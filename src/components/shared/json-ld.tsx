import { headers } from 'next/headers'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vroomx.com'

/**
 * Inline JSON-LD script tag.
 *
 * H2 nonce — reads the per-request CSP nonce from headers() and applies
 * it to the script tag. Without the nonce, the strict script-src CSP
 * set in middleware.ts would block this tag.
 *
 * Async server component: callers do not need to thread the nonce
 * explicitly — it is read from request headers at render time.
 */
export async function JsonLd({ data }: { data: Record<string, unknown> }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  // M8: escape `<` to `\u003c` so a malicious string value containing
  // `</script>` can never break out of the inline script tag. JSON.stringify
  // does not escape `<` by default — defense in depth even though current
  // callers pass hardcoded data.
  const html = JSON.stringify(data).replace(/</g, '\\u003c')
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
       
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export async function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'VroomX',
    url: baseUrl,
    logo: `${baseUrl}/images/logo.png`,
    sameAs: [
      'https://twitter.com/vroomxtms',
      'https://www.linkedin.com/company/vroomx',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@vroomx.com',
      contactType: 'customer support',
    },
  }

  return <JsonLd data={data} />
}

export async function SoftwareApplicationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'VroomX TMS',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'The first TMS built for auto-transport carriers. See Clean Gross on every load, automate driver settlements, and track per-truck profitability.',
    url: baseUrl,
    offers: [
      {
        '@type': 'Offer',
        name: 'Starter',
        price: '49',
        priceCurrency: 'USD',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '49',
          priceCurrency: 'USD',
          unitCode: 'MON',
        },
        description: 'For small carriers getting started with digital dispatch. Up to 5 trucks.',
      },
      {
        '@type': 'Offer',
        name: 'Pro',
        price: '149',
        priceCurrency: 'USD',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '149',
          priceCurrency: 'USD',
          unitCode: 'MON',
        },
        description: 'For growing fleets that need advanced tools. Up to 20 trucks.',
      },
      {
        '@type': 'Offer',
        name: 'Enterprise',
        price: '299',
        priceCurrency: 'USD',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '299',
          priceCurrency: 'USD',
          unitCode: 'MON',
        },
        description: 'For large operations with unlimited capacity and dedicated support.',
      },
    ],
  }

  return <JsonLd data={data} />
}

export async function FAQPageJsonLd({
  faqs,
}: {
  faqs: Array<{ question: string; answer: string }>
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }

  return <JsonLd data={data} />
}

export async function PricingJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'VroomX TMS Pricing Plans',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        item: {
          '@type': 'Product',
          name: 'VroomX Owner-Operator',
          description: 'Built for the solo driver running their own truck. 1 truck, 1 user.',
          offers: {
            '@type': 'Offer',
            price: '29',
            priceCurrency: 'USD',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: '29',
              priceCurrency: 'USD',
              unitCode: 'MON',
            },
            availability: 'https://schema.org/InStock',
            url: `${baseUrl}/pricing`,
          },
        },
      },
      {
        '@type': 'ListItem',
        position: 2,
        item: {
          '@type': 'Product',
          name: 'VroomX Starter X',
          description: 'For small fleets taking on their first drivers. Up to 5 trucks, 3 team members.',
          offers: {
            '@type': 'Offer',
            price: '49',
            priceCurrency: 'USD',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: '49',
              priceCurrency: 'USD',
              unitCode: 'MON',
            },
            availability: 'https://schema.org/InStock',
            url: `${baseUrl}/pricing`,
          },
        },
      },
      {
        '@type': 'ListItem',
        position: 3,
        item: {
          '@type': 'Product',
          name: 'VroomX Pro X',
          description: 'For growing carriers that need fleet-scale dispatch and analytics. Up to 20 trucks, 10 team members.',
          offers: {
            '@type': 'Offer',
            price: '149',
            priceCurrency: 'USD',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: '149',
              priceCurrency: 'USD',
              unitCode: 'MON',
            },
            availability: 'https://schema.org/InStock',
            url: `${baseUrl}/pricing`,
          },
        },
      },
    ],
  }

  return <JsonLd data={data} />
}

export async function BreadcrumbJsonLd({
  items,
}: {
  items: Array<{ name: string; url: string }>
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`,
    })),
  }

  return <JsonLd data={data} />
}
