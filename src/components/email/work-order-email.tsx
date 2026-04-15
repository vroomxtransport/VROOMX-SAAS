import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { CompanyFooter, type CompanyInfo } from './company-footer'

interface WorkOrderEmailProps {
  workOrder: {
    id: string
    wo_number: number | null
    status: string
    description: string | null
    grand_total: string | null
  }
  shopName: string | null
  truckLabel: string | null
  tenant: CompanyInfo
  senderName: string | null
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  closed: 'Closed',
}

export function WorkOrderEmail({
  workOrder,
  shopName,
  truckLabel,
  tenant,
  senderName,
}: WorkOrderEmailProps) {
  const woRef = workOrder.wo_number
    ? `#${workOrder.wo_number}`
    : workOrder.id.slice(0, 8).toUpperCase()
  const status = STATUS_LABELS[workOrder.status] ?? workOrder.status
  const total = `$${Number(workOrder.grand_total ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

  return (
    <Html>
      <Head />
      <Preview>
        Work Order {woRef} — {status} — {total}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Work Order {woRef}</Heading>

          <Text style={paragraph}>
            {senderName ? `${senderName} from ` : ''}
            {tenant.name ?? 'our team'} is sharing Work Order {woRef}. The full
            details are attached as a PDF.
          </Text>

          <Section style={card}>
            <Row label="Status" value={status} />
            {shopName && <Row label="Shop" value={shopName} />}
            {truckLabel && <Row label="Equipment" value={truckLabel} />}
            {workOrder.description && (
              <Row label="Description" value={workOrder.description} />
            )}
            <Row label="Grand Total" value={total} emphasize />
          </Section>

          <Text style={paragraph}>
            Questions? Reply directly to this email — we monitor this inbox.
          </Text>

          <CompanyFooter company={tenant} />
        </Container>
      </Body>
    </Html>
  )
}

function Row({
  label,
  value,
  emphasize,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <Text style={emphasize ? rowEmphasize : row}>
      <span style={rowLabel}>{label}:</span> {value}
    </Text>
  )
}

const body = {
  backgroundColor: '#f6f8fa',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  padding: '40px 0',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '32px',
  maxWidth: '560px',
  borderRadius: '6px',
}

const h1 = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0 0 12px',
}

const paragraph = {
  color: '#334155',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '12px 0',
}

const card = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '4px',
  padding: '16px 20px',
  margin: '16px 0',
}

const row = {
  color: '#334155',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '4px 0',
}

const rowEmphasize = {
  ...row,
  fontWeight: '600',
  color: '#0f172a',
}

const rowLabel = {
  color: '#64748b',
  marginRight: '4px',
  fontWeight: '600',
}
