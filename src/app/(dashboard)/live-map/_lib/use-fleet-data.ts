'use client'

import { useMemo } from 'react'
import { useDriverLocations, useSamsaraVehicleLocations } from '@/hooks/use-driver-locations'
import { normalizeDriverLocations, normalizeVehicleLocations } from './utils'
import type { FleetFilters, FleetStats, FleetUnit } from './types'

export function useFleetData(filters: FleetFilters) {
  const { data: driverLocations = [], isLoading: driversLoading } = useDriverLocations()
  const { data: vehicleLocations = [], isLoading: vehiclesLoading } = useSamsaraVehicleLocations()

  const allUnits = useMemo(() => {
    const drivers = normalizeDriverLocations(driverLocations)
    const vehicles = normalizeVehicleLocations(vehicleLocations)
    return [...drivers, ...vehicles]
  }, [driverLocations, vehicleLocations])

  const stats: FleetStats = useMemo(() => {
    const moving = allUnits.filter((u) => u.status === 'moving').length
    const idle = allUnits.filter((u) => u.status === 'idle').length
    const offline = allUnits.filter((u) => u.status === 'offline').length
    const totalSpeed = allUnits.reduce((sum, u) => sum + u.speed, 0)
    return {
      total: allUnits.length,
      moving,
      idle,
      offline,
      avgSpeed: allUnits.length > 0 ? totalSpeed / allUnits.length : 0,
    }
  }, [allUnits])

  const units = useMemo(() => {
    let filtered = allUnits

    if (filters.type !== 'all') {
      filtered = filtered.filter((u) => u.type === filters.type)
    }
    if (filters.status !== 'all') {
      filtered = filtered.filter((u) => u.status === filters.status)
    }
    if (filters.search) {
      const q = filters.search.toLowerCase()
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          (u.subtitle && u.subtitle.toLowerCase().includes(q))
      )
    }

    const sorted = [...filtered]
    switch (filters.sortBy) {
      case 'speed':
        sorted.sort((a, b) => b.speed - a.speed)
        break
      case 'lastUpdate':
        sorted.sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime())
        break
      case 'name':
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name))
    }
    return sorted
  }, [allUnits, filters])

  return {
    units,
    stats,
    isLoading: driversLoading && vehiclesLoading,
  }
}
