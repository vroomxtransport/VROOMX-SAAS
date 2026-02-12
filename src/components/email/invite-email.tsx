import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface InviteEmailProps {
  tenantName: string
  inviterName: string
  role: string
  acceptUrl: string
}

export function InviteEmail({ tenantName, inviterName, role, acceptUrl }: InviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You've been invited to join {tenantName} on VroomX</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Team Invitation</Heading>

          <Text style={textStyle}>
            {inviterName} has invited you to join <strong>{tenantName}</strong> on VroomX
            as a <strong>{role}</strong>.
          </Text>

          <Section style={buttonSectionStyle}>
            <Link href={acceptUrl} style={buttonStyle}>
              Accept Invitation
            </Link>
          </Section>

          <Hr style={hrStyle} />

          <Text style={footerStyle}>
            This invitation expires in 72 hours. If you didn't expect this email, you can safely ignore it.
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

const buttonSectionStyle: React.CSSProperties = {
  textAlign: 'center' as const,
  marginTop: '24px',
  marginBottom: '24px',
}

const buttonStyle: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2563eb',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 'bold',
  textDecoration: 'none',
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
