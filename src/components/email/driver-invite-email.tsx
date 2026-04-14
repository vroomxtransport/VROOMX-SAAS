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
import { CompanyFooter, type CompanyInfo } from './company-footer'

interface DriverInviteEmailProps {
  tenantName: string
  tenantSlug: string
  inviterName: string
  driverFirstName: string
  applicationUrl: string
  company?: CompanyInfo
}

export function DriverInviteEmail({
  tenantName,
  tenantSlug,
  inviterName,
  driverFirstName,
  applicationUrl,
  company,
}: DriverInviteEmailProps) {
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vroomx.com'
  const resumeUrl = `${appBaseUrl}/apply/${tenantSlug}/resume`

  return (
    <Html>
      <Head />
      <Preview>
        {inviterName} from {tenantName} has invited you to apply for a driver position
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Driver Application Invitation</Heading>

          <Text style={textStyle}>Hi {driverFirstName},</Text>

          <Text style={textStyle}>
            <strong>{inviterName}</strong> from <strong>{tenantName}</strong> has invited you
            to apply for a driver position.
          </Text>

          <Text style={textStyle}>
            Click the button below to start your application. The form covers the federally
            required FMCSA driver qualification information and takes about 10 minutes to
            complete. You can save and come back any time within 72 hours.
          </Text>

          <Section style={buttonSectionStyle}>
            <Link href={applicationUrl} style={buttonStyle}>
              Start Your Application
            </Link>
          </Section>

          <Hr style={hrStyle} />

          <Text style={footerStyle}>
            If the button doesn&apos;t work, copy and paste this link into your browser:
            <br />
            <Link href={applicationUrl} style={linkStyle}>
              {applicationUrl}
            </Link>
          </Text>

          <Text style={footerStyle}>
            If you lose this link, you can request a new one at{' '}
            <Link href={resumeUrl} style={linkStyle}>
              {resumeUrl}
            </Link>
          </Text>

          <CompanyFooter company={company ?? { name: tenantName }} />
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
  marginBottom: '12px',
}

const buttonSectionStyle: React.CSSProperties = {
  textAlign: 'center' as const,
  marginTop: '24px',
  marginBottom: '24px',
}

const buttonStyle: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#fb7232',
  color: '#ffffff',
  padding: '12px 28px',
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
  margin: '0 0 12px 0',
  lineHeight: '20px',
}

const linkStyle: React.CSSProperties = {
  color: '#fb7232',
  textDecoration: 'underline',
  wordBreak: 'break-all' as const,
}

