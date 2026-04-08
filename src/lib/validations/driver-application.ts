/**
 * Zod validation schemas for the driver application wizard.
 *
 * One schema per wizard page (page1Schema – page8Schema) for incremental
 * per-step validation, plus a composite fullApplicationSchema for final
 * submission. Sub-schemas are exported individually so the wizard can
 * safeParse on each page transition.
 *
 * Follows .claude/rules/code-style.md:
 *   - z.coerce.number() for numeric fields
 *   - .optional().or(z.literal('')) for optional strings
 *   - named exports only
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
] as [string, ...string[]]

const optionalString = z.string().optional().or(z.literal(''))

// ---------------------------------------------------------------------------
// Sub-schemas referenced across multiple page schemas
// ---------------------------------------------------------------------------

export const applicantInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  // SSN stored as xxx-xx-xxxx; actual encryption happens server-side
  ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/, 'SSN must be in format xxx-xx-xxxx'),
  phone: z.string().min(7, 'Phone number is required'),
  email: z.string().email('Valid email is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.enum(US_STATES, { error: 'Valid US state is required' }),
  // eslint-disable-next-line security/detect-unsafe-regex
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Valid ZIP code required'),
  lived3Years: z.boolean(),
})

export const addressHistoryEntrySchema = z.object({
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  state: z.enum(US_STATES, { error: 'Valid US state is required' }),
  // eslint-disable-next-line security/detect-unsafe-regex
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Valid ZIP code required'),
  fromDate: z.string().min(1, 'From date is required'),
  toDate: optionalString.nullable().optional(),
  position: z.coerce.number().int().nonnegative(),
})

export const driverLicenseSchema = z.object({
  licenseNumber: z.string().min(1, 'License number is required'),
  state: z.enum(US_STATES, { error: 'Valid US state is required' }),
  class: z.enum(['A', 'B', 'C'], { error: 'License class must be A, B, or C' }),
  expires: z.string().min(1, 'Expiration date is required'),
  endorsements: z
    .array(z.enum(['H', 'N', 'P', 'T', 'S', 'X']))
    .default([]),
  // Storage paths for uploaded files — set after client-side upload
  frontFilePath: optionalString,
  backFilePath: optionalString,
})

// Additional licenses held in the past 3 years (repeater rows)
const additionalLicenseSchema = z.object({
  licenseNumber: z.string().min(1, 'License number is required'),
  state: z.enum(US_STATES, { error: 'Valid US state is required' }),
  class: z.enum(['A', 'B', 'C']),
  expires: z.string().min(1),
})

export const medicalCardSchema = z.object({
  filePath: optionalString,
  expirationDate: z.string().min(1, 'Medical certificate expiration date is required'),
})

export const accidentsSchema = z.object({
  hasAccidents: z.boolean(),
  accidents: z
    .array(
      z.object({
        date: z.string().min(1, 'Date is required'),
        nature: z.string().min(1, 'Nature of accident is required'),
        fatalities: z.coerce.number().int().nonnegative(),
        injuries: z.coerce.number().int().nonnegative(),
        location: z.string().min(1, 'Location is required'),
      })
    )
    .default([]),
})

export const violationsSchema = z.object({
  hasViolations: z.boolean(),
  violations: z
    .array(
      z.object({
        date: z.string().min(1, 'Date is required'),
        charge: z.string().min(1, 'Charge is required'),
        disposition: z.string().min(1, 'Disposition is required'),
      })
    )
    .default([]),
})

export const forfeituresSchema = z.object({
  // Section 6a — § 391.21(b)(6)
  deniedLicense: z.boolean(),
  deniedLicenseExplanation: optionalString,
  // Section 6b
  revokedSuspended: z.boolean(),
  revokedSuspendedExplanation: optionalString,
})

export const employerBlockSchema = z.object({
  employerName: z.string().min(1, 'Employer name is required'),
  phone: optionalString,
  fax: optionalString,
  email: optionalString,
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.enum(US_STATES, { error: 'Valid US state is required' }),
  // eslint-disable-next-line security/detect-unsafe-regex
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Valid ZIP code required'),
  position: z.string().min(1, 'Position held is required'),
  dateFrom: z.string().min(1, 'Start date is required'),
  dateTo: optionalString,
  reasonForLeaving: optionalString,
  equipmentClass: optionalString,
  subjectToFmcsr: z.boolean().default(false),
  safetySensitive: z.boolean().default(false),
})

export const drugAlcoholQuestionsSchema = z.object({
  // Page 4 — 49 CFR Part 40.25(j) three questions + conditional
  positiveDrugTest: z.boolean(),
  alcoholConcentration04: z.boolean(),
  refusedTest: z.boolean(),
  // Conditional — only relevant if any of the above is true
  returnToDutyDocs: z.boolean().nullable().optional(),
})

export const signConsentSchema = z.object({
  consentType: z.enum([
    'application_certification',
    'fcra_disclosure',
    'driver_license_requirements_certification',
    'drug_alcohol_testing_consent',
    'safety_performance_history_investigation',
    'psp_authorization',
    'clearinghouse_limited_query',
    'mvr_release',
  ]),
  typedName: z.string().min(2, 'Please type your full name to sign'),
  // SEC-011: signedText is NO LONGER accepted from the client.
  // The server computes the canonical text from consent-text-server.ts.
  // Keeping this comment so the frontend knows to drop the field.
})

export const applicantDocumentTypeSchema = z.enum([
  'license_front',
  'license_back',
  'medical_card',
  'other',
])

export const applicationDocumentSchema = z.object({
  documentType: applicantDocumentTypeSchema,
  fileName: z.string().min(1),
  storagePath: z.string().min(1),
  fileSize: z.coerce.number().int().positive().optional(),
  mimeType: optionalString,
})

// ---------------------------------------------------------------------------
// Per-wizard-page schemas (Page 1 – Page 8)
// ---------------------------------------------------------------------------

/**
 * Page 1 — Main Application
 * Sections 1–7: applicant info, license, medical card, accidents,
 * violations, forfeitures, employment record.
 * Also captures the address history if lived3Years = false.
 */
