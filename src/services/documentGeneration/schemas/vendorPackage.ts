import { DocumentTemplateDef, IntakeAnswers } from '../types';

function gen(a: IntakeAnswers, id: string, fallback: string): string {
  return a[id] || fallback;
}

const questions = [
  { id: 'q1', question: 'Vendor Company Name', type: 'text' as const, required: true, placeholder: 'e.g. ABC Services LLC' },
  { id: 'q2', question: 'Vendor Tax ID (EIN)', type: 'text' as const, required: true, placeholder: 'e.g. 12-3456789' },
  { id: 'q3', question: 'Tax Classification', type: 'select' as const, options: ['LLC', 'C Corporation', 'S Corporation', 'Partnership', 'Sole Proprietor', 'Trust/Estate'], required: true },
  { id: 'q4', question: 'Requesting Company', type: 'text' as const, required: true, placeholder: 'e.g. Your Company Inc.' },
  { id: 'q5', question: 'Vendor Contact Name', type: 'text' as const, required: true, placeholder: 'e.g. John Doe' },
  { id: 'q6', question: 'Vendor Address', type: 'text' as const, required: true, placeholder: 'Full address' },
  { id: 'q7', question: 'Vendor Email', type: 'text' as const, required: true, placeholder: 'e.g. vendor@company.com' },
  { id: 'q8', question: 'Vendor Phone', type: 'text' as const, required: true, placeholder: 'e.g. (555) 123-4567' },
  { id: 'q9', question: 'Bank Name (for ACH)', type: 'text' as const, required: true, placeholder: 'e.g. Chase Bank' },
  { id: 'q10', question: 'Payment Method Preference', type: 'select' as const, options: ['ACH / Direct Deposit', 'Check', 'Wire Transfer'], required: true },
  { id: 'q11', question: 'Service Category', type: 'select' as const, options: ['Professional Services', 'IT/Technology', 'Facilities/Maintenance', 'Marketing', 'Legal', 'Other'], required: true },
  { id: 'q12', question: 'Background Check Required', type: 'toggle' as const, options: ['Yes', 'No'], required: true },
  { id: 'q13', question: 'Vendor Contact Title', type: 'text' as const, required: true, placeholder: 'e.g. Director of Operations' },
  { id: 'q14', question: 'Vendor Website', type: 'text' as const, required: false, placeholder: 'e.g. www.vendor.com' },
  { id: 'q15', question: 'Description of Services', type: 'textarea' as const, required: true, placeholder: 'e.g. IT consulting and managed cloud infrastructure services' },
  { id: 'q16', question: 'Year Established', type: 'text' as const, required: true, placeholder: 'e.g. 2015' },
  { id: 'q17', question: 'Number of Employees', type: 'select' as const, options: ['1–10', '11–50', '51–200', '201–1000', '1000+'], required: true },
  { id: 'q18', question: 'City, State, ZIP', type: 'text' as const, required: true, placeholder: 'e.g. Austin, TX 78701' },
  { id: 'q19', question: 'Bank Routing Number (ABA)', type: 'text' as const, required: false, placeholder: 'e.g. 021000021', helpText: 'Required for ACH/Direct Deposit payments' },
  { id: 'q20', question: 'Bank Account Number', type: 'text' as const, required: false, placeholder: 'e.g. 1234567890', helpText: 'Required for ACH/Direct Deposit payments' },
];

