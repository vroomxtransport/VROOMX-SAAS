import { Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface WorkOrderCustomerCardProps {
  tenantName: string
}

export function WorkOrderCustomerCard({ tenantName }: WorkOrderCustomerCardProps) {
  return (
    <div className="widget-card p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{tenantName}</p>
          <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">
            Internal
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">Fleet owner / operator</p>
      </div>
    </div>
  )
}
