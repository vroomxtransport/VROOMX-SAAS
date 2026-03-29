'use client'

import { useState } from 'react'
import { updateCompanyProfile } from '@/app/actions/tenant-settings'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Building2, Loader2 } from 'lucide-react'
import type { Tenant } from '@/types/database'

interface ProfileFormProps {
  tenant: Pick<
    Tenant,
    'name' | 'dot_number' | 'mc_number' | 'address' | 'city' | 'state' | 'zip' | 'phone'
  >
}

export function ProfileForm({ tenant }: ProfileFormProps) {
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const [fields, setFields] = useState({
    name: tenant.name ?? '',
    dotNumber: tenant.dot_number ?? '',
    mcNumber: tenant.mc_number ?? '',
    address: tenant.address ?? '',
    city: tenant.city ?? '',
    state: tenant.state ?? '',
    zip: tenant.zip ?? '',
    phone: tenant.phone ?? '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setFields(prev => ({ ...prev, [name]: value }))
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: [] }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFieldErrors({})

    try {
      const result = await updateCompanyProfile(fields)

      if ('error' in result && result.error) {
        if (typeof result.error === 'string') {
          toast.error(result.error)
        } else {
          setFieldErrors(result.error as Record<string, string[]>)
          toast.error('Please fix the errors below')
        }
      } else {
        toast.success('Company profile updated')
      }
    } catch {
      toast.error('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function getFieldError(field: string): string | undefined {
    return fieldErrors[field]?.[0]
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="widget-card !p-0 border-0 shadow-none">
        <CardHeader className="pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Company Profile</CardTitle>
              <CardDescription className="text-sm">
                Basic information about your carrier organization
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-5">
          {/* Company Name — full width */}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Company Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              value={fields.name}
              onChange={handleChange}
              placeholder="Acme Carriers LLC"
              className={getFieldError('name') ? 'border-destructive' : ''}
            />
            {getFieldError('name') && (
              <p className="text-xs text-destructive">{getFieldError('name')}</p>
            )}
          </div>

          {/* MC + DOT — two columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="mcNumber">MC Number</Label>
              <Input
                id="mcNumber"
                name="mcNumber"
                value={fields.mcNumber}
                onChange={handleChange}
                placeholder="MC-123456"
                className={getFieldError('mcNumber') ? 'border-destructive' : ''}
              />
              {getFieldError('mcNumber') && (
                <p className="text-xs text-destructive">{getFieldError('mcNumber')}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dotNumber">DOT Number</Label>
              <Input
                id="dotNumber"
                name="dotNumber"
                value={fields.dotNumber}
                onChange={handleChange}
                placeholder="1234567"
                className={getFieldError('dotNumber') ? 'border-destructive' : ''}
              />
              {getFieldError('dotNumber') && (
                <p className="text-xs text-destructive">{getFieldError('dotNumber')}</p>
              )}
            </div>
          </div>

          {/* Address — full width */}
          <div className="space-y-1.5">
            <Label htmlFor="address">Street Address</Label>
            <Input
              id="address"
              name="address"
              value={fields.address}
              onChange={handleChange}
              placeholder="123 Main St"
              className={getFieldError('address') ? 'border-destructive' : ''}
            />
            {getFieldError('address') && (
              <p className="text-xs text-destructive">{getFieldError('address')}</p>
            )}
          </div>

          {/* City / State / Zip — three columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                name="city"
                value={fields.city}
                onChange={handleChange}
                placeholder="Chicago"
                className={getFieldError('city') ? 'border-destructive' : ''}
              />
              {getFieldError('city') && (
                <p className="text-xs text-destructive">{getFieldError('city')}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                name="state"
                value={fields.state}
                onChange={handleChange}
                placeholder="IL"
                maxLength={2}
                className={getFieldError('state') ? 'border-destructive' : ''}
              />
              {getFieldError('state') && (
                <p className="text-xs text-destructive">{getFieldError('state')}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                name="zip"
                value={fields.zip}
                onChange={handleChange}
                placeholder="60601"
                className={getFieldError('zip') ? 'border-destructive' : ''}
              />
              {getFieldError('zip') && (
                <p className="text-xs text-destructive">{getFieldError('zip')}</p>
              )}
            </div>
          </div>

          {/* Phone — half width */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={fields.phone}
                onChange={handleChange}
                placeholder="(312) 555-0100"
                className={getFieldError('phone') ? 'border-destructive' : ''}
              />
              {getFieldError('phone') && (
                <p className="text-xs text-destructive">{getFieldError('phone')}</p>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end pt-4 border-t border-border-subtle">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
