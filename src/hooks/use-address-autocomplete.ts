'use client'

import { useQuery } from '@tanstack/react-query'

export interface AddressSuggestion {
  displayName: string
  location: string
  city: string
  state: string
  zip: string
  lat: string
  lon: string
}

// US state abbreviation map
const STATE_ABBREVS: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  'District of Columbia': 'DC',
}

function getStateAbbrev(stateName: string): string {
  return STATE_ABBREVS[stateName] || stateName.slice(0, 2).toUpperCase()
}

async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('countrycodes', 'us')
  url.searchParams.set('limit', '5')

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'VroomX-TMS/1.0' },
  })
  if (!res.ok) return []

  const results = await res.json()

  return results.map((r: {
    display_name: string
    lat: string
    lon: string
    address?: {
      road?: string
      house_number?: string
      city?: string
      town?: string
      village?: string
      county?: string
      state?: string
      postcode?: string
    }
  }) => {
    const addr = r.address ?? {}
    const city = addr.city || addr.town || addr.village || addr.county || ''
    const state = addr.state ? getStateAbbrev(addr.state) : ''
    const location = [addr.house_number, addr.road].filter(Boolean).join(' ') || city

    return {
      displayName: r.display_name,
      location,
      city,
      state,
      zip: addr.postcode || '',
      lat: r.lat,
      lon: r.lon,
    }
  })
}

/**
 * Address autocomplete using Nominatim (OpenStreetMap).
 * Debounced via TanStack Query's staleTime + enabled check.
 */
export function useAddressSearch(query: string) {
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['address-search', query],
    queryFn: () => searchAddresses(query),
    enabled: query.length >= 3,
    staleTime: 30_000,
    gcTime: 60_000,
  })

  return { suggestions, isLoading }
}
