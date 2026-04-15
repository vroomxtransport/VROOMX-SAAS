'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Archive, ArchiveRestore, Building2, Store } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { archiveShop, reactivateShop } from '@/app/actions/shops'
import { SHOP_KIND_LABELS } from '@/types'
import type { Shop } from '@/types/database'
import { useShops } from '@/hooks/use-shops'

interface ShopListProps {
  shops: Shop[]
  canManage: boolean
}

export function ShopList({ shops: initialShops, canManage }: ShopListProps) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Hydrate the list via realtime so archive/unarchive from another tab lands.
  const { data: shops = initialShops } = useShops({ includeArchived: true })

  function handleToggleArchive(shop: Shop) {
    setPendingId(shop.id)
    startTransition(async () => {
      const action = shop.is_active ? archiveShop : reactivateShop
      const result = await action(shop.id)
      const ok =
        !!result && typeof result === 'object' && 'success' in result && result.success === true
      if (!ok) {
        const msg =
          result && 'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Operation failed.'
        toast.error(msg)
      } else {
        toast.success(shop.is_active ? `${shop.name} archived.` : `${shop.name} restored.`)
        router.refresh()
      }
      setPendingId(null)
    })
  }

  if (shops.length === 0) {
    return (
      <div className="widget-card flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Store className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">No shops yet</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Shops are where your maintenance work happens — your own bay, or an external vendor. Create
          one to start logging work orders against it.
        </p>
      </div>
    )
  }

  return (
    <div className="widget-card !p-0 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            {canManage && <TableHead className="w-[1%] text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shops.map((shop) => {
            const Icon = shop.kind === 'internal' ? Building2 : Store
            const location = [shop.city, shop.state].filter(Boolean).join(', ')
            const isBusy = pendingId === shop.id
            return (
              <TableRow key={shop.id} className={!shop.is_active ? 'opacity-60' : ''}>
                <TableCell>
                  <Link
                    href={`/maintenance/shops/${shop.id}`}
                    className="flex items-center gap-2 font-medium text-foreground hover:underline"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{shop.name}</span>
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-normal">
                    {SHOP_KIND_LABELS[shop.kind]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {shop.contact_name || shop.phone || shop.email || '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{location || '—'}</TableCell>
                <TableCell>
                  {shop.is_active ? (
                    <Badge className="bg-green-50 text-green-700 border-green-200 font-normal">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="font-normal text-muted-foreground">
                      Archived
                    </Badge>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleArchive(shop)}
                      disabled={isBusy}
                      aria-label={shop.is_active ? 'Archive shop' : 'Restore shop'}
                    >
                      {shop.is_active ? (
                        <Archive className="h-4 w-4" />
                      ) : (
                        <ArchiveRestore className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
