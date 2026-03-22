const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vroomx.com'

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function OrganizationJsonLd() {
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

export function SoftwareApplicationJsonLd() {
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

export function FAQPageJsonLd({
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

export function PricingJsonLd() {
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
          name: 'VroomX Starter',
          description: 'For small carriers getting started with digital dispatch. Up to 5 trucks.',
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
        position: 2,
        item: {
          '@type': 'Product',
          name: 'VroomX Pro',
          description: 'For growing fleets that need advanced tools and more capacity. Up to 20 trucks.',
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
      {
        '@type': 'ListItem',
        position: 3,
        item: {
          '@type': 'Product',
          name: 'VroomX Enterprise',
          description: 'For large operations that need unlimited capacity and dedicated support.',
          offers: {
            '@type': 'Offer',
            price: '299',
            priceCurrency: 'USD',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: '299',
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

export function BreadcrumbJsonLd({
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
