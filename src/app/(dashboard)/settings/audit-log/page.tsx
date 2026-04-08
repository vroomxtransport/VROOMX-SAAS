import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ScrollText } from 'lucide-react'

export const metadata = { title: 'Audit Log | VroomX' }

export default function AuditLogPage() {
  return (
    <Card>
      <CardHeader className="px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <ScrollText className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>Track all activity in your organization</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6">
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <div className="rounded-full bg-muted p-3 mb-3">
            <ScrollText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Coming Soon</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            View a complete, searchable history of every action taken in your organization. Filter by user, action type, and date range. Export audit trails for compliance reviews.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
