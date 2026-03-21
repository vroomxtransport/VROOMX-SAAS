'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Check,
  AlertTriangle,
  X,
  Upload,
  Eye,
  RefreshCw,
  FileText,
} from 'lucide-react'
import type { ComplianceRequirement, ComplianceDocument } from '@/types/database'

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

type ItemStatus = 'missing' | 'valid' | 'expiring_soon' | 'expired'

function getItemStatus(doc: ComplianceDocument | null): ItemStatus {
  if (!doc) return 'missing'
  if (!doc.expires_at) return 'valid'

  const now = new Date()
  const expiry = new Date(doc.expires_at)

  if (expiry <= now) return 'expired'

  const thirtyDays = new Date()
  thirtyDays.setDate(thirtyDays.getDate() + 30)
  if (expiry <= thirtyDays) return 'expiring_soon'

  return 'valid'
}

function daysUntilExpiry(expiresAt: string): number {
  const now = new Date()
  const expiry = new Date(expiresAt)
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChecklistItemProps {
  requirement: ComplianceRequirement
  document: ComplianceDocument | null
  onUpload: (requirement: ComplianceRequirement) => void
  onView?: (document: ComplianceDocument) => void
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ItemStatus,
  {
    icon: React.ElementType
    iconClass: string
    badgeClass: string
    label: string
  }
> = {
  missing: {
    icon: X,
    iconClass: 'text-red-500',
    badgeClass:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
    label: 'Missing',
  },
  valid: {
    icon: Check,
    iconClass: 'text-green-500',
    badgeClass:
      'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800',
    label: 'Valid',
  },
  expiring_soon: {
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
    badgeClass:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
    label: 'Expiring Soon',
  },
  expired: {
    icon: X,
    iconClass: 'text-red-500',
    badgeClass:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
    label: 'Expired',
  },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChecklistItem({
  requirement,
  document,
  onUpload,
  onView,
}: ChecklistItemProps) {
  const status = getItemStatus(document)
  const config = STATUS_CONFIG[status]
  const StatusIcon = config.icon

  const expiryInfo =
    document?.expires_at
      ? (() => {
          const days = daysUntilExpiry(document.expires_at)
          if (days < 0)
            return { text: `Expired ${Math.abs(days)} days ago`, urgent: true }
          if (days === 0) return { text: 'Expires today', urgent: true }
          return { text: `Expires ${new Date(document.expires_at).toLocaleDateString()}`, urgent: days <= 30 }
        })()
      : null

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3 shadow-sm transition-all duration-150 hover:border-brand/20 hover:shadow-md">
      {/* Status icon */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/60">
        <StatusIcon className={`h-4 w-4 ${config.iconClass}`} />
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {requirement.display_name}
          </span>
          {requirement.regulation_reference && (
            <Badge
              variant="outline"
              className="shrink-0 font-mono text-[10px] text-muted-foreground"
            >
              {requirement.regulation_reference}
            </Badge>
          )}
        </div>

        {/* Expiry / doc info row */}
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {document && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[180px]">{document.name}</span>
            </span>
          )}
          {expiryInfo && (
            <span className={expiryInfo.urgent ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
              {expiryInfo.text}
            </span>
          )}
          {requirement.description && !document && (
            <span className="text-muted-foreground/70 italic">
              {requirement.description}
            </span>
          )}
        </div>
      </div>

      {/* Status badge */}
      <Badge
        variant="outline"
        className={`hidden shrink-0 text-xs sm:inline-flex ${config.badgeClass}`}
      >
        {config.label}
      </Badge>

      {/* Action button */}
      <div className="shrink-0">
        {status === 'missing' && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs font-medium"
            onClick={() => onUpload(requirement)}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </Button>
        )}
        {status === 'valid' && document && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => onView?.(document)}
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </Button>
        )}
        {(status === 'expiring_soon' || status === 'expired') && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs font-medium border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
            onClick={() => onUpload(requirement)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Replace
          </Button>
        )}
      </div>
    </div>
  )
}
