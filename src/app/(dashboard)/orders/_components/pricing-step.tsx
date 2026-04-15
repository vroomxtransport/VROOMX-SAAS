'use client'

import { useFormContext } from 'react-hook-form'
import { useBrokers } from '@/hooks/use-brokers'
import { useDrivers } from '@/hooks/use-drivers'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PAYMENT_TYPES, PAYMENT_TYPE_LABELS } from '@/types'
import type { PaymentType } from '@/types'
import { HelpTooltip } from '@/components/help-tooltip'
import type { CreateOrderInput } from '@/lib/validations/order'
import { computeOrderDriverPay } from '@/lib/financial/driver-pay'
import { DistancePreview } from './distance-preview'

export function PricingStep() {
  const form = useFormContext<CreateOrderInput>()
  const { data: brokersData } = useBrokers({ pageSize: 100 })
  const { data: driversData } = useDrivers({ status: 'active', pageSize: 100 })

  const revenue = form.watch('revenue') ?? 0
  const brokerFee = form.watch('brokerFee') ?? 0
  const localFee = form.watch('localFee') ?? 0
  const driverId = form.watch('driverId')
  const driverPayRateOverride = form.watch('driverPayRateOverride')
  const paymentType = form.watch('paymentType')
  const codAmount = form.watch('codAmount')
  const vehicles = form.watch('vehicles')
  const distanceMiles = form.watch('distanceMiles')

  // Find selected driver so we can live-preview the computed driver pay.
  const selectedDriver = driversData?.drivers.find((d) => d.id === driverId)

  // Live driver pay preview: mirrors the server-side computation done in
  // `applyComputedDriverPay`. For per_mile drivers the real distance is
  // filled in by Mapbox after save, but we use whatever is in the form
  // state (usually 0 at create time) so the preview is still defined.
  const computedDriverPay = selectedDriver
    ? computeOrderDriverPay(
        { payType: selectedDriver.pay_type, payRate: Number(selectedDriver.pay_rate) },
        {
          revenue: Number(revenue) || 0,
          brokerFee: Number(brokerFee) || 0,
          localFee: Number(localFee) || 0,
          distanceMiles: distanceMiles ? Number(distanceMiles) : null,
          driverPayRateOverride: driverPayRateOverride ? Number(driverPayRateOverride) : null,
          vehicleCount: Array.isArray(vehicles) ? vehicles.length : 1,
        }
      )
    : 0

  // Margin: revenue − broker fee − local fee − driver pay.
  const margin = Number(revenue) - Number(brokerFee) - Number(localFee) - computedDriverPay

  // SPLIT payment: COD collected at pickup/delivery, rest invoiced later.
  // Billing = revenue − cod (not driver pay — that's a separate concept).
  const isSplit = paymentType === 'SPLIT'
  const numericRevenue = Number(revenue) || 0
  const numericCodAmount = Number(codAmount) || 0
  const billingAmount = isSplit ? Math.max(0, numericRevenue - numericCodAmount) : 0

  return (
    <div className="space-y-4">
      {/* Financial fields */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="revenue"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                Revenue *
                <HelpTooltip content="Total amount the customer or broker pays for this transport." side="top" />
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-7"
                    {...field}
                    value={field.value as number ?? 0}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="brokerFee"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Broker Fee</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-7"
                    {...field}
                    value={field.value as number ?? 0}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="localFee"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                Local Fee
                <HelpTooltip content="Fee for local delivery at destination (e.g., terminal to dealer)." side="top" />
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-7"
                    {...field}
                    value={field.value as number ?? 0}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Driver Pay Rate Override — only shown when a driver is selected */}
      {selectedDriver && (
        <FormField
          control={form.control}
          name="driverPayRateOverride"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                Driver % Override
                <HelpTooltip content="Override the driver's default pay rate for this order. Leave blank to use the driver's configured rate." side="top" />
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder={`${selectedDriver.pay_rate}% (default)`}
                    {...field}
                    value={field.value as number ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Distance + RPM preview — fires once pickup + delivery city/state
          are filled. Auto-populates the distanceMiles form field unless
          the user typed one manually, so per_mile driver pay below picks
          up the real number without a page reload. */}
      <DistancePreview />

      {/* Driver Pay preview — auto-computed from driver config. Only
          shown when a driver is selected; hidden otherwise to avoid
          cluttering the form with $0 placeholders. */}
      {selectedDriver && (
        <div className="rounded-md border border-border-subtle bg-accent/30 p-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-foreground">Driver Pay</span>
              <p className="text-xs text-muted-foreground">
                Auto-calculated from driver&apos;s pay type
                {selectedDriver.pay_type === 'per_mile' && ' × live distance'}
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
              }).format(computedDriverPay)}
            </span>
          </div>
        </div>
      )}

      {/* Margin summary */}
      <div className="rounded-md bg-muted/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Margin</span>
          <span
            className={`text-sm font-semibold ${
              margin >= 0 ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 2,
            }).format(margin)}
          </span>
        </div>
      </div>

      {/* Payment type */}
      <FormField
        control={form.control}
        name="paymentType"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-1">
              Payment Type
              <HelpTooltip content="COD = Cash on Delivery, COP = Cash on Pickup, BILL = Invoice after delivery." side="top" />
            </FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value ?? 'COP'}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {PAYMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {PAYMENT_TYPE_LABELS[type as PaymentType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Split Payment Fields */}
      {isSplit && (
        <div className="rounded-lg border border-border-subtle bg-accent/30 p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            COD: collected at delivery. Billing: invoiced to broker.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="codAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>COD Amount</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={numericRevenue}
                        placeholder="0.00"
                        className="pl-7"
                        {...field}
                        value={field.value as number ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <Label>Billing Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  className="pl-7 bg-muted cursor-default"
                  value={billingAmount.toFixed(2)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Broker select */}
      <FormField
        control={form.control}
        name="brokerId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Broker</FormLabel>
            <Select
              onValueChange={(value) =>
                field.onChange(value === 'none' ? '' : value)
              }
              value={field.value || 'none'}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select broker" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {brokersData?.brokers.map((broker) => (
                  <SelectItem key={broker.id} value={broker.id}>
                    {broker.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Driver select */}
      <FormField
        control={form.control}
        name="driverId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Driver</FormLabel>
            <Select
              onValueChange={(value) =>
                field.onChange(value === 'unassigned' ? '' : value)
              }
              value={field.value || 'unassigned'}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {driversData?.drivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.first_name} {driver.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
