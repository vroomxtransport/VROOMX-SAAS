import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/authz', () => ({
  authorize: vi.fn(),
  safeError: vi.fn((_err: unknown, _ctx: string) => 'An unexpected error occurred. Please try again.'),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/cache', () => ({
  cacheInvalidate: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/storage', () => ({
  deleteFile: vi.fn().mockResolvedValue({ error: null }),
}))

import { authorize } from '@/lib/authz'
import { revalidatePath } from 'next/cache'
import { cacheInvalidate } from '@/lib/cache'
import { deleteFile } from '@/lib/storage'
import {
  createComplianceDoc,
  updateComplianceDoc,
  deleteComplianceDoc,
  updateComplianceDocFields,
  seedComplianceRequirements,
  createCustomFolder,
  deleteCustomFolder,
} from '../compliance'

const mockedAuthorize = vi.mocked(authorize)
const mockedRevalidate = vi.mocked(revalidatePath)
const mockedCacheInvalidate = vi.mocked(cacheInvalidate)
const mockedDeleteFile = vi.mocked(deleteFile)

// ---------------------------------------------------------------------------
// Mock Supabase client factory
// ---------------------------------------------------------------------------

function createMockSupabaseClient(overrides: {
  insertResult?: { data: unknown; error: unknown }
  updateResult?: { data: unknown; error: unknown }
  deleteResult?: { error: unknown }
  selectResult?: { data: unknown; error: unknown }
  upsertResult?: { error: unknown }
} = {}) {
  const insertResult = overrides.insertResult ?? {
    data: { id: 'doc-1', name: 'CDL Certificate', document_type: 'dqf' },
    error: null,
  }
  const updateResult = overrides.updateResult ?? {
    data: { id: 'doc-1', name: 'CDL Certificate Updated', document_type: 'dqf' },
    error: null,
  }
  const deleteResult = overrides.deleteResult ?? { error: null }
  const selectResult = overrides.selectResult ?? {
    data: { storage_path: 'tenant-1/compliance/test-file.pdf' },
    error: null,
  }
  const upsertResult = overrides.upsertResult ?? { error: null }

  const client = {
    from: vi.fn().mockImplementation(() => ({
      // insert chain: .insert({}).select().single()
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(insertResult),
        }),
        // For upsert-style inserts that don't chain .select()
        then: (resolve: (value: { error: unknown }) => void) =>
          resolve({ error: insertResult.error }),
      }),
      // update chain: .update({}).eq(...).eq(...).select().single()
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(updateResult),
            }),
          }),
        }),
      }),
      // select chain: .select(...).eq(...).eq(...).single()
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(selectResult),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { sort_order: 21 }, error: null }),
              }),
            }),
          }),
        }),
      }),
      // delete chain: supports 2-eq (deleteComplianceDoc) and 3-eq (deleteCustomFolder)
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation(() => {
            const thirdLevel = { eq: vi.fn().mockResolvedValue(deleteResult) }
            // Also make this level thenable so 2-eq chains resolve correctly
            return Object.assign(
              Promise.resolve(deleteResult),
              thirdLevel,
            )
          }),
        }),
      }),
      // upsert chain
      upsert: vi.fn().mockResolvedValue(upsertResult),
    })),
  }
  return client
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function validComplianceDocInput() {
  return {
    documentType: 'dqf' as const,
    entityType: 'driver' as const,
    entityId: 'driver-1',
    name: 'CDL Certificate',
    expiresAt: '2027-06-15',
    issueDate: '2025-06-15',
    notes: 'Class A CDL',
    fileName: 'cdl.pdf',
    storagePath: 'tenant-1/compliance/cdl.pdf',
    fileSize: 204800,
  }
}

function mockAuthSuccess(supabaseClient: ReturnType<typeof createMockSupabaseClient>) {
  mockedAuthorize.mockResolvedValue({
    ok: true,
    ctx: {
      supabase: supabaseClient as never,
      tenantId: 'tenant-1',
      user: { id: 'user-1', email: 'test@example.com' },
      role: 'admin',
      permissions: ['*'],
    },
  })
}

