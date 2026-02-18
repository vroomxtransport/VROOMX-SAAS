'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createBusinessExpense, updateBusinessExpense } from '@/app/actions/business-expenses'
import { BUSINESS_EXPENSE_CATEGORIES, BUSINESS_EXPENSE_CATEGORY_LABELS, BUSINESS_EXPENSE_RECURRENCES, BUSINESS_EXPENSE_RECURRENCE_LABELS } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { BusinessExpense } from '@/types/database'
import type { Truck } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  expense: BusinessExpense | null
  trucks: Truck[]
}

export function BusinessExpenseForm({ open, onClose, expense, trucks }: Props) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>('other')
  const [recurrence, setRecurrence] = useState<string>('monthly')
  const [amount, setAmount] = useState('')
  const [truckId, setTruckId] = useState<string>('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [notes, setNotes] = useState('')

  // Populate form when editing
  useEffect(() => {
    if (expense) {
      setName(expense.name)
      setCategory(expense.category)
      setRecurrence(expense.recurrence)
      setAmount(expense.amount)
      setTruckId(expense.truck_id ?? '')
      setEffectiveFrom(expense.effective_from)
      setEffectiveTo(expense.effective_to ?? '')
      setNotes(expense.notes ?? '')
    } else {
      setName('')
      setCategory('other')
      setRecurrence('monthly')
      setAmount('')
      setTruckId('')
      setEffectiveFrom(new Date().toISOString().split('T')[0])
      setEffectiveTo('')
      setNotes('')
    }
    setError(null)
    setFieldErrors({})
  }, [expense, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setFieldErrors({})

    const data = {
      name,
      category,
      recurrence,
      amount,
      truck_id: truckId || '',
      effective_from: effectiveFrom,
      effective_to: effectiveTo || '',
      notes: notes || '',
    }

    const result = expense
      ? await updateBusinessExpense(expense.id, data)
      : await createBusinessExpense(data)

    setSaving(false)

    if ('error' in result && result.error) {
      if (typeof result.error === 'string') {
        setError(result.error)
      } else {
        setFieldErrors(result.error as Record<string, string[]>)
      }
      return
    }

    queryClient.invalidateQueries({ queryKey: ['business-expenses'] })
    queryClient.invalidateQueries({ queryKey: ['pnl'] })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? 'Edit Expense' : 'Add Business Expense'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Commercial Auto Insurance" />
            {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUSINESS_EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{BUSINESS_EXPENSE_CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.category && <p className="text-xs text-destructive">{fieldErrors.category[0]}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Recurrence</Label>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUSINESS_EXPENSE_RECURRENCES.map((r) => (
                    <SelectItem key={r} value={r}>{BUSINESS_EXPENSE_RECURRENCE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.recurrence && <p className="text-xs text-destructive">{fieldErrors.recurrence[0]}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input id="amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              {fieldErrors.amount && <p className="text-xs text-destructive">{fieldErrors.amount[0]}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Truck</Label>
              <Select value={truckId} onValueChange={setTruckId}>
                <SelectTrigger><SelectValue placeholder="Company-wide" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Company-wide</SelectItem>
                  {trucks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.unit_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="effectiveFrom">Effective From</Label>
              <Input id="effectiveFrom" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
              {fieldErrors.effective_from && <p className="text-xs text-destructive">{fieldErrors.effective_from[0]}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="effectiveTo">Effective To</Label>
              <Input id="effectiveTo" type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} placeholder="Open-ended" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : expense ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
