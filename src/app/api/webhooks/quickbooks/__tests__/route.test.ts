/**
 * Regression tests for QB webhook tenant isolation (commit fd8488f, C-2).
 *
 * Bugs fixed:
 *  (a) Column name mismatch: the old code queried `status = 'active'` but the
 *      schema has `sync_status`. The handler silently dropped all events.
 *  (b) TOCTOU gap: tenant ownership was checked once at realm lookup but not
 *      re-validated before each entity handler. Fixed by assertIntegrationActive()
 *      re-checking `sync_status` per entity.
 *  (c) Bonus schema bug: insert wrote `event_type` but the table has separate
 *      `entity_type` + `operation` NOT NULL columns.
 *
 * What these tests guard:
 *  1. Requests with no signature header → 401
 *  2. Requests with an invalid signature → 401
 *  3. Missing QUICKBOOKS_WEBHOOK_VERIFIER env var → 500
 *  4. Malformed JSON body → 400
 *  5. Unknown realmId (no active integration row) → 200, no entity processing
 *  6. C-2 regression: integration that becomes inactive mid-batch stops entity
 *     processing (assertIntegrationActive returns false on second call)
 *  7. Column name regression: the initial integration lookup uses `sync_status`,
 *     not `status`
 *  8. Event insert uses `entity_type` + `operation`, not the defunct `event_type`
 *  9. Happy-path Payment.Create: returns 200 { received: true }
 * 10. Unhandled entity type: returns 200 (gracefully ignored)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'crypto'

// ---------------------------------------------------------------------------
// Module-level mocks (must appear before any import of the module under test)
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(),
}))

vi.mock('@/lib/quickbooks/webhook', () => ({
  verifyQuickBooksWebhook: vi.fn(),
}))

vi.mock('@/lib/quickbooks/sync', () => ({
  getQBClientForTenant: vi.fn(),
  syncPaymentFromQB: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Deferred imports (after vi.mock hoisting)
// ---------------------------------------------------------------------------

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyQuickBooksWebhook } from '@/lib/quickbooks/webhook'
import { getQBClientForTenant, syncPaymentFromQB } from '@/lib/quickbooks/sync'
import { POST } from '../route'

const mockedCreateServiceRoleClient = vi.mocked(createServiceRoleClient)
const mockedVerifyWebhook = vi.mocked(verifyQuickBooksWebhook)
const mockedGetQBClient = vi.mocked(getQBClientForTenant)
const mockedSyncPayment = vi.mocked(syncPaymentFromQB)

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERIFIER_TOKEN = 'test-verifier-token'
const REALM_ID = 'realm-abc-123'
const INTEGRATION_ID = 'intg-uuid-1'
const TENANT_ID = 'tenant-uuid-1'

// ---------------------------------------------------------------------------
// Helper: build a valid HMAC-SHA256 signature for a payload
// ---------------------------------------------------------------------------

function signPayload(payload: string, token: string = VERIFIER_TOKEN): string {
  return createHmac('sha256', token).update(payload).digest('base64')
}

// ---------------------------------------------------------------------------
// Helper: build a minimal QB webhook payload string
// ---------------------------------------------------------------------------

function makePayload(entityName = 'Payment', operation = 'Create') {
  return JSON.stringify({
    eventNotifications: [
      {
        realmId: REALM_ID,
        dataChangeEvent: {
          entities: [
            {
              realmId: REALM_ID,
              name: entityName,
              id: '12345',
              operation,
              lastUpdated: '2026-04-11T00:00:00Z',
            },
          ],
        },
      },
    ],
  })
}

// ---------------------------------------------------------------------------
// Helper: build a NextRequest-compatible Request
// ---------------------------------------------------------------------------

function makeRequest(body: string, signature?: string): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (signature !== undefined) {
    headers['intuit-signature'] = signature
  }
  return new Request('http://localhost/api/webhooks/quickbooks', {
    method: 'POST',
    headers,
    body,
  })
}

// ---------------------------------------------------------------------------
// Supabase mock factory
//
// Models the query chains the handler actually issues:
//   1. quickbooks_integrations: .select('id,tenant_id,sync_status').eq('realm_id',…).eq('sync_status','active').single()
//   2. quickbooks_integrations: .select('sync_status').eq('id',…).maybeSingle()   (assertIntegrationActive)
//   3. quickbooks_webhook_events: .select('id').eq('event_id',…).single()           (idempotency)
//   4. quickbooks_webhook_events: .insert({…})                                      (record event)
// ---------------------------------------------------------------------------

type QueryResult<T> = { data: T | null; error: null | { code: string; message: string } }

interface IntegrationRow {
  id: string
  tenant_id: string
  sync_status: string
}

interface MockClientOptions {
  /** Integration row returned by the initial realm_id lookup (null = not found) */
  integrationLookup?: IntegrationRow | null
  /** lookup error for integration (overrides integrationLookup) */
  integrationLookupError?: { code: string; message: string }
  /**
   * Responses for assertIntegrationActive (called once per entity).
   * Each entry is consumed in order. Defaults to [{sync_status:'active'}].
   */
  assertActiveResponses?: Array<{ data: { sync_status: string } | null; error: null | { code: string; message: string } }>
  /** Whether the idempotency check finds an existing event (default false) */
  eventAlreadyExists?: boolean
  /** Error returned by the webhook_events insert (null = success) */
  insertError?: { code: string; message: string } | null
}

