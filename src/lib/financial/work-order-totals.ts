/**
 * Pure aggregation helpers for work-order line items.
 *
 * Supabase returns numeric columns as **strings** (see `.claude/rules/backend/database.md`);
 * we preserve that convention on input and output so callers can round-trip values into
 * `maintenance_records.total_labor` / `total_parts` / `grand_total` without re-casting.
 *
 * All arithmetic is done in JavaScript `number` internally. If a caller needs
 * stronger precision for six-figure parts bills we can swap in a decimal library —
 * not needed for the current line-item scale (< 4 digits before the decimal).
 */

export interface WorkOrderItemTotal {
  kind: 'labor' | 'part'
  amount: string
}

export interface WorkOrderTotals {
  totalLabor: string
  totalParts: string
  grandTotal: string
}

/**
 * Sum labor + parts from a list of line items and return fixed-2dp strings.
 * Non-numeric amounts are ignored (a corrupt row shouldn't break the total).
 */
export function computeWorkOrderTotals(items: WorkOrderItemTotal[]): WorkOrderTotals {
  let labor = 0
  let parts = 0
  for (const item of items) {
    const n = Number(item.amount)
    if (!Number.isFinite(n)) continue
    if (item.kind === 'labor') labor += n
    else parts += n
  }
  const fix = (n: number): string => n.toFixed(2)
  return {
    totalLabor: fix(labor),
    totalParts: fix(parts),
    grandTotal: fix(labor + parts),
  }
}
