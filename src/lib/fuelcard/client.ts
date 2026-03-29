import type {
  FuelTransaction,
  FuelCard,
  FuelCardAccountInfo,
  FuelCardApiErrorBody,
} from './types'

// ============================================================================
// Multi Service Fuel Card API Client
// ============================================================================

export class FuelCardApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'FuelCardApiError'
  }
}

/**
 * Multi Service Fuel Card API client.
 *
 * Features:
 * - API key auth via Authorization: Bearer header
 * - Exponential backoff retry on 429 / 5xx (max 3 retries)
 * - Typed responses for transactions, cards, and account info
 * - Pagination support for large transaction sets
 */
export class FuelCardClient {
  private baseUrl = 'https://api.fleet.msfuelcard.com'
  private maxRetries = 3

  constructor(
    private apiKey: string,
    private accountNumber?: string
  ) {}

  // --------------------------------------------------------------------------
  // Core HTTP
  // --------------------------------------------------------------------------

  private async request<T>(
    path: string,
    opts?: RequestInit & { query?: Record<string, string> }
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const params = new URLSearchParams(opts?.query)
        if (this.accountNumber) {
          params.set('accountNumber', this.accountNumber)
        }
        const queryString = params.toString()
        const url = queryString
          ? `${this.baseUrl}${path}?${queryString}`
          : `${this.baseUrl}${path}`

        const response = await fetch(url, {
          ...opts,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...opts?.headers,
          },
        })

        // 429 — rate limited, use Retry-After or exponential backoff
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const waitMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : this.getBackoffMs(attempt)
          await this.sleep(waitMs)
          continue
        }

        // 5xx — server error, retry with exponential backoff
        if (response.status >= 500) {
          if (attempt < this.maxRetries) {
            await this.sleep(this.getBackoffMs(attempt))
            continue
          }
          throw new FuelCardApiError(
            `Fuel card API server error: ${response.status}`,
            response.status
          )
        }

        // Other errors — do not retry
        if (!response.ok) {
          const errorBody = await response.text().catch(() => 'Unknown error')
          let parsed: FuelCardApiErrorBody | undefined
          try {
            parsed = JSON.parse(errorBody) as FuelCardApiErrorBody
          } catch {
            // not JSON — use raw text
          }
          throw new FuelCardApiError(
            parsed?.message ?? `Fuel card API error: ${response.status} ${errorBody}`,
            response.status,
            parsed?.code
          )
        }

        return (await response.json()) as T
      } catch (error) {
        if (error instanceof FuelCardApiError) {
          throw error
        }
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < this.maxRetries) {
          await this.sleep(this.getBackoffMs(attempt))
        }
      }
    }

    throw lastError ?? new Error('Fuel card request failed after retries')
  }

  // --------------------------------------------------------------------------
  // Transactions
  // --------------------------------------------------------------------------

  /**
   * Fetch fuel card transactions for a date range.
   * Handles pagination automatically — returns all pages concatenated.
   */
  async getTransactions(
    startDate: string,
    endDate: string
  ): Promise<FuelTransaction[]> {
    const allTransactions: FuelTransaction[] = []
    let page = 1
    const maxPages = 50 // safety limit

    while (page <= maxPages) {
      const response = await this.request<{
        transactions: FuelTransaction[]
        pagination?: { hasMore: boolean; nextPage?: number }
      }>('/v1/transactions', {
        query: {
          startDate,
          endDate,
          page: String(page),
          limit: '500',
        },
      })

      allTransactions.push(...response.transactions)

      if (!response.pagination?.hasMore) {
        break
      }
      page = response.pagination.nextPage ?? page + 1
    }

    return allTransactions
  }

  // --------------------------------------------------------------------------
  // Cards
  // --------------------------------------------------------------------------

  /**
   * Get all fuel cards on the account.
   */
  async getCards(): Promise<FuelCard[]> {
    const response = await this.request<{ cards: FuelCard[] }>('/v1/cards')
    return response.cards
  }

  // --------------------------------------------------------------------------
  // Account
  // --------------------------------------------------------------------------

  /**
   * Get account info. Also used for connection testing.
   */
  async getAccountInfo(): Promise<FuelCardAccountInfo> {
    const response = await this.request<{ account: FuelCardAccountInfo }>(
      '/v1/account'
    )
    return response.account
  }

  /**
   * Test the API connection by attempting to fetch account info.
   * Returns true if the key is valid, false otherwise.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getAccountInfo()
      return true
    } catch {
      return false
    }
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private getBackoffMs(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s + jitter
    const baseMs = Math.pow(2, attempt) * 1000
    const jitter = Math.random() * 500
    return baseMs + jitter
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
