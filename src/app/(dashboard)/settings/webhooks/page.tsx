import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Webhook } from 'lucide-react'

export const metadata = { title: 'Webhooks | VroomX' }

export default function WebhooksPage() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Webhook className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>Receive real-time event notifications</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <div className="rounded-full bg-muted p-3 mb-3">
            <Webhook className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Coming Soon</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Configure webhook endpoints to receive real-time notifications when orders change status, trips complete, or invoices are generated. Supports custom headers and retry policies.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
