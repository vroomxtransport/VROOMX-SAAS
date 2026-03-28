import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/extension/cors'
import { authenticateExtension } from '@/lib/extension/auth'
import { rateLimit } from '@/lib/rate-limit'
import { extractOrdersFromPDF } from '@/lib/ai/pdf-parser'
import { safeError } from '@/lib/authz'

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: NextRequest) {
  const cors = corsHeaders(request)

  // Authenticate via bearer token
  const auth = await authenticateExtension(request)
  if (!auth) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401, headers: cors }
    )
  }

  // Rate limit: 5 requests per minute per user
  const rl = await rateLimit(`${auth.userId}:extensionImportPdf`, {
    limit: 5,
    windowMs: 60_000,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      { status: 429, headers: cors }
    )
  }

  try {
    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400, headers: cors }
      )
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are accepted' },
        { status: 400, headers: cors }
      )
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be under 25MB' },
        { status: 400, headers: cors }
      )
    }

    // Convert to base64 and extract orders via AI
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const result = await extractOrdersFromPDF(base64)

    return NextResponse.json(
      { orders: result.orders },
      { status: 200, headers: cors }
    )
  } catch (err) {
    safeError(err as { message: string }, 'extension:import-pdf')
    return NextResponse.json(
      { error: 'Failed to process PDF. Please try again.' },
      { status: 500, headers: cors }
    )
  }
}
