// ============================================================================
// Multi Service Fuel Card API Types
// ============================================================================

export interface FuelTransaction {
  transactionId: string
  transactionDate: string // ISO datetime
  cardNumber: string
  driverName?: string
  vehicleUnit?: string // unit number on the card
  productType: string // DIESEL, DEF, OIL, etc.
  gallons: number
  pricePerGallon: number
  totalAmount: number
  odometer?: number
  locationName?: string
  city?: string
  state?: string
  latitude?: number
  longitude?: number
}

export interface FuelCard {
  cardNumber: string
  status: 'active' | 'inactive' | 'suspended'
  driverName?: string
  vehicleUnit?: string
  limits?: {
    dailyDollar?: number
    dailyGallon?: number
    transactionDollar?: number
  }
}

export interface FuelCardAccountInfo {
  accountNumber: string
  companyName: string
  status: string
  cardCount: number
}

export interface FuelSyncResult {
  synced: number
  matched: number
  flagged: number
  skipped: number // already existed (dedup)
  errors: string[]
}

export type FuelAnomalyReason =
  | 'volume_exceeded'
  | 'high_dollar_amount'
  | 'duplicate_short_interval'
  | 'unknown_location'

export interface FuelAnomalyFlag {
  flagged: boolean
  reason?: FuelAnomalyReason
}

export interface FuelCardApiErrorBody {
  status: number
  code?: string
  message: string
}
