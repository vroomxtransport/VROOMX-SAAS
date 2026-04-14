import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'
import { CompanyFooter, type CompanyInfo } from './company-footer'

interface AdverseActionFinalEmailProps {
  tenantName: string
  applicantFirstName: string
  finalReason: string
  tenantContactEmail?: string
  company?: CompanyInfo
}

export function AdverseActionFinalEmail({
  tenantName,
  applicantFirstName,
  finalReason,
  tenantContactEmail,
  company,
}: AdverseActionFinalEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Adverse Action Notice from {tenantName}
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Adverse Action Notice</Heading>

          <Text style={textStyle}>Dear {applicantFirstName},</Text>

          <Text style={textStyle}>
            After careful review, <strong>{tenantName}</strong> has made a final decision
            regarding your driver application. We regret to inform you that we are unable
            to move forward with your application at this time.
          </Text>

          <Text style={sectionLabelStyle}>Reason for Adverse Action</Text>
          <Text style={textStyle}>{finalReason}</Text>

          <Hr style={hrStyle} />

          <Heading as="h2" style={subheadingStyle}>
            Your Rights Under the Fair Credit Reporting Act (FCRA)
          </Heading>

          <Text style={textStyle}>
            This adverse action was based, in whole or in part, on information contained
            in a consumer report. You have the following rights:
          </Text>

          <Text style={listItemStyle}>
            1. <strong>Right to a free copy of your report.</strong> You may obtain a free
            copy of your consumer report from the consumer reporting agency that furnished
            the report within 60 days of this notice.
          </Text>
          <Text style={listItemStyle}>
            2. <strong>Right to dispute.</strong> You have the right to dispute the accuracy
            or completeness of any information in your consumer report directly with the
            consumer reporting agency.
          </Text>
          <Text style={listItemStyle}>
            3. <strong>Right to a statement.</strong> You may submit a brief statement
            disputing the information in your file, which the agency must include in
            future reports.
          </Text>

          <Hr style={hrStyle} />

          <Text style={legalStyle}>
            <strong>Consumer Reporting Agency Information</strong>
            <br />
            The consumer reporting agency that furnished the report used in this decision
            did not make the decision to take adverse action and is unable to provide you
            with the specific reasons for this action. You may contact the agency to obtain
            a copy of your report or to dispute any information.
          </Text>

          <Text style={legalStyle}>
            <strong>Equal Employment Opportunity</strong>
            <br />
            Federal law prohibits discrimination based on race, color, religion, sex,
            national origin, age, disability, or genetic information. If you believe this
            decision was made for a discriminatory reason, you may contact the Equal
            Employment Opportunity Commission (EEOC) or your state employment agency.
          </Text>

          {tenantContactEmail ? (
            <Text style={textStyle}>
              If you have questions about this notice, contact {tenantName} at{' '}
              <Link href={`mailto:${tenantContactEmail}`} style={linkStyle}>
                {tenantContactEmail}
              </Link>.
            </Text>
          ) : null}

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

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 'bold',
  color: '#92400e',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: '8px',
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

