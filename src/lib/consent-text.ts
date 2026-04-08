/**
 * Canonical consent text for the driver application wizard.
 *
 * SEC-011 invariant: The client MUST NOT supply signed_text — it is legally-binding
 * content and must be entirely server-controlled. The server action reads these
 * constants via getCanonicalConsentText() and ignores any client-supplied text.
 *
 * Safe to import from both server and client components: this module contains
 * only plain template strings with no server-only APIs, process.env access,
 * or external imports.
 *
 * Text is verbatim regulatory language.
 * Do NOT paraphrase, abbreviate, or alter — regulatory compliance depends on exactness.
 */

// ---------------------------------------------------------------------------
// Page 1 — Application Certification (§ 391.21(b)(12) + § 391.23 authorization)
// ---------------------------------------------------------------------------

export const APPLICATION_CERTIFICATION_TEXT = `TO BE READ AND SIGNED BY APPLICANT

This certifies that this application was completed by me, and that all entries on it and information in it are true and complete to the best of my knowledge.

I authorize you to make such investigations and inquiries of my personal, employment, financial or medical history and other related matters as may be necessary in arriving at an employment decision. (Generally, inquiries regarding medical history will be made only if and after a conditional offer of employment has been extended.) I hereby release employers, schools, health care providers and other persons from all liability in responding to inquiries and releasing information in connection with my application.

In the event of employment, I understand that false or misleading information given in my application or interview(s) may result in discharge. I understand, also, that I am required to abide by all rules and regulations of the Company.

I understand that information I provide regarding current and/or previous employers may be used, and those employer(s) will be contacted, for the purpose of investigating my safety performance history as required by 49 CFR 391.23(d) and (e). I understand that I have the right to:
  1. Review information provided by current/previous employers;
  2. Have errors in the information corrected by previous employers and for those corrections to be sent to the prospective employer; and
  3. Have a rebuttal statement attached to the alleged erroneous information, if the previous employer(s) and I cannot agree on the accuracy of the information.`

// ---------------------------------------------------------------------------
// Page 2 — Fair Credit Reporting Act (FCRA) Disclosure Statement
// ---------------------------------------------------------------------------

export const FCRA_DISCLOSURE_TEXT = `FAIR CREDIT REPORTING ACT DISCLOSURE STATEMENT

DISCLOSURE REGARDING BACKGROUND INVESTIGATION

Pursuant to Section 604(b)(2)(A) of the Fair Credit Reporting Act, Public Law 91-508, as amended by the Consumer Credit Protection Act (15 U.S.C. § 1681b), you are being informed that a consumer report and/or an investigative consumer report may be obtained for employment purposes as part of the pre-employment background investigation and at any time during your employment.

The nature and scope of the investigation requested is as follows: The report may contain information regarding your credit worthiness, credit standing, credit capacity, character, general reputation, personal characteristics and mode of living as well as information about your Motor Vehicle Record. The investigation may also include information regarding your criminal background. Information about prior drug and alcohol testing results may be included, pursuant to 49 CFR 40.25(j).

As required by the Fair Credit Reporting Act (FCRA), we are providing you this disclosure before obtaining any such consumer report. The report will be obtained for employment purposes only.

Your signature below constitutes your acknowledgement that you received this disclosure.

PURSUANT TO 15 USC 1681(g), YOU HAVE THE RIGHT UPON WRITTEN REQUEST TO KNOW WHETHER A CONSUMER REPORT WAS REQUESTED AND, IF SO, THE NAME, ADDRESS, AND TELEPHONE NUMBER OF THE CONSUMER REPORTING AGENCY FURNISHING THE REPORT AND THE DATE THE REPORT WAS REQUESTED. THE REPORT WILL BE USED FOR EMPLOYMENT PURPOSES, INCLUDING HIRING, ASSIGNMENT, PROMOTION, REASSIGNMENT, DISCIPLINARY ACTION, OR RETENTION AS AN EMPLOYEE.`

// ---------------------------------------------------------------------------
// Page 3 — Certification of Compliance with Driver License Requirements
// ---------------------------------------------------------------------------

