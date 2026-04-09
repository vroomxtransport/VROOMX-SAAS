'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Search, SlidersHorizontal, MoreHorizontal, Layers, Info, Map, X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import type { FleetFilters, MapStyle } from '../_lib/types'
import { MAP_STYLES } from '../_lib/types'

interface MobileMapToolbarProps {
  filters: FleetFilters
  onFiltersChange: (filters: FleetFilters) => void
  mapStyle: MapStyle
  onMapStyleChange: (style: MapStyle) => void
  clusterEnabled: boolean
  onClusterToggle: () => void
  legendVisible: boolean
  onLegendToggle: () => void
}

export function MobileMapToolbar({
  filters,
  onFiltersChange,
  mapStyle,
  onMapStyleChange,
  clusterEnabled,
  onClusterToggle,
  legendVisible,
  onLegendToggle,
}: MobileMapToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus the search input when the overlay opens
  useEffect(() => {
    if (searchOpen) {
      const frame = requestAnimationFrame(() => {
        searchInputRef.current?.focus()
      })
      return () => cancelAnimationFrame(frame)
    }
  }, [searchOpen])

  const handleSearchChange = useCallback(
    (value: string) => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      searchTimerRef.current = setTimeout(() => {
        onFiltersChange({ ...filters, search: value })
      }, 300)
    },
    [filters, onFiltersChange],
  )

  const handleSearchClose = useCallback(() => {
    setSearchOpen(false)
    onFiltersChange({ ...filters, search: '' })
  }, [filters, onFiltersChange])

  const hasActiveFilters =
    filters.type !== 'all' || filters.status !== 'all'

  return (
    <>
      {/* Search overlay — slides down from top */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            key="search-overlay"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="absolute top-0 left-0 right-0 z-[1050] flex items-center gap-2 bg-background/95 px-3 py-2 shadow-md backdrop-blur-sm"
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search fleet..."
              defaultValue={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-9 flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleSearchClose}
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button strip — top-right */}
      <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-1.5">
        {/* Search */}
        <Button
          variant="outline"
          size="icon"
          aria-label="Open search"
          className={`h-10 w-10 rounded-xl bg-background/90 shadow-md backdrop-blur-sm ${
            filters.search ? 'ring-2 ring-brand/60' : ''
          }`}
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Filter — shows accent dot when active */}
        <Button
          variant="outline"
          size="icon"
          aria-label="Open filters"
          className="relative h-10 w-10 rounded-xl bg-background/90 shadow-md backdrop-blur-sm"
          onClick={() => setFilterSheetOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {hasActiveFilters && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand" />
          )}
        </Button>

        {/* More (map style + cluster + legend) */}
        <Button
          variant="outline"
          size="icon"
          aria-label="More map options"
          className="h-10 w-10 rounded-xl bg-background/90 shadow-md backdrop-blur-sm"
          onClick={() => setMoreSheetOpen(true)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Filter sheet */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[var(--bottom-tab-height)]">
          <SheetHeader>
            <SheetTitle className="text-sm">Filter Fleet</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-4 overflow-y-auto max-h-[60dvh]">
            {/* Type filter */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Type
              </p>
              <Tabs
                value={filters.type}
                onValueChange={(v) =>
                  onFiltersChange({ ...filters, type: v as FleetFilters['type'] })
                }
              >
                <TabsList className="w-full">
                  <TabsTrigger value="all" className="flex-1 text-xs">
                    All
                  </TabsTrigger>
                  <TabsTrigger value="vehicle" className="flex-1 text-xs">
                    Trucks
                  </TabsTrigger>
                  <TabsTrigger value="driver" className="flex-1 text-xs">
                    Drivers
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <Separator />

            {/* Status filter */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </p>
              <Tabs
                value={filters.status}
                onValueChange={(v) =>
                  onFiltersChange({ ...filters, status: v as FleetFilters['status'] })
                }
              >
                <TabsList className="w-full">
                  <TabsTrigger value="all" className="flex-1 text-xs">
                    All
                  </TabsTrigger>
                  <TabsTrigger value="moving" className="flex-1 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Moving
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="idle" className="flex-1 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Idle
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="offline" className="flex-1 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                      Off
                    </span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* More options sheet */}
      <Sheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[var(--bottom-tab-height)]">
          <SheetHeader>
            <SheetTitle className="text-sm">Map Options</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-4 overflow-y-auto max-h-[60dvh]">
            {/* Map style */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Map Style
              </p>
              <Select
                value={mapStyle}
                onValueChange={(v) => onMapStyleChange(v as MapStyle)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <Map className="mr-1.5 h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAP_STYLES.map((style) => (
                    <SelectItem key={style.key} value={style.key}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Toggles */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2.5 text-sm transition-colors active:bg-accent"
                onClick={() => {
                  onClusterToggle()
                  setMoreSheetOpen(false)
                }}
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Cluster markers</span>
                </div>
                <span
                  className={`h-2 w-2 rounded-full ${
                    clusterEnabled ? 'bg-brand' : 'bg-muted-foreground/30'
                  }`}
                />
              </button>

              <button
                type="button"
                className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2.5 text-sm transition-colors active:bg-accent"
                onClick={() => {
                  onLegendToggle()
                  setMoreSheetOpen(false)
                }}
              >
                <div className="flex items-center gap-2.5">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Show legend</span>
                </div>
                <span
                  className={`h-2 w-2 rounded-full ${
                    legendVisible ? 'bg-brand' : 'bg-muted-foreground/30'
                  }`}
                />
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
