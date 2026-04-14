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

interface PreAdverseActionEmailProps {
  tenantName: string
  applicantFirstName: string
  findingsSummary: string
  disputeDeadline: string
  tenantContactEmail?: string
  company?: CompanyInfo
}

export function PreAdverseActionEmail({
  tenantName,
  applicantFirstName,
  findingsSummary,
  disputeDeadline,
  tenantContactEmail,
  company,
}: PreAdverseActionEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Pre-Adverse Action Notice from {tenantName}
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Pre-Adverse Action Notice</Heading>

          <Text style={textStyle}>Dear {applicantFirstName},</Text>

          <Text style={textStyle}>
            We are writing to inform you that <strong>{tenantName}</strong> is considering
            taking adverse action regarding your driver application based on information
            obtained during the screening process.
          </Text>

          <Section style={sectionBoxStyle}>
            <Text style={sectionLabelStyle}>Summary of Findings</Text>
            <Text style={textStyle}>{findingsSummary}</Text>
          </Section>

          <Heading as="h2" style={subheadingStyle}>
            Your Rights Under the Fair Credit Reporting Act (FCRA)
          </Heading>

          <Text style={textStyle}>
            Before any final adverse action is taken, you have the right to:
          </Text>

          <Text style={listItemStyle}>
            1. Review a copy of any consumer report or background check that was used
            in this decision.
          </Text>
          <Text style={listItemStyle}>
            2. Dispute the accuracy or completeness of any information contained in
            the report.
          </Text>
          <Text style={listItemStyle}>
            3. Submit a written explanation or additional documentation for consideration.
          </Text>

          <Section style={highlightBoxStyle}>
            <Text style={highlightTextStyle}>
              <strong>Dispute Deadline:</strong> You have until{' '}
              <strong>{disputeDeadline}</strong> (5 business days) to respond before
              a final decision is made.
            </Text>
          </Section>

          <Text style={textStyle}>
            To exercise your rights, please contact {tenantName}
            {tenantContactEmail ? (
              <>
                {' '}at{' '}
                <Link href={`mailto:${tenantContactEmail}`} style={linkStyle}>
                  {tenantContactEmail}
                </Link>
              </>
            ) : null}.
          </Text>

          <Hr style={hrStyle} />

          <Text style={legalStyle}>
            <strong>Consumer Reporting Agency Information</strong>
            <br />
            The consumer reporting agency that furnished information used in this
            decision did not make the adverse decision and is unable to provide you
            with specific reasons why the adverse action is being considered. You
            have a right to obtain a free copy of your file from the consumer
            reporting agency within 60 days, and to dispute any inaccurate or
            incomplete information.
          </Text>

          <Text style={legalStyle}>
            For a complete description of your rights under the FCRA, visit{' '}
            <Link href="https://www.consumer.ftc.gov/articles/pdf-0096-fair-credit-reporting-act.pdf" style={linkStyle}>
              www.consumer.ftc.gov
            </Link>.
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

const subheadingStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#1a1a1a',
  margin: '24px 0 12px 0',
}

const textStyle: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#374151',
  marginBottom: '12px',
}

const listItemStyle: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#374151',
  marginBottom: '8px',
  paddingLeft: '8px',
}

const sectionBoxStyle: React.CSSProperties = {
  backgroundColor: '#fef3cd',
  padding: '16px',
  borderRadius: '6px',
  margin: '16px 0',
  borderLeft: '4px solid #f59e0b',
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 'bold',
  color: '#92400e',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: '8px',
}

const highlightBoxStyle: React.CSSProperties = {
  backgroundColor: '#fee2e2',
  padding: '16px',
  borderRadius: '6px',
  margin: '16px 0',
  borderLeft: '4px solid #ef4444',
}

const highlightTextStyle: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#991b1b',
  margin: 0,
}

const hrStyle: React.CSSProperties = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
}

const linkStyle: React.CSSProperties = {
  color: '#fb7232',
  textDecoration: 'underline',
}

const legalStyle: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: '20px',
  color: '#6b7280',
  marginBottom: '12px',
}

