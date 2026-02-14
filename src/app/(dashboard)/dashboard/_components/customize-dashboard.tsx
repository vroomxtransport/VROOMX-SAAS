'use client'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { useDashboardStore, type WidgetId } from '@/stores/dashboard-store'
import { Settings2, GripVertical } from 'lucide-react'

const WIDGET_LABELS: { id: WidgetId; label: string }[] = [
  { id: 'statCards', label: 'Stats Overview' },
  { id: 'loadsPipeline', label: 'Loads Pipeline' },
  { id: 'revenueChart', label: 'Revenue Chart' },
  { id: 'fleetPulse', label: 'Fleet Pulse' },
  { id: 'upcomingPickups', label: 'Upcoming Pickups' },
  { id: 'activityFeed', label: 'Activity Feed' },
]

export function CustomizeDashboard() {
  const { widgetLayout, toggleWidget, editMode, setEditMode, resetDefaults } = useDashboardStore()

  const isVisible = (id: WidgetId) => widgetLayout.find((w) => w.id === id)?.visible ?? true

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4" />
          Customize
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-4">
          {/* Reorder section */}
          <div className="rounded-lg border border-brand/20 bg-brand/5 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-brand" />
                <span className="text-sm font-medium">Reorder Widgets</span>
              </div>
              <Switch
                size="sm"
                checked={editMode}
                onCheckedChange={setEditMode}
              />
            </div>
            {editMode && (
              <p className="mt-2 text-xs text-muted-foreground">
                Drag widgets to reorder them on the dashboard.
              </p>
            )}
          </div>

          {/* Visibility toggles */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Dashboard Widgets</p>
            <button
              onClick={resetDefaults}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset to Default
            </button>
          </div>
          <div className="space-y-3">
            {WIDGET_LABELS.map(({ id, label }) => (
              <div key={id} className="flex items-center justify-between">
                <label htmlFor={`widget-${id}`} className="text-sm cursor-pointer">
                  {label}
                </label>
                <Switch
                  id={`widget-${id}`}
                  size="sm"
                  checked={isVisible(id)}
                  onCheckedChange={() => toggleWidget(id)}
                />
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
