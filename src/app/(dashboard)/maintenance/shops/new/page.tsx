import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { authorize } from '@/lib/authz'
import { PageHeader } from '@/components/shared/page-header'
import { ShopForm } from '../_components/shop-form'

export const metadata = { title: 'New Shop | VroomX' }

export default async function NewShopPage() {
  const auth = await authorize('shops.create')
  if (!auth.ok) redirect('/login')

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
      <PageHeader title="New Shop" subtitle="Add a bay or external vendor" />
      <ShopForm />
    </div>
  )
}