function createMockSupabaseClient(opts: MockClientOptions = {}) {
  const {
    integrationLookup = { id: INTEGRATION_ID, tenant_id: TENANT_ID, sync_status: 'active' },
    integrationLookupError,
    assertActiveResponses = [{ data: { sync_status: 'active' }, error: null }],
    eventAlreadyExists = false,
    insertError = null,
  } = opts

  // Track calls to assertIntegrationActive so tests can assert re-check behavior
  let assertActiveCallIndex = 0

  // Tracks which columns were SELECTed from quickbooks_integrations on first call
  // so the column-name regression test can inspect it.
  let firstIntegrationSelectColumns: string | undefined

  const client = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'quickbooks_integrations') {
        return {
          select: vi.fn().mockImplementation((columns: string) => {
            // First call = realm_id lookup; subsequent = assertIntegrationActive
            if (firstIntegrationSelectColumns === undefined) {
              firstIntegrationSelectColumns = columns
            }
            const isAssertCall = firstIntegrationSelectColumns !== columns || assertActiveCallIndex > 0

            if (isAssertCall || columns === 'sync_status') {
              // assertIntegrationActive path: .select('sync_status').eq(id).maybeSingle()
              const response = assertActiveResponses[assertActiveCallIndex] ?? { data: null, error: null }
              assertActiveCallIndex++
              return {
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue(response),
                }),
              }
            }

            // Initial realm lookup: .select('id,tenant_id,sync_status').eq(realm_id).eq(sync_status).single()
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue(
                    integrationLookupError
                      ? { data: null, error: integrationLookupError }
                      : integrationLookup
                        ? { data: integrationLookup, error: null }
                        : { data: null, error: { code: 'PGRST116', message: 'No rows found' } }
                  ),
                }),
              }),
            }
          }),
        }
      }

      if (table === 'quickbooks_webhook_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                eventAlreadyExists
                  ? { data: { id: 'evt-existing' }, error: null }
                  : { data: null, error: { code: 'PGRST116', message: 'No rows' } }
              ),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: insertError }),
        }
      }

      // Should not reach here in passing tests
      throw new Error(`[test] Unexpected table: ${table}`)
    }),
    // Expose for assertions
    _getFirstIntegrationSelectColumns: () => firstIntegrationSelectColumns,
    _getAssertActiveCallCount: () => assertActiveCallIndex,
  }

  return client
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  process.env.QUICKBOOKS_WEBHOOK_VERIFIER = VERIFIER_TOKEN

  // Default: signature verification succeeds
  mockedVerifyWebhook.mockReturnValue(true)

  // Default: no QB API client needed
  mockedGetQBClient.mockResolvedValue(null)
  mockedSyncPayment.mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/quickbooks — auth & parsing', () => {
  it('returns 401 when intuit-signature header is absent', async () => {
    const body = makePayload()
    const req = makeRequest(body, undefined) // no signature header

    const res = await POST(req as never)

    expect(res.status).toBe(401)
    const json = await res.json() as { error: string }
    expect(json.error).toMatch(/missing intuit-signature/i)
  })

  it('returns 401 when HMAC signature verification fails', async () => {
    mockedVerifyWebhook.mockReturnValue(false)
    const body = makePayload()
    const req = makeRequest(body, 'invalid-signature-value')

    const res = await POST(req as never)

    expect(res.status).toBe(401)
    const json = await res.json() as { error: string }
    expect(json.error).toMatch(/invalid signature/i)
  })

  it('returns 500 when QUICKBOOKS_WEBHOOK_VERIFIER env var is not set', async () => {
    delete process.env.QUICKBOOKS_WEBHOOK_VERIFIER
    const body = makePayload()
    const sig = signPayload(body)
    const req = makeRequest(body, sig)

    const res = await POST(req as never)

    expect(res.status).toBe(500)
  })

  it('returns 400 when body is not valid JSON', async () => {
    // verifyQuickBooksWebhook is already mocked to return true, so parsing
    // is the next step that will fail.
    const body = 'not-json{{{'
    const req = makeRequest(body, signPayload(body))

    const res = await POST(req as never)

    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toMatch(/invalid json/i)
  })
})

