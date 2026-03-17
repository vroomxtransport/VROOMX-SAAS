import { NextResponse } from 'next/server'

const EIA_API_URL =
  'https://api.eia.gov/v2/petroleum/pri/gnd/data/' +
  '?api_key=DEMO_KEY' +
  '&frequency=weekly' +
  '&data[0]=value' +
  '&facets[product][]=EPD2DXL0' + // Ultra Low Sulfur Diesel
  '&facets[duoarea][]=NUS' +       // National U.S.
  '&sort[0][column]=period' +
  '&sort[0][direction]=desc' +
  '&length=1'

interface EIAResponse {
  response: {
    data: Array<{
      period: string
      value: string
      'product-name': string
      'area-name': string
    }>
  }
}

export async function GET() {
  try {
    const res = await fetch(EIA_API_URL, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    })

    if (!res.ok) {
      console.error('[fuel-pricing] EIA API returned', res.status)
      return NextResponse.json(
        { error: 'Failed to fetch fuel pricing' },
        { status: 502 }
      )
    }

    const json: EIAResponse = await res.json()
    const latest = json.response?.data?.[0]

    if (!latest) {
      return NextResponse.json(
        { error: 'No pricing data available' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        dieselPrice: parseFloat(latest.value),
        date: latest.period,
        product: latest['product-name'],
        area: latest['area-name'],
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
        },
      }
    )
  } catch (err) {
    console.error('[fuel-pricing] Failed to fetch EIA data:', err)
    return NextResponse.json(
      { error: 'Failed to fetch fuel pricing' },
      { status: 500 }
    )
  }
}
