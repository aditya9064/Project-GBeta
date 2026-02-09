import { DocumentTemplateDef, IntakeAnswers } from '../types';

function gen(a: IntakeAnswers, id: string, fallback: string): string {
  return a[id] || fallback;
}

const questions = [
  { id: 'q1', question: 'Named Insured', type: 'text' as const, required: true, placeholder: 'e.g. Acme Corp.' },
  { id: 'q2', question: 'Insurance Company', type: 'text' as const, required: true, placeholder: 'e.g. Hartford Insurance' },
  { id: 'q3', question: 'Policy Number', type: 'text' as const, required: true, placeholder: 'e.g. GL-2026-45821' },
  { id: 'q4', question: 'General Liability Limit', type: 'text' as const, required: true, placeholder: 'e.g. $2,000,000' },
  { id: 'q5', question: 'Auto Liability Limit', type: 'text' as const, required: true, placeholder: 'e.g. $1,000,000' },
  { id: 'q6', question: 'Workers Comp Limit', type: 'text' as const, required: true, placeholder: 'e.g. $500,000' },
  { id: 'q7', question: 'Umbrella / Excess Limit', type: 'text' as const, required: true, placeholder: 'e.g. $5,000,000' },
  { id: 'q8', question: 'Additional Insured Name', type: 'text' as const, required: false, placeholder: 'e.g. Property Owner LLC' },
  { id: 'q9', question: 'Certificate Holder', type: 'text' as const, required: true, placeholder: 'e.g. Landlord Corp.' },
  { id: 'q10', question: 'Agent / Broker Name', type: 'text' as const, required: true, placeholder: 'e.g. Marsh & McLennan Agency' },
  { id: 'q11', question: 'Agent Phone & Email', type: 'text' as const, required: true, placeholder: 'e.g. (555) 234-5678 | agent@agency.com' },
  { id: 'q12', question: 'Insured Address', type: 'text' as const, required: true, placeholder: 'e.g. 100 Commerce Blvd, Suite 300, Austin, TX 78701' },
  { id: 'q13', question: 'Policy Period Start', type: 'text' as const, required: true, placeholder: 'e.g. January 1, 2026', defaultValue: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
  { id: 'q14', question: 'Policy Period End', type: 'text' as const, required: true, placeholder: 'e.g. January 1, 2027', defaultValue: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
  { id: 'q15', question: 'Certificate Holder Address', type: 'text' as const, required: true, placeholder: 'e.g. 200 Main Street, San Francisco, CA 94105' },
  { id: 'q16', question: 'Authorized Representative Name', type: 'text' as const, required: true, placeholder: 'e.g. James Mitchell', helpText: 'Person signing the certificate' },
];

const sectionSchemas = [
  {
    id: 'coi-1', title: 'CERTIFICATE OF LIABILITY INSURANCE', level: 1, pageEstimate: 2,
    contentGenerator: (a: IntakeAnswers) => {
      const insured = gen(a, 'q1', 'Named Insured');
      const insurer = gen(a, 'q2', 'Insurance Company');
      const policyNum = gen(a, 'q3', 'GL-2026-00001');
      const glLimit = gen(a, 'q4', '$2,000,000');
      const autoLimit = gen(a, 'q5', '$1,000,000');
      const wcLimit = gen(a, 'q6', '$500,000');
      const umbrellaLimit = gen(a, 'q7', '$5,000,000');
      const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      return `CERTIFICATE OF LIABILITY INSURANCE
DATE: ${date}

THIS CERTIFICATE IS ISSUED AS A MATTER OF INFORMATION ONLY AND CONFERS NO RIGHTS UPON THE CERTIFICATE HOLDER. THIS CERTIFICATE DOES NOT AFFIRMATIVELY OR NEGATIVELY AMEND, EXTEND, OR ALTER THE COVERAGE AFFORDED BY THE POLICIES BELOW.

PRODUCER:
${gen(a, 'q10', 'Insurance Agent/Broker')}
${gen(a, 'q11', 'Phone | Email')}

INSURED:
${insured}
${gen(a, 'q12', 'Insured Address')}

INSURER(S) AFFORDING COVERAGE:
Insurer A: ${insurer}

═══════════════════════════════════════════════════════════

COVERAGES:

A. COMMERCIAL GENERAL LIABILITY
   Policy Number: ${policyNum}
   Policy Period: ${gen(a, 'q13', date)} to ${gen(a, 'q14', date)}
   
   Each Occurrence:                          ${glLimit}
   Damage to Rented Premises:               $300,000
   Medical Expense (Any one person):         $10,000
   Personal & Advertising Injury:            ${glLimit}
   General Aggregate:                        $4,000,000
   Products-Completed Operations Aggregate:  $4,000,000
   
   ☒ Occurrence    ☐ Claims-Made

B. AUTOMOBILE LIABILITY
   Policy Number: ${policyNum}-AUTO
   Policy Period: ${gen(a, 'q13', date)} to ${gen(a, 'q14', date)}
   
   Combined Single Limit:                   ${autoLimit}
   Bodily Injury (Per person):              $500,000
   Bodily Injury (Per accident):            $1,000,000
   Property Damage:                          $500,000
   
   ☒ Any Auto    ☐ Owned Autos    ☐ Hired Autos    ☐ Non-Owned Autos

C. WORKERS COMPENSATION AND EMPLOYERS' LIABILITY
   Policy Number: ${policyNum}-WC
   Policy Period: ${gen(a, 'q13', date)} to ${gen(a, 'q14', date)}
   
   Workers Compensation:                     Statutory Limits
   E.L. Each Accident:                      ${wcLimit}
   E.L. Disease — Each Employee:            ${wcLimit}
   E.L. Disease — Policy Limit:             ${wcLimit}

D. UMBRELLA / EXCESS LIABILITY
   Policy Number: ${policyNum}-UMB
   Policy Period: ${gen(a, 'q13', date)} to ${gen(a, 'q14', date)}
   
   Each Occurrence:                          ${umbrellaLimit}
   Aggregate:                                ${umbrellaLimit}
   
   ☒ Occurrence    ☐ Claims-Made`;
    },
  },
  {
    id: 'coi-2', title: 'ADDITIONAL INSURED AND ENDORSEMENTS', level: 1, pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const additionalInsured = gen(a, 'q8', '');
      const insured = gen(a, 'q1', 'Named Insured');
      let aiSection = 'No additional insured endorsement requested.';
      if (additionalInsured) {
        aiSection = `ADDITIONAL INSURED:

${additionalInsured} is included as an additional insured under the Commercial General Liability policy with respect to liability arising out of operations performed by ${insured}.

ENDORSEMENTS:
- CG 20 10 — Additional Insured — Owners, Lessees or Contractors
- CG 20 37 — Additional Insured — Owners, Lessees or Contractors (Completed Operations)
- Waiver of Subrogation in favor of ${additionalInsured}
- Primary and Non-Contributory endorsement`;
      }
      return `DESCRIPTION OF OPERATIONS / LOCATIONS / VEHICLES:

${insured} — General commercial operations.

${aiSection}

SPECIAL CONDITIONS:
- 30 days' notice of cancellation required
- Waiver of subrogation applies where required by contract
- Certificate holder is listed below`;
    },
  },
  {
    id: 'coi-3', title: 'CERTIFICATE HOLDER', level: 1, pageEstimate: 0.5,
    contentGenerator: (a: IntakeAnswers) => {
      const holder = gen(a, 'q9', 'Certificate Holder');
      return `CERTIFICATE HOLDER:

${holder}
${gen(a, 'q15', 'Certificate Holder Address')}

CANCELLATION:
SHOULD ANY OF THE ABOVE DESCRIBED POLICIES BE CANCELLED BEFORE THE EXPIRATION DATE THEREOF, NOTICE WILL BE DELIVERED IN ACCORDANCE WITH THE POLICY PROVISIONS.

AUTHORIZED REPRESENTATIVE:

________________________________
${gen(a, 'q16', 'Authorized Representative')}
Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    },
  },
  {
    id: 'coi-4', title: 'IMPORTANT NOTICES', level: 1, pageEstimate: 0.5,
    contentGenerator: () => {
      return `IMPORTANT NOTICES

1. This certificate of insurance does not constitute a contract between the issuing insurer(s), authorized representative, or producer, and the certificate holder.

2. If the certificate holder is an ADDITIONAL INSURED, the policy(ies) must be endorsed. A statement on this certificate does not confer rights to the certificate holder in lieu of such endorsement(s).

3. If SUBROGATION IS WAIVED, subject to the terms and conditions of the policy, certain policies may require an endorsement. A statement on this certificate does not confer rights to the certificate holder in lieu of such endorsement(s).

4. The insurance afforded by the policies described herein is subject to all the terms, exclusions, and conditions of such policies. Limits shown may have been reduced by paid claims.`;
    },
  },
];

export const insuranceCOITemplate: DocumentTemplateDef = {
  id: 'dt4',
  name: 'Insurance Certificate (COI)',
  category: 'Compliance',
  description: 'Certificate of insurance with coverage schedules, additional insureds, and endorsement pages',
  pages: '4–6',
  sections: sectionSchemas.length,
  avgGenerationTime: '0.8 min',
  questions,
  schema: sectionSchemas,
};

