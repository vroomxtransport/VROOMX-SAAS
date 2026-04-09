'use client'

import { useState, useCallback, useRef } from 'react'
import { Search, MapPin, ChevronUp, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import type { FleetFilters, FleetStats, FleetUnit } from '../_lib/types'
import { STATUS_COLORS, relativeTime } from '../_lib/utils'
import { cn } from '@/lib/utils'

interface MobileFleetSheetProps {
  units: FleetUnit[]
  stats: FleetStats
  filters: FleetFilters
  onFiltersChange: (filters: FleetFilters) => void
  selectedUnit: FleetUnit | null
  onSelectUnit: (unit: FleetUnit) => void
}

export function MobileFleetSheet({
  units,
  stats,
  filters,
  onFiltersChange,
  selectedUnit,
  onSelectUnit,
}: MobileFleetSheetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dragStartY = useRef<number | null>(null)
  const dragCurrentY = useRef<number | null>(null)

  const handleSelectUnit = useCallback(
    (unit: FleetUnit) => {
      onSelectUnit(unit)
      setIsOpen(false)
    },
    [onSelectUnit],
  )

  const handleHandleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0]?.clientY ?? null
  }, [])

  const handleHandleTouchMove = useCallback((e: React.TouchEvent) => {
    dragCurrentY.current = e.touches[0]?.clientY ?? null
  }, [])

  const handleHandleTouchEnd = useCallback(() => {
    const start = dragStartY.current
    const current = dragCurrentY.current
    if (start !== null && current !== null) {
      const delta = current - start
      // Swipe up to open, swipe down to close
      if (delta < -30 && !isOpen) setIsOpen(true)
      if (delta > 30 && isOpen) setIsOpen(false)
    }
    dragStartY.current = null
    dragCurrentY.current = null
  }, [isOpen])

  return (
    // Positioned above the bottom tab bar
    <div
      className="absolute bottom-0 left-0 right-0 z-[1100]"
      style={{ paddingBottom: 'var(--bottom-tab-height)' }}
    >
      {/* Handle / collapsed bar */}
      <button
        type="button"
        aria-label={isOpen ? 'Collapse fleet panel' : 'Expand fleet panel'}
        aria-expanded={isOpen}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-4 bg-background border-t border-border-subtle transition-colors',
          'active:bg-accent',
        )}
        style={{ height: '3rem' }}
        onClick={() => setIsOpen((o) => !o)}
        onTouchStart={handleHandleTouchStart}
        onTouchMove={handleHandleTouchMove}
        onTouchEnd={handleHandleTouchEnd}
      >
        {/* Drag indicator pill */}
        <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-border" />

        <div className="flex items-center gap-2 pt-1">
          {/* Status dots summary */}
          <span className="flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: STATUS_COLORS.moving }}
            />
            <span className="text-[11px] font-medium text-muted-foreground">
              {stats.moving}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: STATUS_COLORS.idle }}
            />
            <span className="text-[11px] font-medium text-muted-foreground">
              {stats.idle}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: STATUS_COLORS.offline }}
            />
            <span className="text-[11px] font-medium text-muted-foreground">
              {stats.offline}
            </span>
          </span>
          <span className="ml-1 text-xs font-semibold text-foreground">
            {stats.total} Tracked
          </span>
        </div>

        {isOpen ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Expanded panel */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="fleet-sheet"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: '60dvh', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="overflow-hidden bg-background border-t border-border-subtle"
          >
            <div className="flex h-full flex-col pb-[var(--bottom-tab-height)]">
              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-1.5 border-b border-border-subtle p-3">
                <StatPill label="Moving" value={stats.moving} color={STATUS_COLORS.moving} />
                <StatPill label="Idle" value={stats.idle} color={STATUS_COLORS.idle} />
                <StatPill label="Offline" value={stats.offline} color={STATUS_COLORS.offline} />
                <StatPill label="Total" value={stats.total} color="#2563eb" />
              </div>

              {/* Type tabs */}
              <div className="border-b border-border-subtle px-3 py-2">
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

              {/* Search + sort */}
              <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search fleet..."
                    value={filters.search}
                    onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                    className="h-8 pl-7 text-xs"
                  />
                </div>
                <Select
                  value={filters.sortBy}
                  onValueChange={(v) =>
                    onFiltersChange({ ...filters, sortBy: v as FleetFilters['sortBy'] })
                  }
                >
                  <SelectTrigger className="h-8 w-[90px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="speed">Speed</SelectItem>
                    <SelectItem value="lastUpdate">Updated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Unit list — scrollable */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {units.length === 0 ? (
                  <div className="flex h-full items-center justify-center p-6">
                    <EmptyState
                      icon={MapPin}
                      title="No fleet locations"
                      description="Fleet locations will appear here once drivers share their position or vehicles are synced."
                    />
                  </div>
                ) : (
                  units.map((unit) => (
                    <button
                      key={unit.id}
                      type="button"
                      className={cn(
                        'w-full border-b border-border-subtle px-4 py-3 text-left transition-colors active:bg-accent',
                        selectedUnit?.id === unit.id && 'border-l-2 bg-accent/60',
                      )}
                      style={
                        selectedUnit?.id === unit.id
                          ? { borderLeftColor: STATUS_COLORS[unit.status] }
                          : undefined
                      }
                      onClick={() => handleSelectUnit(unit)}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: STATUS_COLORS[unit.status] }}
                        />
                        <span className="text-sm font-medium text-foreground">{unit.name}</span>
                      </div>
                      {unit.subtitle && (
                        <p className="ml-4 text-xs text-muted-foreground">{unit.subtitle}</p>
                      )}
                      <div className="ml-4 mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        {unit.speed > 0 && <span>{Math.round(unit.speed)} mph</span>}
                        <span>{relativeTime(unit.lastUpdate)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-accent/50 px-1.5 py-2">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  )
}
