import Anthropic from '@anthropic-ai/sdk'
import { createOrderSchema, type CreateOrderValues } from '@/lib/validations/order'

export interface ExtractedOrder {
  data: Partial<CreateOrderValues>
  valid: boolean
  errors: string[]
}

export interface PDFExtractionResult {
  orders: ExtractedOrder[]
  rawText?: string
}

export async function extractOrdersFromPDF(base64PDF: string): Promise<PDFExtractionResult> {
  const client = new Anthropic()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64PDF,
            },
          },
          {
            type: 'text',
            text: `Extract all vehicle transport orders from this document. For each order/vehicle, extract the following fields as a JSON array:

Each order object should have these fields (use null for missing values):
- vehicleYear: number (e.g. 2024)
- vehicleMake: string (e.g. "Toyota")
- vehicleModel: string (e.g. "Camry")
- vehicleVin: string or null (17-char VIN)
- vehicleType: string or null (e.g. "Sedan", "SUV", "Truck")
- vehicleColor: string or null
- pickupLocation: string (street address)
- pickupCity: string
- pickupState: string (2-letter state code, e.g. "FL")
- pickupZip: string or null
- pickupContactName: string or null
- pickupContactPhone: string or null
- pickupDate: string or null (YYYY-MM-DD format)
- deliveryLocation: string (street address)
- deliveryCity: string
- deliveryState: string (2-letter state code)
- deliveryZip: string or null
- deliveryContactName: string or null
- deliveryContactPhone: string or null
- deliveryDate: string or null (YYYY-MM-DD format)
- revenue: number (total price/rate for this vehicle, 0 if not found)
- carrierPay: number (carrier pay amount, same as revenue if not specified separately)
- brokerFee: number (broker fee, 0 if not found)
- distanceMiles: number or null
- paymentType: "COD" | "COP" | "CHECK" | "BILL" | "SPLIT" | null

Return ONLY a valid JSON array. No markdown, no explanation, just the JSON array.
If no orders can be extracted, return an empty array [].`,
          },
        ],
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  const rawText = textContent?.type === 'text' ? textContent.text : '[]'

  let parsed: unknown[]
  try {
    const cleaned = rawText.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim()
    parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) parsed = []
  } catch {
    return { orders: [], rawText }
  }

  const orders: ExtractedOrder[] = parsed.map((raw) => {
    const obj = raw as Record<string, unknown>
    const formData = {
      vehicleYear: obj.vehicleYear ?? undefined,
      vehicleMake: obj.vehicleMake ?? '',
      vehicleModel: obj.vehicleModel ?? '',
      vehicleVin: obj.vehicleVin ?? '',
      vehicleType: obj.vehicleType ?? '',
      vehicleColor: obj.vehicleColor ?? '',
      pickupLocation: obj.pickupLocation ?? '',
      pickupCity: obj.pickupCity ?? '',
      pickupState: obj.pickupState ?? '',
      pickupZip: obj.pickupZip ?? '',
      pickupContactName: obj.pickupContactName ?? '',
      pickupContactPhone: obj.pickupContactPhone ?? '',
      pickupDate: obj.pickupDate ?? '',
      deliveryLocation: obj.deliveryLocation ?? '',
      deliveryCity: obj.deliveryCity ?? '',
      deliveryState: obj.deliveryState ?? '',
      deliveryZip: obj.deliveryZip ?? '',
      deliveryContactName: obj.deliveryContactName ?? '',
      deliveryContactPhone: obj.deliveryContactPhone ?? '',
      deliveryDate: obj.deliveryDate ?? '',
      revenue: obj.revenue ?? 0,
      carrierPay: obj.carrierPay ?? 0,
      brokerFee: obj.brokerFee ?? 0,
      localFee: 0,
      distanceMiles: obj.distanceMiles ?? undefined,
      paymentType: obj.paymentType ?? 'COP',
    }

    const result = createOrderSchema.safeParse(formData)
    if (result.success) {
      return { data: result.data, valid: true, errors: [] }
    }

    const errors = Object.entries(result.error.flatten().fieldErrors)
      .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)

    return { data: formData as Partial<CreateOrderValues>, valid: false, errors }
  })

  return { orders, rawText }
}