export const DRIVER_LICENSE_REQUIREMENTS_TEXT = `CERTIFICATION OF COMPLIANCE WITH DRIVER LICENSE REQUIREMENTS

I certify that I have read and that I understand the regulations at 49 CFR Parts 383 and 391 relating to:

1. Prohibition Against Operating with Multiple Commercial Drivers' Licenses: I understand that federal regulations prohibit a driver from having more than one commercial driver's license. I understand it is unlawful for me to have more than one driver's license and that I am required to notify the state licensing agency of my principal place of business of any traffic violations (other than parking violations) in another state in my own name or in any other name, within 30 days of the violation.

2. Notification Requirements: I understand that federal regulations require me to notify my employer within 30 days of conviction for any violations of state or local traffic laws (other than parking violations) that I committed while driving a commercial motor vehicle or my own vehicle if it results in a revocation, suspension, or cancellation of my commercial drivers' license.

3. Notification of License Suspension/Revocation/Cancellation: I understand that I must notify my employer before the end of the business day after I receive a notice that my commercial driver's license is suspended, revoked, or cancelled, or I lose the privilege to operate a commercial motor vehicle for any period.

4. One License Rule: I certify that I am not currently licensed to operate a motor vehicle in more than one jurisdiction and that I will not seek or maintain a license to operate a motor vehicle in more than one jurisdiction while employed by this carrier.

I hereby certify that the information I provided on this form is complete and accurate.`

// ---------------------------------------------------------------------------
// Page 4 — Pre-Employment Drug & Alcohol Test Statement (49 CFR Part 40.25(j))
// ---------------------------------------------------------------------------

export const DRUG_ALCOHOL_TESTING_TEXT = `PRE-EMPLOYMENT EMPLOYEE ALCOHOL AND DRUG TEST STATEMENT
(As required by 49 CFR Part 40.25(j))

This carrier is required by Federal law (49 CFR Part 40.25) to provide the following information to all applicants for safety-sensitive positions. Please answer the following questions honestly and completely.

CONSENT TO DRUG AND ALCOHOL TESTING

I understand that as a condition of employment and continued employment, I am required to submit to alcohol and drug testing in accordance with 49 CFR Parts 40, 382, and 391. I understand that testing may occur:

• Pre-Employment: Prior to performing any safety-sensitive function for the first time
• Random: At any time during the course of employment, on an unannounced basis
• Reasonable Suspicion: When a trained supervisor believes you have used alcohol or controlled substances on the basis of specific, contemporaneous, articulable observations concerning the appearance, behavior, speech, or body odors of the driver
• Post-Accident: Following accidents as defined in 49 CFR Part 382.303

I understand that refusal to test is treated as a positive test result. I understand that a positive test or refusal to test will result in immediate removal from safety-sensitive duties.

By signing below, I consent to submit to alcohol and drug testing as described above, and I certify that all information I provided in answering the questions above is true and complete.`

// ---------------------------------------------------------------------------
// Page 5 — Safety Performance History Investigation (§ 391.23 + § 40.25)
// Interpolates applicant name + SSN last 4
// ---------------------------------------------------------------------------

export function getSafetyPerformanceHistoryText({
  firstName,
  lastName,
  ssnLast4,
  tenantName,
}: {
  firstName: string
  lastName: string
  ssnLast4: string
  tenantName: string
}): string {
  return `SAFETY PERFORMANCE HISTORY INVESTIGATION AUTHORIZATION

FCRA INVESTIGATIVE CONSUMER REPORT AUTHORIZATION

I, ${firstName} ${lastName}, social security xxx-xx-${ssnLast4}, hereby authorize ${tenantName} to conduct a comprehensive background investigation including, but not limited to: Social Security Number verification; current and previous residences; employment history and personnel files; education background; references; credit history; criminal history (federal, state, and county); birth records; motor vehicle records and traffic citations; and any other public records.

I understand that this report may be prepared by a consumer reporting agency and will comply with the Fair Credit Reporting Act (FCRA). I understand I have the right to know if a report is obtained, and to request a copy of the report from the consumer reporting agency if adverse action is taken.

DRIVER REVIEW RIGHTS (49 CFR § 391.23(c))

I understand I have the right to:
  1. Review information provided by previous employers;
  2. Request corrections from the previous employer if I believe the information is inaccurate or incomplete;
  3. Attach a rebuttal statement to disputed information if my previous employer and I cannot agree on the accuracy of the information;
  4. Submit a written request to review such information within 30 days after being hired or being denied employment;
  5. The carrier may consider it a waiver of this right if records are not requested within 30 days after hire.

SAFETY PERFORMANCE HISTORY & DOT DRUG/ALCOHOL RELEASE

I, ${firstName} ${lastName}, social security xxx-xx-${ssnLast4}, hereby authorize my previous DOT-regulated employers to release the following safety performance history information to ${tenantName} in accordance with 49 CFR §§ 391.23, 40.25, 382.405(f), and 382.413(b):

  1. Alcohol tests with a result of 0.04 or higher
  2. Verified positive controlled substance tests
  3. Refusals to be tested (including verified adulterated or substituted drug test results)
  4. Other violations of DOT agency drug and alcohol testing regulations
  5. Information obtained from previous employers of a drug and alcohol rule violation
  6. Documentation, if any, of completion of the return-to-duty process following a rule violation, including results of any follow-up tests and the date of the last follow-up test

This authorization shall be effective for the period of time necessary to conduct the investigation and for use in the employment decision. I release ${tenantName} and any previous employer or its representatives, agents, and employees from any and all claims, demands, or liabilities arising out of or in connection with this investigation.`
}

