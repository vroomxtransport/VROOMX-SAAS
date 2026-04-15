'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Fuel, KeyRound, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { connectFuelCard } from '@/app/actions/fuelcard'

interface FuelCardConnectFormProps {
  onConnected: () => void
}

export function FuelCardConnectForm({ onConnected }: FuelCardConnectFormProps) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const fieldError = (name: string): string | undefined => {
    if (!Object.prototype.hasOwnProperty.call(fieldErrors, name)) return undefined
    const messages = fieldErrors[name as keyof typeof fieldErrors]
    return Array.isArray(messages) ? messages[0] : undefined
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setServerError(null)
    setFieldErrors({})

    const result = await connectFuelCard({
      apiKey,
      accountNumber: accountNumber || undefined,
      provider: 'multi_service',
    })

    setSaving(false)

    if ('error' in result && result.error) {
      if (typeof result.error === 'string') {
        setServerError(result.error)
        toast.error(result.error)
      } else {
        setFieldErrors(result.error as Record<string, string[]>)
        toast.error('Please fix the highlighted fields')
      }
      return
    }

    toast.success('Fuel card connected successfully')
    queryClient.invalidateQueries({ queryKey: ['fuel-card-status'] })
    queryClient.invalidateQueries({ queryKey: ['fuel-card-transactions'] })
    onConnected()
  }

  return (
    <div className="widget-card max-w-lg">
      <div className="widget-header">
        <h3 className="widget-title">
          <span className="widget-accent-dot bg-brand" />
          Connect Fuel Card
        </h3>
      </div>

      {/* Integration info row */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand/10">
          <Fuel className="h-4 w-4 text-brand" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Multi Service Fuel Card</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Syncs fuel transactions automatically, matches to your fleet, and flags anomalies.
            Your API key is stored in an access-controlled database.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="apiKey" className="flex items-center gap-1.5">
            <KeyRound className="h-3 w-3" />
            API Key
          </Label>
          <Input
            id="apiKey"
            type="password"
            autoComplete="off"
            placeholder="Enter your Multi Service API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="mt-1.5"
            required
            minLength={10}
          />
          {fieldError('apiKey') && (
            <p className="mt-1 text-xs text-rose-600">{fieldError('apiKey')}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Found in your Multi Service portal under API Settings.
          </p>
        </div>

        <div>
          <Label htmlFor="accountNumber" className="flex items-center gap-1.5">
            <Hash className="h-3 w-3" />
            Account Number
            <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="accountNumber"
            type="text"
            placeholder="e.g. MSC-123456"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            className="mt-1.5"
          />
          {fieldError('accountNumber') && (
            <p className="mt-1 text-xs text-rose-600">{fieldError('accountNumber')}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            We&apos;ll fetch this from your API automatically — only needed if auto-detection fails.
          </p>
        </div>

        {serverError && (
          <div className="rounded-md border border-rose-200 px-3 py-2 text-xs text-rose-700">
            {serverError}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button
            type="submit"
            disabled={saving || !apiKey}
            className="bg-brand text-white hover:bg-brand/90"
          >
            {saving ? 'Connecting…' : 'Connect fuel card'}
          </Button>
        </div>
      </form>
    </div>
  )
}
