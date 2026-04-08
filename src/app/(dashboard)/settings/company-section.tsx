'use client'

import { useState, useMemo } from 'react'
import { updateFactoringFeeRate } from '@/app/actions/tenant-settings'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { CircleDollarSign, Loader2, Info } from 'lucide-react'

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

  const exampleLoad = 5000
  const parsedRate = useMemo(() => {
    const n = parseFloat(rate)
    return isNaN(n) || n < 0 ? 0 : n
  }, [rate])
  const exampleFee = useMemo(() => ((parsedRate / 100) * exampleLoad).toFixed(2), [parsedRate])
  const exampleNet = useMemo(() => (exampleLoad - parseFloat(exampleFee)).toFixed(2), [exampleFee])

  return (
    <Card className="widget-card !p-0 border-0 shadow-none">
      <CardHeader className="px-6 pt-5 pb-4 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <CircleDollarSign className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Order &amp; Financial Defaults</CardTitle>
            <CardDescription className="text-sm">
              Configure default financial settings for orders and billing
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-6 pt-6 pb-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <Label htmlFor="factoring-fee-rate" className="font-medium">
              Factoring Fee Rate
            </Label>
            <div className="relative flex items-center">
              <Input
                id="factoring-fee-rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="e.g. 3.00"
                className="pr-8"
              />
              <span className="pointer-events-none absolute right-3 text-sm text-muted-foreground select-none">
                %
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Applied when factoring an order. Set to 0 to hide the Factor button in billing.
            </p>
          </div>
        </div>

        {/* Live example calculation card */}
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          <p className="text-sm text-blue-700">
            <span className="font-medium">Example:</span> On a{' '}
            <span className="font-medium">$5,000</span> load with{' '}
            <span className="font-medium">{parsedRate.toFixed(2)}%</span> factoring fee &rarr;{' '}
            Fee: <span className="font-medium">${exampleFee}</span> &middot; Net:{' '}
            <span className="font-medium">${exampleNet}</span>
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex justify-end px-6 pt-4 pb-5 border-t border-border-subtle">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
