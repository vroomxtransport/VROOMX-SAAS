import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

// M10: replaced fragile regex HTML parsing with cheerio selector-based
// extraction. The previous implementation used multi-line regex over the
// raw response body which broke whenever FMCSA changed its HTML layout
// and was potentially vulnerable to ReDoS. cheerio is a server-side
// jQuery-like parser that handles malformed HTML correctly.

// Bound the response so a malicious or runaway upstream cannot exhaust
// memory. FMCSA carrier snapshot pages are typically 30–60KB.
const MAX_RESPONSE_BYTES = 1_000_000 // 1 MB
const FETCH_TIMEOUT_MS = 5_000

/**
 * Find the value of an FMCSA snapshot field by its label.
 *
 * The FMCSA snapshot HTML uses a table layout where the label appears
 * inside a TH (or sometimes an A inside a TH) and the value is in the
 * neighbouring TD with class="queryfield". cheerio handles this with
 * a single selector pattern + sibling traversal.
 */
function extractField($: cheerio.CheerioAPI, label: string): string {
  // Find any TH whose text contains the label (case-sensitive,
  // whitespace-normalized). The previous regex implementation used
  // substring matching, which is more forgiving than strict equality —
  // FMCSA periodically tweaks label punctuation (e.g. "MC/MX/FF Number"
  // vs "MC/MX/FF Number(s):") and we don't want to break extraction on
  // those churns. Then walk to the parent row and pull the sibling
  // td.queryfield value.
  let value = ''
  $('th').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ')
    if (text.includes(label)) {
      const td = $(el).parent('tr').find('td.queryfield').first()
      if (td.length > 0) {
        value = td.text().trim().replace(/\s+/g, ' ')
        return false // break out of .each
      }
    }
  })

  // Fallback: some labels are inside <a> tags inside <th>, or split
  // across nested elements. Try a broader element scan with the same
  // contains-match policy.
  if (!value) {
    $('th, td').each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ')
      if (text.includes(label) && text.length < label.length + 50) {
        const row = $(el).closest('tr')
        const td = row.find('td.queryfield').first()
        if (td.length > 0) {
          value = td.text().trim().replace(/\s+/g, ' ')
          return false
        }
      }
    })
  }

  return value
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
  // Auth check: only authenticated users can use this proxy
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Rate limit: 10 lookups per minute per user
  const { allowed } = await rateLimit(`fmcsa:${user.id}`, { limit: 10, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const dot = request.nextUrl.searchParams.get('dot')

  if (!dot || !/^\d+$/.test(dot)) {
    return NextResponse.json({ error: 'Invalid DOT number' }, { status: 400 })
  }

  // Bound the request with an explicit timeout. Without this, a slow
  // FMCSA response can hold a serverless invocation hostage.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch('https://safer.fmcsa.dot.gov/query.asp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${dot}`,
      next: { revalidate: 86400 },
      signal: controller.signal,
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'FMCSA lookup failed' }, { status: 502 })
    }

    // Read response with a hard size cap
    const contentLength = parseInt(res.headers.get('content-length') ?? '0', 10)
    if (contentLength > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: 'FMCSA response too large' }, { status: 502 })
    }
    const html = await res.text()
    if (html.length > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: 'FMCSA response too large' }, { status: 502 })
    }

    // Quick reject before parsing
    if (html.includes('No records matching') || html.includes('Invalid Search')) {
      return NextResponse.json({ error: 'Carrier not found' }, { status: 404 })
    }

    const $ = cheerio.load(html)

    const legalName = extractField($, 'Legal Name:')
    if (!legalName) {
      return NextResponse.json({ error: 'Carrier not found' }, { status: 404 })
    }

    const dbaName = extractField($, 'DBA Name:')
    const phone = extractField($, 'Phone:')
    // Use the singular form which is the historical FMCSA label;
    // extractField uses contains-match so the parenthesized variant
    // 'MC/MX/FF Number(s):' is also caught.
    const mcRaw = extractField($, 'MC/MX/FF Number')
    const physicalRaw = extractField($, 'Physical Address:')
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
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'FMCSA request timed out' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Failed to fetch carrier data' }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}
