export type FleetUnitType = 'vehicle' | 'driver'
export type FleetUnitStatus = 'moving' | 'idle' | 'offline'

export interface FleetUnit {
  id: string
  type: FleetUnitType
  name: string
  subtitle: string | null
  latitude: number
  longitude: number
  speed: number
  heading: number | null
  lastUpdate: string
  status: FleetUnitStatus
  linkHref: string | null
}

export interface FleetFilters {
  type: 'all' | 'vehicle' | 'driver'
  status: 'all' | 'moving' | 'idle' | 'offline'
  search: string
  sortBy: 'name' | 'speed' | 'lastUpdate'
}

export interface FleetStats {
  total: number
  moving: number
  idle: number
  offline: number
  avgSpeed: number
}

export const DEFAULT_FILTERS: FleetFilters = {
  type: 'all',
  status: 'all',
  search: '',
  sortBy: 'name',
}

export type MapStyle = 'street' | 'satellite' | 'terrain' | 'dark'

export const MAP_STYLES: { key: MapStyle; label: string; url: string; attribution: string }[] = [
  {
    key: 'street',
    label: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    key: 'satellite',
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
  },
  {
    key: 'terrain',
    label: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  },
  {
    key: 'dark',
    label: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
]