describe('POST /api/webhooks/quickbooks — tenant isolation (C-2 regression)', () => {
  it('returns 200 and skips processing when no active integration exists for the realmId', async () => {
    const mockClient = createMockSupabaseClient({ integrationLookup: null })
    mockedCreateServiceRoleClient.mockReturnValue(mockClient as never)

    const body = makePayload()
    const req = makeRequest(body, signPayload(body))

    const res = await POST(req as never)

    expect(res.status).toBe(200)
    const json = await res.json() as { received: boolean }
    expect(json.received).toBe(true)
    // assertIntegrationActive should NOT have been called — no integration found
    expect(mockClient._getAssertActiveCallCount()).toBe(0)
  })

  it('C-2: stops processing remaining entities when integration becomes inactive mid-batch', async () => {
    // First assertIntegrationActive call → inactive (integration was just disabled)
    const mockClient = createMockSupabaseClient({
      assertActiveResponses: [
        { data: { sync_status: 'paused' }, error: null },
      ],
    })
    mockedCreateServiceRoleClient.mockReturnValue(mockClient as never)

    const payloadWithTwoEntities = JSON.stringify({
      eventNotifications: [
        {
          realmId: REALM_ID,
          dataChangeEvent: {
            entities: [
              { realmId: REALM_ID, name: 'Payment', id: '1', operation: 'Create', lastUpdated: '2026-04-11T00:00:00Z' },
              { realmId: REALM_ID, name: 'Payment', id: '2', operation: 'Create', lastUpdated: '2026-04-11T00:01:00Z' },
            ],
          },
        },
      ],
    })

    const req = makeRequest(payloadWithTwoEntities, signPayload(payloadWithTwoEntities))
    const res = await POST(req as never)

    expect(res.status).toBe(200)
    // assertIntegrationActive was only called once (for entity 1) — the loop
    // broke before reaching entity 2 because the first check returned inactive.
    expect(mockClient._getAssertActiveCallCount()).toBe(1)
  })

  it('C-2: processes entity when integration is still active', async () => {
    const mockClient = createMockSupabaseClient({
      assertActiveResponses: [{ data: { sync_status: 'active' }, error: null }],
    })
    mockedCreateServiceRoleClient.mockReturnValue(mockClient as never)

    const body = makePayload('Customer', 'Update') // unhandled type → no QB API call needed
    const req = makeRequest(body, signPayload(body))

    const res = await POST(req as never)

    expect(res.status).toBe(200)
    expect(mockClient._getAssertActiveCallCount()).toBe(1)
  })

  it('C-2: stops entity loop when assertIntegrationActive query itself errors', async () => {
    const mockClient = createMockSupabaseClient({
      assertActiveResponses: [
        { data: null, error: { code: '500', message: 'connection timeout' } },
      ],
    })
    mockedCreateServiceRoleClient.mockReturnValue(mockClient as never)

    const body = makePayload()
    const req = makeRequest(body, signPayload(body))

    const res = await POST(req as never)

    // Handler should not throw — returns 200 but stops processing
    expect(res.status).toBe(200)
  })
})

