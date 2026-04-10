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

// H6 hardening bounds. Claude is configured with max_tokens: 4096 (≈12KB
// of JSON in the worst case), but a malicious PDF could attempt prompt
// injection to make the model emit a much larger payload, or a bug
// upstream could allow oversized responses through. Defense in depth:
//
// MAX_RAW_TEXT_BYTES — drop the response entirely if the cleaned text
//   exceeds 100KB. This is ~25× the configured max_tokens budget.
// MAX_PARSED_ORDERS — cap the array length after JSON.parse to prevent
//   OOM during the per-order Zod validation map below. Real-world PDFs
//   contain at most a few dozen orders.
const MAX_RAW_TEXT_BYTES = 100_000
const MAX_PARSED_ORDERS = 1000

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

  return parseExtractedOrders(rawText)
}

/**
 * Parse a raw text payload from Claude into validated extracted orders.
 *
 * Pure function — no I/O, no SDK calls. Exported so it can be unit-tested
 * with crafted inputs covering the H6 hardening bounds (oversized text,
 * non-array JSON, oversized arrays, malformed JSON).
 */
export function parseExtractedOrders(rawText: string): PDFExtractionResult {
  const cleaned = rawText.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim()

  // H6: drop oversized payloads before JSON.parse to prevent OOM.
  if (cleaned.length > MAX_RAW_TEXT_BYTES) {
    console.warn('[pdf-parser] cleaned text exceeded MAX_RAW_TEXT_BYTES', {
      length: cleaned.length,
    })
    return { orders: [], rawText }
  }

  let parsed: unknown[]
  try {
    const result = JSON.parse(cleaned)
    parsed = Array.isArray(result) ? result : []
  } catch {
    return { orders: [], rawText }
  }

  // H6: cap array length before mapping. Each element triggers a Zod
  // validation pass; an unbounded array would allocate memory linearly.
  if (parsed.length > MAX_PARSED_ORDERS) {
    console.warn('[pdf-parser] parsed array exceeded MAX_PARSED_ORDERS', {
      length: parsed.length,
    })
    parsed = parsed.slice(0, MAX_PARSED_ORDERS)
  }

  const orders: ExtractedOrder[] = parsed.map((raw) => {
    const obj = raw as Record<string, unknown>
    const formData = {
      vehicles: [{
        year: obj.vehicleYear ? Number(obj.vehicleYear) : new Date().getFullYear(),
        make: (obj.vehicleMake as string) ?? '',
        model: (obj.vehicleModel as string) ?? '',
        vin: (obj.vehicleVin as string) ?? '',
        type: (obj.vehicleType as string) ?? '',
        color: (obj.vehicleColor as string) ?? '',
      }],
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
