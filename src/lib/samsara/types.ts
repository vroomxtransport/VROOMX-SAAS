// ============================================================================
// Samsara API Response Types
// ============================================================================

export interface SamsaraVehicle {
  id: string
  name: string
  vin?: string
  make?: string
  model?: string
  year?: number
  licensePlate?: string
  externalIds?: Record<string, string>
  notes?: string
}

export interface SamsaraDriver {
  id: string
  name: string
  email?: string
  phone?: string
  licenseNumber?: string
  licenseState?: string
  driverActivationStatus: 'active' | 'inactive'
}

export interface SamsaraLocation {
  id: string
  name: string
  gps: {
    latitude: number
    longitude: number
    headingDegrees: number
    speedMilesPerHour: number
    reverseGeo?: { formattedLocation: string }
    time: string
  }
}

/**
 * Odometer snapshot from the Samsara `/fleet/vehicles/stats?types=obdOdometerMeters`
 * endpoint. `value` is the raw OBD reading in meters; `time` is the timestamp
 * Samsara captured the reading.
 */
export interface SamsaraOdometerSnapshot {
  id: string
  name: string
  obdOdometerMeters?: {
    value: number
    time: string
  }
}

export interface SamsaraHOSClock {
  driverId: string
  driverName: string
  currentDutyStatus: SamsaraDutyStatus
  timeUntilBreak: number
  drivingTimeRemaining: number
  shiftTimeRemaining: number
  cycleTimeRemaining: number
  vehicleId?: string
}

export type SamsaraDutyStatus =
  | 'off_duty'
  | 'sleeper_berth'
  | 'driving'
  | 'on_duty_not_driving'

export interface SamsaraSafetyEvent {
  id: string
  type: string
  time: string
  vehicleId: string
  vehicleName?: string
  driverId?: string
  driverName?: string
  location: {
    latitude: number
    longitude: number
  }
  maxSpeedMph?: number
  behaviorLabel?: string
}

export interface SamsaraPaginatedResponse<T> {
  data: T[]
  pagination: {
    endCursor: string
    hasNextPage: boolean
  }
}

// ============================================================================
// Webhook Event Types
// ============================================================================

export type SamsaraWebhookEventType =
  | 'VehicleLocationUpdate'
  | 'DriverHosUpdate'
  | 'SafetyEvent'
  | 'VehicleFaultCode'
  | 'DriverCreated'
  | 'DriverUpdated'
  | 'VehicleCreated'
  | 'VehicleUpdated'

export interface SamsaraWebhookPayload {
  eventId: string
  eventType: SamsaraWebhookEventType
  eventTime: string
  data: Record<string, unknown>
}

// ============================================================================
// Internal Mapping Types
// ============================================================================

export type SamsaraSyncStatus = 'active' | 'paused' | 'error' | 'disconnected'
