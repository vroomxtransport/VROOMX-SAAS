'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
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
import { dispatcherPayConfigSchema, type DispatcherPayConfigFormInput } from '@/lib/validations/dispatcher-payroll'
import { createDispatcherPayConfig, updateDispatcherPayConfig } from '@/app/actions/dispatcher-payroll'
import { DISPATCHER_PAY_TYPE_LABELS, PAY_FREQUENCY_LABELS } from '@/types'
import type { DispatcherPayConfig } from '@/types/database'
import type { Dispatcher } from '@/lib/queries/dispatchers'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

interface DispatcherPayConfigDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dispatcher: Dispatcher
  existingConfig?: DispatcherPayConfig | null
}

export function DispatcherPayConfigDrawer({
  open,
  onOpenChange,
  dispatcher,
  existingConfig,
}: DispatcherPayConfigDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const isEdit = !!existingConfig

  const form = useForm<DispatcherPayConfigFormInput>({
    resolver: zodResolver(dispatcherPayConfigSchema),
    defaultValues: {
      userId: dispatcher.user_id,
      payType: existingConfig?.pay_type ?? 'fixed_salary',
      payRate: existingConfig ? parseFloat(existingConfig.pay_rate) : undefined,
      payFrequency: existingConfig?.pay_frequency ?? 'biweekly',
      effectiveFrom: existingConfig?.effective_from ?? new Date().toISOString().split('T')[0],
      effectiveTo: existingConfig?.effective_to ?? '',
      notes: existingConfig?.notes ?? '',
    },
  })

  const payType = form.watch('payType')

  const handleSubmit = async (values: DispatcherPayConfigFormInput) => {
    setIsSubmitting(true)
    setError(null)

    const result = isEdit
      ? await updateDispatcherPayConfig(existingConfig!.id, values)
      : await createDispatcherPayConfig(values)

    if ('error' in result && result.error) {
      setError(typeof result.error === 'string' ? result.error : 'Validation error')
      setIsSubmitting(false)
      return
    }

    queryClient.invalidateQueries({ queryKey: ['dispatchers-with-pay-config'] })
    queryClient.invalidateQueries({ queryKey: ['dispatcher-pay-configs'] })
    setIsSubmitting(false)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit' : 'Set'} Pay Configuration</SheetTitle>
          <SheetDescription>
            Configure compensation for {dispatcher.full_name || dispatcher.email}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-6 px-4 pb-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="payType">Pay Type</Label>
            <Select
              value={form.watch('payType')}
              onValueChange={(val) => form.setValue('payType', val as 'fixed_salary' | 'performance_revenue')}
            >
              <SelectTrigger id="payType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DISPATCHER_PAY_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {payType === 'fixed_salary'
                ? 'Fixed amount paid per pay period (weekly, biweekly, or monthly).'
                : 'Percentage of Clean Gross (revenue - broker fees - local fees) for orders dispatched.'}
            </p>
          </div>

          <div>
            <Label htmlFor="payRate">
              {payType === 'fixed_salary' ? 'Salary Amount ($)' : 'Commission Rate (%)'}
            </Label>
            <Input
              id="payRate"
              type="number"
              step={payType === 'fixed_salary' ? '0.01' : '0.1'}
              placeholder={payType === 'fixed_salary' ? '2000.00' : '10'}
              {...form.register('payRate', { valueAsNumber: true })}
            />
            {form.formState.errors.payRate && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.payRate.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="payFrequency">Pay Frequency</Label>
            <Select
              value={form.watch('payFrequency')}
              onValueChange={(val) => form.setValue('payFrequency', val as 'weekly' | 'biweekly' | 'monthly')}
            >
              <SelectTrigger id="payFrequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAY_FREQUENCY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="effectiveFrom">Effective From</Label>
              <Input
                id="effectiveFrom"
                type="date"
                {...form.register('effectiveFrom')}
              />
              {form.formState.errors.effectiveFrom && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.effectiveFrom.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="effectiveTo">Effective To (optional)</Label>
              <Input
                id="effectiveTo"
                type="date"
                {...form.register('effectiveTo')}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Optional notes about this pay configuration..."
              rows={3}
              {...form.register('notes')}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Update' : 'Save'} Configuration
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
