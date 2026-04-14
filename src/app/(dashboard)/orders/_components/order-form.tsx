'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createOrderSchemaWithRefinements,
  orderVehiclesSchema,
  orderLocationSchema,
  orderPricingSchema,
  type CreateOrderValues,
  type CreateOrderInput,
} from '@/lib/validations/order'
import { createOrder, updateOrder } from '@/app/actions/orders'
import { useDraftStore } from '@/stores/draft-store'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { VehicleStep } from './vehicle-step'
import { LocationStep } from './location-step'
import { PricingStep } from './pricing-step'
import { CheckCircle2 } from 'lucide-react'
import type { OrderWithRelations } from '@/lib/queries/orders'

const STEPS = [
  { label: 'Vehicles', schema: orderVehiclesSchema },
  { label: 'Location', schema: orderLocationSchema },
  { label: 'Pricing', schema: orderPricingSchema },
] as const

const DRAFT_KEY = 'order-new'

interface OrderFormProps {
  order?: OrderWithRelations
  onSuccess: () => void
  onCancel: () => void
  onStepChange?: (step: number) => void
  onDirtyChange?: (dirty: boolean) => void
}

function mapOrderToFormValues(order: OrderWithRelations): CreateOrderInput {
  // Build vehicles array from JSONB or fall back to flat columns
  const vehicles = order.vehicles && Array.isArray(order.vehicles) && order.vehicles.length > 0
    ? order.vehicles.map((v: { vin?: string | null; year?: number; make?: string; model?: string; type?: string | null; color?: string | null; lotNumber?: string | null; buyerNumber?: string | null; auctionPin?: string | null }) => ({
        vin: v.vin ?? '',
        year: v.year ?? new Date().getFullYear(),
        make: v.make ?? '',
        model: v.model ?? '',
        type: v.type ?? '',
        color: v.color ?? '',
        lotNumber: v.lotNumber ?? '',
        buyerNumber: v.buyerNumber ?? '',
        auctionPin: v.auctionPin ?? '',
      }))
    : [{
        vin: order.vehicle_vin ?? '',
        year: order.vehicle_year ?? new Date().getFullYear(),
        make: order.vehicle_make ?? '',
        model: order.vehicle_model ?? '',
        type: order.vehicle_type ?? '',
        color: order.vehicle_color ?? '',
        lotNumber: '',
        buyerNumber: '',
        auctionPin: '',
      }]

  return {
    vehicles,
    pickupCustomerType: (order.pickup_customer_type as 'private' | 'dealer' | 'business' | 'auction') ?? '',
    pickupLocation: order.pickup_location ?? '',
    pickupCity: order.pickup_city ?? '',
    pickupState: order.pickup_state ?? '',
    pickupZip: order.pickup_zip ?? '',
    pickupContactName: order.pickup_contact_name ?? '',
    pickupContactPhone: order.pickup_contact_phone ?? '',
    pickupContactEmail: order.pickup_contact_email ?? '',
    pickupDate: order.pickup_date ?? '',
    deliveryCustomerType: (order.delivery_customer_type as 'private' | 'dealer' | 'business' | 'auction') ?? '',
    deliveryLocation: order.delivery_location ?? '',
    deliveryCity: order.delivery_city ?? '',
    deliveryState: order.delivery_state ?? '',
    deliveryZip: order.delivery_zip ?? '',
    deliveryContactName: order.delivery_contact_name ?? '',
    deliveryContactPhone: order.delivery_contact_phone ?? '',
    deliveryContactEmail: order.delivery_contact_email ?? '',
    deliveryDate: order.delivery_date ?? '',
    revenue: parseFloat(order.revenue) || 0,
    brokerFee: parseFloat(order.broker_fee) || 0,
    codAmount: order.cod_amount ? parseFloat(order.cod_amount) : undefined,
    paymentType: order.payment_type ?? 'COP',
    brokerId: order.broker_id ?? '',
    driverId: order.driver_id ?? '',
  }
}

