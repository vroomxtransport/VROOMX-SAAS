'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { EntitySelector } from '../../_components/entity-selector'
import { ChecklistItem } from '../../_components/checklist-item'
import { UploadDrawer } from '../../_components/upload-drawer'
import { Skeleton } from '@/components/ui/skeleton'
import { Shield, CheckCircle2 } from 'lucide-react'
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
          <Shield className={`h-5 w-5 ${allDone ? 'text-green-500' : 'text-brand'}`} />
          <span className="text-sm font-semibold text-foreground">
            DQF Completion
          </span>
        </div>
        <div className="flex items-center gap-2">
          {allDone && (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
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
          All required documents are on file
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state (no driver selected)
// ---------------------------------------------------------------------------

function EmptyDriverState() {
  return (
    <div className="widget-card flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
        <Shield className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Select a driver</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose a driver above to view their Driver Qualification File checklist
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
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DQF Dashboard
// ---------------------------------------------------------------------------

export function DqfDashboard() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerPrefill, setDrawerPrefill] = useState<{
    documentType?: string
    entityType?: string
    entityId?: string
    subCategory?: string
    regulationReference?: string
    isRequired?: boolean
  } | undefined>(undefined)

  // Fetch FMCSA DQF requirements (tenant-agnostic seed data + tenant overrides)
  const { data: requirements = [], isLoading: requirementsLoading } = useQuery({
    queryKey: ['compliance-requirements', 'dqf'],
    queryFn: async () => {
      const { data } = await supabase
        .from('compliance_requirements')
        .select('*')
        .eq('document_type', 'dqf')
        .eq('is_active', true)
        .order('sort_order')
      return (data ?? []) as ComplianceRequirement[]
    },
    staleTime: 60_000,
  })

  // Fetch documents for the selected driver
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['compliance-docs-dqf', selectedDriverId],
    queryFn: async () => {
      const { data } = await supabase
        .from('compliance_documents')
        .select('*')
        .eq('document_type', 'dqf')
        .eq('entity_type', 'driver')
        .eq('entity_id', selectedDriverId)
        .order('created_at', { ascending: false })
      return (data ?? []) as ComplianceDocument[]
    },
    enabled: !!selectedDriverId,
    staleTime: 30_000,
  })

  // Match each requirement to the most-recent document with that sub_category
  const docBySubCategory = documents.reduce<Record<string, ComplianceDocument>>(
    (acc, doc) => {
      if (!doc.sub_category) return acc
      // Keep the newest one per sub_category (already ordered desc by created_at)
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
        documentType: 'dqf',
        entityType: 'driver',
        entityId: selectedDriverId,
        subCategory: requirement.sub_category,
        regulationReference: requirement.regulation_reference ?? undefined,
        isRequired: true,
      })
      setDrawerOpen(true)
    },
    [selectedDriverId]
  )

  const handleDrawerClose = useCallback(
    (open: boolean) => {
      setDrawerOpen(open)
      if (!open && selectedDriverId) {
        queryClient.invalidateQueries({ queryKey: ['compliance-docs-dqf', selectedDriverId] })
        queryClient.invalidateQueries({ queryKey: ['compliance-docs'] })
        queryClient.invalidateQueries({ queryKey: ['compliance-expiration-alerts'] })
      }
    },
    [queryClient, selectedDriverId]
  )

  return (
    <div className="space-y-6">
      {/* Entity selector */}
      <div className="widget-card p-4">
        <EntitySelector
          entityType="driver"
          value={selectedDriverId}
          onChange={setSelectedDriverId}
          label="Driver"
        />
      </div>

      {!selectedDriverId && <EmptyDriverState />}

      {selectedDriverId && (
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
                  <ChecklistItem
                    key={req.id}
                    requirement={req}
                    document={docBySubCategory[req.sub_category] ?? null}
                    onUpload={handleUpload}
                  />
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
