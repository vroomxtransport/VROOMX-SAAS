'use client'

import { EntityCard } from '@/components/shared/entity-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, Calendar } from 'lucide-react'
import {
  COMPLIANCE_DOC_TYPE_LABELS,
  COMPLIANCE_ENTITY_TYPE_LABELS,
  COMPLIANCE_DOC_STATUS_COLORS,
  COMPLIANCE_DOC_STATUS_LABELS,
} from '@/types'
import type { ComplianceDocType, ComplianceEntityType, ComplianceDocStatus } from '@/types'
import type { ComplianceDocument } from '@/types/database'

interface DocumentCardProps {
  doc: ComplianceDocument
  onEdit: () => void
  onDelete: () => void
}

function getDocStatus(expiresAt: string | null): ComplianceDocStatus | 'no_expiry' {
  if (!expiresAt) return 'no_expiry'
  const now = new Date()
  const expiry = new Date(expiresAt)
  if (expiry <= now) return 'expired'
  const thirtyDays = new Date()
  thirtyDays.setDate(thirtyDays.getDate() + 30)
  if (expiry <= thirtyDays) return 'expiring_soon'
  return 'valid'
}

const STATUS_DISPLAY: Record<ComplianceDocStatus | 'no_expiry', { label: string; colors: string }> = {
  valid: { label: COMPLIANCE_DOC_STATUS_LABELS.valid, colors: COMPLIANCE_DOC_STATUS_COLORS.valid },
  expiring_soon: { label: COMPLIANCE_DOC_STATUS_LABELS.expiring_soon, colors: COMPLIANCE_DOC_STATUS_COLORS.expiring_soon },
  expired: { label: COMPLIANCE_DOC_STATUS_LABELS.expired, colors: COMPLIANCE_DOC_STATUS_COLORS.expired },
  no_expiry: { label: 'No Expiry', colors: 'bg-muted/50 text-foreground/80 border-border' },
}

export function DocumentCard({ doc, onEdit, onDelete }: DocumentCardProps) {
  const status = getDocStatus(doc.expires_at)
  const display = STATUS_DISPLAY[status]

  return (
    <EntityCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-foreground">{doc.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {COMPLIANCE_DOC_TYPE_LABELS[doc.document_type as ComplianceDocType] ?? doc.document_type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {COMPLIANCE_ENTITY_TYPE_LABELS[doc.entity_type as ComplianceEntityType] ?? doc.entity_type}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        {doc.expires_at ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{new Date(doc.expires_at).toLocaleDateString()}</span>
          </div>
        ) : (
          <span />
        )}
        <Badge variant="outline" className={display.colors}>
          {display.label}
        </Badge>
      </div>
    </EntityCard>
  )
}
