import { Hr, Section, Text } from '@react-email/components'

export interface CompanyInfo {
  name: string
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  phone?: string | null
  dot_number?: string | null
  mc_number?: string | null
}

interface CompanyFooterProps {
  company: CompanyInfo
}

export function CompanyFooter({ company }: CompanyFooterProps) {
  const addressLine = [
    company.address,
    [company.city, company.state].filter(Boolean).join(', '),
    company.zip,
  ]
    .filter(Boolean)
    .join(' · ')

  const regulatoryLine = [
    company.dot_number ? `DOT# ${company.dot_number}` : null,
    company.mc_number ? `MC# ${company.mc_number}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Section>
      <Hr style={hrStyle} />
      <Text style={companyNameStyle}>{company.name}</Text>
      {addressLine && <Text style={detailStyle}>{addressLine}</Text>}
      {company.phone && <Text style={detailStyle}>{company.phone}</Text>}
      {regulatoryLine && <Text style={detailStyle}>{regulatoryLine}</Text>}
      <Text style={poweredByStyle}>Powered by VroomX TMS</Text>
    </Section>
  )
}

const hrStyle: React.CSSProperties = {
  borderColor: '#e5e7eb',
  margin: '24px 0 16px 0',
}

const companyNameStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 'bold',
  color: '#374151',
  margin: '0 0 4px 0',
  textAlign: 'center',
}

const detailStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#6b7280',
  margin: '0 0 2px 0',
  textAlign: 'center',
}

const poweredByStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#9ca3af',
  margin: '12px 0 0 0',
  textAlign: 'center',
}
