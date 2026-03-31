'use client'

import { ChevronLeft, ChevronRight, Search, MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import type { FleetFilters, FleetStats, FleetUnit } from '../_lib/types'
import { STATUS_COLORS, relativeTime } from '../_lib/utils'
import { cn } from '@/lib/utils'

interface FleetPanelProps {
  units: FleetUnit[]
  stats: FleetStats
  filters: FleetFilters
  onFiltersChange: (filters: FleetFilters) => void
  selectedUnit: FleetUnit | null
  onSelectUnit: (unit: FleetUnit) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function FleetPanel({
  units,
  stats,
  filters,
  onFiltersChange,
  selectedUnit,
  onSelectUnit,
  collapsed,
  onToggleCollapse,
}: FleetPanelProps) {
  if (collapsed) {
    return (
      <div className="flex w-12 shrink-0 flex-col items-center border-r border-border-subtle bg-background py-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggleCollapse}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex w-80 shrink-0 flex-col border-r border-border-subtle bg-background transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Fleet Tracker</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onToggleCollapse}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 border-b border-border-subtle p-3">
        <StatPill label="Moving" value={stats.moving} color={STATUS_COLORS.moving} />
        <StatPill label="Idle" value={stats.idle} color={STATUS_COLORS.idle} />
        <StatPill label="Offline" value={stats.offline} color={STATUS_COLORS.offline} />
        <StatPill label="Total" value={stats.total} color="#2563eb" />
      </div>

      {/* Tabs */}
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
              Vehicles
            </TabsTrigger>
            <TabsTrigger value="driver" className="flex-1 text-xs">
              Drivers
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search + Sort */}
      <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
            className="h-8 pl-7 text-xs"
          />
        </div>
        <Select
          value={filters.sortBy}
          onValueChange={(v) =>
            onFiltersChange({ ...filters, sortBy: v as FleetFilters['sortBy'] })
          }
        >
          <SelectTrigger className="h-8 w-[100px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="speed">Speed</SelectItem>
            <SelectItem value="lastUpdate">Updated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {units.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4">
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
                'w-full border-b border-border-subtle px-4 py-3 text-left transition-colors hover:bg-accent',
                selectedUnit?.id === unit.id && 'border-l-2 bg-accent',
              )}
              style={
                selectedUnit?.id === unit.id
                  ? { borderLeftColor: STATUS_COLORS[unit.status] }
                  : undefined
              }
              onClick={() => onSelectUnit(unit)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[unit.status] }}
                  />
                  <span className="text-sm font-medium text-foreground">{unit.name}</span>
                </div>
              </div>
              {unit.subtitle && (
                <p className="ml-4 text-xs text-muted-foreground">{unit.subtitle}</p>
              )}
              <div className="ml-4 mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                {unit.speed > 0 && <span>{Math.round(unit.speed)} mph</span>}
                <span>{relativeTime(unit.lastUpdate)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-accent/50 px-2.5 py-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="ml-auto text-sm font-semibold text-foreground">{value}</span>
    </div>
  )
}
