'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { EntitySelector } from '../../_components/entity-selector'
import { ChecklistItem } from '../../_components/checklist-item'
import { UploadDrawer } from '../../_components/upload-drawer'
import { Skeleton } from '@/components/ui/skeleton'
import { Truck, CheckCircle2, Info } from 'lucide-react'
import type { ComplianceRequirement, ComplianceDocument } from '@/types/database'

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

interface ProgressBarProps {
  complete: number
  total: number
}

function ProgressBar({ complete, total }: ProgressBarProps) {
  const pct = total === 0 ? 0 : Math.round((complete / total) * 100)
  const allDone = complete === total && total > 0

  return (
    <div className="widget-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className={`h-5 w-5 ${allDone ? 'text-green-500' : 'text-brand'}`} />
          <span className="text-sm font-semibold text-foreground">
            Vehicle File Completion
          </span>
        </div>
        <div className="flex items-center gap-2">
          {allDone && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          <span className="text-sm font-medium text-foreground">
            {complete} of {total} complete
          </span>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            allDone
              ? 'bg-green-500'
              : pct >= 70
              ? 'bg-brand'
              : pct >= 40
              ? 'bg-amber-500'
              : 'bg-red-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!allDone && (
        <p className="mt-2 text-xs text-muted-foreground">
          {total - complete} item{total - complete !== 1 ? 's' : ''} still required
        </p>
      )}
      {allDone && (
        <p className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">
          All required vehicle documents are on file
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Special info banners for certain sub-categories
// ---------------------------------------------------------------------------

interface InfoBannerProps {
  subCategory: string
  document: ComplianceDocument | null
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function SpecialInfoBanner({ subCategory, document }: InfoBannerProps) {
  if (subCategory === 'annual_dot_inspection' && document?.expires_at) {
    const days = daysUntil(document.expires_at)
    if (days > 0 && days <= 60) {
      return (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Annual DOT inspection due in <strong>{days} days</strong></span>
        </div>
      )
    }
  }

  if (subCategory === 'insurance') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>FMCSA minimum: <strong>$1M liability</strong> / <strong>$5k per vehicle cargo</strong></span>
      </div>
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Empty state (no truck selected)
// ---------------------------------------------------------------------------

function EmptyTruckState() {
  return (
    <div className="widget-card flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
        <Truck className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Select a vehicle</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose a vehicle above to view its qualification file checklist
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Checklist skeleton
// ---------------------------------------------------------------------------

function ChecklistSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Vehicle Dashboard
// ---------------------------------------------------------------------------

export function VehicleDashboard() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [selectedTruckId, setSelectedTruckId] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerPrefill, setDrawerPrefill] = useState<{
    documentType?: string
    entityType?: string
    entityId?: string
    subCategory?: string
    regulationReference?: string
    isRequired?: boolean
  } | undefined>(undefined)

  // Fetch FMCSA vehicle requirements
  const { data: requirements = [], isLoading: requirementsLoading } = useQuery({
    queryKey: ['compliance-requirements', 'vehicle_qualification'],
    queryFn: async () => {
      const { data } = await supabase
        .from('compliance_requirements')
        .select('*')
        .eq('document_type', 'vehicle_qualification')
        .eq('is_active', true)
        .order('sort_order')
      return (data ?? []) as ComplianceRequirement[]
    },
    staleTime: 60_000,
  })

  // Fetch documents for the selected truck
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['compliance-docs-vehicle', selectedTruckId],
    queryFn: async () => {
      const { data } = await supabase
        .from('compliance_documents')
        .select('*')
        .eq('document_type', 'vehicle_qualification')
        .eq('entity_type', 'truck')
        .eq('entity_id', selectedTruckId)
        .order('created_at', { ascending: false })
      return (data ?? []) as ComplianceDocument[]
    },
    enabled: !!selectedTruckId,
    staleTime: 30_000,
  })

  // Match each requirement to the most-recent document with that sub_category
  const docBySubCategory = documents.reduce<Record<string, ComplianceDocument>>(
    (acc, doc) => {
      if (!doc.sub_category) return acc
      if (!acc[doc.sub_category]) {
        acc[doc.sub_category] = doc
      }
      return acc
    },
    {}
  )

  const completedCount = requirements.filter(
    (req) => !!docBySubCategory[req.sub_category]
  ).length

  const handleUpload = useCallback(
    (requirement: ComplianceRequirement) => {
      setDrawerPrefill({
        documentType: 'vehicle_qualification',
        entityType: 'truck',
        entityId: selectedTruckId,
        subCategory: requirement.sub_category,
        regulationReference: requirement.regulation_reference ?? undefined,
        isRequired: true,
      })
      setDrawerOpen(true)
    },
    [selectedTruckId]
  )

  const handleDrawerClose = useCallback(
    (open: boolean) => {
      setDrawerOpen(open)
      if (!open && selectedTruckId) {
        queryClient.invalidateQueries({ queryKey: ['compliance-docs-vehicle', selectedTruckId] })
        queryClient.invalidateQueries({ queryKey: ['compliance-docs'] })
        queryClient.invalidateQueries({ queryKey: ['compliance-expiration-alerts'] })
      }
    },
    [queryClient, selectedTruckId]
  )

  return (
    <div className="space-y-6">
      {/* Entity selector */}
      <div className="widget-card p-4">
        <EntitySelector
          entityType="truck"
          value={selectedTruckId}
          onChange={setSelectedTruckId}
          label="Vehicle"
        />
      </div>

      {!selectedTruckId && <EmptyTruckState />}

      {selectedTruckId && (
        <>
          {/* Progress bar */}
          {!requirementsLoading && requirements.length > 0 && (
            <ProgressBar complete={completedCount} total={requirements.length} />
          )}

          {/* Checklist */}
          <div className="widget-card p-4">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              Required Documents
            </h2>

            {requirementsLoading || documentsLoading ? (
              <ChecklistSkeleton />
            ) : requirements.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No requirements configured. Contact your administrator to set up FMCSA requirements.
              </p>
            ) : (
              <div className="space-y-2">
                {requirements.map((req) => (
                  <div key={req.id} className="space-y-1">
                    <ChecklistItem
                      requirement={req}
                      document={docBySubCategory[req.sub_category] ?? null}
                      onUpload={handleUpload}
                    />
                    <SpecialInfoBanner
                      subCategory={req.sub_category}
                      document={docBySubCategory[req.sub_category] ?? null}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Upload drawer */}
      <UploadDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        prefill={drawerPrefill}
      />
    </div>
  )
}