// ---------------------------------------------------------------------------
// Page 6 — PSP Driver Disclosure & Authorization
// ---------------------------------------------------------------------------

export function getPspAuthorizationText({ tenantName }: { tenantName: string }): string {
  return `FMCSA PRE-EMPLOYMENT SCREENING PROGRAM (PSP)
DRIVER DISCLOSURE AND AUTHORIZATION STATEMENT

The Federal Motor Carrier Safety Administration (FMCSA) Pre-Employment Screening Program (PSP) provides motor carriers and individual drivers with electronic access to their safety performance information from FMCSA's Motor Carrier Management Information System (MCMIS). The PSP provides information reported in MCMIS that includes accidents, inspection violations and driver out-of-service orders for the prior 5 years, and driver roadside inspections for the prior 3 years.

IMPORTANT NOTICE TO DRIVER-APPLICANT:

In connection with your application for employment with ${tenantName} (hereinafter referred to as "Prospective Motor Carrier Employer" or PMCE), the PMCE may obtain information about you from FMCSA's Pre-Employment Screening Program (PSP). This PSP report provides access to your accident and roadside inspection history reports.

I authorize ${tenantName} to request my PSP report from FMCSA pursuant to 49 U.S.C. § 31150.

I understand the following:
  • The PSP report may be used as a factor in the hiring decision.
  • I have the right to review my PSP report for accuracy.
  • I may access my own PSP report at any time via the FMCSA Portal at https://dataqs.fmcsa.dot.gov.
  • If the PMCE takes adverse action based in whole or in part on the information in my PSP report, I will be notified of such action and given a summary of my rights under 49 USC 31150(d).
  • The information in the PSP report will not be used in violation of applicable federal or state equal employment opportunity laws or regulations.

I authorize ${tenantName} to obtain this information and use it in connection with my employment application.`
}

// ---------------------------------------------------------------------------
// Page 7 — General Consent for Limited Queries of FMCSA Drug & Alcohol Clearinghouse
// ---------------------------------------------------------------------------

export function getClearinghouseLimitedQueryText({ tenantName }: { tenantName: string }): string {
  return `GENERAL CONSENT FOR LIMITED QUERIES OF THE
FMCSA DRUG AND ALCOHOL CLEARINGHOUSE

Pursuant to 49 CFR Part 382.701(b), this consent is for LIMITED QUERIES of the FMCSA Drug and Alcohol Clearinghouse during the period of your employment with ${tenantName}.

IMPORTANT NOTICE REGARDING THE FMCSA CLEARINGHOUSE:

The Federal Motor Carrier Safety Administration (FMCSA) Drug and Alcohol Clearinghouse is a secure online database that gives FMCSA, employers, state driver licensing agencies, and law enforcement personnel real-time information about commercial driver's license (CDL) and commercial learner's permit (CLP) holders' drug and alcohol program violations.

Under 49 CFR § 382.701, ${tenantName} is required to:
  1. Query the Clearinghouse as part of the pre-employment investigation process (FULL query);
  2. Query the Clearinghouse at least once per year for each driver employed (LIMITED query).

This consent covers the ANNUAL LIMITED QUERIES that will occur during your period of employment with ${tenantName}. The pre-employment FULL query requires your separate consent through the FMCSA Clearinghouse portal.

By signing below, you provide general consent for ${tenantName} to conduct limited queries of the FMCSA Drug and Alcohol Clearinghouse to determine whether information about you exists in the Clearinghouse during the duration of your employment with ${tenantName}. You understand that:
  • ${tenantName} must query the Clearinghouse at least once per year while you are employed.
  • Limited queries will only reveal whether information about you exists in the Clearinghouse.
  • If a limited query reveals information, ${tenantName} must obtain your specific consent for a full query.
  • This consent does not expire; it covers all limited queries conducted during your employment.`
}

