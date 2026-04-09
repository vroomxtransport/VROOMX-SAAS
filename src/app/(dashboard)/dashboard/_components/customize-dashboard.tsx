'use client'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { useDashboardStore, type WidgetId } from '@/stores/dashboard-store'
import { getWidgetsForView, type DashboardView } from '@/app/(dashboard)/dashboard/_lib/resolve-view'
import { Settings2, GripVertical } from 'lucide-react'
import { useMemo } from 'react'

interface CustomizeDashboardProps {
  view: DashboardView
}

export function CustomizeDashboard({ view }: CustomizeDashboardProps) {
  const { editMode, setEditMode, resetDefaults, toggleWidget } = useDashboardStore()
  const layout = useDashboardStore((s) => s.viewLayouts[s.activeView])

  const isVisible = (id: WidgetId) => layout.find((w) => w.id === id)?.visible ?? true

  // Only show widgets valid for the current view
  const viewWidgets = useMemo(() => getWidgetsForView(view), [view])

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
                <span className="text-sm font-medium">Edit Layout</span>
              </div>
              <Switch
                size="sm"
                checked={editMode}
                onCheckedChange={setEditMode}
              />
            </div>
            {editMode && (
              <p className="mt-2 text-xs text-muted-foreground">
                Drag to reorder, resize from bottom-right corner.
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
            {viewWidgets.map(({ id, label }) => (
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
