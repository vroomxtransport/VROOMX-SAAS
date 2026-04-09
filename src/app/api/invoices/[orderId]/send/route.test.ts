import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from('pdf')),
}))

vi.mock('@/lib/authz', () => ({
  authorize: vi.fn(),
}))

vi.mock('@/lib/resend/client', () => ({
  getResend: vi.fn(),
}))

vi.mock('@/lib/storage', () => ({
  getSignedUrl: vi.fn().mockResolvedValue({ url: null }),
}))

vi.mock('@/lib/activity-log', () => ({
  logOrderActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/quickbooks/sync', () => ({
  syncInvoiceToQB: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/notifications/load-events', () => ({
  notifyAssignedTeamForInvoiceSent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/pdf/invoice-template', () => ({
  InvoiceDocument: vi.fn().mockReturnValue(null),
}))

vi.mock('@/components/email/invoice-email', () => ({
  InvoiceEmail: vi.fn().mockReturnValue(null),
}))

import { authorize } from '@/lib/authz'
import { getResend } from '@/lib/resend/client'
import { notifyAssignedTeamForInvoiceSent } from '@/lib/notifications/load-events'
import { POST } from './route'

const mockedAuthorize = vi.mocked(authorize)
const mockedGetResend = vi.mocked(getResend)
const mockedNotifyAssignedTeamForInvoiceSent = vi.mocked(notifyAssignedTeamForInvoiceSent)

function createMockSupabaseClient(overrides?: {
  orderUpdateError?: unknown
}) {
  const orderUpdateError = overrides?.orderUpdateError ?? null

  const order = {
    id: 'order-1',
    status: 'delivered',
    payment_status: 'unpaid',
    invoice_date: null,
    broker: {
      id: 'broker-1',
      email: 'broker@example.com',
      name: 'Broker',
    },
  }

  const tenant = {
    name: 'VroomX',
    address: '123 Main',
    city: 'Miami',
    state: 'FL',
    zip: '33101',
    phone: '555-0100',
    logo_storage_path: null,
    invoice_header_text: null,
    invoice_footer_text: null,
  }

  const ordersSelectChain = {
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: order, error: null }),
  }
  ordersSelectChain.eq.mockReturnValue(ordersSelectChain)

  const tenantSelectChain = {
    single: vi.fn().mockResolvedValue({ data: tenant, error: null }),
  }

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnValue(ordersSelectChain),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: orderUpdateError }),
            }),
          }),
        }
      }

      if (table === 'tenants') {
        return {
          select: vi.fn().mockReturnValue(tenantSelectChain),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

describe('POST /api/invoices/[orderId]/send', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetResend.mockReturnValue({
      emails: {
        send: vi.fn().mockResolvedValue({
          data: { id: 'email-1' },
          error: null,
        }),
      },
    } as never)
  })

  it('sends invoice notifications only after the order update reaches invoiced', async () => {
    const supabase = createMockSupabaseClient()
    mockedAuthorize.mockResolvedValue({
      ok: true,
      ctx: {
        supabase: supabase as never,
        tenantId: 'tenant-1',
        user: { id: 'user-1', email: 'user@example.com' },
      },
    } as never)

    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ orderId: 'order-1' }),
    })

    expect(response.status).toBe(200)
    expect(mockedNotifyAssignedTeamForInvoiceSent).toHaveBeenCalledWith({
      supabase,
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
    }, {
      orderId: 'order-1',
    })
  })

  it('does not send invoice notifications when the order update fails', async () => {
    const supabase = createMockSupabaseClient({
      orderUpdateError: { message: 'update failed' },
    })
    mockedAuthorize.mockResolvedValue({
      ok: true,
      ctx: {
        supabase: supabase as never,
        tenantId: 'tenant-1',
        user: { id: 'user-1', email: 'user@example.com' },
      },
    } as never)

    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ orderId: 'order-1' }),
    })

    expect(response.status).toBe(200)
    expect(mockedNotifyAssignedTeamForInvoiceSent).not.toHaveBeenCalled()
  })
})
