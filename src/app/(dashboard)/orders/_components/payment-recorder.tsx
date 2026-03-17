'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { recordPayment, recordCodPayment } from '@/app/actions/payments'
import { usePaymentsByOrder } from '@/hooks/use-payments'
import {
  recordPaymentSchema,
  type RecordPaymentInput,
} from '@/lib/validations/payment'
import { PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from '@/types'
import type { PaymentStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, DollarSign, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaymentRecorderProps {
  orderId: string
  carrierPay: number
  amountPaid: number
  paymentStatus: PaymentStatus
  paymentType?: string | null
  codAmount?: number | null
  billingAmount?: number | null
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getTodayString(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function PaymentRecorder({
  orderId,
  carrierPay,
  amountPaid,
  paymentStatus,
  paymentType,
  codAmount,
  billingAmount,
}: PaymentRecorderProps) {
  const queryClient = useQueryClient()
  const [isPending, startTransition] = useTransition()
  const [isCodPending, startCodTransition] = useTransition()
  const { data: payments, isLoading: paymentsLoading } =
    usePaymentsByOrder(orderId)

  const isSplit = paymentType === 'SPLIT' && billingAmount != null && codAmount != null

  // For SPLIT orders, calculate COD and billing portions separately
  const codValue = isSplit ? codAmount : 0
  const billingValue = isSplit ? billingAmount : carrierPay
  const codCollected = isSplit ? Math.min(amountPaid, codValue) >= codValue : false
  const billingPaid = isSplit ? Math.max(0, amountPaid - codValue) : amountPaid
  const billingRemaining = Math.max(0, Math.round((billingValue - billingPaid) * 100) / 100)

  const remaining = Math.max(
    0,
    Math.round((carrierPay - amountPaid) * 100) / 100
  )
  const percentPaid =
    carrierPay > 0 ? Math.min(100, (amountPaid / carrierPay) * 100) : 0

  const handleCodCollected = () => {
    startCodTransition(async () => {
      const result = await recordCodPayment(orderId)
      if ('error' in result && result.error) {
        const errorMsg = typeof result.error === 'string' ? result.error : 'Failed to record COD payment'
        toast.error(errorMsg)
        return
      }
      toast.success('COD payment collected')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      queryClient.invalidateQueries({ queryKey: ['payments', orderId] })
    })
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RecordPaymentInput>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      amount: '' as unknown as number,
      paymentDate: getTodayString(),
      notes: '',
    },
  })

  const onSubmit = (data: RecordPaymentInput) => {
    startTransition(async () => {
      const result = await recordPayment(orderId, data)

      if ('error' in result && result.error) {
        const errorMsg =
          typeof result.error === 'string'
            ? result.error
            : 'Validation failed. Check your inputs.'
        toast.error(errorMsg)
        return
      }

      toast.success('Payment recorded successfully')
      reset({
        amount: '' as unknown as number,
        paymentDate: getTodayString(),
        notes: '',
      })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      queryClient.invalidateQueries({ queryKey: ['payments', orderId] })
    })
  }

  return (
    <div className="space-y-5">
      {/* Payment Status Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                PAYMENT_STATUS_COLORS[paymentStatus]
              )}
            >
              {PAYMENT_STATUS_LABELS[paymentStatus]}
            </span>
            {isSplit && (
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                Split Payment
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Paid: {formatCurrency(amountPaid)} / {formatCurrency(carrierPay)}
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              percentPaid >= 100 ? 'bg-emerald-500' : 'bg-green-500'
            )}
            style={{ width: `${percentPaid}%` }}
          />
        </div>

        {remaining > 0 && (
          <p className="text-xs text-muted-foreground">
            Remaining: {formatCurrency(remaining)}
          </p>
        )}
      </div>

      {/* SPLIT Order: COD + Billing Breakdown */}
      {isSplit && (
        <div className="space-y-4">
          {/* COD Portion */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-orange-500" />
                <h4 className="text-sm font-medium text-foreground">COD Portion</h4>
              </div>
              <span className={cn(
                'text-xs font-medium',
                codCollected ? 'text-emerald-600' : 'text-orange-600'
              )}>
                {codCollected ? 'Collected' : 'Pending'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">COD Amount:</span>
              <span className="font-medium">{formatCurrency(codValue)}</span>
            </div>
            {!codCollected && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                disabled={isCodPending}
                onClick={handleCodCollected}
              >
                {isCodPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Mark COD Collected
              </Button>
            )}
          </div>

          {/* Billing Portion */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <h4 className="text-sm font-medium text-foreground">Billing Portion</h4>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Billing Amount:</span>
              <span className="font-medium">{formatCurrency(billingValue)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Paid:</span>
              <span className="font-medium">{formatCurrency(billingPaid)}</span>
            </div>
            {billingRemaining > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Remaining:</span>
                <span className="font-medium text-amber-600">{formatCurrency(billingRemaining)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment History */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-foreground">
          Payment History
        </h3>
        {paymentsLoading ? (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading payments...
          </div>
        ) : !payments || payments.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">No payments recorded</p>
        ) : (
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {formatCurrency(parseFloat(payment.amount))}
                    </p>
                    {payment.notes && (
                      <p className="text-xs text-muted-foreground">{payment.notes}</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(payment.payment_date)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Record Payment Form */}
      {paymentStatus !== 'paid' && (
        <div className="border-t border-border pt-4">
          <h3 className="mb-3 text-sm font-medium text-foreground">
            Record {isSplit ? 'Billing ' : ''}Payment
          </h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={isSplit ? billingRemaining : remaining}
                  placeholder="0.00"
                  disabled={isPending}
                  {...register('amount')}
                />
                {errors.amount && (
                  <p className="text-xs text-red-600">
                    {errors.amount.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="paymentDate">Date</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  disabled={isPending}
                  {...register('paymentDate')}
                />
                {errors.paymentDate && (
                  <p className="text-xs text-red-600">
                    {errors.paymentDate.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                type="text"
                placeholder="Payment reference, check number, etc."
                disabled={isPending}
                {...register('notes')}
              />
            </div>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