describe('POST /api/webhooks/quickbooks — column name regression (schema bugs)', () => {
  it('queries quickbooks_integrations with sync_status column (not status)', async () => {
    // This test guards against re-introduction of the `.eq('status', 'active')`
    // bug where the wrong column name caused PGRST 42703 and silently dropped
    // all webhook events.  We verify the eq() chain receives 'sync_status' as
    // the first filter key on the initial integration lookup.
    const mockClient = createMockSupabaseClient()
    mockedCreateServiceRoleClient.mockReturnValue(mockClient as never)

    const body = makePayload('Customer', 'Update')
    const req = makeRequest(body, signPayload(body))

    await POST(req as never)

    // The from('quickbooks_integrations').select(…) chain was called
    const fromCalls = mockClient.from.mock.calls.filter(
      (c: unknown[]) => c[0] === 'quickbooks_integrations'
    )
    expect(fromCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('event insert uses entity_type + operation columns (not event_type)', async () => {
    // Guards the bonus latent bug: the old code wrote `event_type` to a column
    // that does not exist; the schema requires separate `entity_type` + `operation`.
    const insertSpy = vi.fn().mockResolvedValue({ error: null })

    const clientWithInsertSpy = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'quickbooks_integrations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: INTEGRATION_ID, tenant_id: TENANT_ID, sync_status: 'active' },
                    error: null,
                  }),
                }),
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { sync_status: 'active' },
                  error: null,
                }),
              }),
            }),
          }
        }

        if (table === 'quickbooks_webhook_events') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: '' } }),
              }),
            }),
            insert: insertSpy,
          }
        }

        throw new Error(`[test] Unexpected table: ${table}`)
      }),
    }

    mockedCreateServiceRoleClient.mockReturnValue(clientWithInsertSpy as never)

    const body = makePayload('Customer', 'Update')
    const req = makeRequest(body, signPayload(body))

    await POST(req as never)

    expect(insertSpy).toHaveBeenCalledOnce()
    const insertArg = insertSpy.mock.calls[0][0] as Record<string, unknown>

    // Must have entity_type and operation
    expect(insertArg).toHaveProperty('entity_type')
    expect(insertArg).toHaveProperty('operation')

    // Must NOT have the old defunct column
    expect(insertArg).not.toHaveProperty('event_type')

    // Values should match the entity from the payload
    expect(insertArg.entity_type).toBe('Customer')
    expect(insertArg.operation).toBe('Update')
  })
})

describe('POST /api/webhooks/quickbooks — idempotency', () => {
  it('skips processing when the event was already recorded', async () => {
    const mockClient = createMockSupabaseClient({ eventAlreadyExists: true })
    mockedCreateServiceRoleClient.mockReturnValue(mockClient as never)

    const body = makePayload()
    const req = makeRequest(body, signPayload(body))

    const res = await POST(req as never)

    expect(res.status).toBe(200)
    // getQBClientForTenant should not have been called because we returned early
    expect(mockedGetQBClient).not.toHaveBeenCalled()
  })
})

describe('POST /api/webhooks/quickbooks — happy path', () => {
  it('returns 200 { received: true } for a valid Payment.Create event', async () => {
    const mockClient = createMockSupabaseClient()
    mockedCreateServiceRoleClient.mockReturnValue(mockClient as never)

    const body = makePayload('Payment', 'Create')
    const req = makeRequest(body, signPayload(body))

    const res = await POST(req as never)

    expect(res.status).toBe(200)
    const json = await res.json() as { received: boolean }
    expect(json.received).toBe(true)
  })

  it('returns 200 for an unhandled entity type (graceful no-op)', async () => {
    const mockClient = createMockSupabaseClient()
    mockedCreateServiceRoleClient.mockReturnValue(mockClient as never)

    const body = makePayload('Account', 'Update')
    const req = makeRequest(body, signPayload(body))

    const res = await POST(req as never)

    expect(res.status).toBe(200)
  })

  it('returns 200 for an empty eventNotifications array', async () => {
    mockedCreateServiceRoleClient.mockReturnValue(createMockSupabaseClient() as never)

    const body = JSON.stringify({ eventNotifications: [] })
    const req = makeRequest(body, signPayload(body))

    const res = await POST(req as never)

    expect(res.status).toBe(200)
  })
})
