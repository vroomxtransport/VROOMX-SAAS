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
import type { CreateOrderInput } from '@/lib/validations/order'

export function PricingStep() {
  const form = useFormContext<CreateOrderInput>()
  const { data: brokersData } = useBrokers({ pageSize: 100 })
  const { data: driversData } = useDrivers({ status: 'active', pageSize: 100 })

  const revenue = form.watch('revenue') ?? 0
  const carrierPay = form.watch('carrierPay') ?? 0
  const brokerFee = form.watch('brokerFee') ?? 0
  const margin = Number(revenue) - Number(carrierPay) - Number(brokerFee)

  return (
    <div className="space-y-4">
      {/* Financial fields */}
      <div className="grid grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="revenue"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Revenue *</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
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
              <FormLabel>Carrier Pay *</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
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

      {/* Margin summary */}
      <div className="rounded-md bg-gray-50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">Margin</span>
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
            <FormLabel>Payment Type</FormLabel>
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
