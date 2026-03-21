'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { ChecklistItem } from '../../_components/checklist-item'
import { UploadDrawer } from '../../_components/upload-drawer'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, CheckCircle2, Info, Calendar } from 'lucide-react'
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
          <Building2 className={`h-5 w-5 ${allDone ? 'text-green-500' : 'text-brand'}`} />
          <span className="text-sm font-semibold text-foreground">
            Company File Completion
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
          All required company documents are on file
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
}

function SpecialInfoBanner({ subCategory }: InfoBannerProps) {
  if (subCategory === 'ucr') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
        <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>UCR annual registration — <strong>deadline: December 31</strong></span>
      </div>
    )
  }

  if (subCategory === 'boc3') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>BOC-3 Process Agent — <strong>verify process agent annually</strong></span>
      </div>
    )
  }

  if (subCategory === 'operating_authority') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Upload your MC# letter and USDOT certificate for easy reference</span>
      </div>
    )
  }

  return null
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
// Company Dashboard
// ---------------------------------------------------------------------------

export function CompanyDashboard() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerPrefill, setDrawerPrefill] = useState<{
    documentType?: string
    entityType?: string
    entityId?: string
    subCategory?: string
    regulationReference?: string
    isRequired?: boolean
  } | undefined>(undefined)

  // Fetch FMCSA company requirements
  const { data: requirements = [], isLoading: requirementsLoading } = useQuery({
    queryKey: ['compliance-requirements', 'company_document'],
    queryFn: async () => {
      const { data } = await supabase
        .from('compliance_requirements')
        .select('*')
        .eq('document_type', 'company_document')
        .eq('is_active', true)
        .order('sort_order')
      return (data ?? []) as ComplianceRequirement[]
    },
    staleTime: 60_000,
  })

  // Fetch company-level documents (entity_type = 'company', no specific entity_id)
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['compliance-docs-company'],
    queryFn: async () => {
      const { data } = await supabase
        .from('compliance_documents')
        .select('*')
        .eq('document_type', 'company_document')
        .eq('entity_type', 'company')
        .order('created_at', { ascending: false })
      return (data ?? []) as ComplianceDocument[]
    },
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

  const handleUpload = useCallback((requirement: ComplianceRequirement) => {
    setDrawerPrefill({
      documentType: 'company_document',
      entityType: 'company',
      entityId: '',
      subCategory: requirement.sub_category,
      regulationReference: requirement.regulation_reference ?? undefined,
      isRequired: true,
    })
    setDrawerOpen(true)
  }, [])

  const handleDrawerClose = useCallback(
    (open: boolean) => {
      setDrawerOpen(open)
      if (!open) {
        queryClient.invalidateQueries({ queryKey: ['compliance-docs-company'] })
        queryClient.invalidateQueries({ queryKey: ['compliance-docs'] })
        queryClient.invalidateQueries({ queryKey: ['compliance-expiration-alerts'] })
      }
    },
    [queryClient]
  )

  return (
    <div className="space-y-6">
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
            No requirements configured. Contact your administrator to set up company compliance requirements.
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
                <SpecialInfoBanner subCategory={req.sub_category} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload drawer */}
      <UploadDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        prefill={drawerPrefill}
      />
    </div>
  )
}
