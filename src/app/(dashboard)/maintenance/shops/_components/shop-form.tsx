'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createShop, updateShop } from '@/app/actions/shops'
import type { Shop } from '@/types/database'
import type { ShopKind } from '@/types'

interface ShopFormProps {
  /** If set → edit mode. Otherwise → create mode. */
  shop?: Shop
}

export function ShopForm({ shop }: ShopFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [values, setValues] = useState({
    name: shop?.name ?? '',
    kind: (shop?.kind ?? 'external') as ShopKind,
    contactName: shop?.contact_name ?? '',
    phone: shop?.phone ?? '',
    email: shop?.email ?? '',
    address: shop?.address ?? '',
    city: shop?.city ?? '',
    state: shop?.state ?? '',
    zip: shop?.zip ?? '',
    notes: shop?.notes ?? '',
    isActive: shop?.is_active ?? true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    startTransition(async () => {
      const action = shop ? (data: unknown) => updateShop(shop.id, data) : createShop
      const result = await action(values)
      const ok =
        !!result && typeof result === 'object' && 'success' in result && result.success === true
      if (!ok) {
        if (result && 'error' in result) {
          if (typeof result.error === 'string') {
            toast.error(result.error)
          } else if (result.error && typeof result.error === 'object') {
            const flat: Record<string, string> = {}
            for (const [k, v] of Object.entries(result.error)) {
              if (Array.isArray(v) && v.length > 0) flat[k] = String(v[0])
            }
            setErrors(flat)
            toast.error('Please fix the highlighted fields.')
          }
        } else {
          toast.error('Operation failed.')
        }
        return
      }
      toast.success(shop ? 'Shop updated.' : 'Shop created.')
      router.push('/maintenance/shops')
      router.refresh()
    })
  }

  const field = (key: keyof typeof values) => ({
    value: values[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value })),
  })

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="widget-card space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" required maxLength={80} autoFocus {...field('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kind">Kind</Label>
            <Select
              value={values.kind}
              onValueChange={(v) => setValues((prev) => ({ ...prev, kind: v as ShopKind }))}
            >
              <SelectTrigger id="kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal bay</SelectItem>
                <SelectItem value="external">External vendor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="contactName">Contact name</Label>
            <Input id="contactName" maxLength={120} {...field('contactName')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" maxLength={40} {...field('phone')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" maxLength={200} {...field('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address">Address</Label>
          <Input id="address" maxLength={200} {...field('address')} />
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input id="city" maxLength={80} {...field('city')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State</Label>
            <Input id="state" maxLength={80} {...field('state')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zip">ZIP</Label>
            <Input id="zip" maxLength={20} {...field('zip')} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={3} maxLength={2000} {...field('notes')} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {shop ? 'Save changes' : 'Create shop'}
        </Button>
      </div>
    </form>
  )
}
