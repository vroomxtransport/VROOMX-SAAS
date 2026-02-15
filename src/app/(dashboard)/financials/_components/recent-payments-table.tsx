import { format } from 'date-fns'
import type { RecentPayment } from '@/lib/queries/financials'

interface RecentPaymentsTableProps {
  data: RecentPayment[]
}

export function RecentPaymentsTable({ data }: RecentPaymentsTableProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <h3 className="text-base font-semibold text-foreground mb-3">Recent Payments</h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No payments recorded</p>
      ) : (
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
              {data.map((payment, i) => (
                <tr key={`${payment.orderNumber}-${i}`} className="border-b border-border-subtle last:border-0">
                  <td className="py-2 font-medium text-foreground">{payment.orderNumber}</td>
                  <td className="py-2 text-right tabular-nums text-foreground font-medium">
                    ${payment.amount.toLocaleString()}
                  </td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {format(new Date(payment.paymentDate), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
