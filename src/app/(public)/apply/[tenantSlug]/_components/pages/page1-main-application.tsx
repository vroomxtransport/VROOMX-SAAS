'use client'

/**
 * Page 1 — Main Application (§ 391.21(b))
 *
 * 7 stacked sections on desktop, accordion on mobile:
 *   1. Applicant Information
 *   2. Driver's License Information
 *   3. Medical Card
 *   4. Accidents/Crashes
 *   5. Moving Traffic Violations
 *   6. Forfeitures
 *   7. Employment Record
 *
 * Followed by the "TO BE READ AND SIGNED BY APPLICANT" consent block.
 */

import { useState } from 'react'
import { useFormContext, useFieldArray, Controller } from 'react-hook-form'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FullApplication } from '@/lib/validations/driver-application'
import { SignatureBox } from '../signature-box'
import { FileUploadField } from '../file-upload-field'
import { APPLICATION_CERTIFICATION_TEXT } from '../consent-text'
import type { DriverApplication } from '@/types/database'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

const ENDORSEMENTS = [
  { value: 'H', label: 'H — Placarded Hazmat' },
  { value: 'N', label: 'N — Tank Vehicles' },
  { value: 'P', label: 'P — Passengers' },
  { value: 'T', label: 'T — Double/Triple Trailers' },
  { value: 'S', label: 'S — School Bus' },
  { value: 'X', label: 'X — Placarded Hazmat & Tank' },
] as const

interface Page1Props {
  resumeToken: string
  application: DriverApplication
  tenantName?: string
  onConsentSigned?: (typedName: string) => Promise<void>
}

// Collapsible section wrapper for mobile — card style with section number badge
function Section({
  title,
  sectionNumber,
  children,
  defaultOpen = true,
}: {
  title: string
  sectionNumber: number
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section
      className={cn(
        'rounded-xl border border-gray-100 bg-white shadow-[0_1px_2px_rgba(50,50,93,0.06)] overflow-hidden transition-all duration-200',
        open && 'border-t-2 border-t-[var(--brand-primary,#192334)]',
      )}
    >
      {/* Section header — accordion on mobile, plain on desktop */}
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#192334)] md:cursor-default"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--brand-primary,#192334)] text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            {sectionNumber}
          </span>
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {title}
          </h3>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200 md:hidden',
            open && 'rotate-180',
          )}
        />
      </button>

      <div
        className={cn(
          'grid transition-all duration-300 ease-in-out md:!grid-rows-[1fr] md:!opacity-100',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-6 pt-1 space-y-4">{children}</div>
        </div>
      </div>
    </section>
  )
}

// Reusable labeled input
function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-red-400" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

const inputCls = (error?: string) =>
  cn(
    'w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-[border-color,box-shadow] duration-200',
    'placeholder:text-muted-foreground',
    'focus:border-[var(--brand-primary,#192334)] focus:shadow-[0_0_0_3px_rgba(25,35,52,0.08)]',
    '[font-size:16px]',
    error ? 'border-red-400' : 'border-gray-200',
  )

const selectCls = (error?: string) =>
  cn(
    inputCls(error),
    'appearance-none bg-no-repeat pr-8',
    "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")] bg-[right_12px_center]",
  )

// Small numbered badge for nested card items (addresses, employers, etc.)
function ItemBadge({ index }: { index: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-gray-600">
      {index + 1}
    </span>
  )
}