function mockAuthFailure() {
  mockedAuthorize.mockResolvedValue({
    ok: false,
    error: 'Not authenticated',
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ===========================================================================
// createComplianceDoc
// ===========================================================================

describe('createComplianceDoc', () => {
  it('returns field errors for invalid input (missing name)', async () => {
    const result = await createComplianceDoc({
      documentType: 'dqf',
      entityType: 'driver',
      name: '', // required
    })

    expect(result).toHaveProperty('error')
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns field errors for invalid documentType', async () => {
    const result = await createComplianceDoc({
      ...validComplianceDocInput(),
      documentType: 'invalid_type',
    })

    expect(result).toHaveProperty('error')
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns field errors for invalid entityType', async () => {
    const result = await createComplianceDoc({
      ...validComplianceDocInput(),
      entityType: 'invalid_entity',
    })

    expect(result).toHaveProperty('error')
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await createComplianceDoc(validComplianceDocInput())

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('calls authorize with compliance.create permission and rate limit', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await createComplianceDoc(validComplianceDocInput())

    expect(mockedAuthorize).toHaveBeenCalledWith('compliance.create', expect.objectContaining({
      rateLimit: expect.objectContaining({ key: 'createComplianceDoc' }),
    }))
  })

  it('returns success with valid input', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await createComplianceDoc(validComplianceDocInput())

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ id: 'doc-1', name: 'CDL Certificate' }),
    })
  })

  it('includes tenant_id in the insert payload', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await createComplianceDoc(validComplianceDocInput())

    expect(mockClient.from).toHaveBeenCalledWith('compliance_documents')
    const insertFn = mockClient.from.mock.results[0].value.insert
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 'tenant-1' }),
    )
  })

  it('sets uploaded_by to current user id', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await createComplianceDoc(validComplianceDocInput())

    const insertFn = mockClient.from.mock.results[0].value.insert
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ uploaded_by: 'user-1' }),
    )
  })

  it('returns error when insert fails', async () => {
    const mockClient = createMockSupabaseClient({
      insertResult: { data: null, error: { message: 'DB insert failed' } },
    })
    mockAuthSuccess(mockClient)

    const result = await createComplianceDoc(validComplianceDocInput())

    expect(result).toEqual({ error: 'An unexpected error occurred. Please try again.' })
  })

  it('revalidates /compliance path on success', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await createComplianceDoc(validComplianceDocInput())

    expect(mockedRevalidate).toHaveBeenCalledWith('/compliance')
  })

  it('calls cacheInvalidate for compliance-overview on success', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await createComplianceDoc(validComplianceDocInput())

    expect(mockedCacheInvalidate).toHaveBeenCalledWith('tenant-1', 'compliance-overview')
  })

  it('handles optional fields being omitted', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const minimalInput = {
      documentType: 'dqf' as const,
      entityType: 'driver' as const,
      name: 'Basic Doc',
    }

    const result = await createComplianceDoc(minimalInput)

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ id: 'doc-1' }),
    })
  })
})

// ===========================================================================
// updateComplianceDoc
// ===========================================================================

describe('updateComplianceDoc', () => {
  it('returns field errors for invalid input', async () => {
    const result = await updateComplianceDoc('doc-1', {
      documentType: 'invalid',
      entityType: 'driver',
      name: '',
    })

    expect(result).toHaveProperty('error')
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await updateComplianceDoc('doc-1', validComplianceDocInput())

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('returns success on valid update', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await updateComplianceDoc('doc-1', validComplianceDocInput())

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ id: 'doc-1' }),
    })
  })

  it('calls cacheInvalidate on success', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await updateComplianceDoc('doc-1', validComplianceDocInput())

    expect(mockedCacheInvalidate).toHaveBeenCalledWith('tenant-1', 'compliance-overview')
  })

  it('returns error when update fails', async () => {
    const mockClient = createMockSupabaseClient({
      updateResult: { data: null, error: { message: 'DB update failed' } },
    })
    mockAuthSuccess(mockClient)

    const result = await updateComplianceDoc('doc-1', validComplianceDocInput())

    expect(result).toEqual({ error: 'An unexpected error occurred. Please try again.' })
  })
})

// ===========================================================================
// updateComplianceDocFields
// ===========================================================================

describe('updateComplianceDocFields', () => {
  it('returns field errors for invalid UUID', async () => {
    const result = await updateComplianceDocFields('not-a-uuid', { notes: 'test' })

    expect(result).toHaveProperty('error')
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await updateComplianceDocFields(
      '550e8400-e29b-41d4-a716-446655440000',
      { notes: 'updated' },
    )

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('returns success with valid partial field update', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await updateComplianceDocFields(
      '550e8400-e29b-41d4-a716-446655440000',
      { notes: 'Updated notes', expiresAt: '2028-01-01' },
    )

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ id: 'doc-1' }),
    })
  })

  it('calls cacheInvalidate on success', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await updateComplianceDocFields(
      '550e8400-e29b-41d4-a716-446655440000',
      { notes: 'test' },
    )

    expect(mockedCacheInvalidate).toHaveBeenCalledWith('tenant-1', 'compliance-overview')
  })
})

// ===========================================================================
// deleteComplianceDoc
// ===========================================================================