// ---------------------------------------------------------------------------
// Page 8 — Motor Vehicle Record (MVR) Release Consent
// ---------------------------------------------------------------------------

export function getMvrReleaseText({ tenantName }: { tenantName: string }): string {
  return `MOTOR VEHICLE RECORD (MVR) RELEASE CONSENT

18 U.S.C. § 2721 — FEDERAL DRIVERS PRIVACY PROTECTION ACT

Pursuant to the Federal Drivers Privacy Protection Act (18 U.S.C. § 2721 et seq.) and applicable state motor vehicle record privacy laws, your written consent is required before your motor vehicle driving record can be obtained.

I hereby authorize ${tenantName} and/or its designated agents and representatives to obtain my motor vehicle driving record(s) from any and all applicable state(s) Department(s) of Motor Vehicles or equivalent state agency for the purposes of:
  1. Pre-employment screening and background investigation;
  2. Annual motor vehicle record review as required by 49 CFR § 391.25; and
  3. Any other review required by law or company policy during my period of employment.

I understand that ${tenantName} will review the information in my motor vehicle record(s) as part of the hiring process and may review such records on an annual basis and/or as necessary during my employment. I authorize the release of such records for a period of three (3) years from the date of signature or until I am no longer employed by ${tenantName}, whichever occurs last.

I acknowledge that this consent is required under 49 CFR § 391.23(a)(1) as part of the investigation of my driving record conducted by motor vehicle record inquiries to the applicable state agency for every state in which I have held a motor vehicle operator's license or permit during the preceding 3 years.

I release ${tenantName} and any state motor vehicle agency from any liability in connection with the furnishing of this information.`
}

// ---------------------------------------------------------------------------
// Dispatcher — getCanonicalConsentText
// ---------------------------------------------------------------------------

/**
 * Returns the canonical consent text for a given consentType.
 *
 * Returns null if:
 *   - consentType is unrecognised
 *   - required interpolation params are missing (e.g. page 5 needs ssnLast4)
 *
 * Server actions MUST treat null as a hard error and abort the sign action.
 * The server action ignores any client-supplied text and re-derives it here.
 */
export function getCanonicalConsentText(
  consentType: string,
  ctx: {
    tenantName: string
    firstName?: string | null
    lastName?: string | null
    ssnLast4?: string | null
  }
): string | null {
  switch (consentType) {
    case 'application_certification':
      return APPLICATION_CERTIFICATION_TEXT

    case 'fcra_disclosure':
      return FCRA_DISCLOSURE_TEXT

    case 'driver_license_requirements_certification':
      return DRIVER_LICENSE_REQUIREMENTS_TEXT

    case 'drug_alcohol_testing_consent':
      return DRUG_ALCOHOL_TESTING_TEXT

    case 'safety_performance_history_investigation':
      if (!ctx.firstName || !ctx.lastName || !ctx.ssnLast4) return null
      return getSafetyPerformanceHistoryText({
        firstName: ctx.firstName,
        lastName: ctx.lastName,
        ssnLast4: ctx.ssnLast4,
        tenantName: ctx.tenantName,
      })

    case 'psp_authorization':
      return getPspAuthorizationText({ tenantName: ctx.tenantName })

    case 'clearinghouse_limited_query':
      return getClearinghouseLimitedQueryText({ tenantName: ctx.tenantName })

    case 'mvr_release':
      return getMvrReleaseText({ tenantName: ctx.tenantName })

    default:
      return null
  }
}
