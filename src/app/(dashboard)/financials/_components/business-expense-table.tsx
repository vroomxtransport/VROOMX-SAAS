'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { deleteBusinessExpense } from '@/app/actions/business-expenses'
import { BUSINESS_EXPENSE_CATEGORY_LABELS, BUSINESS_EXPENSE_RECURRENCE_LABELS } from '@/types'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import type { BusinessExpense } from '@/types/database'

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

interface Props {
  expenses: BusinessExpense[]
  onEdit: (expense: BusinessExpense) => void
}

export function BusinessExpenseTable({ expenses, onEdit }: Props) {
  const queryClient = useQueryClient()

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this expense?')) return
    const result = await deleteBusinessExpense(id)
    if (!('error' in result && result.error)) {
      queryClient.invalidateQueries({ queryKey: ['business-expenses'] })
    }
  }, [queryClient])

  if (expenses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">No business expenses yet. Add your first expense to start tracking your P&L.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Recurrence</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Truck</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Effective</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-medium text-foreground">{expense.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {BUSINESS_EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium">
                    {BUSINESS_EXPENSE_RECURRENCE_LABELS[expense.recurrence] ?? expense.recurrence}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {formatCurrency(expense.amount)}
                  {expense.recurrence !== 'one_time' && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      /{expense.recurrence === 'monthly' ? 'mo' : expense.recurrence === 'quarterly' ? 'qtr' : 'yr'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {expense.truck ? (expense.truck as { unit_number: string }).unit_number : 'Company-wide'}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {expense.effective_from}
                  {expense.effective_to ? ` → ${expense.effective_to}` : ' → Present'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(expense)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(expense.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
