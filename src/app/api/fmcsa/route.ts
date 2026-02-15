import { NextRequest, NextResponse } from 'next/server'

function extractField(html: string, label: string): string {
  // Match: label text in <A> or <TH> → next <TD class="queryfield">...</TD>
  const regex = new RegExp(
    label + `[\\s\\S]*?<TD[^>]*class="queryfield"[^>]*>([\\s\\S]*?)</TD>`,
    'i'
  )
  const match = html.match(regex)
  if (!match) return ''
  return match[1]
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseAddress(raw: string): { street: string; city: string; state: string; zip: string } {
  // Format: "11808 STATE ROAD #205, LAOTTO, IN  46763"
  const parts = raw.split(',').map((s) => s.trim())
  const street = parts[0] || ''
  let city = ''
  let state = ''
  let zip = ''

  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1].trim()
    // Last part is "IN  46763" or "IN 46763"
    const stateZip = lastPart.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/)
    if (stateZip) {
      state = stateZip[1]
      zip = stateZip[2]
    }
    // City is everything between street and state/zip
    if (parts.length >= 3) {
      city = parts.slice(1, -1).join(', ')
    } else {
      // "STREET, CITY STATE ZIP" → city is before state
      city = lastPart.replace(/\s*[A-Z]{2}\s+\d{5}.*$/, '').trim()
    }
  }

  return { street, city, state, zip }
}

export async function GET(request: NextRequest) {
  const dot = request.nextUrl.searchParams.get('dot')

  if (!dot || !/^\d+$/.test(dot)) {
    return NextResponse.json({ error: 'Invalid DOT number' }, { status: 400 })
  }

  try {
    const res = await fetch('https://safer.fmcsa.dot.gov/query.asp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${dot}`,
      next: { revalidate: 86400 },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'FMCSA lookup failed' }, { status: 502 })
    }

    const html = await res.text()

    // Check if carrier was found
    if (html.includes('No records matching') || html.includes('Invalid Search')) {
      return NextResponse.json({ error: 'Carrier not found' }, { status: 404 })
    }

    const legalName = extractField(html, 'Legal Name:')
    if (!legalName) {
      return NextResponse.json({ error: 'Carrier not found' }, { status: 404 })
    }

    const dbaName = extractField(html, 'DBA Name:')
    const phone = extractField(html, 'Phone:')
    const mcRaw = extractField(html, 'MC/MX/FF Number')
    const physicalRaw = extractField(html, 'Physical Address:')
    const address = parseAddress(physicalRaw)

    // Extract MC number (e.g. "MC-123456" → "123456")
    const mcMatch = mcRaw.match(/MC-?\s*(\d+)/i)
    const mcNumber = mcMatch ? mcMatch[1] : ''

    return NextResponse.json({
      legalName,
      dbaName,
      mcNumber,
      dotNumber: dot,
      telephone: phone,
      phyStreet: address.street,
      phyCity: address.city,
      phyState: address.state,
      phyZipcode: address.zip,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch carrier data' }, { status: 502 })
  }
}
