import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { authorize } from '@/lib/authz'
import { fetchShop } from '@/lib/queries/shops'
import { PageHeader } from '@/components/shared/page-header'
import { ShopForm } from '../_components/shop-form'

export const metadata = { title: 'Edit Shop | VroomX' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditShopPage({ params }: Props) {
  const { id } = await params
  const auth = await authorize('shops.view')
  if (!auth.ok) redirect('/login')
  const { supabase, tenantId, permissions } = auth.ctx

  const shop = await fetchShop(supabase, id)
  if (!shop || shop.tenant_id !== tenantId) notFound()

  const canEdit =
    permissions.includes('*') || permissions.includes('shops.update') || permissions.includes('shops.*')

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/maintenance/shops"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Shops
        </Link>
      </div>
      <PageHeader title={shop.name} subtitle={canEdit ? 'Edit shop details' : 'Read-only — you do not have edit permissions'} />
      {canEdit ? (
        <ShopForm shop={shop} />
      ) : (
        <div className="widget-card text-sm text-muted-foreground">
          Contact an admin to make changes to this shop.
        </div>
      )}
    </div>
  )
}