export const page1Schema = z.object({
  applicantInfo: applicantInfoSchema,
  // Address history rows — required if lived3Years = false
  addressHistory: z.array(addressHistoryEntrySchema).default([]),
  primaryLicense: driverLicenseSchema,
  additionalLicenses: z.array(additionalLicenseSchema).default([]),
  hasAdditionalLicenses: z.boolean().default(false),
  medicalCard: medicalCardSchema,
  accidents: accidentsSchema,
  violations: violationsSchema,
  forfeitures: forfeituresSchema,
  employers: z.array(employerBlockSchema).min(1, 'At least one employer record is required'),
  employmentGapExplanation: optionalString,
})

/** Page 2 — FCRA Disclosure — collect consent only */
export const page2Schema = z.object({
  consent: signConsentSchema.refine(
    (v) => v.consentType === 'fcra_disclosure',
    { message: 'Expected fcra_disclosure consent on page 2' }
  ),
})

/** Page 3 — Driver License Requirements Certification */
export const page3Schema = z.object({
  consent: signConsentSchema.refine(
    (v) => v.consentType === 'driver_license_requirements_certification',
    { message: 'Expected driver_license_requirements_certification consent on page 3' }
  ),
})

/** Page 4 — Drug & Alcohol Pre-Employment Statement */
export const page4Schema = z.object({
  drugAlcoholQuestions: drugAlcoholQuestionsSchema,
  consent: signConsentSchema.refine(
    (v) => v.consentType === 'drug_alcohol_testing_consent',
    { message: 'Expected drug_alcohol_testing_consent on page 4' }
  ),
})

/** Page 5 — Safety Performance History Investigation */
export const page5Schema = z.object({
  consent: signConsentSchema.refine(
    (v) => v.consentType === 'safety_performance_history_investigation',
    { message: 'Expected safety_performance_history_investigation consent on page 5' }
  ),
})

/** Page 6 — PSP Driver Disclosure & Authorization */
export const page6Schema = z.object({
  consent: signConsentSchema.refine(
    (v) => v.consentType === 'psp_authorization',
    { message: 'Expected psp_authorization consent on page 6' }
  ),
})

/** Page 7 — Clearinghouse Limited Query Consent */
export const page7Schema = z.object({
  clearinghouseRegistered: z.boolean().nullable().optional(),
  consent: signConsentSchema.refine(
    (v) => v.consentType === 'clearinghouse_limited_query',
    { message: 'Expected clearinghouse_limited_query consent on page 7' }
  ),
})

/** Page 8 — MVR Release Consent */
export const page8Schema = z.object({
  consent: signConsentSchema.refine(
    (v) => v.consentType === 'mvr_release',
    { message: 'Expected mvr_release consent on page 8' }
  ),
})

// ---------------------------------------------------------------------------
// Composite schema for final submitApplication validation
// ---------------------------------------------------------------------------

export const fullApplicationSchema = z.object({
  page1: page1Schema,
  page2: page2Schema,
  page3: page3Schema,
  page4: page4Schema,
  page5: page5Schema,
  page6: page6Schema,
  page7: page7Schema,
  page8: page8Schema,
})

export type FullApplication = z.infer<typeof fullApplicationSchema>
export type ApplicantInfoInput = z.infer<typeof applicantInfoSchema>
export type DriverLicenseInput = z.infer<typeof driverLicenseSchema>
export type MedicalCardInput = z.infer<typeof medicalCardSchema>
export type AccidentsInput = z.infer<typeof accidentsSchema>
export type ViolationsInput = z.infer<typeof violationsSchema>
export type ForfeituresInput = z.infer<typeof forfeituresSchema>
export type EmployerBlockInput = z.infer<typeof employerBlockSchema>
export type DrugAlcoholQuestionsInput = z.infer<typeof drugAlcoholQuestionsSchema>
export type SignConsentInput = z.infer<typeof signConsentSchema>
export type ApplicationDocumentInput = z.infer<typeof applicationDocumentSchema>
export type ApplicantDocumentTypeInput = z.infer<typeof applicantDocumentTypeSchema>
export type AddressHistoryEntryInput = z.infer<typeof addressHistoryEntrySchema>

// ---------------------------------------------------------------------------
// Phase 2 — Admin-invite model
// ---------------------------------------------------------------------------

export const inviteDriverApplicationSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(200),
  lastName: z.string().min(1, 'Last name is required').max(200),
  email: z.string().email('Please enter a valid email').max(254),
  phone: z.string().min(7, 'Phone number is required').max(30),
})
export type InviteDriverApplicationInput = z.infer<typeof inviteDriverApplicationSchema>
