import { notFound } from 'next/navigation'
import { getIntegration } from '@/lib/integrations/registry'
import { IntegrationDetail } from '../_components/integration-detail'

interface IntegrationPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: IntegrationPageProps) {
  const { slug } = await params
  const integration = getIntegration(slug)
  if (!integration) return { title: 'Integration Not Found' }

  return {
    title: `${integration.name} Integration | VroomX`,
    description: integration.description,
  }
}

export default async function IntegrationPage({ params }: IntegrationPageProps) {
  const { slug } = await params
  const integration = getIntegration(slug)

  if (!integration) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <IntegrationDetail integration={integration} />
    </div>
  )
}
