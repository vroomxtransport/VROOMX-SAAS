'use client'

import { useState } from 'react'
import { updateFactoringFeeRate } from '@/app/actions/tenant-settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Building2, Loader2 } from 'lucide-react'

interface CompanySectionProps {
  factoringFeeRate: string
}

export function CompanySection({ factoringFeeRate }: CompanySectionProps) {
  const [rate, setRate] = useState(factoringFeeRate)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const result = await updateFactoringFeeRate({ factoringFeeRate: rate })
      if ('error' in result && result.error) {
        toast.error(typeof result.error === 'string' ? result.error : 'Invalid input')
      } else {
        toast.success('Factoring fee rate updated')
      }
    } catch {
      toast.error('Failed to update')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Company Settings
        </CardTitle>
        <CardDescription>
          Configure company-wide financial settings like factoring fees.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3 max-w-sm">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="factoring-fee-rate">Factoring Fee Rate (%)</Label>
            <Input
              id="factoring-fee-rate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 3.00"
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Applied when factoring an order. Set to 0 to hide the Factor button in billing.
        </p>
      </CardContent>
    </Card>
  )
}