const sectionSchemas = [
  {
    id: 'vp-1', title: 'VENDOR INFORMATION FORM', level: 1, pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const vendor = gen(a, 'q1', 'Vendor Company');
      const contact = gen(a, 'q5', 'Contact Name');
      const address = gen(a, 'q6', 'Vendor Address');
      const email = gen(a, 'q7', 'vendor@company.com');
      const phone = gen(a, 'q8', '(555) 123-4567');
      const requesting = gen(a, 'q4', 'Requesting Company');
      const category = gen(a, 'q11', 'Professional Services');
      return `VENDOR ONBOARDING PACKAGE
${requesting.toUpperCase()} — VENDOR REGISTRATION FORM

Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

SECTION 1: VENDOR INFORMATION

Legal Business Name: ${vendor}
Primary Contact: ${contact}
Title: ${gen(a, 'q13', 'Contact Title')}
Address: ${address}
City, State, ZIP: ${gen(a, 'q18', 'City, State ZIP')}
Phone: ${phone}
Email: ${email}
Website: ${gen(a, 'q14', 'N/A')}

Business Type: ${gen(a, 'q3', 'LLC')}
Federal Tax ID (EIN): ${gen(a, 'q2', 'XX-XXXXXXX')}
Year Established: ${gen(a, 'q16', 'N/A')}
Number of Employees: ${gen(a, 'q17', 'N/A')}

Service Category: ${category}
Description of Services: ${gen(a, 'q15', 'Professional services as described in vendor agreement')}

DIVERSITY STATUS (check all that apply):
☐ Minority-Owned Business Enterprise (MBE)
☐ Women-Owned Business Enterprise (WBE)
☐ Small Business Enterprise (SBE)
☐ Veteran-Owned Business
☐ HUBZone Certified
☐ 8(a) Certified
☐ None of the above`;
    },
  },
  {
    id: 'vp-2', title: 'IRS FORM W-9', level: 1, pageEstimate: 2,
    contentGenerator: (a: IntakeAnswers) => {
      const vendor = gen(a, 'q1', 'Vendor Company');
      const ein = gen(a, 'q2', 'XX-XXXXXXX');
      const taxClass = gen(a, 'q3', 'LLC');
      const address = gen(a, 'q6', 'Vendor Address');
      return `FORM W-9 — REQUEST FOR TAXPAYER IDENTIFICATION NUMBER AND CERTIFICATION
(Rev. March 2024) | Department of the Treasury — Internal Revenue Service

Give Form to the requester. Do not send to the IRS.

1. Name (as shown on your income tax return): ${vendor}

2. Business name/disregarded entity name (if different from above): ${vendor}

3. Federal Tax Classification (check one):
${taxClass === 'Sole Proprietor' ? '☒' : '☐'} Individual/sole proprietor or single-member LLC
${taxClass === 'C Corporation' ? '☒' : '☐'} C Corporation
${taxClass === 'S Corporation' ? '☒' : '☐'} S Corporation
${taxClass === 'Partnership' ? '☒' : '☐'} Partnership
${taxClass === 'Trust/Estate' ? '☒' : '☐'} Trust/estate
${taxClass === 'LLC' ? '☒' : '☐'} Limited liability company. Enter the tax classification: ___

4. Exemptions (codes apply only to certain entities):
   Exempt payee code: ___
   Exemption from FATCA reporting code: ___

5. Address: ${address}

6. City, State, and ZIP code: ${gen(a, 'q18', 'City, State ZIP')}

7. Account number(s): ${gen(a, 'q20', 'See banking section')}

PART I: TAXPAYER IDENTIFICATION NUMBER (TIN)
Social Security Number: ___-__-____    OR    Employer Identification Number: ${ein}

PART II: CERTIFICATION

Under penalties of perjury, I certify that:
1. The number shown on this form is my correct taxpayer identification number;
2. I am not subject to backup withholding because: (a) I am exempt, or (b) I have not been notified by the IRS that I am subject to backup withholding, or (c) I have been notified and the IRS has informed me that I am no longer subject;
3. I am a U.S. citizen or other U.S. person; and
4. The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.

Signature: ________________________________    Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    },
  },
  {
    id: 'vp-3', title: 'BANKING AND PAYMENT INFORMATION', level: 1, pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const vendor = gen(a, 'q1', 'Vendor Company');
      const bank = gen(a, 'q9', 'Bank Name');
      const paymentMethod = gen(a, 'q10', 'ACH / Direct Deposit');
      return `SECTION 3: BANKING AND PAYMENT INFORMATION

Preferred Payment Method: ${paymentMethod}

${paymentMethod.includes('ACH') || paymentMethod.includes('Direct') ? `ACH / DIRECT DEPOSIT AUTHORIZATION:

Bank Name: ${bank}
Routing Number (ABA): ${gen(a, 'q19', 'Provided separately')}
Account Number: ${gen(a, 'q20', 'Provided separately')}
Account Type: ☒ Checking    ☐ Savings
Account Name: ${vendor}

I authorize ${gen(a, 'q4', 'Requesting Company')} to initiate electronic payment transactions to the account listed above. This authorization will remain in effect until written cancellation is received.` : `
CHECK / WIRE TRANSFER:

Make payments payable to: ${vendor}
Remittance Address: ${gen(a, 'q6', 'Vendor Address')}
Wire Transfer Instructions (if applicable):
  Bank Name: ${bank}
  Account Number: ${gen(a, 'q20', 'Provided separately')}`}

AUTHORIZED SIGNATORY:

Signature: ________________________________
Print Name: ${gen(a, 'q5', 'Contact Name')}
Title: ${gen(a, 'q13', 'Contact Title')}
Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    },
  },
  {
    id: 'vp-4', title: 'COMPLIANCE ATTESTATIONS', level: 1, pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const vendor = gen(a, 'q1', 'Vendor Company');
      const bgCheck = gen(a, 'q12', 'No');
      let bgSection = '';
      if (bgCheck === 'Yes') {
        bgSection = `\n\nBACKGROUND CHECK AUTHORIZATION:

${vendor} hereby authorizes a background check on the company and its key personnel. This may include criminal history, credit history, and professional reference verification. ${vendor} agrees to cooperate fully with any background check requirements.

Authorized Signatory: ${gen(a, 'q5', 'Contact Name')}
Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
      }
      return `SECTION 4: COMPLIANCE ATTESTATIONS

${vendor} hereby represents, warrants, and certifies that:

☐ The company is not debarred, suspended, or otherwise excluded from federal procurement and non-procurement programs.

☐ The company complies with all applicable federal, state, and local laws, regulations, and ordinances.

☐ The company maintains adequate insurance coverage, including general liability, workers' compensation, and professional liability insurance.

☐ The company does not employ or engage any person who is on the U.S. Department of Treasury's Specially Designated Nationals (SDN) list or other government watch lists.

☐ The company complies with all applicable anti-bribery and anti-corruption laws, including the Foreign Corrupt Practices Act (FCPA).

☐ The company has implemented appropriate data security measures and complies with applicable data privacy laws.

☐ The company agrees to comply with the requesting company's Code of Conduct and Vendor Standards.

CONFLICT OF INTEREST DISCLOSURE:

Does any officer, director, or employee of ${vendor} have a financial interest in, or a family or personal relationship with, any officer, director, or employee of ${gen(a, 'q4', 'Requesting Company')}?

☐ Yes (please describe): ________________________________
☐ No${bgSection}

I certify that all information provided in this vendor package is true, accurate, and complete.

Signature: ________________________________
Print Name: ${gen(a, 'q5', 'Contact Name')}
Title: ${gen(a, 'q13', 'Contact Title')}
Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
Company: ${vendor}`;
    },
  },
];

export const vendorPackageTemplate: DocumentTemplateDef = {
  id: 'dt5',
  name: 'W-9 + Vendor Package',
  category: 'Compliance',
  description: 'Complete vendor onboarding package: W-9, banking details, compliance attestations, and background check forms',
  pages: '6–10',
  sections: sectionSchemas.length,
  avgGenerationTime: '1.1 min',
  questions,
  schema: sectionSchemas,
};

