'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, useEffect } from 'react'

interface NHTSAMake {
  Make_ID: number
  Make_Name: string
}

interface NHTSAModel {
  Model_ID: number
  Model_Name: string
}

function guessVehicleType(modelName: string): string {
  const lower = modelName.toLowerCase()
  if (/suv|rav4|cr-v|cx-|tiguan|tucson|santa fe|explorer|4runner|tahoe|suburban|pilot|highlander|pathfinder|gle|x[1-7]|q[3-8]|cayenne|macan|equinox|traverse|blazer|trailblazer|escape|edge|bronco|wrangler|cherokee/i.test(lower)) return 'SUV'
  if (/f-?150|f-?250|f-?350|silverado|sierra|ram|tundra|tacoma|ranger|frontier|colorado|gladiator|ridgeline|titan|maverick/i.test(lower)) return 'Pickup'
  if (/civic|accord|camry|corolla|altima|sentra|jetta|passat|3 series|c-class|a4|model 3|prius|mazda3|mazda6|impreza|legacy|elantra|sonata|forte|optima/i.test(lower)) return 'Sedan'
  if (/mustang|camaro|challenger|corvette|911|supra|86|brz|miata|mx-5/i.test(lower)) return 'Coupe'
  if (/sienna|odyssey|pacifica|carnival|transit|sprinter|metris/i.test(lower)) return 'Van'
  if (/model s|model x|model y|bolt|leaf|ioniq|id\.|mach-e|ariya|ev6|lyriq|hummer ev/i.test(lower)) return 'Electric'
  return ''
}

async function fetchAllMakes(): Promise<NHTSAMake[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch('https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json', {
      signal: controller.signal,
    })
    if (!res.ok) throw new Error('Failed to fetch makes')
    const json = await res.json()
    return (json.Results ?? []) as NHTSAMake[]
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchModelsForMake(makeName: string): Promise<NHTSAModel[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${encodeURIComponent(makeName)}?format=json`,
      { signal: controller.signal }
    )
    if (!res.ok) throw new Error('Failed to fetch models')
    const json = await res.json()
    return (json.Results ?? []) as NHTSAModel[]
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Debounce hook.
 */
function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

/**
 * Search vehicle makes from NHTSA database.
 * Fetches all makes ONCE (cached forever), filters client-side.
 */
export function useVehicleMakes(query: string) {
  const { data: allMakes = [], isLoading } = useQuery({
    queryKey: ['nhtsa-all-makes'],
    queryFn: fetchAllMakes,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
  })

  const debouncedQuery = useDebouncedValue(query, 150)

  const filtered = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return []
    const lower = debouncedQuery.toLowerCase()
    return allMakes
      .filter((m) => m.Make_Name.toLowerCase().startsWith(lower))
      .slice(0, 10)
      .map((m) => ({ id: m.Make_ID, name: m.Make_Name }))
  }, [allMakes, debouncedQuery])

  return { makes: filtered, isLoading }
}

/**
 * Search vehicle models for a CONFIRMED make from NHTSA database.
 * Only fetches when makeName is a full, confirmed make (not while typing).
 */
export function useVehicleModels(makeName: string, query: string) {
  const { data: allModels = [], isLoading } = useQuery({
    queryKey: ['nhtsa-models', makeName],
    queryFn: () => fetchModelsForMake(makeName),
    // Only fetch when make has 3+ chars — caller should only pass confirmed makes
    enabled: makeName.length >= 3,
    staleTime: 10 * 60 * 1000, // 10 min cache
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const debouncedQuery = useDebouncedValue(query, 150)

  const filtered = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 1) return allModels.slice(0, 15).map((m) => m.Model_Name)
    const lower = debouncedQuery.toLowerCase()
    return allModels
      .filter((m) => m.Model_Name.toLowerCase().includes(lower))
      .slice(0, 15)
      .map((m) => m.Model_Name)
  }, [allModels, debouncedQuery])

  return { models: filtered, isLoading }
}

/**
 * Guess vehicle type from model name.
 */
export function getVehicleType(modelName: string): string {
  return guessVehicleType(modelName)
}
