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

interface ReceiptEmailProps {
  order: {
    id: string
    order_number: string | null
    amount_paid: string | null
    payment_type: string | null
  }
  tenant: CompanyInfo
  paymentDate: string
}

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  COD: 'Cash on Delivery',
  COP: 'Cash on Pickup',
  CHECK: 'Check',
  SPLIT: 'Split',
  BILL: 'Billed',
}

export function ReceiptEmail({ order, tenant, paymentDate }: ReceiptEmailProps) {
  const orderRef = order.order_number ?? order.id.slice(0, 8).toUpperCase()
  const amount = `$${Number(order.amount_paid ?? 0).toFixed(2)}`
  const typeLabel = order.payment_type
    ? PAYMENT_TYPE_LABEL[order.payment_type] ?? order.payment_type
    : 'N/A'
  const formattedDate = new Date(paymentDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <Html>
      <Head />
      <Preview>Payment receipt from {tenant.name}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Payment Receipt</Heading>

          <Text style={textStyle}>
            Thank you — we have received your payment for order{' '}
            <strong>{orderRef}</strong>. The official receipt is attached as a
            PDF.
          </Text>

          <Section style={amountSectionStyle}>
            <Text style={amountLabelStyle}>Amount Received</Text>
            <Text style={amountValueStyle}>{amount}</Text>
            <Text style={metaStyle}>
              Paid {formattedDate} · {typeLabel} · Status PAID
            </Text>
          </Section>

          <Text style={textStyle}>
            If anything looks off, reply to this email and we&apos;ll sort it out
            right away.
          </Text>

          <CompanyFooter company={tenant} />
        </Container>
      </Body>
    </Html>
  )
}

const bodyStyle: React.CSSProperties = {
  fontFamily: 'Arial, Helvetica, sans-serif',
  backgroundColor: '#f9fafb',
  margin: 0,
  padding: 0,
}

const containerStyle: React.CSSProperties = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: '40px 20px',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  marginTop: '20px',
  marginBottom: '20px',
}

const headingStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#1a1a1a',
  margin: '0 0 16px 0',
}

const textStyle: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#374151',
}

const amountSectionStyle: React.CSSProperties = {
  backgroundColor: '#ecfdf5',
  borderRadius: '6px',
  padding: '16px',
  marginTop: '16px',
  marginBottom: '16px',
  border: '1px solid #a7f3d0',
}

const amountLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#047857',
  margin: '0 0 4px 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}

const amountValueStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 'bold',
  color: '#065f46',
  margin: 0,
}

const metaStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#047857',
  margin: '6px 0 0 0',
}
