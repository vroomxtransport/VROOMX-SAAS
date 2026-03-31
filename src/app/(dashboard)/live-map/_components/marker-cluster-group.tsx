'use client'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import type { FleetUnit } from '../_lib/types'
import { createFleetIcon, createClusterIcon } from '../_lib/markers'

interface MarkerClusterGroupProps {
  units: FleetUnit[]
  enabled: boolean
  onSelectUnit: (unit: FleetUnit) => void
}

export function MarkerClusterGroup({ units, enabled, onSelectUnit }: MarkerClusterGroupProps) {
  const map = useMap()
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null)
  const directMarkersRef = useRef<L.Marker[]>([])

  useEffect(() => {
    // Clean up previous state
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current)
      clusterGroupRef.current = null
    }
    directMarkersRef.current.forEach((m) => map.removeLayer(m))
    directMarkersRef.current = []

    const markers = units.map((unit) => {
      const marker = L.marker([unit.latitude, unit.longitude], {
        icon: createFleetIcon(unit),
      })
      marker.on('click', () => onSelectUnit(unit))
      // Bind popup
      const popupContent = createPopupHtml(unit)
      marker.bindPopup(popupContent, {
        className: 'fleet-popup',
        closeButton: false,
        maxWidth: 280,
      })
      return marker
    })

    if (enabled) {
      const group = L.markerClusterGroup({
        iconCreateFunction: createClusterIcon,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        animate: true,
      })
      group.addLayers(markers)
      map.addLayer(group)
      clusterGroupRef.current = group
    } else {
      markers.forEach((m) => m.addTo(map))
      directMarkersRef.current = markers
    }

    return () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current)
        clusterGroupRef.current = null
      }
      directMarkersRef.current.forEach((m) => map.removeLayer(m))
      directMarkersRef.current = []
    }
  }, [map, units, enabled, onSelectUnit])

  return null
}

function createPopupHtml(unit: FleetUnit): string {
  const statusColor =
    unit.status === 'moving' ? '#059669' : unit.status === 'idle' ? '#d97706' : '#6b7280'
  const statusLabel = unit.status.charAt(0).toUpperCase() + unit.status.slice(1)

  return `<div style="font-family:system-ui;padding:10px;min-width:180px;background:#fff;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.15);color:#1e293b;">
    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px;">
      <strong style="font-size:13px;color:#0f172a;">${unit.name}</strong>
      <span style="font-size:10px;font-weight:600;color:${statusColor};background:${statusColor}20;padding:1px 6px;border-radius:8px;">${statusLabel}</span>
    </div>
    ${unit.subtitle ? `<div style="font-size:11px;color:#64748b;margin-bottom:4px;">${unit.subtitle}</div>` : ''}
    <div style="font-size:11px;color:#475569;">${Math.round(unit.speed)} mph</div>
    <div style="font-size:10px;color:#64748b;margin-top:2px;">${unit.latitude.toFixed(4)}, ${unit.longitude.toFixed(4)}</div>
    ${unit.linkHref ? `<a href="${unit.linkHref}" style="font-size:11px;color:#2563eb;text-decoration:none;margin-top:6px;display:inline-block;">View Details &rarr;</a>` : ''}
  </div>`
}
