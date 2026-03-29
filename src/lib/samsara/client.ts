import type {
  SamsaraVehicle,
  SamsaraDriver,
  SamsaraLocation,
  SamsaraHOSClock,
  SamsaraSafetyEvent,
  SamsaraPaginatedResponse,
} from './types'

// ============================================================================
// Samsara API Client
// ============================================================================

export class SamsaraApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'SamsaraApiError'
  }
}

/**
 * Professional-grade Samsara API client with:
 * - Bearer token auth
 * - Automatic cursor-based pagination
 * - Exponential backoff retry with 429 Retry-After support
 * - Token refresh on 401
 */
export class SamsaraClient {
  private baseUrl = 'https://api.samsara.com'
  private maxRetries = 3
  private currentToken: string

  constructor(
    accessToken: string,
    private onTokenRefresh?: () => Promise<string | null>
  ) {
    this.currentToken = accessToken
  }

  // --------------------------------------------------------------------------
  // Core HTTP
  // --------------------------------------------------------------------------

  async request<T>(path: string, opts?: RequestInit): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`
        const response = await fetch(url, {
          ...opts,
          headers: {
            Authorization: `Bearer ${this.currentToken}`,
            'Content-Type': 'application/json',
            ...opts?.headers,
          },
        })

        // 401 — try token refresh once
        if (response.status === 401 && attempt === 0 && this.onTokenRefresh) {
          const newToken = await this.onTokenRefresh()
          if (newToken) {
            this.currentToken = newToken
            continue // retry with new token
          }
          throw new SamsaraApiError('Token refresh failed', 401)
        }

        // 429 — rate limited, use Retry-After header
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
          throw new SamsaraApiError(
            `Samsara server error: ${response.status}`,
            response.status
          )
        }

        // Other errors — do not retry
        if (!response.ok) {
          const errorBody = await response.text().catch(() => 'Unknown error')
          throw new SamsaraApiError(
            `Samsara API error: ${response.status} ${errorBody}`,
            response.status
          )
        }

        return (await response.json()) as T
      } catch (error) {
        if (error instanceof SamsaraApiError) {
          throw error
        }
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < this.maxRetries) {
          await this.sleep(this.getBackoffMs(attempt))
        }
      }
    }

    throw lastError ?? new Error('Samsara request failed after retries')
  }

  // --------------------------------------------------------------------------
  // Pagination
  // --------------------------------------------------------------------------

  async fetchAll<T>(
    path: string,
    params?: Record<string, string>
  ): Promise<T[]> {
    const allData: T[] = []
    let cursor: string | undefined

    // Safety limit to prevent infinite loops
    const maxPages = 100

    for (let page = 0; page < maxPages; page++) {
      const searchParams = new URLSearchParams(params)
      if (cursor) {
        searchParams.set('after', cursor)
      }

      const queryString = searchParams.toString()
      const url = queryString ? `${path}?${queryString}` : path

      const response = await this.request<SamsaraPaginatedResponse<T>>(url)
      allData.push(...response.data)

      if (!response.pagination?.hasNextPage) {
        break
      }
      cursor = response.pagination.endCursor
    }

    return allData
  }

  // --------------------------------------------------------------------------
  // Convenience Methods
  // --------------------------------------------------------------------------

  async getVehicles(): Promise<SamsaraVehicle[]> {
    return this.fetchAll<SamsaraVehicle>('/fleet/vehicles')
  }

  async getDrivers(): Promise<SamsaraDriver[]> {
    return this.fetchAll<SamsaraDriver>('/fleet/drivers')
  }

  async getVehicleLocations(): Promise<SamsaraLocation[]> {
    return this.fetchAll<SamsaraLocation>('/fleet/vehicles/stats', {
      types: 'gps',
    })
  }

  async getHOSClocks(): Promise<SamsaraHOSClock[]> {
    return this.fetchAll<SamsaraHOSClock>('/fleet/hos/clocks')
  }

  async getSafetyEvents(
    startTime: string,
    endTime: string
  ): Promise<SamsaraSafetyEvent[]> {
    return this.fetchAll<SamsaraSafetyEvent>('/fleet/safety/events', {
      startTime,
      endTime,
    })
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
