import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Key } from 'lucide-react'

export const metadata = { title: 'API Keys | VroomX' }

export default function ApiKeysPage() {
  return (
    <Card>
      <CardHeader className="px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Key className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>Manage programmatic access to your data</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6">
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <div className="rounded-full bg-muted p-3 mb-3">
            <Key className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Coming Soon</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Generate and manage API keys for third-party integrations, custom automations, and external reporting tools. Each key can be scoped to specific permissions.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
