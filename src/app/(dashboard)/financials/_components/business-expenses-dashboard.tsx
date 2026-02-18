'use client'

import { useState, useCallback } from 'react'
import { useBusinessExpenses } from '@/hooks/use-business-expenses'
import { useTrucks } from '@/hooks/use-trucks'
import { BusinessExpenseTable } from './business-expense-table'
import { BusinessExpenseForm } from './business-expense-form'
import { BusinessExpenseSummaryCards } from './business-expense-summary-cards'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus } from 'lucide-react'
import type { BusinessExpense } from '@/types/database'
import type { BusinessExpenseRecurrence } from '@/types'

export function BusinessExpensesDashboard() {
  const [formOpen, setFormOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<BusinessExpense | null>(null)
  const [filterRecurrence, setFilterRecurrence] = useState<BusinessExpenseRecurrence | ''>('')

  const { data, isLoading } = useBusinessExpenses(
    filterRecurrence ? { recurrence: filterRecurrence } : {}
  )
  const { data: trucksData } = useTrucks({ pageSize: 100 })

  const expenses = data?.expenses ?? []
  const trucks = trucksData?.trucks ?? []

  const handleEdit = useCallback((expense: BusinessExpense) => {
    setEditingExpense(expense)
    setFormOpen(true)
  }, [])

  const handleCreate = useCallback(() => {
    setEditingExpense(null)
    setFormOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setFormOpen(false)
    setEditingExpense(null)
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <BusinessExpenseSummaryCards expenses={expenses} truckCount={trucks.length} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            value={filterRecurrence}
            onChange={(e) => setFilterRecurrence(e.target.value as BusinessExpenseRecurrence | '')}
          >
            <option value="">All Types</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
            <option value="one_time">One-Time</option>
          </select>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Expense
        </Button>
      </div>

      <BusinessExpenseTable
        expenses={expenses}
        onEdit={handleEdit}
      />

      <BusinessExpenseForm
        open={formOpen}
        onClose={handleClose}
        expense={editingExpense}
        trucks={trucks}
      />
    </div>
  )
}
