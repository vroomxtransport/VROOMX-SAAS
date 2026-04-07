import { randomUUID } from 'crypto'
import type {
  QBCustomer,
  QBInvoice,
  QBPayment,
  QBPurchase,
  QBVendor,
  QBAccount,
  QBError,
  QBErrorDetail,
  QBTokenResponse,
} from './types'
import { refreshAccessToken } from './oauth'
import { validateQbDisplayName, escapeQbStringLiteral } from './qbql'

// ============================================================================
// QuickBooks API Client
// ============================================================================

const QB_PRODUCTION_BASE = 'https://quickbooks.api.intuit.com/v3/company'
const QB_SANDBOX_BASE = 'https://sandbox-quickbooks.api.intuit.com/v3/company'

export class QuickBooksApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: QBErrorDetail[] = [],
    public readonly code?: string
  ) {
    super(message)
    this.name = 'QuickBooksApiError'
  }
}

interface QuickBooksClientOptions {
  sandbox?: boolean
  refreshToken?: string
  onTokenRefresh?: (tokens: QBTokenResponse) => Promise<void>
}

/**
 * Production-grade QuickBooks Online API v3 client.
 *
 * Features:
 * - Bearer token auth with auto-refresh on 401
 * - CRITICAL: Persists rotated refresh tokens immediately via onTokenRefresh
 * - Exponential backoff on 429 (rate limit: 500 req/min)
 * - Max 3 retries
 * - RequestID on all POST requests for idempotency
 * - Parses QB Fault.Error[] error format
 */
export class QuickBooksClient {
  private baseUrl: string
  private currentAccessToken: string
  private currentRefreshToken: string | undefined
  private maxRetries = 3
  private onTokenRefresh: ((tokens: QBTokenResponse) => Promise<void>) | undefined

  constructor(
    private readonly realmId: string,
    accessToken: string,
    opts?: QuickBooksClientOptions
  ) {
    this.baseUrl = opts?.sandbox ? QB_SANDBOX_BASE : QB_PRODUCTION_BASE
    this.currentAccessToken = accessToken
    this.currentRefreshToken = opts?.refreshToken
    this.onTokenRefresh = opts?.onTokenRefresh
  }

