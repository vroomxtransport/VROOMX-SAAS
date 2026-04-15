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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { generatePayrollPeriod, batchGeneratePayroll } from '@/app/actions/dispatcher-payroll'
import { generatePayrollPeriodSchema, batchGeneratePayrollSchema } from '@/lib/validations/dispatcher-payroll'
import type { GeneratePayrollPeriodFormInput, BatchGeneratePayrollFormInput } from '@/lib/validations/dispatcher-payroll'
import type { DispatcherWithPayConfig } from '@/lib/queries/dispatcher-payroll'
import { DISPATCHER_PAY_TYPE_LABELS, PAY_FREQUENCY_LABELS } from '@/types'
import type { DispatcherPayType, PayFrequency } from '@/types'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Users, User } from 'lucide-react'

interface PayrollGenerateDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dispatchers: DispatcherWithPayConfig[]
}

export function PayrollGenerateDrawer({
  open,
  onOpenChange,
  dispatchers,
}: PayrollGenerateDrawerProps) {
  const [batchMode, setBatchMode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [batchResult, setBatchResult] = useState<{ generated: number; skipped: number } | null>(null)
  const queryClient = useQueryClient()

  const dispatchersWithConfig = dispatchers.filter((d) => d.pay_config !== null)

  const form = useForm<GeneratePayrollPeriodFormInput>({
    resolver: zodResolver(generatePayrollPeriodSchema),
    defaultValues: {
      userId: '',
      periodStart: '',
      periodEnd: '',
    },
  })

  const batchForm = useForm<BatchGeneratePayrollFormInput>({
    resolver: zodResolver(batchGeneratePayrollSchema),
    defaultValues: {
      periodStart: '',
      periodEnd: '',
    },
  })

  const handleSingleSubmit = async (values: GeneratePayrollPeriodFormInput) => {
    setIsSubmitting(true)
    setError(null)

    const result = await generatePayrollPeriod(values)

    if ('error' in result && result.error) {
      setError(typeof result.error === 'string' ? result.error : 'Validation error')
      setIsSubmitting(false)
      return
    }

    queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
    form.reset()
    setIsSubmitting(false)
    onOpenChange(false)
  }

  const handleBatchSubmit = async (values: BatchGeneratePayrollFormInput) => {
    setIsSubmitting(true)
    setError(null)
    setBatchResult(null)

    const result = await batchGeneratePayroll(values)

    if ('error' in result && result.error) {
      setError(typeof result.error === 'string' ? result.error : 'Validation error')
      setIsSubmitting(false)
      return
    }

    if ('data' in result && result.data) {
      const data = result.data as { generated: number; skipped: number }
      setBatchResult({ generated: data.generated, skipped: data.skipped })
    }

    queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
    setIsSubmitting(false)

    // Auto-close after batch success
    setTimeout(() => {
      batchForm.reset()
      setBatchResult(null)
      onOpenChange(false)
    }, 2000)
  }

  const selectedDispatcher = dispatchersWithConfig.find(
    (d) => d.user_id === form.watch('userId')
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Generate Payroll</SheetTitle>
          <SheetDescription>
            Create payroll period(s) for dispatcher compensation.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-4">
          {/* Mode Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              {batchMode ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
              <span className="text-sm font-medium">
                {batchMode ? 'Batch — All Dispatchers' : 'Single Dispatcher'}
              </span>
            </div>
            <Switch checked={batchMode} onCheckedChange={setBatchMode} />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {batchResult && (
            <div className="rounded-lg border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
              Generated {batchResult.generated} payroll period(s).
              {batchResult.skipped > 0 && ` Skipped ${batchResult.skipped} (overlap or error).`}
            </div>
          )}

          {batchMode ? (
            <form onSubmit={batchForm.handleSubmit(handleBatchSubmit)} className="space-y-4">
              <div className="text-sm text-muted-foreground">
                This will generate payroll for all {dispatchersWithConfig.length} dispatcher(s) with active pay configurations.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="batch-start">Period Start</Label>
                  <Input
                    id="batch-start"
                    type="date"
                    {...batchForm.register('periodStart')}
                  />
                  {batchForm.formState.errors.periodStart && (
                    <p className="mt-1 text-xs text-destructive">{batchForm.formState.errors.periodStart.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="batch-end">Period End</Label>
                  <Input
                    id="batch-end"
                    type="date"
                    {...batchForm.register('periodEnd')}
                  />
                  {batchForm.formState.errors.periodEnd && (
                    <p className="mt-1 text-xs text-destructive">{batchForm.formState.errors.periodEnd.message}</p>
                  )}
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate for All Dispatchers
              </Button>
            </form>
          ) : (
            <form onSubmit={form.handleSubmit(handleSingleSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="dispatcher">Dispatcher</Label>
                <Select
                  value={form.watch('userId')}
                  onValueChange={(val) => form.setValue('userId', val)}
                >
                  <SelectTrigger id="dispatcher">
                    <SelectValue placeholder="Select dispatcher..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dispatchersWithConfig.map((d) => (
                      <SelectItem key={d.user_id} value={d.user_id}>
                        {d.full_name || d.email || d.user_id.substring(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {dispatchersWithConfig.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No dispatchers have pay configurations. Set up pay first on the Dispatchers page.
                  </p>
                )}
                {form.formState.errors.userId && (
                  <p className="mt-1 text-xs text-destructive">{form.formState.errors.userId.message}</p>
                )}
              </div>

              {/* Pay config preview */}
              {selectedDispatcher?.pay_config && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                  <div className="font-medium text-foreground mb-1">Pay Configuration</div>
                  <div className="text-muted-foreground space-y-0.5">
                    <div>
                      Type: {DISPATCHER_PAY_TYPE_LABELS[selectedDispatcher.pay_config.pay_type as DispatcherPayType]}
                    </div>
                    <div>
                      Rate: {selectedDispatcher.pay_config.pay_type === 'performance_revenue'
                        ? `${parseFloat(selectedDispatcher.pay_config.pay_rate)}%`
                        : `$${parseFloat(selectedDispatcher.pay_config.pay_rate).toLocaleString()}`
                      }
                    </div>
                    <div>
                      Frequency: {PAY_FREQUENCY_LABELS[selectedDispatcher.pay_config.pay_frequency as PayFrequency]}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="single-start">Period Start</Label>
                  <Input
                    id="single-start"
                    type="date"
                    {...form.register('periodStart')}
                  />
                  {form.formState.errors.periodStart && (
                    <p className="mt-1 text-xs text-destructive">{form.formState.errors.periodStart.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="single-end">Period End</Label>
                  <Input
                    id="single-end"
                    type="date"
                    {...form.register('periodEnd')}
                  />
                  {form.formState.errors.periodEnd && (
                    <p className="mt-1 text-xs text-destructive">{form.formState.errors.periodEnd.message}</p>
                  )}
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting || !form.watch('userId')} className="w-full">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Payroll Period
              </Button>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
