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

export function PricingStep() {
  const form = useFormContext<CreateOrderInput>()
  const { data: brokersData } = useBrokers({ pageSize: 100 })
  const { data: driversData } = useDrivers({ status: 'active', pageSize: 100 })

  const revenue = form.watch('revenue') ?? 0
  const carrierPay = form.watch('carrierPay') ?? 0
  const brokerFee = form.watch('brokerFee') ?? 0
  const localFee = form.watch('localFee') ?? 0
  const driverId = form.watch('driverId')
  const margin = Number(revenue) - Number(carrierPay) - Number(brokerFee) - Number(localFee)

  // Find selected driver for showing default pay rate
  const selectedDriver = driversData?.drivers.find((d) => d.id === driverId)

  return (
    <div className="space-y-4">
      {/* Financial fields */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
          name="carrierPay"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                Carrier Pay *
                <HelpTooltip content="Amount paid to the carrier or driver for hauling this vehicle." side="top" />
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

      {/* Distance */}
      <FormField
        control={form.control}
        name="distanceMiles"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-1">
              Distance (miles)
              <HelpTooltip content="Total route distance in miles. Used for per-mile driver pay and financial KPIs." side="top" />
            </FormLabel>
            <FormControl>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0"
                  {...field}
                  value={field.value as number ?? ''}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">mi</span>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

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
