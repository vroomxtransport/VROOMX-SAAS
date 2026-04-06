'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { EntitySelector } from '../../_components/entity-selector'
import { UploadDrawer } from '../../_components/upload-drawer'
import { FolderTable } from '../../_components/folder-table'
import { BulkUploadDialog } from '../../_components/bulk-upload-dialog'
import { CreateFolderDialog } from '../../_components/create-folder-dialog'
import { fetchComplianceFolders } from '@/lib/queries/compliance-folders'
import type { ComplianceFolder } from '@/lib/queries/compliance-folders'
import { deleteCustomFolder } from '@/app/actions/compliance'
import { Skeleton } from '@/components/ui/skeleton'
import { Shield, CheckCircle2 } from 'lucide-react'

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
        <p className="mt-2 text-xs text-green-600 font-medium">
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
          Choose a driver above to view their Driver Qualification File
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Folder skeleton
// ---------------------------------------------------------------------------

function FolderSkeleton() {
  return (
    <div className="widget-card p-0 overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="space-y-px">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none" />
        ))}
      </div>
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
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [drawerPrefill, setDrawerPrefill] = useState<{
    documentType?: string
    entityType?: string
    entityId?: string
    subCategory?: string
    regulationReference?: string
    isRequired?: boolean
  } | undefined>(undefined)

  // Fetch folders (groups documents by sub_category, fills in empty folders)
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['compliance-folders', 'dqf', 'driver', selectedDriverId],
    queryFn: () => fetchComplianceFolders(supabase, 'dqf', 'driver', selectedDriverId),
    enabled: !!selectedDriverId,
    staleTime: 30_000,
  })

  const completedCount = folders.filter((f) => f.activeDocument !== null).length

  const handleUploadNewVersion = useCallback(
    (folder: ComplianceFolder) => {
      setDrawerPrefill({
        documentType: 'dqf',
        entityType: 'driver',
        entityId: selectedDriverId,
        subCategory: folder.subCategory,
        isRequired: folder.isRequired,
      })
      setDrawerOpen(true)
    },
    [selectedDriverId]
  )

  const handleBulkDownload = useCallback(() => {
    if (!selectedDriverId) return
    const params = new URLSearchParams({
      documentType: 'dqf',
      entityType: 'driver',
      entityId: selectedDriverId,
    })
    window.location.href = `/api/compliance/download?${params.toString()}`
  }, [selectedDriverId])

  const handleDrawerClose = useCallback(
    (open: boolean) => {
      setDrawerOpen(open)
      if (!open && selectedDriverId) {
        queryClient.invalidateQueries({ queryKey: ['compliance-folders', 'dqf', 'driver', selectedDriverId] })
        queryClient.invalidateQueries({ queryKey: ['compliance-expiration-alerts'] })
      }
    },
    [queryClient, selectedDriverId]
  )

  const handleBulkUploadSuccess = useCallback(() => {
    if (!selectedDriverId) return
    queryClient.invalidateQueries({ queryKey: ['compliance-folders', 'dqf', 'driver', selectedDriverId] })
    queryClient.invalidateQueries({ queryKey: ['compliance-expiration-alerts'] })
  }, [queryClient, selectedDriverId])

  const handleCreateFolderSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['compliance-folders', 'dqf', 'driver', selectedDriverId] })
  }, [queryClient, selectedDriverId])

  const handleDeleteFolder = useCallback(async (folder: ComplianceFolder) => {
    if (!folder.isCustom) return
    if (folder.documents.length > 0) {
      const confirmed = window.confirm(
        `"${folder.label}" contains ${folder.documents.length} document${folder.documents.length === 1 ? '' : 's'}. Deleting the folder will not delete the documents, but they will become unfiled. Continue?`
      )
      if (!confirmed) return
    } else {
      const confirmed = window.confirm(`Delete folder "${folder.label}"?`)
      if (!confirmed) return
    }
    const result = await deleteCustomFolder({
      documentType: 'dqf',
      subCategory: folder.subCategory,
    })
    if ('error' in result && result.error) {
      alert(typeof result.error === 'string' ? result.error : 'Failed to delete folder')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['compliance-folders', 'dqf', 'driver', selectedDriverId] })
  }, [queryClient, selectedDriverId])

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
          {!foldersLoading && folders.length > 0 && (
            <ProgressBar complete={completedCount} total={folders.length} />
          )}

          {/* Folder table */}
          {foldersLoading ? (
            <FolderSkeleton />
          ) : (
            <FolderTable
              documentType="dqf"
              entityType="driver"
              entityId={selectedDriverId}
              folders={folders}
              onUploadNewVersion={handleUploadNewVersion}
              onBulkUpload={() => setBulkUploadOpen(true)}
              onBulkDownload={handleBulkDownload}
              onCreateFolder={() => setCreateFolderOpen(true)}
              onDeleteFolder={handleDeleteFolder}
            />
          )}
        </>
      )}

      {/* Upload drawer (single file, "upload new version" path) */}
      <UploadDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        prefill={drawerPrefill}
      />

      {/* Bulk upload dialog */}
      <BulkUploadDialog
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        documentType="dqf"
        entityType="driver"
        entityId={selectedDriverId}
        onSuccess={handleBulkUploadSuccess}
      />

      {/* Create folder dialog */}
      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        documentType="dqf"
        onSuccess={handleCreateFolderSuccess}
      />
    </div>
  )
}
