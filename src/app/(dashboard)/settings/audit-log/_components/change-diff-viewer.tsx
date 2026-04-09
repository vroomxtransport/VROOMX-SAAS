'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChangeDiff {
  before: Record<string, unknown>
  after: Record<string, unknown>
}

interface ChangeDiffViewerProps {
  changeDiff: ChangeDiff | null
}

type FieldStatus = 'added' | 'removed' | 'changed' | 'unchanged'

interface DiffField {
  key: string
  before: unknown
  after: unknown
  status: FieldStatus
}

function classifyFields(diff: ChangeDiff): DiffField[] {
  const allKeys = new Set([
    ...Object.keys(diff.before),
    ...Object.keys(diff.after),
  ])

  const fields: DiffField[] = []

  for (const key of allKeys) {
    const hasBefore = key in diff.before
    const hasAfter = key in diff.after
    const beforeVal = diff.before[key]
    const afterVal = diff.after[key]

    let status: FieldStatus

    if (!hasBefore && hasAfter) {
      status = 'added'
    } else if (hasBefore && !hasAfter) {
      status = 'removed'
    } else if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      status = 'changed'
    } else {
      status = 'unchanged'
    }

    fields.push({ key, before: beforeVal, after: afterVal, status })
  }

  // Sort: changed first, then added/removed, then unchanged
  const order: Record<FieldStatus, number> = {
    changed: 0,
    added: 1,
    removed: 2,
    unchanged: 3,
  }

  return fields.sort((a, b) => order[a.status] - order[b.status])
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'string') return val
  return JSON.stringify(val)
}

function FieldRow({ field }: { field: DiffField }) {
  const labelClass = 'text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5'

  if (field.status === 'unchanged') return null

  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 text-xs',
        field.status === 'added' && 'border-emerald-500/20 bg-emerald-500/5',
        field.status === 'removed' && 'border-red-500/20 bg-red-500/5',
        field.status === 'changed' && 'border-amber-500/20 bg-amber-500/5'
      )}
    >
      <p className="font-mono text-[11px] font-semibold text-foreground/70 mb-1.5">
        {field.key.replace(/_/g, ' ')}
      </p>

      {field.status === 'added' && (
        <div>
          <p className={labelClass}>Added</p>
          <p className="font-mono text-[11px] text-emerald-700 break-all">
            {formatValue(field.after)}
          </p>
        </div>
      )}

      {field.status === 'removed' && (
        <div>
          <p className={labelClass}>Removed</p>
          <p className="font-mono text-[11px] text-red-700 break-all line-through opacity-70">
            {formatValue(field.before)}
          </p>
        </div>
      )}

      {field.status === 'changed' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className={labelClass}>Before</p>
            <p className="font-mono text-[11px] text-red-700 break-all line-through opacity-70">
              {formatValue(field.before)}
            </p>
          </div>
          <div>
            <p className={labelClass}>After</p>
            <p className="font-mono text-[11px] text-emerald-700 break-all">
              {formatValue(field.after)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export function ChangeDiffViewer({ changeDiff }: ChangeDiffViewerProps) {
  const [expanded, setExpanded] = useState(false)

  if (!changeDiff) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const fields = classifyFields(changeDiff)
  const changedCount = fields.filter((f) => f.status !== 'unchanged').length

  if (changedCount === 0) {
    return <span className="text-xs text-muted-foreground">No changes</span>
  }

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {changedCount} change{changedCount !== 1 ? 's' : ''}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 max-w-[420px]">
          {fields.map((field) => (
            <FieldRow key={field.key} field={field} />
          ))}
        </div>
      )}
    </div>
  )
}
