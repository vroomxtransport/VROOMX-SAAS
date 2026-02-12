'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTripExpenses } from '@/hooks/use-trip-expenses'
import {
  createTripExpense,
  updateTripExpense,
  deleteTripExpense,
} from '@/app/actions/trip-expenses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
} from '@/types'
import type { ExpenseCategory } from '@/types'
import type { TripExpense } from '@/types/database'

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

interface ExpenseFormData {
  category: ExpenseCategory
  custom_label: string
  amount: string
  expense_date: string
  notes: string
}

const EMPTY_FORM: ExpenseFormData = {
  category: 'fuel',
  custom_label: '',
  amount: '',
  expense_date: '',
  notes: '',
}

interface TripExpensesProps {
  tripId: string
}

export function TripExpenses({ tripId }: TripExpensesProps) {
  const queryClient = useQueryClient()
  const { data, isPending } = useTripExpenses(tripId)
  const expenses = data?.expenses ?? []

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ExpenseFormData>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null)

  const totalExpenses = expenses.reduce(
    (sum, e) => sum + parseFloat(e.amount || '0'),
    0
  )

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trip-expenses', tripId] })
    queryClient.invalidateQueries({ queryKey: ['trip', tripId] })
  }, [queryClient, tripId])

  const handleOpenAdd = useCallback(() => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setShowForm(true)
  }, [])

  const handleOpenEdit = useCallback((expense: TripExpense) => {
    setEditingId(expense.id)
    setForm({
      category: expense.category as ExpenseCategory,
      custom_label: expense.custom_label ?? '',
      amount: expense.amount,
      expense_date: expense.expense_date ?? '',
      notes: expense.notes ?? '',
    })
    setFormError('')
    setShowForm(true)
  }, [])

  const handleCancel = useCallback(() => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }, [])

  const handleSave = useCallback(async () => {
    // Validate
    const amount = parseFloat(form.amount)
    if (!form.amount || isNaN(amount) || amount <= 0) {
      setFormError('Amount must be greater than 0')
      return
    }

    setIsSaving(true)
    setFormError('')

    try {
      const payload = {
        category: form.category,
        custom_label: form.category === 'misc' ? form.custom_label : undefined,
        amount,
        expense_date: form.expense_date || undefined,
        notes: form.notes || undefined,
      }

      if (editingId) {
        const result = await updateTripExpense(editingId, tripId, payload)
        if ('error' in result && result.error) {
          setFormError(typeof result.error === 'string' ? result.error : 'Failed to update expense')
          return
        }
      } else {
        const result = await createTripExpense(tripId, payload)
        if ('error' in result && result.error) {
          setFormError(typeof result.error === 'string' ? result.error : 'Failed to add expense')
          return
        }
      }

      invalidate()
      handleCancel()
    } finally {
      setIsSaving(false)
    }
  }, [form, editingId, tripId, invalidate, handleCancel])

  const handleDelete = useCallback(async () => {
    if (!deleteExpenseId) return

    const result = await deleteTripExpense(deleteExpenseId, tripId)
    if ('error' in result && result.error) {
      console.error('Failed to delete expense:', result.error)
      return
    }

    invalidate()
    setDeleteExpenseId(null)
  }, [deleteExpenseId, tripId, invalidate])

  return (
    <div className="rounded-lg border bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Expenses</h2>
        </div>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={handleOpenAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        )}
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className="border-b bg-gray-50 p-4">
          <div className="space-y-3">
            {/* Category */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Category
              </label>
              <Select
                value={form.category}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, category: value as ExpenseCategory }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {EXPENSE_CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Label (shown only for misc) */}
            {form.category === 'misc' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Custom Label
                </label>
                <Input
                  placeholder="e.g., Parking, Car wash..."
                  value={form.custom_label}
                  onChange={(e) => setForm((f) => ({ ...f, custom_label: e.target.value }))}
                  className="bg-white"
                />
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Amount
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="bg-white"
              />
            </div>

            {/* Date */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Date (optional)
              </label>
              <Input
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
                className="bg-white"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Notes (optional)
              </label>
              <Input
                placeholder="Additional details..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="bg-white"
              />
            </div>

            {/* Error */}
            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                {editingId ? 'Update' : 'Add'} Expense
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Expenses List */}
      <div className="divide-y">
        {isPending ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No expenses recorded for this trip.
          </div>
        ) : (
          expenses.map((expense) => {
            const label =
              expense.category === 'misc' && expense.custom_label
                ? expense.custom_label
                : EXPENSE_CATEGORY_LABELS[expense.category as ExpenseCategory] ?? expense.category

            return (
              <div
                key={expense.id}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {label}
                    </span>
                    {expense.expense_date && (
                      <span className="text-xs text-gray-400">
                        {formatDate(expense.expense_date)}
                      </span>
                    )}
                  </div>
                  {expense.notes && (
                    <p className="text-xs text-gray-500">{expense.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(expense.amount)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600"
                    onClick={() => handleOpenEdit(expense)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                    onClick={() => setDeleteExpenseId(expense.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Total Row */}
      {expenses.length > 0 && (
        <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-2.5">
          <span className="text-sm font-semibold text-gray-900">Total</span>
          <span className="text-sm font-semibold text-gray-900">
            {formatCurrency(totalExpenses)}
          </span>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteExpenseId}
        onOpenChange={(open) => {
          if (!open) setDeleteExpenseId(null)
        }}
        title="Delete Expense"
        description="Are you sure you want to delete this expense? Trip financials will be recalculated."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
