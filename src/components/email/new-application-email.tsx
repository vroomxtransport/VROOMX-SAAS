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

interface NewApplicationEmailProps {
  tenantName: string
  applicantFirstName: string
  applicantLastName: string
  applicationId: string
}

export function NewApplicationEmail({
  tenantName,
  applicantFirstName,
  applicantLastName,
  applicationId,
}: NewApplicationEmailProps) {
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vroomx.com'
  const reviewUrl = `${appBaseUrl}/onboarding/${applicationId}`

  return (
    <Html>
      <Head />
      <Preview>
        New driver application submitted: {applicantFirstName} {applicantLastName}
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>New Driver Application</Heading>

          <Text style={textStyle}>
            A new driver application has been submitted for <strong>{tenantName}</strong>.
          </Text>

          <Section style={detailBoxStyle}>
            <Text style={detailLabelStyle}>Applicant</Text>
            <Text style={detailValueStyle}>
              {applicantFirstName} {applicantLastName}
            </Text>
            <Text style={detailLabelStyle}>Submitted</Text>
            <Text style={detailValueStyle}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </Section>

          <Text style={textStyle}>
            Review the application and start the FMCSA onboarding pipeline.
          </Text>

          <Section style={buttonSectionStyle}>
            <Link href={reviewUrl} style={buttonStyle}>
              Review Application
            </Link>
          </Section>

          <Hr style={hrStyle} />

          <Text style={footerStyle}>
            If the button doesn&apos;t work, copy and paste this link into your browser:
            <br />
            <Link href={reviewUrl} style={linkStyle}>
              {reviewUrl}
            </Link>
          </Text>

          <Hr style={hrStyle} />

          <Text style={poweredByStyle}>Powered by VroomX TMS</Text>
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

const detailBoxStyle: React.CSSProperties = {
  backgroundColor: '#f3f4f6',
  padding: '16px',
  borderRadius: '6px',
  margin: '16px 0',
}

const detailLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 'bold',
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: '2px',
}

const detailValueStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#1a1a1a',
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

const poweredByStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#9ca3af',
  textAlign: 'center' as const,
  margin: 0,
}
