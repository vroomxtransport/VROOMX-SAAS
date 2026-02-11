'use client'

import { useQuery } from '@tanstack/react-query'
import { decodeVin, type VinDecodeResult } from '@/lib/vin-decoder'

export function useVinDecode(vin: string) {
  return useQuery<VinDecodeResult>({
    queryKey: ['vin-decode', vin],
    queryFn: () => decodeVin(vin),
    enabled: vin.length === 17,
    staleTime: Infinity,
    retry: 1,
  })
}
