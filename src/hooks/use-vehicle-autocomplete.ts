'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

interface NHTSAMake {
  Make_ID: number
  Make_Name: string
}

interface NHTSAModel {
  Model_ID: number
  Model_Name: string
}

// Common vehicle types mapped from body class patterns
const BODY_CLASS_TO_TYPE: Record<string, string> = {
  'sedan': 'Sedan',
  'coupe': 'Coupe',
  'convertible': 'Convertible',
  'hatchback': 'Hatchback',
  'wagon': 'Wagon',
  'suv': 'SUV',
  'sport utility': 'SUV',
  'crossover': 'SUV',
  'pickup': 'Pickup',
  'truck': 'Truck',
  'van': 'Van',
  'minivan': 'Minivan',
  'motorcycle': 'Motorcycle',
}

function guessVehicleType(modelName: string): string {
  const lower = modelName.toLowerCase()
  // Common model-to-type mappings
  if (/suv|rav4|cr-v|cx-|tiguan|tucson|santa fe|explorer|4runner|tahoe|suburban|pilot|highlander|pathfinder|gle|x[1-7]|q[3-8]|cayenne|macan/i.test(lower)) return 'SUV'
  if (/f-?150|f-?250|f-?350|silverado|sierra|ram|tundra|tacoma|ranger|frontier|colorado|gladiator|ridgeline|titan/i.test(lower)) return 'Pickup'
  if (/civic|accord|camry|corolla|altima|sentra|jetta|passat|3 series|c-class|a4|model 3|prius|mazda3|mazda6|impreza|legacy/i.test(lower)) return 'Sedan'
  if (/mustang|camaro|challenger|corvette|911|supra|86|brz|miata|mx-5/i.test(lower)) return 'Coupe'
  if (/sienna|odyssey|pacifica|carnival|transit|sprinter/i.test(lower)) return 'Van'
  return ''
}

async function fetchAllMakes(): Promise<NHTSAMake[]> {
  const res = await fetch('https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json')
  if (!res.ok) throw new Error('Failed to fetch makes')
  const json = await res.json()
  return (json.Results ?? []) as NHTSAMake[]
}

async function fetchModelsForMake(makeName: string): Promise<NHTSAModel[]> {
  const res = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${encodeURIComponent(makeName)}?format=json`
  )
  if (!res.ok) throw new Error('Failed to fetch models')
  const json = await res.json()
  return (json.Results ?? []) as NHTSAModel[]
}

/**
 * Search vehicle makes from NHTSA database.
 * Fetches all makes once (cached forever), filters client-side.
 */
export function useVehicleMakes(query: string) {
  const { data: allMakes = [], isLoading } = useQuery({
    queryKey: ['nhtsa-all-makes'],
    queryFn: fetchAllMakes,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const filtered = useMemo(() => {
    if (!query || query.length < 2) return []
    const lower = query.toLowerCase()
    return allMakes
      .filter((m) => m.Make_Name.toLowerCase().startsWith(lower))
      .slice(0, 10)
      .map((m) => ({ id: m.Make_ID, name: m.Make_Name }))
  }, [allMakes, query])

  return { makes: filtered, isLoading }
}

/**
 * Search vehicle models for a given make from NHTSA database.
 */
export function useVehicleModels(makeName: string, query: string) {
  const { data: allModels = [], isLoading } = useQuery({
    queryKey: ['nhtsa-models', makeName],
    queryFn: () => fetchModelsForMake(makeName),
    enabled: makeName.length >= 2,
    staleTime: 5 * 60 * 1000,
  })

  const filtered = useMemo(() => {
    if (!query || query.length < 1) return allModels.slice(0, 15).map((m) => m.Model_Name)
    const lower = query.toLowerCase()
    return allModels
      .filter((m) => m.Model_Name.toLowerCase().includes(lower))
      .slice(0, 15)
      .map((m) => m.Model_Name)
  }, [allModels, query])

  return { models: filtered, isLoading }
}

/**
 * Guess vehicle type from make + model name.
 */
export function getVehicleType(modelName: string): string {
  return guessVehicleType(modelName)
}