export function OrderForm({ order, onSuccess, onCancel, onStepChange, onDirtyChange }: OrderFormProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()
  const { saveDraft, loadDraft, clearDraft } = useDraftStore()
  const isEditMode = !!order

  // Load default values: edit mode uses order data, create mode uses draft
  const getDefaultValues = useCallback((): CreateOrderInput => {
    if (isEditMode) {
      return mapOrderToFormValues(order)
    }
    const draft = loadDraft(DRAFT_KEY)
    if (draft) {
      const { _savedAt, ...draftValues } = draft
      return draftValues as unknown as CreateOrderInput
    }
    return {
      vehicles: [{
        vin: '',
        year: new Date().getFullYear(),
        make: '',
        model: '',
        type: '',
        color: '',
        lotNumber: '',
        buyerNumber: '',
        auctionPin: '',
      }],
      pickupCustomerType: '',
      pickupLocation: '',
      pickupCity: '',
      pickupState: '',
      pickupZip: '',
      pickupContactName: '',
      pickupContactPhone: '',
      pickupContactEmail: '',
      pickupDate: '',
      deliveryCustomerType: '',
      deliveryLocation: '',
      deliveryCity: '',
      deliveryState: '',
      deliveryZip: '',
      deliveryContactName: '',
      deliveryContactPhone: '',
      deliveryContactEmail: '',
      deliveryDate: '',
      revenue: 0,
      brokerFee: 0,
      paymentType: 'COP',
      brokerId: '',
      driverId: '',
    }
  }, [isEditMode, order, loadDraft])

  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderSchemaWithRefinements),
    defaultValues: getDefaultValues(),
  })

  // Draft auto-save for create mode only
  const watchedRef = useRef(false)
  useEffect(() => {
    if (isEditMode) return
    if (!watchedRef.current) {
      watchedRef.current = true
    }
    const subscription = form.watch((values) => {
      if (watchedRef.current) {
        saveDraft(DRAFT_KEY, values as Record<string, unknown>)
        onDirtyChange?.(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [form, isEditMode, saveDraft, onDirtyChange])

  // Notify parent of step changes
  useEffect(() => {
    onStepChange?.(currentStep)
  }, [currentStep, onStepChange])

  const handleNext = () => {
    const stepSchema = STEPS[currentStep].schema
    const values = form.getValues()
    const result = stepSchema.safeParse(values)

    if (!result.success) {
      const fieldNames = Object.keys(stepSchema.shape) as (keyof CreateOrderInput)[]
      form.trigger(fieldNames) // fire-and-forget — displays field errors
      return
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const onSubmit = async (values: CreateOrderInput) => {
    // Guard: only create/update on the final step.
    // Pressing Enter on earlier steps advances the wizard instead.
    if (currentStep < STEPS.length - 1) {
      handleNext()
      return
    }

    if (isSubmitting) return

    setIsSubmitting(true)
    setServerError(null)

    try {
      const result = isEditMode
        ? await updateOrder(order.id, values)
        : await createOrder(values)

      if ('error' in result && result.error) {
        if (typeof result.error === 'string') {
          setServerError(result.error)
        } else {
          // Field errors from Zod
          Object.entries(result.error).forEach(([field, messages]) => {
            if (Array.isArray(messages) && messages.length > 0) {
              form.setError(field as keyof CreateOrderInput, {
                message: messages[0],
              })
            }
          })
        }
        return
      }

      // Success
      if (!isEditMode) {
        clearDraft(DRAFT_KEY)
      }
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ['order', order.id] })
      }
      onSuccess()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        key={order?.id ?? 'create'}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.label} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  index < currentStep
                    ? 'bg-green-100 text-green-700'
                    : index === currentStep
                      ? 'bg-blue-600 text-white'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`ml-2 text-sm ${
                  index === currentStep
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
              {index < STEPS.length - 1 && (
                <div className="mx-4 h-px w-8 bg-muted" />
              )}
            </div>
          ))}
        </div>

        {serverError && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        {/* Step content */}
        <div className="min-h-[300px]">
          {currentStep === 0 && <VehicleStep />}
          {currentStep === 1 && <LocationStep />}
          {currentStep === 2 && <PricingStep />}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between border-t border-border pt-4">
          <div>
            {currentStep > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                Back
              </Button>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            {currentStep < STEPS.length - 1 ? (
              <Button key="next" type="button" onClick={handleNext}>
                Next
              </Button>
            ) : (
              <Button key="submit" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? isEditMode
                    ? 'Saving...'
                    : 'Creating...'
                  : isEditMode
                    ? 'Save Changes'
                    : 'Create Order'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  )
}
