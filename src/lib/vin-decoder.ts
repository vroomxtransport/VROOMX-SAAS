const BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues'

export interface VinDecodeResult {
  make: string
  model: string
  year: string
  bodyClass: string
  vehicleType: string
  errorCode: string
  errorText: string
}

export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  if (!vin || vin.length !== 17) {
    throw new Error('VIN must be exactly 17 characters')
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}/${vin}?format=json`)
  } catch {
    throw new Error('Failed to connect to NHTSA VIN decoder service. Please try again.')
  }

  if (!response.ok) {
    throw new Error(`NHTSA API returned status ${response.status}`)
  }

  const json = await response.json()
  const results = json?.Results
  if (!results || !Array.isArray(results) || results.length === 0) {
    throw new Error('No results returned from NHTSA VIN decoder')
  }

  const result = results[0]

  return {
    make: result.Make ?? '',
    model: result.Model ?? '',
    year: result.ModelYear ?? '',
    bodyClass: result.BodyClass ?? '',
    vehicleType: result.VehicleType ?? '',
    errorCode: result.ErrorCode ?? '',
    errorText: result.ErrorText ?? '',
  }
}
