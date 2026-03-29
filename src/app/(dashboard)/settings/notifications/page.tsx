import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Bell } from 'lucide-react'

export const metadata = { title: 'Notification Preferences | VroomX' }

export default function NotificationsPage() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>Control when and how you receive alerts</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <div className="rounded-full bg-muted p-3 mb-3">
            <Bell className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Coming Soon</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Configure email notifications for order status changes, document expirations, safety events, and driver check-ins. Set up threshold alerts for financial metrics.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
