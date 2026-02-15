import type { TopBroker } from '@/lib/queries/financials'

interface TopBrokersTableProps {
  data: TopBroker[]
}

export function TopBrokersTable({ data }: TopBrokersTableProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <h3 className="text-base font-semibold text-foreground mb-3">Top Brokers by Revenue</h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No broker data available</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="pb-2 text-left font-medium text-muted-foreground">Broker</th>
                <th className="pb-2 text-right font-medium text-muted-foreground">Orders</th>
                <th className="pb-2 text-right font-medium text-muted-foreground">Revenue</th>
                <th className="pb-2 text-right font-medium text-muted-foreground">Avg Value</th>
              </tr>
            </thead>
            <tbody>
              {data.map((broker) => (
                <tr key={broker.brokerName} className="border-b border-border-subtle last:border-0">
                  <td className="py-2 font-medium text-foreground">{broker.brokerName}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">{broker.orderCount}</td>
                  <td className="py-2 text-right tabular-nums text-foreground font-medium">
                    ${broker.totalRevenue.toLocaleString()}
                  </td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    ${broker.avgOrderValue.toLocaleString()}
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
