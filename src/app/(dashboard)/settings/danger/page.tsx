import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SeedSection } from '../seed-section'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import type { TenantRole } from '@/types'

export default async function DangerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const tenantId = user.app_metadata?.tenant_id
  const userRole = (user.app_metadata?.role ?? 'dispatcher') as TenantRole

  if (!tenantId) {
    redirect('/login')
  }

  if (userRole !== 'owner' && userRole !== 'admin') {
    redirect('/settings/profile')
  }

  const isOwner = userRole === 'owner' || userRole === 'admin'

  return (
    <div className="space-y-4">
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader className="px-6">
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Actions in this section can have irreversible consequences for your organization&apos;s data.
            Proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6">
          <p className="text-sm text-muted-foreground">
            The tools below are intended for testing and demonstration purposes only.
            Loading or clearing sample data will affect your live account.
          </p>
        </CardContent>
      </Card>

      <SeedSection isOwner={isOwner} />
    </div>
  )
}