  // --------------------------------------------------------------------------
  // Core HTTP
  // --------------------------------------------------------------------------

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    query?: Record<string, string>
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const url = this.buildUrl(path, method, query)
        const headers: Record<string, string> = {
          Authorization: `Bearer ${this.currentAccessToken}`,
          Accept: 'application/json',
        }
        if (body) {
          headers['Content-Type'] = 'application/json'
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        })

        // 401 — try token refresh once
        if (response.status === 401 && attempt === 0 && this.currentRefreshToken) {
          const refreshed = await this.tryTokenRefresh()
          if (refreshed) {
            continue // retry with new token
          }
          throw new QuickBooksApiError('Token refresh failed', 401)
        }

        // 429 — rate limited, exponential backoff
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const waitMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : this.getBackoffMs(attempt)
          await this.sleep(waitMs)
          continue
        }

        // 5xx — server error, retry with backoff
        if (response.status >= 500) {
          if (attempt < this.maxRetries) {
            await this.sleep(this.getBackoffMs(attempt))
            continue
          }
          throw new QuickBooksApiError(
            `QuickBooks server error: ${response.status}`,
            response.status
          )
        }

        // Parse response
        const responseText = await response.text()
        let data: Record<string, unknown>
        try {
          data = JSON.parse(responseText) as Record<string, unknown>
        } catch {
          throw new QuickBooksApiError(
            `Invalid JSON response from QuickBooks`,
            response.status
          )
        }

        // Check for QB Fault error format
        if (!response.ok || 'Fault' in data) {
          const fault = data as unknown as QBError
          const errors = fault?.Fault?.Error ?? []
          const message = errors.length > 0
            ? errors.map((e) => `${e.Message}: ${e.Detail}`).join('; ')
            : `QuickBooks API error: ${response.status}`
          throw new QuickBooksApiError(
            message,
            response.status,
            errors,
            errors[0]?.code
          )
        }

        return data as T
      } catch (error) {
        if (error instanceof QuickBooksApiError) {
          throw error
        }
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < this.maxRetries) {
          await this.sleep(this.getBackoffMs(attempt))
        }
      }
    }

    throw lastError ?? new Error('QuickBooks request failed after retries')
  }

  // --------------------------------------------------------------------------
  // Customers
  // --------------------------------------------------------------------------

  async createCustomer(data: Partial<QBCustomer>): Promise<QBCustomer> {
    const response = await this.request<{ Customer: QBCustomer }>(
      'POST',
      'customer',
      data
    )
    return response.Customer
  }

  async updateCustomer(
    data: Partial<QBCustomer> & { Id: string; SyncToken: string }
  ): Promise<QBCustomer> {
    const response = await this.request<{ Customer: QBCustomer }>(
      'POST',
      'customer',
      data
    )
    return response.Customer
  }

  async getCustomer(id: string): Promise<QBCustomer> {
    const response = await this.request<{ Customer: QBCustomer }>(
      'GET',
      `customer/${id}`
    )
    return response.Customer
  }

  /**
   * Find a QB Customer by display name.
   *
   * SECURITY: displayName is validated against a strict whitelist via
   * validateQbDisplayName(). The returned safe value is then run through
   * escapeQbStringLiteral() to escape apostrophes for QBQL string literal
   * interpolation. The whitelist guarantees no escape-sensitive characters
   * other than `'` survive, so the escape is safe.
   */
  async findCustomerByName(displayName: string): Promise<QBCustomer | null> {
    const safeName = validateQbDisplayName(displayName)
    const escaped = escapeQbStringLiteral(safeName)
    const results = await this.query<QBCustomer>(
      `SELECT * FROM Customer WHERE DisplayName = '${escaped}'`
    )
    return results.length > 0 ? results[0] : null
  }

  // --------------------------------------------------------------------------
  // Invoices
  // --------------------------------------------------------------------------

  async createInvoice(data: Partial<QBInvoice>): Promise<QBInvoice> {
    const response = await this.request<{ Invoice: QBInvoice }>(
      'POST',
      'invoice',
      data
    )
    return response.Invoice
  }

  async getInvoice(id: string): Promise<QBInvoice> {
    const response = await this.request<{ Invoice: QBInvoice }>(
      'GET',
      `invoice/${id}`
    )
    return response.Invoice
  }

  async voidInvoice(id: string, syncToken: string): Promise<void> {
    await this.request<{ Invoice: QBInvoice }>(
      'POST',
      'invoice',
      { Id: id, SyncToken: syncToken },
      { operation: 'void' }
    )
  }

  // --------------------------------------------------------------------------
  // Payments
  // --------------------------------------------------------------------------

  async createPayment(data: Partial<QBPayment>): Promise<QBPayment> {
    const response = await this.request<{ Payment: QBPayment }>(
      'POST',
      'payment',
      data
    )
    return response.Payment
  }

  // --------------------------------------------------------------------------
  // Purchases (Expenses)
  // --------------------------------------------------------------------------

  async createPurchase(data: Partial<QBPurchase>): Promise<QBPurchase> {
    const response = await this.request<{ Purchase: QBPurchase }>(
      'POST',
      'purchase',
      data
    )
    return response.Purchase
  }

  // --------------------------------------------------------------------------
  // Vendors
  // --------------------------------------------------------------------------

  async createVendor(data: Partial<QBVendor>): Promise<QBVendor> {
    const response = await this.request<{ Vendor: QBVendor }>(
      'POST',
      'vendor',
      data
    )
    return response.Vendor
  }

  /**
   * Find a QB Vendor by display name.
   *
   * SECURITY: same model as findCustomerByName — strict whitelist, then
   * escape apostrophes for QBQL string-literal interpolation.
   */
  async findVendorByName(displayName: string): Promise<QBVendor | null> {
    const safeName = validateQbDisplayName(displayName)
    const escaped = escapeQbStringLiteral(safeName)
    const results = await this.query<QBVendor>(
      `SELECT * FROM Vendor WHERE DisplayName = '${escaped}'`
    )
    return results.length > 0 ? results[0] : null
  }

  // --------------------------------------------------------------------------
  // Accounts (Chart of Accounts)
  // --------------------------------------------------------------------------

  async getAccounts(): Promise<QBAccount[]> {
    return this.query<QBAccount>('SELECT * FROM Account MAXRESULTS 1000')
  }

  // --------------------------------------------------------------------------
  // Generic Query
  // --------------------------------------------------------------------------

  async query<T>(sql: string): Promise<T[]> {
    const response = await this.request<{
      QueryResponse: Record<string, unknown>
    }>('GET', 'query', undefined, { query: sql })

    const qr = response.QueryResponse
    // QB returns entities under their type name key (Customer, Invoice, etc.)
    // Find the first array value in the response
    for (const key of Object.keys(qr)) {
      if (Array.isArray(qr[key])) {
        return qr[key] as T[]
      }
    }
    return []
  }

  // --------------------------------------------------------------------------
  // Token Refresh
  // --------------------------------------------------------------------------

  /**
   * Attempt to refresh the access token.
   * CRITICAL: QuickBooks rotates refresh tokens on every refresh call.
   * The new refresh token MUST be persisted immediately or the integration
   * will become permanently disconnected.
   */
  private async tryTokenRefresh(): Promise<boolean> {
    if (!this.currentRefreshToken) return false

    try {
      const tokens = await refreshAccessToken(this.currentRefreshToken)
      this.currentAccessToken = tokens.access_token
      this.currentRefreshToken = tokens.refresh_token

      // Persist new tokens immediately — QB rotates refresh tokens
      if (this.onTokenRefresh) {
        await this.onTokenRefresh(tokens)
      }

      return true
    } catch {
      return false
    }
  }

  // --------------------------------------------------------------------------
  // URL Builder
  // --------------------------------------------------------------------------

  private buildUrl(
    path: string,
    method: 'GET' | 'POST',
    query?: Record<string, string>
  ): string {
    const base = `${this.baseUrl}/${this.realmId}/${path}`
    const params = new URLSearchParams(query)

    // Add RequestID for POST idempotency
    if (method === 'POST') {
      params.set('requestid', randomUUID())
    }

    // QB API requires minorversion for consistent behavior
    params.set('minorversion', '73')

    const qs = params.toString()
    return qs ? `${base}?${qs}` : base
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private getBackoffMs(attempt: number): number {
    const baseMs = Math.pow(2, attempt) * 1000
    const jitter = Math.random() * 500
    return baseMs + jitter
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
