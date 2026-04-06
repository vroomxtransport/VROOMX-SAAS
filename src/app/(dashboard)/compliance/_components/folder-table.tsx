'use client'

import { Download, Upload, FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FolderRow } from './folder-row'
import type { ComplianceFolder } from '@/lib/queries/compliance-folders'

interface FolderTableProps {
  documentType: 'dqf' | 'vehicle_qualification' | 'company_document'
  entityType: 'driver' | 'truck' | 'company'
  entityId: string | null
  folders: ComplianceFolder[]
  onUploadNewVersion: (folder: ComplianceFolder) => void
  onBulkUpload?: () => void
  onBulkDownload?: () => void
  onCreateFolder?: () => void
  onDeleteFolder?: (folder: ComplianceFolder) => void
}

export function FolderTable({
  folders,
  onUploadNewVersion,
  onBulkUpload,
  onBulkDownload,
  onCreateFolder,
  onDeleteFolder,
}: FolderTableProps) {
  return (
    <div className="widget-card p-0 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Documents</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium text-brand border-brand/30 hover:bg-brand/5 hover:border-brand/50"
            onClick={onCreateFolder}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New Folder
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium text-brand border-brand/30 hover:bg-brand/5 hover:border-brand/50"
            onClick={onBulkUpload}
          >
            <Upload className="h-3.5 w-3.5" />
            Bulk Upload
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium text-brand border-brand/30 hover:bg-brand/5 hover:border-brand/50"
            onClick={onBulkDownload}
          >
            <Download className="h-3.5 w-3.5" />
            Bulk Download
          </Button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="bg-muted/30">
              {/* Chevron + folder icon column */}
              <th className="w-[300px] py-2 px-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                File Name
              </th>
              <th className="w-[130px] py-2 px-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide tabular-nums">
                Issue Date
              </th>
              <th className="w-[130px] py-2 px-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide tabular-nums">
                Exp. Date
              </th>
              <th className="w-[130px] py-2 px-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide tabular-nums">
                Uploaded Date
              </th>
              <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Notes
              </th>
              {/* Actions column — no header text */}
              <th className="w-[80px] py-2 px-3" />
            </tr>
          </thead>
          <tbody>
            {folders.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No folders configured for this document type.
                </td>
              </tr>
            ) : (
              folders.map((folder) => (
                <FolderRow
                  key={folder.subCategory}
                  folder={folder}
                  onUploadNewVersion={() => onUploadNewVersion(folder)}
                  onDeleteFolder={onDeleteFolder ? () => onDeleteFolder(folder) : undefined}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
