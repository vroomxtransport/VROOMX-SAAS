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

interface ResumeApplicationEmailProps {
  tenantName: string
  applicantFirstName: string
  resumeUrl: string
  company?: CompanyInfo
}

export function ResumeApplicationEmail({
  tenantName,
  applicantFirstName,
  resumeUrl,
  company,
}: ResumeApplicationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Resume your driver application for {tenantName}
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Resume Your Application</Heading>

          <Text style={textStyle}>Hi {applicantFirstName},</Text>

          <Text style={textStyle}>
            You requested a link to resume your driver application for{' '}
            <strong>{tenantName}</strong>. Click the button below to continue where
            you left off.
          </Text>

          <Section style={buttonSectionStyle}>
            <Link href={resumeUrl} style={buttonStyle}>
              Resume Application
            </Link>
          </Section>

          <Text style={cautionStyle}>
            This link expires in 72 hours. If it expires, you can request a new one
            from the application page.
          </Text>

          <Hr style={hrStyle} />

          <Text style={footerStyle}>
            If the button doesn&apos;t work, copy and paste this link into your browser:
            <br />
            <Link href={resumeUrl} style={linkStyle}>
              {resumeUrl}
            </Link>
          </Text>

          <Text style={footerStyle}>
            If you did not request this link, you can safely ignore this email.
          </Text>

          <CompanyFooter company={company ?? { name: tenantName }} />
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

const cautionStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#92400e',
  backgroundColor: '#fef3cd',
  padding: '12px 16px',
  borderRadius: '6px',
  margin: '0 0 12px 0',
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

