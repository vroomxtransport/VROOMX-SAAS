import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/extension/cors'
import { createClient } from '@/lib/supabase/server'

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(null, { status: 204, headers: corsHeaders(request) })
}

export async function GET(request: NextRequest) {
  const cors = corsHeaders(request)

  try {
    // This route uses cookie-based auth (called from VroomX domain context)
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { authenticated: false },
        { status: 200, headers: cors }
      )
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json(
        { authenticated: false },
        { status: 200, headers: cors }
      )
    }

    const tenantId = user.app_metadata?.tenant_id
    if (!tenantId) {
      return NextResponse.json(
        { authenticated: false },
        { status: 200, headers: cors }
      )
    }

    return NextResponse.json(
      {
        authenticated: true,
        accessToken: session.access_token,
        user: {
          email: user.email,
          tenantId,
        },
      },
      { status: 200, headers: cors }
    )
  } catch {
    return NextResponse.json(
      { authenticated: false },
      { status: 200, headers: cors }
    )
  }
}