export function Page1MainApplication({ resumeToken, onConsentSigned }: Page1Props) {
  const [isCertSigned, setIsCertSigned] = useState(false)
  const [certSigError, setCertSigError] = useState<string | undefined>()
  const [certTypedName, setCertTypedName] = useState('')
  const { register, control, watch, setValue, formState: { errors } } = useFormContext<FullApplication>()
  const p = 'page1' as const

  const lived3Years = watch(`${p}.applicantInfo.lived3Years`)
  const hasAdditionalLicenses = watch(`${p}.hasAdditionalLicenses`)
  const hasAccidents = watch(`${p}.accidents.hasAccidents`)
  const hasViolations = watch(`${p}.violations.hasViolations`)
  const deniedLicense = watch(`${p}.forfeitures.deniedLicense`)
  const revokedSuspended = watch(`${p}.forfeitures.revokedSuspended`)

  const { fields: addressFields, append: appendAddress, remove: removeAddress } = useFieldArray({
    control,
    name: `${p}.addressHistory`,
  })
  const { fields: additionalLicenseFields, append: appendLicense, remove: removeLicense } = useFieldArray({
    control,
    name: `${p}.additionalLicenses`,
  })
  const { fields: accidentFields, append: appendAccident, remove: removeAccident } = useFieldArray({
    control,
    name: `${p}.accidents.accidents`,
  })
  const { fields: violationFields, append: appendViolation, remove: removeViolation } = useFieldArray({
    control,
    name: `${p}.violations.violations`,
  })
  const { fields: employerFields, append: appendEmployer, remove: removeEmployer } = useFieldArray({
    control,
    name: `${p}.employers`,
  })

  const p1Errors = errors.page1

  function handleCertSignatureChange(name: string) {
    setCertTypedName(name)
    setCertSigError(undefined)
  }

  async function handleCertSign(name: string) {
    if (!name.trim()) {
      setCertSigError('Please type your full legal name to sign.')
      return
    }
    await onConsentSigned?.(name)
    setIsCertSigned(true)
  }

  return (
    <div className="space-y-3">
      <header className="mb-6">
        <h2 className="text-lg font-bold text-[#192334]">Application For Employment</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          All fields marked with * are required. Complete all sections truthfully and to the best of your knowledge.
        </p>
      </header>

      {/* ── Section 1: Applicant Information ── */}
      <Section title="1. Applicant Information" sectionNumber={1}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First Name" required error={p1Errors?.applicantInfo?.firstName?.message}>
            <input
              {...register(`${p}.applicantInfo.firstName`)}
              autoFocus
              autoComplete="given-name"
              placeholder="First name"
              className={inputCls(p1Errors?.applicantInfo?.firstName?.message)}
            />
          </Field>
          <Field label="Last Name" required error={p1Errors?.applicantInfo?.lastName?.message}>
            <input
              {...register(`${p}.applicantInfo.lastName`)}
              autoComplete="family-name"
              placeholder="Last name"
              className={inputCls(p1Errors?.applicantInfo?.lastName?.message)}
            />
          </Field>
          <Field label="Date of Birth" required error={p1Errors?.applicantInfo?.dateOfBirth?.message}>
            <input
              {...register(`${p}.applicantInfo.dateOfBirth`)}
              type="date"
              className={inputCls(p1Errors?.applicantInfo?.dateOfBirth?.message)}
            />
          </Field>
          <Field label="Social Security Number" required error={p1Errors?.applicantInfo?.ssn?.message}>
            <input
              {...register(`${p}.applicantInfo.ssn`)}
              type="text"
              placeholder="xxx-xx-xxxx"
              maxLength={11}
              autoComplete="off"
              inputMode="numeric"
              className={inputCls(p1Errors?.applicantInfo?.ssn?.message)}
            />
          </Field>
          <Field label="Phone" required error={p1Errors?.applicantInfo?.phone?.message}>
            <input
              {...register(`${p}.applicantInfo.phone`)}
              type="tel"
              autoComplete="tel"
              placeholder="(555) 555-5555"
              className={inputCls(p1Errors?.applicantInfo?.phone?.message)}
            />
          </Field>
          <Field label="Email" required error={p1Errors?.applicantInfo?.email?.message}>
            <input
              {...register(`${p}.applicantInfo.email`)}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className={inputCls(p1Errors?.applicantInfo?.email?.message)}
            />
          </Field>
        </div>

        <Field label="Address" required error={p1Errors?.applicantInfo?.address?.message}>
          <input
            {...register(`${p}.applicantInfo.address`)}
            autoComplete="street-address"
            placeholder="Street address"
            className={inputCls(p1Errors?.applicantInfo?.address?.message)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="col-span-2">
            <Field label="City" required error={p1Errors?.applicantInfo?.city?.message}>
              <input
                {...register(`${p}.applicantInfo.city`)}
                autoComplete="address-level2"
                className={inputCls(p1Errors?.applicantInfo?.city?.message)}
              />
            </Field>
          </div>
          <Field label="State" required error={p1Errors?.applicantInfo?.state?.message}>
            <select
              {...register(`${p}.applicantInfo.state`)}
              className={selectCls(p1Errors?.applicantInfo?.state?.message)}
            >
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Zip Code" required error={p1Errors?.applicantInfo?.zip?.message}>
            <input
              {...register(`${p}.applicantInfo.zip`)}
              inputMode="numeric"
              maxLength={10}
              className={inputCls(p1Errors?.applicantInfo?.zip?.message)}
            />
          </Field>
        </div>

        {/* Lived 3+ years at current address? */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Have you lived at this address for more than 3 years? *
          </p>
          <div className="flex gap-6">
            {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(({ label, value }) => (
              <label key={label} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <Controller
                  control={control}
                  name={`${p}.applicantInfo.lived3Years`}
                  render={({ field }) => (
                    <input
                      type="radio"
                      checked={field.value === value}
                      onChange={() => field.onChange(value)}
                      className="h-[18px] w-[18px] accent-[var(--brand-primary,#192334)]"
                    />
                  )}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Address history repeater */}
        {!lived3Years && (
          <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/30 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-gray-100 pb-2">
              Previous Addresses — past 3 years (most recent first)
            </p>
            {addressFields.map((field, idx) => (
              <div key={field.id} className="relative space-y-3 rounded-lg border border-gray-100 bg-white p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <ItemBadge index={idx} />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Address {idx + 1}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAddress(idx)}
                    className="flex items-center gap-1 text-[11px] font-medium text-red-400 hover:text-red-600 transition-colors"
                    aria-label={`Remove address ${idx + 1}`}
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label="Street">
                      <input
                        {...register(`${p}.addressHistory.${idx}.street`)}
                        placeholder="Street address"
                        className={inputCls()}
                      />
                    </Field>
                  </div>
                  <Field label="City">
                    <input {...register(`${p}.addressHistory.${idx}.city`)} className={inputCls()} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="State">
                      <select {...register(`${p}.addressHistory.${idx}.state`)} className={selectCls()}>
                        {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Field>
                    <Field label="Zip">
                      <input {...register(`${p}.addressHistory.${idx}.zip`)} className={inputCls()} />
                    </Field>
                  </div>
                  <Field label="From Date">
                    <input {...register(`${p}.addressHistory.${idx}.fromDate`)} type="date" className={inputCls()} />
                  </Field>
                  <Field label="To Date">
                    <input {...register(`${p}.addressHistory.${idx}.toDate`)} type="date" className={inputCls()} />
                  </Field>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => appendAddress({ street: '', city: '', state: 'AL', zip: '', fromDate: '', toDate: '', position: addressFields.length })}
              className="flex items-center gap-1.5 rounded-full border border-[var(--brand-primary,#192334)] px-3 py-1 text-xs font-medium text-[var(--brand-primary,#192334)] hover:bg-[var(--brand-primary,#192334)] hover:text-white transition-colors"
            >
              <Plus className="h-3 w-3" /> Add Address
            </button>
          </div>
        )}
      </Section>

      {/* ── Section 2: Driver's License ── */}
      <Section title="2. Driver's License Information" sectionNumber={2}>
        <p className="text-xs text-muted-foreground italic">
          Include all licenses held for the past 3 years. Start with the most current.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="License Number" required error={p1Errors?.primaryLicense?.licenseNumber?.message}>
            <input
              {...register(`${p}.primaryLicense.licenseNumber`)}
              className={inputCls(p1Errors?.primaryLicense?.licenseNumber?.message)}
            />
          </Field>
          <Field label="State" required error={p1Errors?.primaryLicense?.state?.message}>
            <select
              {...register(`${p}.primaryLicense.state`)}
              className={selectCls(p1Errors?.primaryLicense?.state?.message)}
            >
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Class" required error={p1Errors?.primaryLicense?.class?.message}>
            <select
              {...register(`${p}.primaryLicense.class`)}
              className={selectCls(p1Errors?.primaryLicense?.class?.message)}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </Field>
          <Field label="Expiration Date" required error={p1Errors?.primaryLicense?.expires?.message}>
            <input
              {...register(`${p}.primaryLicense.expires`)}
              type="date"
              className={inputCls(p1Errors?.primaryLicense?.expires?.message)}
            />
          </Field>
        </div>

        {/* Endorsements */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Endorsements</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ENDORSEMENTS.map((e) => (
              <label key={e.value} className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
                <Controller
                  control={control}
                  name={`${p}.primaryLicense.endorsements`}
                  render={({ field }) => (
                    <input
                      type="checkbox"
                      checked={Array.isArray(field.value) && field.value.includes(e.value)}
                      onChange={(ev) => {
                        const current = Array.isArray(field.value) ? field.value : []
                        field.onChange(
                          ev.target.checked
                            ? [...current, e.value]
                            : current.filter((v) => v !== e.value)
                        )
                      }}
                      className="h-[18px] w-[18px] rounded accent-[var(--brand-primary,#192334)]"
                    />
                  )}
                />
                {e.label}
              </label>
            ))}
          </div>
        </div>

        {/* File uploads */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FileUploadField
            label="Upload Front of License"
            documentType="license_front"
            resumeToken={resumeToken}
            existingFilePath={watch(`${p}.primaryLicense.frontFilePath`) || null}
            onUploadSuccess={({ storagePath }) => {
              setValue(`${p}.primaryLicense.frontFilePath`, storagePath, { shouldDirty: true })
            }}
          />
          <FileUploadField
            label="Upload Back of License"
            documentType="license_back"
            resumeToken={resumeToken}
            existingFilePath={watch(`${p}.primaryLicense.backFilePath`) || null}
            onUploadSuccess={({ storagePath }) => {
              setValue(`${p}.primaryLicense.backFilePath`, storagePath, { shouldDirty: true })
            }}
          />
        </div>

        {/* Additional licenses */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Have you held any other licenses in the past 3 years?
          </p>
          <div className="flex gap-6">
            {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(({ label, value }) => (
              <label key={label} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <Controller
                  control={control}
                  name={`${p}.hasAdditionalLicenses`}
                  render={({ field }) => (
                    <input
                      type="radio"
                      checked={field.value === value}
                      onChange={() => field.onChange(value)}
                      className="h-[18px] w-[18px] accent-[var(--brand-primary,#192334)]"
                    />
                  )}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {hasAdditionalLicenses && (
          <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/30 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-gray-100 pb-2">
              Additional Licenses
            </p>
            {additionalLicenseFields.map((field, idx) => (
              <div key={field.id} className="relative rounded-lg border border-gray-100 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ItemBadge index={idx} />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">License {idx + 1}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLicense(idx)}
                    className="flex items-center gap-1 text-[11px] font-medium text-red-400 hover:text-red-600 transition-colors"
                    aria-label={`Remove license ${idx + 1}`}
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="License #">
                    <input {...register(`${p}.additionalLicenses.${idx}.licenseNumber`)} className={inputCls()} />
                  </Field>
                  <Field label="State">
                    <select {...register(`${p}.additionalLicenses.${idx}.state`)} className={selectCls()}>
                      {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Class">
                    <select {...register(`${p}.additionalLicenses.${idx}.class`)} className={selectCls()}>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </select>
                  </Field>
                  <Field label="Expires">
                    <input {...register(`${p}.additionalLicenses.${idx}.expires`)} type="date" className={inputCls()} />
                  </Field>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => appendLicense({ licenseNumber: '', state: 'AL', class: 'A', expires: '' })}
              className="flex items-center gap-1.5 rounded-full border border-[var(--brand-primary,#192334)] px-3 py-1 text-xs font-medium text-[var(--brand-primary,#192334)] hover:bg-[var(--brand-primary,#192334)] hover:text-white transition-colors"
            >
              <Plus className="h-3 w-3" /> Add License
            </button>
          </div>
        )}
      </Section>

      {/* ── Section 3: Medical Card ── */}
      <Section title="3. Medical Card" sectionNumber={3}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FileUploadField
            label="Upload Medical Card"
            documentType="medical_card"
            resumeToken={resumeToken}
            existingFilePath={watch(`${p}.medicalCard.filePath`) || null}
            onUploadSuccess={({ storagePath }) => {
              setValue(`${p}.medicalCard.filePath`, storagePath, { shouldDirty: true })
            }}
          />
          <Field label="Medical Certificate Expiration Date" required error={p1Errors?.medicalCard?.expirationDate?.message}>
            <input
              {...register(`${p}.medicalCard.expirationDate`)}
              type="date"
              className={inputCls(p1Errors?.medicalCard?.expirationDate?.message)}
            />
          </Field>
        </div>
      </Section>

      {/* ── Section 4: Accidents ── */}
      <Section title="4. Accidents/Crashes Previous 3 Years" sectionNumber={4}>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Have you had any accidents/crashes in the last 3 years? *
          </p>
          <div className="flex gap-6">
            {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(({ label, value }) => (
              <label key={label} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <Controller
                  control={control}
                  name={`${p}.accidents.hasAccidents`}
                  render={({ field }) => (
                    <input
                      type="radio"
                      checked={field.value === value}
                      onChange={() => field.onChange(value)}
                      className="h-[18px] w-[18px] accent-[var(--brand-primary,#192334)]"
                    />
                  )}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {hasAccidents && (
          <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/30 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-gray-100 pb-2">
              Accident Records
            </p>
            {accidentFields.map((field, idx) => (
              <div key={field.id} className="relative rounded-lg border border-gray-100 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ItemBadge index={idx} />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Accident {idx + 1}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAccident(idx)}
                    className="flex items-center gap-1 text-[11px] font-medium text-red-400 hover:text-red-600 transition-colors"
                    aria-label={`Remove accident ${idx + 1}`}
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Date">
                    <input {...register(`${p}.accidents.accidents.${idx}.date`)} type="date" className={inputCls()} />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Nature of Accident">
                      <input {...register(`${p}.accidents.accidents.${idx}.nature`)} className={inputCls()} />
                    </Field>
                  </div>
                  <Field label="Location">
                    <input {...register(`${p}.accidents.accidents.${idx}.location`)} className={inputCls()} />
                  </Field>
                  <Field label="Fatalities">
                    <input {...register(`${p}.accidents.accidents.${idx}.fatalities`)} type="number" min="0" className={inputCls()} />
                  </Field>
                  <Field label="Injuries">
                    <input {...register(`${p}.accidents.accidents.${idx}.injuries`)} type="number" min="0" className={inputCls()} />
                  </Field>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => appendAccident({ date: '', nature: '', fatalities: 0, injuries: 0, location: '' })}
              className="flex items-center gap-1.5 rounded-full border border-[var(--brand-primary,#192334)] px-3 py-1 text-xs font-medium text-[var(--brand-primary,#192334)] hover:bg-[var(--brand-primary,#192334)] hover:text-white transition-colors"
            >
              <Plus className="h-3 w-3" /> Add Accident
            </button>
          </div>
        )}
      </Section>

      {/* ── Section 5: Violations ── */}
      <Section title="5. Moving Traffic Violations Previous 3 Years" sectionNumber={5}>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Have you had any traffic violations in the last 3 years? *
          </p>
          <div className="flex gap-6">
            {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(({ label, value }) => (
              <label key={label} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <Controller
                  control={control}
                  name={`${p}.violations.hasViolations`}
                  render={({ field }) => (
                    <input
                      type="radio"
                      checked={field.value === value}
                      onChange={() => field.onChange(value)}
                      className="h-[18px] w-[18px] accent-[var(--brand-primary,#192334)]"
                    />
                  )}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {hasViolations && (
          <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/30 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-gray-100 pb-2">
              Violation Records
            </p>
            {violationFields.map((field, idx) => (
              <div key={field.id} className="relative rounded-lg border border-gray-100 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ItemBadge index={idx} />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Violation {idx + 1}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeViolation(idx)}
                    className="flex items-center gap-1 text-[11px] font-medium text-red-400 hover:text-red-600 transition-colors"
                    aria-label={`Remove violation ${idx + 1}`}
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Date">
                    <input {...register(`${p}.violations.violations.${idx}.date`)} type="date" className={inputCls()} />
                  </Field>
                  <Field label="Charge">
                    <input {...register(`${p}.violations.violations.${idx}.charge`)} className={inputCls()} />
                  </Field>
                  <Field label="Disposition">
                    <input {...register(`${p}.violations.violations.${idx}.disposition`)} className={inputCls()} />
                  </Field>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => appendViolation({ date: '', charge: '', disposition: '' })}
              className="flex items-center gap-1.5 rounded-full border border-[var(--brand-primary,#192334)] px-3 py-1 text-xs font-medium text-[var(--brand-primary,#192334)] hover:bg-[var(--brand-primary,#192334)] hover:text-white transition-colors"
            >
              <Plus className="h-3 w-3" /> Add Violation
            </button>
          </div>
        )}
      </Section>

      {/* ── Section 6: Forfeitures ── */}
      <Section title="6. Forfeitures Previous 3 Years" sectionNumber={6}>
        {/* 6a */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            a. Have you ever been denied a license, permit, or privilege to operate a motor vehicle? *
          </p>
          <div className="flex gap-6">
            {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(({ label, value }) => (
              <label key={label} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <Controller
                  control={control}
                  name={`${p}.forfeitures.deniedLicense`}
                  render={({ field }) => (
                    <input
                      type="radio"
                      checked={field.value === value}
                      onChange={() => field.onChange(value)}
                      className="h-[18px] w-[18px] accent-[var(--brand-primary,#192334)]"
                    />
                  )}
                />
                {label}
              </label>
            ))}
          </div>
          {deniedLicense && (
            <Field label="Explanation">
              <textarea
                {...register(`${p}.forfeitures.deniedLicenseExplanation`)}
                rows={3}
                className={inputCls()}
                placeholder="Please explain…"
              />
            </Field>
          )}
        </div>

        {/* 6b */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            b. Has any license, permit, or privilege ever been revoked or suspended? *
          </p>
          <div className="flex gap-6">
            {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(({ label, value }) => (
              <label key={label} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <Controller
                  control={control}
                  name={`${p}.forfeitures.revokedSuspended`}
                  render={({ field }) => (
                    <input
                      type="radio"
                      checked={field.value === value}
                      onChange={() => field.onChange(value)}
                      className="h-[18px] w-[18px] accent-[var(--brand-primary,#192334)]"
                    />
                  )}
                />
                {label}
              </label>
            ))}
          </div>
          {revokedSuspended && (
            <Field label="Explanation">
              <textarea
                {...register(`${p}.forfeitures.revokedSuspendedExplanation`)}
                rows={3}
                className={inputCls()}
                placeholder="Please explain…"
              />
            </Field>
          )}
        </div>
      </Section>

      {/* ── Section 7: Employment Record ── */}
      <Section title="7. Employment Record Previous 10 Years" sectionNumber={7}>
        <p className="text-xs text-muted-foreground italic">
          Any gaps in employment in excess of one (1) month must be explained. Start with the last or current position, including any military experience, and work backwards.
        </p>

        {employerFields.map((field, idx) => (
          <div key={field.id} className="relative space-y-4 rounded-lg border border-gray-100 bg-gray-50/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ItemBadge index={idx} />
                <h4 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Employer {idx + 1}
                </h4>
              </div>
              {employerFields.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEmployer(idx)}
                  className="flex items-center gap-1 text-[11px] font-medium text-red-400 hover:text-red-600 transition-colors"
                  aria-label={`Remove employer ${idx + 1}`}
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Employer Name" required>
                <input {...register(`${p}.employers.${idx}.employerName`)} className={inputCls()} />
              </Field>
              <Field label="Phone">
                <input {...register(`${p}.employers.${idx}.phone`)} type="tel" className={inputCls()} />
              </Field>
              <Field label="Fax">
                <input {...register(`${p}.employers.${idx}.fax`)} type="tel" className={inputCls()} />
              </Field>
              <Field label="Email">
                <input {...register(`${p}.employers.${idx}.email`)} type="email" className={inputCls()} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address" required>
                  <input {...register(`${p}.employers.${idx}.address`)} className={inputCls()} />
                </Field>
              </div>
              <Field label="City" required>
                <input {...register(`${p}.employers.${idx}.city`)} className={inputCls()} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="State" required>
                  <select {...register(`${p}.employers.${idx}.state`)} className={selectCls()}>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Zip" required>
                  <input {...register(`${p}.employers.${idx}.zip`)} className={inputCls()} />
                </Field>
              </div>
              <Field label="Position Held" required>
                <input {...register(`${p}.employers.${idx}.position`)} className={inputCls()} />
              </Field>
              <Field label="Equipment Class">
                <input {...register(`${p}.employers.${idx}.equipmentClass`)} className={inputCls()} />
              </Field>
              <Field label="Date From" required>
                <input {...register(`${p}.employers.${idx}.dateFrom`)} type="date" className={inputCls()} />
              </Field>
              <Field label="Date To">
                <input {...register(`${p}.employers.${idx}.dateTo`)} type="date" className={inputCls()} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Reason for Leaving">
                  <input {...register(`${p}.employers.${idx}.reasonForLeaving`)} className={inputCls()} />
                </Field>
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
                <input
                  {...register(`${p}.employers.${idx}.subjectToFmcsr`)}
                  type="checkbox"
                  className="h-[18px] w-[18px] rounded accent-[var(--brand-primary,#192334)]"
                />
                Subject to FMCSRs while employed?
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
                <input
                  {...register(`${p}.employers.${idx}.safetySensitive`)}
                  type="checkbox"
                  className="h-[18px] w-[18px] rounded accent-[var(--brand-primary,#192334)]"
                />
                Safety-sensitive DOT regulated position (49 CFR Part 40)?
              </label>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => appendEmployer({
            employerName: '', phone: '', fax: '', email: '', address: '', city: '',
            state: 'AL', zip: '', position: '', dateFrom: '', dateTo: '', reasonForLeaving: '',
            equipmentClass: '', subjectToFmcsr: false, safetySensitive: false,
          })}
          className="flex items-center gap-1.5 rounded-full border border-[var(--brand-primary,#192334)] px-3 py-1.5 text-xs font-medium text-[var(--brand-primary,#192334)] hover:bg-[var(--brand-primary,#192334)] hover:text-white transition-colors"
        >
          <Plus className="h-3 w-3" /> Add Employer
        </button>

        <Field label="Explain any gaps in employment exceeding more than 1 month">
          <textarea
            {...register(`${p}.employmentGapExplanation`)}
            rows={3}
            className={inputCls()}
            placeholder="Describe any employment gaps…"
          />
        </Field>
      </Section>

      {/* ── Consent Block ── */}
      <div className="mt-2 rounded-xl border border-gray-100 bg-white shadow-[0_1px_2px_rgba(50,50,93,0.06)] p-6">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          To Be Read and Signed by Applicant
        </h3>
        <div className="mb-6 rounded-lg border/50 p-4 text-xs leading-relaxed text-gray-700 whitespace-pre-line max-h-48 overflow-y-auto">
          {APPLICATION_CERTIFICATION_TEXT}
        </div>
        <SignatureBox
          consentType="application_certification"
          onChange={(name) => handleCertSignatureChange(name)}
          isSigned={isCertSigned}
          error={certSigError}
        />
        {!isCertSigned && certTypedName && (
          <button
            type="button"
            onClick={() => void handleCertSign(certTypedName)}
            className="mt-3 rounded-lg bg-[var(--brand-primary,#192334)] px-5 py-2 text-sm font-semibold text-white hover:brightness-110 transition-[filter,colors] focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#192334)] focus-visible:ring-offset-1 focus-visible:outline-none"
          >
            Confirm Signature
          </button>
        )}
      </div>
    </div>
  )
}
