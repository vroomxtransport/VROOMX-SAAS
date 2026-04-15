import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, Plus } from 'lucide-react'
import { authorize } from '@/lib/authz'
import { fetchShops } from '@/lib/queries/shops'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { ShopList } from './_components/shop-list'

export const metadata = { title: 'Shops | VroomX' }

export default async function ShopsDirectoryPage() {
  const auth = await authorize('shops.view')
  if (!auth.ok) redirect('/login')
  const { supabase, permissions } = auth.ctx

  const shops = await fetchShops(supabase, { includeArchived: true })
  const canManage = permissions.includes('*') || permissions.some((p) => p === 'shops.create' || p === 'shops.*')

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/maintenance"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Maintenance
        </Link>
      </div>
      <PageHeader
        title="Shops"
        subtitle="Internal bays and external vendors where work orders run"
      >
        {canManage && (
          <Button asChild size="sm">
            <Link href="/maintenance/shops/new">
              <Plus className="mr-1.5 h-4 w-4" />
              New Shop
            </Link>
          </Button>
        )}
      </PageHeader>
      <ShopList shops={shops} canManage={canManage} />
    </div>
  )
}
