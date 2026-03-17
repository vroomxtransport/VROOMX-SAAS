'use client'

import { useQuery } from '@tanstack/react-query'

interface FuelPricingData {
  dieselPrice: number
  date: string
  product: string
  area: string
}

async function fetchFuelPricing(): Promise<FuelPricingData> {
  const res = await fetch('/api/fuel-pricing')
  if (!res.ok) throw new Error('Failed to fetch fuel pricing')
  return res.json()
}

export function useFuelPricing() {
  return useQuery({
    queryKey: ['fuel-pricing'],
    queryFn: fetchFuelPricing,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 48 * 60 * 60 * 1000,    // 48 hours
    retry: 2,
    refetchOnWindowFocus: false,
  })
}