describe('deleteComplianceDoc', () => {
  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await deleteComplianceDoc('doc-1')

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('returns success on successful deletion', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await deleteComplianceDoc('doc-1')

    expect(result).toEqual({ success: true })
  })

  it('calls deleteFile when doc has a storage_path', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: {
        data: { storage_path: 'tenant-1/compliance/old-file.pdf' },
        error: null,
      },
    })
    mockAuthSuccess(mockClient)

    await deleteComplianceDoc('doc-1')

    expect(mockedDeleteFile).toHaveBeenCalledWith(
      expect.anything(), // supabase client
      'documents',
      'tenant-1/compliance/old-file.pdf',
    )
  })

  it('does not call deleteFile when storage_path is null', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: {
        data: { storage_path: null },
        error: null,
      },
    })
    mockAuthSuccess(mockClient)

    await deleteComplianceDoc('doc-1')

    expect(mockedDeleteFile).not.toHaveBeenCalled()
  })

  it('returns error when document is not found', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: { data: null, error: { message: 'not found' } },
    })
    mockAuthSuccess(mockClient)

    const result = await deleteComplianceDoc('doc-999')

    expect(result).toEqual({ error: 'An unexpected error occurred. Please try again.' })
  })

  it('returns error when delete fails', async () => {
    const mockClient = createMockSupabaseClient({
      deleteResult: { error: { message: 'FK constraint' } },
    })
    mockAuthSuccess(mockClient)

    const result = await deleteComplianceDoc('doc-1')

    expect(result).toEqual({ error: 'An unexpected error occurred. Please try again.' })
  })

  it('revalidates /compliance path on success', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await deleteComplianceDoc('doc-1')

    expect(mockedRevalidate).toHaveBeenCalledWith('/compliance')
  })

  it('calls cacheInvalidate on success', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await deleteComplianceDoc('doc-1')

    expect(mockedCacheInvalidate).toHaveBeenCalledWith('tenant-1', 'compliance-overview')
  })

  it('still deletes DB record even if storage delete fails', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)
    mockedDeleteFile.mockResolvedValue({ error: 'Storage unavailable' })

    const result = await deleteComplianceDoc('doc-1')

    // Should still succeed — storage failure is logged but not fatal
    expect(result).toEqual({ success: true })
  })
})

// ===========================================================================
// seedComplianceRequirements
// ===========================================================================

describe('seedComplianceRequirements', () => {
  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await seedComplianceRequirements()

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('returns success on successful seed', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await seedComplianceRequirements()

    expect(result).toEqual({ success: true })
  })

  it('calls upsert on compliance_requirements table', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await seedComplianceRequirements()

    expect(mockClient.from).toHaveBeenCalledWith('compliance_requirements')
    const fromResult = mockClient.from.mock.results[0].value
    expect(fromResult.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          tenant_id: 'tenant-1',
          document_type: 'dqf',
          sub_category: 'cdl_endorsements',
        }),
      ]),
      expect.objectContaining({ onConflict: 'tenant_id,sub_category,document_type' }),
    )
  })

  it('revalidates /compliance on success', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await seedComplianceRequirements()

    expect(mockedRevalidate).toHaveBeenCalledWith('/compliance')
  })

  it('calls cacheInvalidate on success', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await seedComplianceRequirements()

    expect(mockedCacheInvalidate).toHaveBeenCalledWith('tenant-1', 'compliance-overview')
  })

  it('returns error when upsert fails', async () => {
    const mockClient = createMockSupabaseClient({
      upsertResult: { error: { message: 'upsert failed' } },
    })
    mockAuthSuccess(mockClient)

    const result = await seedComplianceRequirements()

    expect(result).toEqual({ error: 'An unexpected error occurred. Please try again.' })
  })
})

// ===========================================================================
// createCustomFolder
// ===========================================================================

describe('createCustomFolder', () => {
  it('returns field errors for missing label', async () => {
    const result = await createCustomFolder({
      documentType: 'dqf',
      label: '',
    })

    expect(result).toHaveProperty('error')
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns field errors for invalid documentType', async () => {
    const result = await createCustomFolder({
      documentType: 'invalid_type',
      label: 'My Folder',
    })

    expect(result).toHaveProperty('error')
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await createCustomFolder({
      documentType: 'dqf',
      label: 'My Folder',
    })

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('returns success with subCategory on valid input', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await createCustomFolder({
      documentType: 'dqf',
      label: 'My Custom Folder',
    })

    expect(result).toEqual(expect.objectContaining({
      success: true,
      subCategory: expect.stringContaining('custom_'),
    }))
  })
})

// ===========================================================================
// deleteCustomFolder
// ===========================================================================

describe('deleteCustomFolder', () => {
  it('returns error for invalid input', async () => {
    const result = await deleteCustomFolder({})

    expect(result).toEqual({ error: 'Invalid folder' })
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await deleteCustomFolder({
      documentType: 'dqf',
      subCategory: 'custom_my_folder',
    })

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('prevents deleting predefined FMCSA folders', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await deleteCustomFolder({
      documentType: 'dqf',
      subCategory: 'cdl_endorsements', // not prefixed with custom_
    })

    expect(result).toEqual({ error: 'Cannot delete predefined FMCSA folders' })
  })

  it('returns success when deleting a custom folder', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await deleteCustomFolder({
      documentType: 'dqf',
      subCategory: 'custom_my_folder',
    })

    expect(result).toEqual({ success: true })
  })
})
