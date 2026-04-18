'use client'

import { useState } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { Plus, Minus, Maximize2, Info } from 'lucide-react'

interface MapChromeProps {
  /** Bounds to fit when the user clicks the recenter button. */
  fitBounds: L.LatLngBoundsExpression | null
  /** Optional override for the OSM/Mapbox attribution string. */
  attribution?: string
}

/**
 * Custom map controls overlay. Replaces Leaflet's default zoom
 * widget (hidden via `globals.css` `.vroomx-map .leaflet-control-zoom
 * { display: none }`) with navy-on-white buttons styled to match the
 * Supabase-panel aesthetic used elsewhere in the dashboard.
 *
 * Phase 1 ships zoom + fit-to-bounds + scale legend + attribution
 * popover. Layer toggle and fullscreen are placeholder-free here —
 * they land in Phase 2 to keep the visual surface consistent until
 * the toggle UX is finalized.
 */
export function MapChrome({ fitBounds, attribution }: MapChromeProps) {
  const map = useMap()
  const [showAttribution, setShowAttribution] = useState(false)

  const handleZoomIn = () => map.zoomIn()
  const handleZoomOut = () => map.zoomOut()
  const handleFit = () => {
    if (fitBounds) {
      map.fitBounds(fitBounds, { padding: [40, 40], maxZoom: 12 })
    }
  }

  return (
    <>
      {/* Top-right control stack */}
      <div className="vroomx-map-chrome vroomx-map-chrome--top-right">
        <button
          type="button"
          aria-label="Zoom in"
          className="vroomx-map-chrome__btn"
          onClick={handleZoomIn}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          className="vroomx-map-chrome__btn"
          onClick={handleZoomOut}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Fit route to view"
          className="vroomx-map-chrome__btn"
          onClick={handleFit}
          disabled={!fitBounds}
          title="Fit route to view"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Bottom-right attribution toggle */}
      <div className="vroomx-map-chrome vroomx-map-chrome--bottom-right">
        <button
          type="button"
          aria-label="Map attribution"
          aria-expanded={showAttribution}
          aria-controls="vroomx-map-attribution"
          className="vroomx-map-chrome__btn"
          onClick={() => setShowAttribution((v) => !v)}
        >
          <Info className="h-3 w-3" />
        </button>
        {showAttribution && (
          <div
            id="vroomx-map-attribution"
            role="region"
            aria-label="Map data attribution"
            className="vroomx-map-chrome__attribution"
          >
            {attribution ?? '© Mapbox · © OpenStreetMap'}
          </div>
        )}
      </div>
    </>
  )
}
