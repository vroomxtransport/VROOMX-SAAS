'use client'

import { useState, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import type { RecentPayment } from '@/lib/queries/receivables'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import type { EnhancedFilterConfig, DateRange } from '@/types/filters'

const FILTER_CONFIG: EnhancedFilterConfig[] = [
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Search order number...',
  },
  {
    key: 'dateRange',
    label: 'Payment Date',
    type: 'date-range',
  },
]

interface RecentPaymentsTableProps {
  data: RecentPayment[]
}

export function RecentPaymentsTable({ data = [] }: RecentPaymentsTableProps) {
  const [activeFilters, setActiveFilters] = useState<
    Record<string, string | string[] | DateRange | undefined>
  >({})

  const handleFilterChange = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      setActiveFilters((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const filteredData = useMemo(() => {
    let result = [...data]

    // Search filter
    const search = activeFilters.search as string | undefined
    if (search) {
      const term = search.toLowerCase()
      result = result.filter((p) =>
        p.orderNumber.toLowerCase().includes(term)
      )
    }

    // Date range filter
    const dateRange = activeFilters.dateRange as DateRange | undefined
    if (dateRange) {
      const from = new Date(dateRange.from)
      const to = new Date(dateRange.to)
      result = result.filter((p) => {
        const payDate = new Date(p.paymentDate)
        return payDate >= from && payDate <= to
      })
    }

    return result
  }, [data, activeFilters])

  const handleCsvExport = useCallback(async (): Promise<Record<string, unknown>[]> => {
    return filteredData.map((p) => ({
      'Order Number': p.orderNumber,
      'Amount': p.amount,
      'Payment Date': p.paymentDate,
    }))
  }, [filteredData])

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground">Recent Payments</h3>
        {data.length > 0 && (
          <CsvExportButton
            filename="recent-payments"
            headers={['Order Number', 'Amount', 'Payment Date']}
            fetchData={handleCsvExport}
          />
        )}
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No payments recorded</p>
      ) : (
        <div className="space-y-3">
          <EnhancedFilterBar
            filters={FILTER_CONFIG}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            resultCount={filteredData.length}
          />

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="pb-2 text-left font-medium text-muted-foreground">Order #</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">Amount</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-muted-foreground">
                      No payments match your filters
                    </td>
                  </tr>
                ) : (
                  filteredData.map((payment, i) => (
                    <tr key={`${payment.orderNumber}-${i}`} className="border-b border-border-subtle last:border-0">
                      <td className="py-2 font-medium text-foreground">{payment.orderNumber}</td>
                      <td className="py-2 text-right tabular-nums text-foreground font-medium">
                        ${payment.amount.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {format(new Date(payment.paymentDate), 'MMM d, yyyy')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
