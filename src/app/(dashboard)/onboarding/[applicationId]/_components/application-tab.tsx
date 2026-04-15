'use client'

import { useState } from 'react'
import { CONSENT_TYPE_LABELS } from '@/types'
import type {
  DriverApplication,
  DriverApplicationConsent,
  DriverApplicationAddressHistory,
  AccidentRecord,
  ViolationRecord,
  EmployerRecord,
} from '@/types/database'

interface Props {
  application: DriverApplication
  consents: unknown[]
  addressHistory: unknown[]
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2 border-b border-border-subtle last:border-0">
      <span className="text-xs font-medium text-muted-foreground w-44 shrink-0">{label}</span>
      <span className="text-sm text-foreground break-words">{value ?? <span className="text-muted-foreground/40 italic">Not provided</span>}</span>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-5 first:mt-0">
      {title}
    </h3>
  )
}

function ConsentRow({ consent }: { consent: DriverApplicationConsent }) {
  const [showText, setShowText] = useState(false)
  const label = CONSENT_TYPE_LABELS[consent.consent_type] ?? consent.consent_type

  return (
    <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <span className="shrink-0 text-[10px] text-green-700 border border-green-200 rounded px-1.5 py-0.5">
          Signed
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">Typed name:</span> {consent.typed_name}
        </div>
        <div>
          <span className="font-medium text-foreground">Signed at:</span>{' '}
          {new Date(consent.signed_at).toLocaleString()}
        </div>
        <div className="truncate">
          <span className="font-medium text-foreground">IP:</span> {consent.ip_address}
        </div>
        <div className="truncate">
          <span className="font-medium text-foreground">UA:</span>{' '}
          <span title={consent.user_agent} className="truncate">{consent.user_agent.slice(0, 60)}…</span>
        </div>
      </div>
      <button
        onClick={() => setShowText(!showText)}
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
      >
        {showText ? 'Hide legal text' : 'Show legal text'}
      </button>
      {showText && (
        <div className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {consent.signed_text}
        </div>
      )}
    </div>
  )
}

export function ApplicationTab({ application, consents, addressHistory }: Props) {
  const appData = application.application_data
  const typedConsents = consents as DriverApplicationConsent[]
  const typedAddresses = addressHistory as DriverApplicationAddressHistory[]

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-1">
      {/* Personal information */}
      <SectionHeader title="Personal Information" />
      <FieldRow label="Full Name" value={[application.first_name, application.last_name].filter(Boolean).join(' ')} />
      <FieldRow label="Date of Birth" value={application.date_of_birth ?? undefined} />
      <FieldRow label="SSN (last 4)" value={application.ssn_last4 ? `***-**-${application.ssn_last4}` : undefined} />
      <FieldRow label="Email" value={application.email ?? undefined} />
      <FieldRow label="Phone" value={application.phone ?? undefined} />
      <FieldRow label="License Number" value={application.license_number ?? undefined} />
      <FieldRow label="License State" value={application.license_state ?? undefined} />

      {/* Address history */}
      {typedAddresses.length > 0 && (
        <>
          <SectionHeader title="Address History (§ 391.21(b)(3) — 3 years)" />
          {typedAddresses.map((addr) => (
            <FieldRow
              key={addr.id}
              label={addr.from_date + (addr.to_date ? ` – ${addr.to_date}` : ' – Present')}
              value={`${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`}
            />
          ))}
        </>
      )}

      {/* Driving history */}
      {appData?.accidents && appData.accidents.length > 0 && (
        <>
          <SectionHeader title="Accident Record (§ 391.21(b)(8))" />
          {appData.accidents.map((acc: AccidentRecord, i: number) => (
            <div key={i} className="rounded-md border border-border bg-muted/20 p-2 text-xs space-y-1 mb-2">
              <FieldRow label="Date" value={acc.date} />
              <FieldRow label="Location" value={acc.location} />
              <FieldRow label="Nature" value={acc.nature} />
            </div>
          ))}
        </>
      )}

      {appData?.violations && appData.violations.length > 0 && (
        <>
          <SectionHeader title="Traffic Convictions (§ 391.21(b)(9))" />
          {appData.violations.map((v: ViolationRecord, i: number) => (
            <div key={i} className="rounded-md border border-border bg-muted/20 p-2 text-xs space-y-1 mb-2">
              <FieldRow label="Date" value={v.date} />
              <FieldRow label="Charge" value={v.charge} />
              <FieldRow label="Disposition" value={v.disposition} />
            </div>
          ))}
        </>
      )}

      {/* Employment history */}
      {appData?.employers && appData.employers.length > 0 && (
        <>
          <SectionHeader title="Employment History (§ 391.21(b)(6))" />
          {appData.employers.map((emp: EmployerRecord, i: number) => (
            <div key={i} className="rounded-md border border-border bg-muted/20 p-2 text-xs space-y-1 mb-2">
              <FieldRow label="Company" value={emp.employer_name} />
              <FieldRow label="Position" value={emp.position_held} />
              <FieldRow
                label="Dates"
                value={`${emp.date_from ?? '—'} → ${emp.date_to ?? 'Present'}`}
              />
              {emp.reason_for_leaving && <FieldRow label="Reason for leaving" value={emp.reason_for_leaving} />}
            </div>
          ))}
        </>
      )}

      {/* Drug & alcohol history */}
      {appData?.drug_alcohol_history && (
        <>
          <SectionHeader title="Drug & Alcohol History (§ 391.21(b)(11))" />
          <FieldRow
            label="Positive drug test"
            value={appData.drug_alcohol_history.positive_drug_test ? 'Yes' : 'No'}
          />
          <FieldRow
            label="Refused test"
            value={appData.drug_alcohol_history.refused_test ? 'Yes' : 'No'}
          />
          <FieldRow
            label="Alcohol concentration >= 0.04"
            value={appData.drug_alcohol_history.alcohol_concentration_04 ? 'Yes' : 'No'}
          />
        </>
      )}

      {/* Application metadata */}
      <SectionHeader title="Application Metadata" />
      <FieldRow label="Application ID" value={<span className="font-mono text-xs">{application.id}</span>} />
      <FieldRow
        label="Submitted"
        value={application.submitted_at ? new Date(application.submitted_at).toLocaleString() : undefined}
      />
      <FieldRow label="Schema version" value={String(application.schema_version)} />

      {/* Consents */}
      {typedConsents.length > 0 && (
        <>
          <SectionHeader title="Signed Consents" />
          <div className="space-y-2">
            {typedConsents.map((c) => (
              <ConsentRow key={c.id} consent={c} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
