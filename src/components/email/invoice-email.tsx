import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface InvoiceEmailProps {
  order: {
    id: string
    order_number: string | null
    carrier_pay: string
  }
  tenant: {
    name: string
  }
}

export function InvoiceEmail({ order, tenant }: InvoiceEmailProps) {
  const invoiceNumber = `INV-${order.id}`
  const amountDue = `$${parseFloat(order.carrier_pay).toFixed(2)}`

  return (
    <Html>
      <Head />
      <Preview>Invoice from {tenant.name}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Invoice {invoiceNumber}</Heading>

          <Text style={textStyle}>
            Please find attached the invoice for order{' '}
            {order.order_number ?? order.id}.
          </Text>

          <Section style={amountSectionStyle}>
            <Text style={amountLabelStyle}>Amount Due</Text>
            <Text style={amountValueStyle}>{amountDue}</Text>
          </Section>

          <Hr style={hrStyle} />

          <Text style={footerStyle}>
            This invoice was sent by {tenant.name}.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// Inline styles for email client compatibility
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
  backgroundColor: '#f9fafb',
  borderRadius: '6px',
  padding: '16px',
  marginTop: '16px',
  marginBottom: '16px',
}

const amountLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '0 0 4px 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}

const amountValueStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 'bold',
  color: '#1a1a1a',
  margin: 0,
}

const hrStyle: React.CSSProperties = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
}

const footerStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  margin: 0,
}
