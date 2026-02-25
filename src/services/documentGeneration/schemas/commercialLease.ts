import { DocumentTemplateDef, IntakeAnswers } from '../types';

/* ─── COMMERCIAL LEASE AGREEMENT ─────────────────────────── */

const questions = [
  { id: 'q1', question: 'Property Type', type: 'select' as const, options: ['Office', 'Retail', 'Industrial', 'Mixed-Use', 'Medical'], required: true, helpText: 'Determines applicable clauses and regulatory requirements' },
  { id: 'q2', question: 'State / Jurisdiction', type: 'select' as const, options: ['California', 'New York', 'Texas', 'Florida', 'Illinois', 'Other'], required: true, helpText: 'Controls state-specific disclosures and statutory provisions' },
  { id: 'q3', question: 'Lease Term', type: 'select' as const, options: ['1 Year', '3 Years', '5 Years', '7 Years', '10 Years', 'Month-to-Month'], required: true },
  { id: 'q4', question: 'Tenant Entity Name', type: 'text' as const, required: true, placeholder: 'e.g. Acme Technologies, Inc.' },
  { id: 'q5', question: 'Landlord Entity Name', type: 'text' as const, required: true, placeholder: 'e.g. Pacific Realty Holdings LLC' },
  { id: 'q6', question: 'Base Rent (monthly)', type: 'text' as const, required: true, placeholder: 'e.g. $18,500' },
  { id: 'q7', question: 'Annual Escalation', type: 'select' as const, options: ['3% Fixed', 'CPI-Based', '4% Fixed', 'Fair Market Value', 'None'], required: true },
  { id: 'q8', question: 'Security Deposit', type: 'text' as const, required: true, placeholder: 'e.g. $55,500 (3 months)' },
  { id: 'q9', question: 'CAM Charges', type: 'select' as const, options: ['Triple Net (NNN)', 'Modified Gross', 'Full Service Gross', 'Absolute Net'], required: true, helpText: 'Determines operating expense allocation' },
  { id: 'q10', question: 'Tenant Improvement Allowance', type: 'text' as const, required: false, placeholder: 'e.g. $45/sqft' },
  { id: 'q11', question: 'Renewal Options', type: 'select' as const, options: ['1x 5-Year Option', '2x 3-Year Options', 'Right of First Refusal', 'Right of First Offer', 'None'], required: false },
  { id: 'q12', question: 'Permitted Use', type: 'text' as const, required: true, placeholder: 'e.g. General office, software development' },
  { id: 'q13', question: 'Personal Guaranty Required', type: 'toggle' as const, options: ['Yes', 'No'], required: true },
  { id: 'q14', question: 'Include Environmental Provisions', type: 'toggle' as const, options: ['Yes', 'No'], required: false, helpText: 'Required for California commercial properties' },
  { id: 'q15', question: 'Premises Square Footage', type: 'text' as const, required: true, placeholder: 'e.g. 4,200 sqft' },
  { id: 'q16', question: 'Property Address', type: 'text' as const, required: true, placeholder: 'e.g. 100 Main Street, Suite 200, San Francisco, CA' },
  { id: 'q17', question: 'Floor Number(s)', type: 'text' as const, required: true, placeholder: 'e.g. 3rd and 4th', helpText: 'Floor(s) where the premises are located' },
  { id: 'q18', question: 'Rent Abatement Period (months)', type: 'select' as const, options: ['0 (None)', '1', '2', '3', '6'], required: true, helpText: 'Free rent period at lease start' },
  { id: 'q19', question: 'TI Completion Timeline (days)', type: 'select' as const, options: ['60', '90', '120', '150', '180'], required: true, helpText: 'Days allowed to complete tenant improvements' },
  { id: 'q20', question: 'Landlord Signatory Name', type: 'text' as const, required: true, placeholder: 'e.g. Robert Martinez' },
  { id: 'q21', question: 'Landlord Signatory Title', type: 'text' as const, required: true, placeholder: 'e.g. Managing Director' },
  { id: 'q22', question: 'Tenant Signatory Name', type: 'text' as const, required: true, placeholder: 'e.g. Jane Smith' },
  { id: 'q23', question: 'Tenant Signatory Title', type: 'text' as const, required: true, placeholder: 'e.g. Chief Executive Officer' },
];

/* ─── SECTION CONTENT GENERATORS ─────────────────────────── */

function gen(a: IntakeAnswers, id: string, fallback: string): string {
  return a[id] || fallback;
}

const sectionSchemas = [
  /* ARTICLE 1 — RECITALS & DEFINITIONS */
  {
    id: 'sec-1',
    title: 'ARTICLE 1 — RECITALS AND DEFINITIONS',
    level: 1,
    pageEstimate: 2.5,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant Entity');
      const landlord = gen(a, 'q5', 'Landlord Entity');
      const state = gen(a, 'q2', 'California');
      const sqft = gen(a, 'q15', '4,200');
      const address = gen(a, 'q16', '100 Main Street, San Francisco, CA');
      return `This Commercial Lease Agreement (this "Agreement" or "Lease") is entered into as of the Effective Date set forth below, by and between:

LANDLORD: ${landlord}, a ${state} limited liability company ("Landlord"), having its principal place of business at ${address};

TENANT: ${tenant}, a Delaware corporation authorized to do business in the State of ${state} ("Tenant").

WHEREAS, Landlord is the owner of certain real property and improvements located thereon, situated in the County of San Francisco, State of ${state}, and more particularly described in Exhibit A attached hereto (the "Property"); and

WHEREAS, Tenant desires to lease from Landlord, and Landlord desires to lease to Tenant, a portion of the Property consisting of approximately ${sqft} square feet of rentable area (the "Premises"), as more particularly described in Exhibit A; and

WHEREAS, the parties desire to set forth the terms and conditions of such lease;

NOW, THEREFORE, in consideration of the mutual covenants and agreements herein contained, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties agree as follows:

1.1 DEFINITIONS. As used in this Lease, the following terms shall have the meanings set forth below:

(a) "Base Rent" shall mean the monthly rent specified in Section 4.1 hereof.

(b) "Building" shall mean the commercial ${gen(a, 'q1', 'office').toLowerCase()} building and all improvements thereon located at ${address}, including all common areas, parking structures, and appurtenant facilities.

(c) "Commencement Date" shall mean the date upon which Tenant's obligation to pay Rent commences, as determined in accordance with Section 3.1 hereof.

(d) "Common Areas" shall mean all areas and facilities within the Building and the Property that are not designated for the exclusive use of any tenant or other occupant, including but not limited to: lobbies, corridors, restrooms, stairways, elevators, mechanical rooms, janitorial closets, loading docks, driveways, walkways, and landscaped areas.

(e) "CPI" shall mean the Consumer Price Index for All Urban Consumers (CPI-U) for the metropolitan statistical area in which the Premises is located, as published by the U.S. Bureau of Labor Statistics, or any successor index thereto.

(f) "Default Rate" shall mean the lesser of (i) the Prime Rate (as defined below) plus four percent (4%) per annum, or (ii) the maximum rate permitted by applicable law.

(g) "Environmental Laws" shall mean all federal, state, and local laws, ordinances, regulations, and standards relating to the protection of the environment or human health, including but not limited to the Comprehensive Environmental Response, Compensation, and Liability Act (CERCLA), the Resource Conservation and Recovery Act (RCRA), and all ${state} state environmental statutes.

(h) "Expiration Date" shall mean the last day of the Term, as set forth in Section 3.1 hereof, unless sooner terminated in accordance with this Lease.

(i) "Hazardous Materials" shall mean any substance, material, or waste that is regulated by any Environmental Law, including but not limited to petroleum products, asbestos, polychlorinated biphenyls (PCBs), and radioactive materials.

(j) "Landlord's Work" shall mean any construction, alteration, or improvement to be performed by Landlord as described in Exhibit C, if any.

(k) "Lease Year" shall mean each consecutive twelve (12) month period during the Term, with the first Lease Year commencing on the Commencement Date.

(l) "Operating Expenses" shall have the meaning set forth in Section 5.2 hereof.

(m) "Permitted Use" shall mean ${gen(a, 'q12', 'general office and related commercial operations')}, and any lawful use incidental thereto.

(n) "Premises" shall mean that certain space containing approximately ${sqft} rentable square feet located on the ${gen(a, 'q17', 'designated')} floor(s) of the Building, as depicted on Exhibit A attached hereto.

(o) "Prime Rate" shall mean the prime rate of interest as published from time to time in The Wall Street Journal, or if such rate ceases to be published, a comparable rate designated by Landlord.

(p) "Property" shall mean the Building, together with the real property on which it is situated and all appurtenances thereto.

(q) "Rent" shall mean, collectively, Base Rent, Tenant's Share of Operating Expenses, and all other sums due from Tenant to Landlord under this Lease.

(r) "Security Deposit" shall have the meaning set forth in Section 6.1 hereof.

(s) "Tenant Improvements" or "Tenant's Work" shall have the meaning set forth in Section 9 and Exhibit C hereof.

(t) "Tenant's Share" shall mean the ratio of the rentable square footage of the Premises to the total rentable square footage of the Building, expressed as a percentage, which the parties agree is ___%.

(u) "Term" shall mean the period specified in Section 3.1 hereof, as the same may be extended pursuant to any renewal option exercised by Tenant in accordance with this Lease.`;
    },
  },

  /* ARTICLE 2 — GRANT OF LEASE */
  {
    id: 'sec-2',
    title: 'ARTICLE 2 — GRANT OF LEASE AND PREMISES',
    level: 1,
    pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      const sqft = gen(a, 'q15', '4,200');
      const address = gen(a, 'q16', '100 Main Street');
      return `2.1 LEASE GRANT. ${landlord} hereby leases to ${tenant}, and ${tenant} hereby leases from ${landlord}, the Premises described herein, subject to and upon all of the terms, covenants, and conditions set forth in this Lease. The Premises consists of approximately ${sqft} rentable square feet located at ${address}, as more particularly depicted on the floor plan attached hereto as Exhibit A and incorporated herein by this reference.

2.2 COMMON AREAS. Together with the Premises, ${tenant} shall have the non-exclusive right, in common with ${landlord}, other tenants of the Building, and their respective employees, agents, customers, visitors, invitees, licensees, and subtenants, to use the Common Areas of the Building and Property, subject to the terms of this Lease and such reasonable rules and regulations as ${landlord} may prescribe from time to time.

2.3 MEASUREMENT. The parties acknowledge and agree that the rentable square footage of the Premises set forth herein is approximate and has been calculated in accordance with the Building Owners and Managers Association International (BOMA) Standard Method for Measuring Floor Area in Office Buildings (ANSI/BOMA Z65.1-2017), or such successor standard as may be adopted. In the event of any dispute regarding the measurement of the Premises, the parties agree to engage a mutually acceptable licensed architect to measure the Premises in accordance with the applicable BOMA Standard, and such architect's determination shall be binding on both parties. Any adjustment to the rentable square footage shall result in a proportionate adjustment to Base Rent, Tenant's Share, and any other amounts calculated on a per-square-foot basis.

2.4 CONDITION OF PREMISES. Except as expressly set forth in this Lease and in the Work Letter attached hereto as Exhibit C (if applicable), ${tenant} hereby accepts the Premises in their "AS IS" condition as of the date of this Lease, and acknowledges that ${landlord} has made no representations or warranties, express or implied, regarding the condition of the Premises or their fitness for any particular purpose. ${landlord} shall deliver the Premises to ${tenant} in broom-clean condition, with all Building systems serving the Premises (including HVAC, electrical, plumbing, and fire/life safety systems) in good working order and condition.

2.5 LANDLORD'S RESERVED RIGHTS. ${landlord} hereby reserves the following rights, each of which ${landlord} may exercise without notice to ${tenant} and without liability to ${tenant} for damage or injury to property, person, or business, and the exercise of any such right shall not constitute an eviction or disturbance of ${tenant}'s use or possession of the Premises:

(a) To change the name, number, or designation by which the Building is commonly known;

(b) To install, affix, and maintain any and all signs on the exterior or interior of the Building;

(c) To designate or approve, prior to installation, all types of window shades, blinds, drapes, and other similar equipment;

(d) To grant to any party the exclusive right to conduct any business or render any service in the Building, provided such exclusive right shall not operate to exclude ${tenant} from the Permitted Use;

(e) To retain at all times pass keys to the Premises;

(f) To enter the Premises upon reasonable prior notice (except in the case of emergency) for purposes of inspection, maintenance, repair, or showing the Premises to prospective tenants, purchasers, or lenders.`;
    },
  },

  /* ARTICLE 3 — TERM & COMMENCEMENT */
  {
    id: 'sec-3',
    title: 'ARTICLE 3 — TERM AND COMMENCEMENT',
    level: 1,
    pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const term = gen(a, 'q3', '5 Years');
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `3.1 TERM. The Term of this Lease shall be ${term} (the "Initial Term"), commencing on the Commencement Date and expiring on the Expiration Date, unless sooner terminated or extended as provided herein. For purposes of this Lease:

(a) The "Commencement Date" shall be the earlier of: (i) the date ${tenant} first occupies the Premises for the conduct of business; or (ii) the date that is thirty (30) days after ${landlord} delivers possession of the Premises to ${tenant} with ${landlord}'s Work (if any) Substantially Complete.

(b) The "Expiration Date" shall be the last day of the month in which the anniversary of the Commencement Date occurs in the final year of the Initial Term.

(c) "Substantially Complete" or "Substantial Completion" shall mean that ${landlord}'s Work has been completed in accordance with the approved plans and specifications, subject to punch list items that do not materially interfere with ${tenant}'s use of the Premises.

3.2 COMMENCEMENT DATE CONFIRMATION. Within thirty (30) days after the Commencement Date has been determined, ${landlord} and ${tenant} shall execute a written Commencement Date Confirmation in the form attached hereto as Exhibit D, confirming the actual Commencement Date, the Expiration Date, and the schedule of Base Rent. The failure to execute such Commencement Date Confirmation shall not affect either party's obligations hereunder.

3.3 EARLY ACCESS. Subject to the terms and conditions of this Lease, ${landlord} shall permit ${tenant} to enter the Premises prior to the Commencement Date solely for the purpose of installing ${tenant}'s furniture, fixtures, equipment, cabling, and telecommunications infrastructure ("Early Access Period"). During such Early Access Period:

(a) ${tenant} shall not be required to pay Base Rent, but shall be responsible for all utilities consumed during such period;

(b) ${tenant} shall maintain all insurance required under this Lease;

(c) All other provisions of this Lease (other than the obligation to pay Rent) shall be in full force and effect during such period;

(d) ${tenant}'s access shall be coordinated with ${landlord} and shall not interfere with the completion of ${landlord}'s Work.

3.4 DELAYED DELIVERY. If ${landlord} is unable to deliver possession of the Premises to ${tenant} on or before the estimated delivery date, this Lease shall not be void or voidable, nor shall ${landlord} be liable to ${tenant} for any loss or damage resulting therefrom. In such event, the Commencement Date shall be postponed to the date on which ${landlord} delivers possession of the Premises to ${tenant}, and the Expiration Date shall be correspondingly extended. Notwithstanding the foregoing, if ${landlord} fails to deliver possession within one hundred eighty (180) days after the estimated delivery date, ${tenant} may terminate this Lease by written notice to ${landlord}, in which event ${landlord} shall promptly return to ${tenant} all prepaid rent and the Security Deposit.

3.5 HOLDING OVER. If ${tenant} remains in possession of the Premises after the Expiration Date or earlier termination of this Lease without the express written consent of ${landlord}, ${tenant} shall become a tenant at sufferance, and (a) shall pay ${landlord} holdover rent equal to one hundred fifty percent (150%) of the Base Rent in effect during the last month of the Term, plus all other Rent due under this Lease, (b) shall be subject to all other terms and conditions of this Lease, and (c) shall indemnify, defend, and hold harmless ${landlord} from and against any and all claims, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising from or related to such holdover tenancy, including any claims by succeeding tenants.`;
    },
  },

  /* ARTICLE 4 — BASE RENT & ESCALATION */
  {
    id: 'sec-4',
    title: 'ARTICLE 4 — BASE RENT AND RENT ESCALATION',
    level: 1,
    pageEstimate: 2.5,
    contentGenerator: (a: IntakeAnswers) => {
      const rent = gen(a, 'q6', '$18,500');
      const escalation = gen(a, 'q7', '3% Fixed');
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      const term = gen(a, 'q3', '5 Years');
      const termYears = parseInt(term) || 5;

      let escalationClause = '';
      if (escalation.includes('3% Fixed')) {
        const schedule = Array.from({ length: termYears }, (_, i) => {
          const baseAmount = parseFloat(rent.replace(/[^0-9.]/g, '')) || 18500;
          const yearRent = baseAmount * Math.pow(1.03, i);
          return `    Lease Year ${i + 1}: $${yearRent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per month`;
        }).join('\n');
        escalationClause = `4.2 RENT ESCALATION. Commencing on the first anniversary of the Commencement Date and on each anniversary thereafter during the Term (each, an "Adjustment Date"), the monthly Base Rent shall increase by three percent (3%) over the Base Rent in effect immediately prior to such Adjustment Date. The schedule of Base Rent over the Initial Term shall be as follows:\n\n${schedule}\n\nThe foregoing schedule is provided for reference purposes and is subject to adjustment based on the actual Commencement Date.`;
      } else if (escalation.includes('CPI')) {
        escalationClause = `4.2 RENT ESCALATION — CPI ADJUSTMENT. Commencing on the first anniversary of the Commencement Date and on each anniversary thereafter during the Term, the monthly Base Rent shall be adjusted by multiplying the Base Rent in effect immediately prior to such adjustment by a fraction, the numerator of which is the CPI published most recently prior to such adjustment date and the denominator of which is the CPI published most recently prior to the Commencement Date (or the immediately preceding adjustment date, as applicable). Notwithstanding the foregoing:

(a) In no event shall the adjusted Base Rent be less than the Base Rent in effect immediately prior to such adjustment (i.e., the CPI adjustment shall not result in a decrease in Rent);

(b) The annual increase in Base Rent pursuant to this Section shall not exceed five percent (5%) in any given Lease Year;

(c) If the CPI ceases to be published, ${landlord} shall select a reasonably comparable replacement index, and shall notify ${tenant} of such selection in writing.`;
      } else if (escalation.includes('4% Fixed')) {
        escalationClause = `4.2 RENT ESCALATION. Commencing on the first anniversary of the Commencement Date and on each anniversary thereafter during the Term, the monthly Base Rent shall increase by four percent (4%) over the Base Rent in effect immediately prior to such Adjustment Date.`;
      } else {
        escalationClause = `4.2 RENT ESCALATION. The Base Rent shall remain fixed for the duration of the Initial Term, with no annual escalation.`;
      }

      return `4.1 BASE RENT. ${tenant} shall pay to ${landlord}, without notice, demand, deduction, or setoff (except as expressly set forth herein), monthly Base Rent in the amount of ${rent} per month ("Base Rent"). Base Rent shall be payable in advance on the first (1st) day of each calendar month during the Term. If the Commencement Date falls on a day other than the first day of a calendar month, the Base Rent for such partial month shall be prorated on a per diem basis based on the actual number of days in such month.

${escalationClause}

4.3 PAYMENT OF RENT. All Rent shall be paid to ${landlord} at the address specified in Article 26 (Notices) of this Lease, or to such other person or at such other place as ${landlord} may designate from time to time by written notice to ${tenant}. ${tenant} may pay Rent by check, wire transfer, or automated clearinghouse (ACH) transfer, as directed by ${landlord}. ${landlord} shall provide ${tenant} with wire transfer instructions within ten (10) business days after the execution of this Lease.

4.4 LATE PAYMENT. If any installment of Rent is not received by ${landlord} within five (5) business days after its due date, ${tenant} shall pay to ${landlord} a late charge equal to five percent (5%) of the overdue amount ("Late Charge"). The parties agree that such Late Charge represents a fair and reasonable estimate of the costs ${landlord} will incur by reason of late payment by ${tenant}, and that the exact amount of such costs would be extremely difficult or impractical to determine. Acceptance of such Late Charge by ${landlord} shall not constitute a waiver of ${tenant}'s default with respect to such overdue amount, nor shall it prevent ${landlord} from exercising any of the other rights and remedies available to ${landlord} under this Lease or at law or in equity.

4.5 INTEREST. Any Rent not paid when due shall bear interest from the date due until paid at the Default Rate; provided, however, that interest shall not be payable on late charges. Payment of interest shall not excuse or cure any default by ${tenant} under this Lease.

4.6 RENT COMMENCEMENT. Notwithstanding any other provision of this Lease to the contrary, ${tenant} shall not be required to pay Base Rent for the first ${gen(a, 'q18', '0 (None)').replace(' (None)', '')} full calendar months after the Commencement Date (the "Rent Abatement Period"). During the Rent Abatement Period, ${tenant} shall nevertheless be responsible for the payment of all other Rent due under this Lease, including ${tenant}'s Share of Operating Expenses, utilities, and all other charges. If ${tenant} defaults under this Lease at any time during the Term and fails to cure such default within the applicable cure period, ${tenant} shall immediately become obligated to pay to ${landlord} the full amount of Base Rent that was abated during the Rent Abatement Period.

4.7 RENT SCHEDULE TABLE. The Base Rent payable during each Lease Year of the Initial Term shall be as set forth in the Rent Schedule attached hereto as part of Exhibit B and incorporated herein by this reference.`;
    },
  },

  /* ARTICLE 5 — OPERATING EXPENSES & CAM */
  {
    id: 'sec-5',
    title: 'ARTICLE 5 — OPERATING EXPENSES AND COMMON AREA MAINTENANCE',
    level: 1,
    pageEstimate: 2.5,
    contentGenerator: (a: IntakeAnswers) => {
      const cam = gen(a, 'q9', 'Triple Net (NNN)');
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');

      let camClause = '';
      if (cam.includes('Triple Net')) {
        camClause = `5.1 TRIPLE NET LEASE. This Lease is a "triple net" lease, and ${tenant} acknowledges and agrees that ${landlord} shall receive the Base Rent set forth herein free and clear of any and all impositions, taxes, liens, charges, and expenses of any nature whatsoever in connection with the ownership and operation of the Property. In addition to the Base Rent, ${tenant} shall pay to ${landlord} ${tenant}'s Share of all Operating Expenses, Taxes, and Insurance Costs (each as defined below) as Additional Rent.`;
      } else if (cam.includes('Modified Gross')) {
        camClause = `5.1 MODIFIED GROSS LEASE. This Lease is a "modified gross" lease. Base Rent includes a base year allocation of Operating Expenses for the first Lease Year (the "Base Year Amount"). Commencing in the second Lease Year and each Lease Year thereafter, ${tenant} shall pay to ${landlord}, as Additional Rent, ${tenant}'s Share of the amount by which actual Operating Expenses for such Lease Year exceed the Base Year Amount.`;
      } else if (cam.includes('Full Service')) {
        camClause = `5.1 FULL SERVICE GROSS LEASE. This Lease is a "full service gross" lease. The Base Rent set forth herein includes all Operating Expenses, subject to the following provisions regarding expense stops and caps.`;
      } else {
        camClause = `5.1 ABSOLUTE NET LEASE. This Lease is an "absolute net" lease. ${tenant} shall be responsible for all costs and expenses associated with the Premises, including but not limited to Operating Expenses, real property taxes, insurance, maintenance, repairs, and capital replacements.`;
      }

      return `${camClause}

5.2 OPERATING EXPENSES DEFINED. "Operating Expenses" shall mean all costs and expenses of every kind and nature paid or incurred by ${landlord} in connection with the ownership, management, maintenance, security, repair, replacement, and operation of the Building and the Property, and the personal property used in conjunction therewith, including without limitation:

(a) Wages, salaries, and related costs (including taxes, insurance, and benefits) of all persons engaged in the operation, management, maintenance, or security of the Building;

(b) All supplies, tools, equipment, and materials used in the operation, management, maintenance, repair, and security of the Building;

(c) Costs of all utilities for the Common Areas of the Building, including electricity, gas, water, sewer, and trash removal;

(d) Cost of all maintenance and service agreements for the Building, including but not limited to HVAC maintenance, elevator maintenance, fire/life safety systems, janitorial services, window washing, landscaping, snow removal, and pest control;

(e) Premiums for all insurance maintained by ${landlord} with respect to the Building and the Property, including property insurance, general liability insurance, earthquake insurance (if applicable), flood insurance (if applicable), and umbrella/excess liability insurance;

(f) Real property taxes, personal property taxes, and assessments levied against the Building or the Property;

(g) Costs of capital improvements or replacements required by any governmental authority or that are designed to reduce Operating Expenses, amortized over their useful lives in accordance with generally accepted accounting principles;

(h) Management fees, not to exceed four percent (4%) of gross rental revenues for the Building;

(i) Legal and accounting fees incurred in connection with the operation and management of the Building (excluding fees incurred in connection with disputes with tenants or leasing activities);

(j) Costs of maintaining and repairing the Common Areas, including parking areas, lobbies, corridors, restrooms, and landscaping.

5.3 OPERATING EXPENSE EXCLUSIONS. Operating Expenses shall not include:

(a) Costs of leasing commissions, advertising, and other costs incurred in connection with leasing space in the Building;

(b) Depreciation of the Building or equipment (except as provided in Section 5.2(g));

(c) Interest and principal payments on mortgages or other financing;

(d) Costs of any work or service performed for any tenant (including ${tenant}) at such tenant's expense;

(e) Costs incurred to correct defects in the original construction of the Building;

(f) ${landlord}'s income taxes, franchise taxes, or inheritance taxes;

(g) Costs of artwork, sculptures, or other decorative items in excess of Building-standard improvements.

5.4 ESTIMATES AND RECONCILIATION. ${landlord} shall provide ${tenant} with an estimate of ${tenant}'s Share of Operating Expenses for each calendar year. ${tenant} shall pay one-twelfth (1/12) of the estimated amount monthly, together with Base Rent. Within one hundred twenty (120) days after the end of each calendar year, ${landlord} shall furnish ${tenant} with a statement setting forth the actual Operating Expenses for such year. If the total amount paid by ${tenant} for such year exceeds ${tenant}'s Share, ${landlord} shall credit such excess against the next installment(s) of Operating Expenses due from ${tenant}. If ${tenant}'s payments are less than ${tenant}'s Share, ${tenant} shall pay the deficiency within thirty (30) days of receipt of ${landlord}'s statement.

5.5 AUDIT RIGHTS. ${tenant} or its authorized representative shall have the right, at ${tenant}'s expense, to audit ${landlord}'s books and records relating to Operating Expenses for any calendar year, upon not less than thirty (30) days' prior written notice. Such audit shall be conducted during normal business hours at ${landlord}'s office. If such audit reveals that ${landlord} has overstated Operating Expenses by more than five percent (5%), ${landlord} shall reimburse ${tenant} for the cost of the audit.`;
    },
  },

  /* ARTICLE 6 — SECURITY DEPOSIT */
  {
    id: 'sec-6',
    title: 'ARTICLE 6 — SECURITY DEPOSIT',
    level: 1,
    pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const deposit = gen(a, 'q8', '$55,500');
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      const state = gen(a, 'q2', 'California');
      return `6.1 DEPOSIT AMOUNT. Upon execution of this Lease, ${tenant} shall deposit with ${landlord} the sum of ${deposit} (the "Security Deposit") as security for the faithful performance by ${tenant} of all the terms, covenants, and conditions of this Lease.

6.2 USE OF SECURITY DEPOSIT. If ${tenant} defaults under any provision of this Lease beyond any applicable notice and cure period, ${landlord} may use, apply, or retain all or any part of the Security Deposit for the payment of any Rent or other charge in default, for the payment of any other sum to which ${landlord} may become obligated by reason of ${tenant}'s default, or to compensate ${landlord} for any loss or damage that ${landlord} may suffer thereby. If ${landlord} so uses or applies all or any portion of the Security Deposit, ${tenant} shall, within ten (10) business days after demand therefor, deposit with ${landlord} cash in an amount sufficient to restore the Security Deposit to the full amount required herein.

6.3 RETURN OF DEPOSIT. Provided ${tenant} is not in default hereunder and has complied with all of its obligations under this Lease, ${landlord} shall return the Security Deposit (or the balance thereof, if any portion has been applied) to ${tenant} within thirty (30) days after the later of (a) the Expiration Date or earlier termination of this Lease, (b) ${tenant}'s vacation and surrender of the Premises in the condition required by this Lease, and (c) determination of any final reconciliation of Operating Expenses.

6.4 TRANSFER OF DEPOSIT. If ${landlord} conveys or transfers its interest in the Building or this Lease to a successor-in-interest, ${landlord} shall transfer the Security Deposit (or the balance thereof) to the transferee, and ${landlord} shall thereupon be released from all liability for the return of the Security Deposit, and ${tenant} shall look solely to the transferee for the return of the Security Deposit.

6.5 NOT ADVANCE RENT. ${tenant} shall not have the right to apply the Security Deposit to any Rent or other charges due under this Lease. The Security Deposit shall not be deemed an advance payment of Rent or a measure of ${landlord}'s damages in case of default by ${tenant}.

6.6 ${state.toUpperCase()} REQUIREMENTS. ${landlord} shall comply with all applicable ${state} laws regarding the handling and return of security deposits, including any requirement to hold the Security Deposit in a separate interest-bearing account or to provide ${tenant} with an itemized statement of deductions.`;
    },
  },

  /* ARTICLE 7 — USE & COMPLIANCE */
  {
    id: 'sec-7',
    title: 'ARTICLE 7 — USE AND COMPLIANCE',
    level: 1,
    pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const use = gen(a, 'q12', 'general office and related commercial operations');
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `7.1 PERMITTED USE. ${tenant} shall use and occupy the Premises solely for the purpose of ${use}, and for no other purpose without the prior written consent of ${landlord}, which consent shall not be unreasonably withheld, conditioned, or delayed (the "Permitted Use").

7.2 COMPLIANCE WITH LAWS. ${tenant} shall, at its sole cost and expense, comply with all applicable federal, state, and local laws, codes, ordinances, rules, regulations, and requirements (collectively, "Laws"), including but not limited to zoning laws, building codes, health and safety regulations, and the Americans with Disabilities Act (ADA), to the extent applicable to ${tenant}'s use and occupancy of the Premises and ${tenant}'s specific manner of use.

7.3 RESTRICTIONS ON USE. ${tenant} shall not use or permit the use of the Premises in any manner that:

(a) Violates any applicable Laws or any certificate of occupancy for the Building;

(b) Constitutes a nuisance, annoyance, or inconvenience to ${landlord} or other tenants of the Building;

(c) Causes damage to the Premises, the Building, or the Property;

(d) Increases the cost of insurance for the Building or causes the cancellation of any insurance policy;

(e) Obstructs or interferes with the rights of other tenants or occupants of the Building;

(f) Involves the use, storage, or disposal of any Hazardous Materials except as permitted under Article 21 (Environmental Provisions) of this Lease;

(g) Creates excessive noise, vibration, or odors detectable outside the Premises.

7.4 LANDLORD REPRESENTATIONS. ${landlord} represents that as of the date of this Lease, the Building is in compliance with all applicable Laws, and the Permitted Use is consistent with the zoning and use restrictions applicable to the Property.`;
    },
  },

  /* ARTICLE 8 — ALTERATIONS & IMPROVEMENTS */
  {
    id: 'sec-8',
    title: 'ARTICLE 8 — ALTERATIONS AND IMPROVEMENTS',
    level: 1,
    pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `8.1 TENANT'S ALTERATIONS. ${tenant} shall not make any alterations, additions, or improvements to the Premises (collectively, "Alterations") without the prior written consent of ${landlord}, which consent shall not be unreasonably withheld, conditioned, or delayed; provided, however, that ${tenant} may make non-structural Alterations that do not affect the Building systems, that cost less than Twenty-Five Thousand Dollars ($25,000.00) in the aggregate per Lease Year, and that are not visible from the exterior of the Premises without ${landlord}'s consent but with prior written notice to ${landlord}.

8.2 PLANS AND SPECIFICATIONS. All Alterations requiring ${landlord}'s consent shall be made in accordance with plans and specifications approved in writing by ${landlord} prior to commencement of any work. ${landlord} shall respond to ${tenant}'s request for approval within fifteen (15) business days after receipt of complete plans and specifications; failure to respond within such period shall be deemed disapproval.

8.3 CONTRACTOR REQUIREMENTS. All Alterations shall be performed by licensed, bonded, and insured contractors approved by ${landlord} (such approval not to be unreasonably withheld). All work shall be performed in a good and workmanlike manner, in compliance with all applicable Laws, and in accordance with the plans and specifications approved by ${landlord}.

8.4 LIENS. ${tenant} shall keep the Premises, the Building, and the Property free from any mechanics' liens or other liens arising out of any work performed, materials furnished, or obligations incurred by or on behalf of ${tenant}. If any such lien is filed, ${tenant} shall cause such lien to be released of record within thirty (30) days after notice thereof, by payment, bond, or otherwise.

8.5 OWNERSHIP OF ALTERATIONS. Unless ${landlord} elects otherwise by written notice to ${tenant} at the time of ${landlord}'s consent to such Alterations, all Alterations made by ${tenant} shall become the property of ${landlord} upon installation and shall remain upon and be surrendered with the Premises at the expiration or earlier termination of this Lease. ${landlord} may require ${tenant} to remove any or all Alterations upon the expiration or earlier termination of this Lease and to restore the Premises to their condition prior to such Alterations, at ${tenant}'s sole cost and expense.`;
    },
  },

  /* ARTICLE 9 — TENANT IMPROVEMENT ALLOWANCE */
  {
    id: 'sec-9',
    title: 'ARTICLE 9 — TENANT IMPROVEMENT ALLOWANCE',
    level: 1,
    pageEstimate: 1.5,
    conditional: { questionId: 'q10', values: [''], include: false },
    contentGenerator: (a: IntakeAnswers) => {
      const tia = gen(a, 'q10', '$45/sqft');
      const sqft = gen(a, 'q15', '4,200');
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `9.1 ALLOWANCE AMOUNT. ${landlord} shall provide ${tenant} with a tenant improvement allowance in the amount of ${tia} of rentable square footage of the Premises (the "TI Allowance") to be applied toward the cost of designing and constructing the initial tenant improvements to the Premises (the "Tenant Improvements"). Based on the approximately ${sqft} square feet of the Premises, the total TI Allowance shall be approximately $${(parseFloat(tia.replace(/[^0-9.]/g, '')) * parseFloat(sqft.replace(/[^0-9.]/g, ''))).toLocaleString()}.

9.2 DISBURSEMENT. The TI Allowance shall be disbursed by ${landlord} to ${tenant} (or, at ${landlord}'s option, directly to ${tenant}'s contractor) in installments upon submission of draw requests, accompanied by:

(a) A description of the work completed since the prior draw request;
(b) Invoices from contractors and suppliers;
(c) Lien waivers from all contractors, subcontractors, and material suppliers for amounts previously paid;
(d) Certification by ${tenant}'s architect that the work has been performed in accordance with the approved plans.

The final installment of the TI Allowance (equal to ten percent (10%) of the total) shall be withheld until:

(i) ${tenant}'s architect has issued a certificate of substantial completion;
(ii) A certificate of occupancy (or its equivalent) has been issued for the Premises;
(iii) Final, unconditional lien waivers have been received from all contractors and subcontractors.

9.3 EXCESS COSTS. Any costs of the Tenant Improvements in excess of the TI Allowance shall be borne solely by ${tenant}. If the actual cost of the Tenant Improvements is less than the TI Allowance, ${tenant} shall not be entitled to any credit or payment for the unused portion, unless ${landlord} agrees otherwise in writing.

9.4 CONSTRUCTION STANDARDS. All Tenant Improvements shall be constructed in accordance with the Work Letter attached as Exhibit C, in compliance with all applicable Laws, and in a good and workmanlike manner using new materials of first-class quality. ${tenant} shall obtain all necessary permits and approvals prior to commencing construction.`;
    },
  },

  /* ARTICLE 10 — MAINTENANCE & REPAIRS */
  {
    id: 'sec-10',
    title: 'ARTICLE 10 — MAINTENANCE AND REPAIRS',
    level: 1,
    pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `10.1 LANDLORD'S OBLIGATIONS. ${landlord} shall maintain in good order, condition, and repair the structural elements of the Building, including the foundation, exterior walls, roof, and the Building's core mechanical, electrical, plumbing, HVAC, and fire/life safety systems; provided, however, that to the extent any such maintenance or repair is necessitated by the acts or omissions of ${tenant}, its agents, employees, contractors, or invitees, the cost thereof shall be borne by ${tenant}.

10.2 TENANT'S OBLIGATIONS. ${tenant} shall, at its sole cost and expense, maintain the Premises in good order, condition, and repair, including but not limited to:

(a) Interior walls, ceilings, and floors;
(b) Doors, windows, and hardware within the Premises;
(c) All fixtures, equipment, and personal property of ${tenant};
(d) HVAC equipment exclusively serving the Premises, if any;
(e) All supplemental systems installed by or for ${tenant}, including supplemental cooling, UPS systems, and security systems;
(f) Keeping the Premises in a clean and sanitary condition.

10.3 REPAIRS BY LANDLORD. Except for repairs necessitated by the negligence or willful misconduct of ${tenant}, its agents, employees, contractors, or invitees, if ${tenant} notifies ${landlord} of the need for repairs that are ${landlord}'s responsibility under Section 10.1, ${landlord} shall use commercially reasonable efforts to commence such repairs within a reasonable time after receipt of such notice and to complete them with due diligence. ${landlord} shall not be liable for any damages or losses incurred by ${tenant} as a result of any failure to make repairs unless ${landlord} has received written notice of the need for such repairs and has failed to commence repairs within a reasonable time thereafter.

10.4 SELF-HELP. If ${landlord} fails to perform any obligation under this Lease and such failure continues for thirty (30) days after written notice from ${tenant} (or such shorter period as may be reasonably necessary in the case of an emergency), ${tenant} may perform such obligation on behalf of ${landlord}, and ${landlord} shall reimburse ${tenant} for the reasonable cost thereof within thirty (30) days after receipt of an invoice and supporting documentation.`;
    },
  },

  /* ARTICLE 11 — INSURANCE */
  {
    id: 'sec-11',
    title: 'ARTICLE 11 — INSURANCE REQUIREMENTS',
    level: 1,
    pageEstimate: 2,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `11.1 TENANT'S INSURANCE. ${tenant} shall maintain, at its sole cost and expense, the following insurance coverage throughout the Term:

(a) COMMERCIAL GENERAL LIABILITY INSURANCE with combined single limits of not less than Two Million Dollars ($2,000,000) per occurrence and Five Million Dollars ($5,000,000) in the aggregate, covering bodily injury, property damage, personal injury, and advertising injury arising out of or in connection with ${tenant}'s use and occupancy of the Premises;

(b) PROPERTY INSURANCE covering ${tenant}'s personal property, trade fixtures, equipment, and improvements and betterments made by or on behalf of ${tenant} within the Premises, on an "all risk" or "special form" basis, in an amount equal to the full replacement cost thereof;

(c) WORKERS' COMPENSATION INSURANCE as required by applicable law, and Employers' Liability Insurance with limits of not less than One Million Dollars ($1,000,000) per accident;

(d) BUSINESS INTERRUPTION INSURANCE in an amount sufficient to cover a period of not less than twelve (12) months of Rent due under this Lease;

(e) UMBRELLA/EXCESS LIABILITY INSURANCE with limits of not less than Five Million Dollars ($5,000,000) per occurrence and in the aggregate, providing coverage in excess of the underlying policies described above.

11.2 INSURANCE REQUIREMENTS. All insurance policies required to be maintained by ${tenant} shall:

(a) Be issued by insurance companies licensed to do business in the applicable state, with an A.M. Best rating of at least "A-" and a Financial Size Category of at least "VII";

(b) Name ${landlord}, ${landlord}'s managing agent, and ${landlord}'s mortgagee as additional insureds;

(c) Contain a waiver of subrogation in favor of ${landlord};

(d) Be primary and non-contributory with respect to any insurance maintained by ${landlord};

(e) Provide that such policies shall not be cancelled, non-renewed, or materially modified without at least thirty (30) days' prior written notice to ${landlord}.

11.3 CERTIFICATES OF INSURANCE. ${tenant} shall deliver to ${landlord} certificates of insurance evidencing all required coverage prior to the Commencement Date and at least thirty (30) days prior to the expiration of each policy. Failure to deliver such certificates shall not relieve ${tenant} of its obligations under this Section.

11.4 LANDLORD'S INSURANCE. ${landlord} shall maintain the following insurance throughout the Term: (a) property insurance covering the Building on an "all risk" or "special form" basis in an amount equal to the full replacement cost thereof; (b) commercial general liability insurance; and (c) such other insurance as ${landlord} deems reasonably necessary. The cost of such insurance shall be included in Operating Expenses.

11.5 WAIVER OF SUBROGATION. Each party hereby releases the other party, and its officers, directors, employees, agents, and representatives, from any and all liability for loss or damage to property to the extent such loss or damage is covered by (or would be covered by, had the releasing party maintained the insurance required by this Lease) property insurance maintained (or required to be maintained) by the releasing party, regardless of cause, including the negligence of the other party. Each party shall cause its property insurance policies to contain a waiver of subrogation clause consistent with this Section.`;
    },
  },

  /* ARTICLE 12 — INDEMNIFICATION */
  {
    id: 'sec-12',
    title: 'ARTICLE 12 — INDEMNIFICATION',
    level: 1,
    pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `12.1 TENANT'S INDEMNIFICATION. ${tenant} shall indemnify, defend (with counsel reasonably acceptable to ${landlord}), and hold harmless ${landlord} and its officers, directors, members, managers, employees, agents, and representatives (collectively, the "Landlord Parties") from and against any and all claims, actions, damages, liability, costs, and expenses, including reasonable attorneys' fees and court costs (collectively, "Claims"), arising from or related to:

(a) ${tenant}'s use and occupancy of the Premises;
(b) Any activity, work, or thing done or permitted by ${tenant} in or about the Premises;
(c) Any breach or default by ${tenant} under this Lease;
(d) Any negligence or willful misconduct of ${tenant} or its agents, employees, contractors, or invitees.

12.2 LANDLORD'S INDEMNIFICATION. ${landlord} shall indemnify, defend (with counsel reasonably acceptable to ${tenant}), and hold harmless ${tenant} and its officers, directors, employees, agents, and representatives (collectively, the "Tenant Parties") from and against any and all Claims arising from or related to:

(a) Any breach or default by ${landlord} under this Lease;
(b) Any negligence or willful misconduct of ${landlord} or its agents, employees, or contractors;
(c) Any defect in the structure or Building systems that are ${landlord}'s responsibility under this Lease.

12.3 LIMITATION. Notwithstanding the foregoing, neither party shall be obligated to indemnify the other party against Claims to the extent arising from the negligence or willful misconduct of the indemnified party.

12.4 SURVIVAL. The obligations of the parties under this Article 12 shall survive the expiration or earlier termination of this Lease.`;
    },
  },

  /* ARTICLE 13 — ASSIGNMENT & SUBLETTING */
  {
    id: 'sec-13',
    title: 'ARTICLE 13 — ASSIGNMENT AND SUBLETTING',
    level: 1,
    pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `13.1 RESTRICTION. ${tenant} shall not assign, transfer, mortgage, pledge, or encumber this Lease or any interest herein, or sublet the Premises or any part thereof, or permit the use or occupancy of the Premises by any party other than ${tenant}, without the prior written consent of ${landlord}, which consent shall not be unreasonably withheld, conditioned, or delayed. Any attempted assignment, subletting, or transfer without such consent shall be void and shall constitute a default under this Lease.

13.2 REQUEST FOR CONSENT. If ${tenant} desires to assign this Lease or sublet the Premises, ${tenant} shall give ${landlord} written notice (the "Transfer Notice") at least thirty (30) days prior to the effective date of the proposed assignment or subletting, specifying: (a) the identity of the proposed assignee or subtenant; (b) the terms of the proposed assignment or subletting, including the rent and other consideration; (c) current financial statements of the proposed assignee or subtenant; and (d) such other information as ${landlord} may reasonably request.

13.3 LANDLORD'S OPTIONS. Within twenty (20) business days after receipt of the Transfer Notice, ${landlord} shall:

(a) Consent to the proposed assignment or subletting;
(b) Refuse consent, provided that such refusal is reasonable;
(c) Recapture the Premises by terminating this Lease as to the space proposed to be assigned or sublet.

13.4 REASONABLE WITHHOLDING. ${landlord}'s consent shall be deemed reasonably withheld if: (a) the proposed assignee or subtenant is not financially creditworthy; (b) the proposed use is not compatible with the Building; (c) the proposed assignee or subtenant is a governmental entity; (d) the proposed assignee or subtenant is a current tenant of the Building; or (e) the proposed terms are materially different from the terms of this Lease.

13.5 EXCESS RENT. In the event of any permitted assignment or subletting, fifty percent (50%) of any rent or other consideration received by ${tenant} in excess of the Rent payable under this Lease (after deduction of ${tenant}'s reasonable costs incurred in connection with such assignment or subletting) shall be paid to ${landlord} as Additional Rent.

13.6 NO RELEASE. No assignment or subletting shall release ${tenant} from its obligations under this Lease. ${tenant} shall remain primarily liable for the performance of all terms and conditions of this Lease.

13.7 PERMITTED TRANSFERS. Notwithstanding the foregoing, ${tenant} may, without ${landlord}'s consent but with prior written notice to ${landlord}, assign this Lease or sublet the Premises to: (a) any entity controlling, controlled by, or under common control with ${tenant}; (b) any entity resulting from a merger, consolidation, or reorganization with ${tenant}; or (c) any entity that acquires all or substantially all of the assets or stock of ${tenant}.`;
    },
  },

  /* ARTICLE 14 — DEFAULT & REMEDIES */
  {
    id: 'sec-14',
    title: 'ARTICLE 14 — DEFAULT AND REMEDIES',
    level: 1,
    pageEstimate: 2,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      const state = gen(a, 'q2', 'California');
      return `14.1 TENANT DEFAULT. The occurrence of any one or more of the following events shall constitute a default by ${tenant} under this Lease ("Tenant Default"):

(a) MONETARY DEFAULT. ${tenant}'s failure to pay any installment of Rent or any other sum due under this Lease within five (5) business days after written notice from ${landlord} that such payment is past due;

(b) ABANDONMENT. ${tenant}'s abandonment of the Premises (as defined by applicable ${state} law);

(c) NON-MONETARY DEFAULT. ${tenant}'s failure to perform or observe any other term, covenant, or condition of this Lease, if such failure continues for thirty (30) days after written notice from ${landlord}; provided, however, that if such default is of a nature that cannot reasonably be cured within thirty (30) days, ${tenant} shall not be deemed in default if ${tenant} commences the cure within such thirty (30) day period and thereafter diligently prosecutes such cure to completion;

(d) BANKRUPTCY. The filing by ${tenant} of a petition in bankruptcy or for reorganization or arrangement under the bankruptcy laws of the United States, or the commencement by ${tenant} of a proceeding under any other insolvency law;

(e) INVOLUNTARY BANKRUPTCY. The filing of an involuntary petition against ${tenant} under any bankruptcy or insolvency law that is not dismissed within sixty (60) days;

(f) ATTACHMENT. A receiver, trustee, or custodian is appointed for the Premises or for all or substantially all of ${tenant}'s assets.

14.2 LANDLORD'S REMEDIES. Upon the occurrence of a Tenant Default, ${landlord} shall have the following remedies, which are cumulative and in addition to any other rights or remedies available at law or in equity:

(a) TERMINATION. ${landlord} may terminate this Lease and ${tenant}'s right to possession of the Premises by giving written notice to ${tenant}, in which event ${tenant} shall immediately surrender possession of the Premises. Upon termination, ${landlord} shall be entitled to recover from ${tenant}:

(i) The worth at the time of award of the unpaid Rent earned at the time of termination;
(ii) The worth at the time of award of the amount by which the unpaid Rent which would have been earned after termination until the time of award exceeds the amount of rental loss that ${tenant} proves could have been reasonably avoided;
(iii) The worth at the time of award of the amount by which the unpaid Rent for the balance of the Term after the time of award exceeds the amount of rental loss that ${tenant} proves could be reasonably avoided;
(iv) Any other amount necessary to compensate ${landlord} for all detriment proximately caused by ${tenant}'s failure to perform its obligations under this Lease.

(b) CONTINUATION. ${landlord} may elect to continue this Lease in full force and effect, and to enforce all of its rights and remedies under this Lease, including the right to collect Rent as it becomes due. This remedy is available to ${landlord} under applicable ${state} law.

(c) RELETTING. ${landlord} may re-enter the Premises and relet the Premises or any part thereof for the account of ${tenant}, for such term, at such rent, and upon such other conditions as ${landlord} may deem advisable.

14.3 LANDLORD DEFAULT. ${landlord} shall be in default under this Lease if ${landlord} fails to perform any obligation required to be performed by ${landlord} under this Lease and such failure continues for thirty (30) days after written notice from ${tenant} specifying the nature of such failure; provided, however, that if such default is of a nature that cannot reasonably be cured within thirty (30) days, ${landlord} shall not be deemed in default if ${landlord} commences the cure within such thirty (30) day period and thereafter diligently prosecutes such cure to completion.`;
    },
  },

  /* ARTICLE 15 — DAMAGE & DESTRUCTION */
  {
    id: 'sec-15',
    title: 'ARTICLE 15 — DAMAGE AND DESTRUCTION',
    level: 1,
    pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `15.1 DAMAGE NOTIFICATION. If the Premises or the Building are damaged by fire or other casualty, ${tenant} shall immediately notify ${landlord} of such damage.

15.2 REPAIR OBLIGATION. If the Premises are damaged but not rendered wholly untenantable, ${landlord} shall promptly repair the damage to the extent of ${landlord}'s obligation under this Lease (excluding ${tenant}'s personal property, trade fixtures, and improvements installed by ${tenant}). If such repairs can be completed within one hundred eighty (180) days after the date of damage, this Lease shall remain in full force and effect.

15.3 TERMINATION — EXTENSIVE DAMAGE. If the Premises are rendered wholly untenantable, or if the Building is damaged to an extent exceeding thirty-three percent (33%) of the replacement cost thereof, or if the damage cannot be repaired within one hundred eighty (180) days, ${landlord} may elect to either repair the damage or terminate this Lease by written notice to ${tenant} within sixty (60) days after the date of damage.

15.4 TENANT'S TERMINATION RIGHT. If ${landlord} elects to repair but cannot complete repairs within the one hundred eighty (180) day period, ${tenant} may terminate this Lease by written notice to ${landlord} given within thirty (30) days after the expiration of such period.

15.5 RENT ABATEMENT. During the period that the Premises are untenantable (in whole or in part), the Rent shall be abated in proportion to the area of the Premises rendered untenantable.`;
    },
  },

  /* ARTICLE 16 — CONDEMNATION */
  {
    id: 'sec-16',
    title: 'ARTICLE 16 — CONDEMNATION',
    level: 1,
    pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `16.1 TOTAL TAKING. If the entire Premises or such substantial portion thereof as renders the remainder unsuitable for ${tenant}'s continued use is taken by eminent domain or conveyed under threat thereof (a "Taking"), this Lease shall terminate as of the date of the Taking.

16.2 PARTIAL TAKING. If only a portion of the Premises is Taken and the remainder is suitable for ${tenant}'s continued use, this Lease shall continue in effect as to the remaining portion, and Rent shall be reduced in proportion to the area Taken.

16.3 AWARD. All compensation awarded or paid for any Taking shall belong to and be the property of ${landlord}; provided, however, that ${tenant} shall be entitled to independently claim and receive any award or portion thereof specifically attributable to: (a) ${tenant}'s trade fixtures and personal property; (b) ${tenant}'s relocation expenses; and (c) the unamortized cost of any improvements installed by ${tenant} at ${tenant}'s expense.

16.4 TEMPORARY TAKING. If the Premises or any part thereof is Taken for temporary use or occupancy for a period not exceeding one hundred eighty (180) days, this Lease shall not terminate and ${tenant} shall continue to pay Rent as required hereunder, without reduction; ${tenant} shall be entitled to receive any award or compensation for such temporary Taking.`;
    },
  },

  /* ARTICLE 17 — SUBORDINATION & ATTORNMENT */
  {
    id: 'sec-17',
    title: 'ARTICLE 17 — SUBORDINATION, NON-DISTURBANCE AND ATTORNMENT',
    level: 1,
    pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `17.1 SUBORDINATION. This Lease, and all rights of ${tenant} hereunder, are and shall be subject and subordinate to the lien of any mortgage, deed of trust, or other security instrument (collectively, "Mortgage") now or hereafter encumbering the Property, and to all renewals, modifications, consolidations, replacements, and extensions thereof; provided, however, that such subordination is conditioned upon ${tenant} receiving a Subordination, Non-Disturbance and Attornment Agreement ("SNDA") from the holder of such Mortgage in a commercially reasonable form.

17.2 ATTORNMENT. In the event of foreclosure or other enforcement of any Mortgage, or transfer of the Property in lieu of foreclosure, ${tenant} shall attorn to and recognize the purchaser or transferee (the "Successor Landlord") as ${landlord} under this Lease, and this Lease shall continue in full force and effect as a direct lease between ${tenant} and the Successor Landlord, subject to the terms of the SNDA.

17.3 NON-DISTURBANCE. So long as ${tenant} is not in default under this Lease (beyond any applicable notice and cure period), no foreclosure of any Mortgage, no enforcement of any rights under any Mortgage, and no sale or transfer of the Property shall disturb ${tenant}'s possession or use of the Premises in accordance with the terms of this Lease.

17.4 ESTOPPEL CERTIFICATES. Within fifteen (15) business days after request by ${landlord}, ${tenant} shall execute and deliver to ${landlord} a written statement certifying: (a) that this Lease is in full force and effect; (b) the Commencement Date and Expiration Date; (c) the current Base Rent; (d) the date through which Rent has been paid; (e) whether there are any defaults by either party; and (f) such other matters as ${landlord} or any prospective purchaser or lender may reasonably request.`;
    },
  },

  /* ARTICLE 18 — RENEWAL OPTIONS */
  {
    id: 'sec-18',
    title: 'ARTICLE 18 — RENEWAL OPTIONS',
    level: 1,
    pageEstimate: 1,
    conditional: { questionId: 'q11', values: ['None'], include: false },
    contentGenerator: (a: IntakeAnswers) => {
      const renewal = gen(a, 'q11', '2x 3-Year Options');
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `18.1 RENEWAL OPTION. ${tenant} shall have the option to extend the Term of this Lease for ${renewal} (each, a "Renewal Term"), upon the same terms and conditions as set forth in this Lease, except that (a) Base Rent for the Renewal Term shall be adjusted to the then-prevailing fair market rental rate for comparable space in the Building and surrounding market, and (b) there shall be no additional tenant improvement allowance, unless otherwise agreed in writing by ${landlord}.

18.2 EXERCISE OF OPTION. ${tenant} shall exercise each renewal option by delivering written notice to ${landlord} not later than nine (9) months prior to the expiration of the then-current Term (or Renewal Term, as applicable). If ${tenant} fails to timely deliver such notice, ${tenant}'s renewal option shall be deemed waived and shall be of no further force or effect.

18.3 FAIR MARKET RENT DETERMINATION. If the parties are unable to agree on the fair market rental rate for any Renewal Term within sixty (60) days after ${tenant}'s exercise of the renewal option, the fair market rental rate shall be determined as follows:

(a) Each party shall appoint one (1) licensed real estate appraiser with at least ten (10) years of experience in the local commercial real estate market;

(b) The two appraisers shall jointly select a third appraiser meeting the same qualifications;

(c) Each appraiser shall independently determine the fair market rental rate;

(d) The fair market rental rate shall be the average of the two closest determinations;

(e) The costs of the appraisal process shall be shared equally by ${landlord} and ${tenant}.

18.4 CONDITIONS. The renewal options set forth herein shall be personal to ${tenant} and may not be assigned or transferred (except in connection with a Permitted Transfer). ${tenant}'s right to exercise any renewal option is conditioned upon ${tenant} not being in default under this Lease at the time of exercise or at the commencement of the applicable Renewal Term.`;
    },
  },

  /* ARTICLE 19 — ENVIRONMENTAL PROVISIONS */
  {
    id: 'sec-19',
    title: 'ARTICLE 19 — ENVIRONMENTAL PROVISIONS',
    level: 1,
    pageEstimate: 1.5,
    conditional: { questionId: 'q14', values: ['No'], include: false },
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      const state = gen(a, 'q2', 'California');
      return `19.1 TENANT'S ENVIRONMENTAL OBLIGATIONS. ${tenant} shall not cause or permit any Hazardous Materials to be used, stored, generated, released, or disposed of in, on, under, or about the Premises, the Building, or the Property, except for small quantities of standard office and cleaning supplies customarily used in the ordinary course of ${tenant}'s business, provided that such materials are used, stored, and disposed of in compliance with all applicable Environmental Laws.

19.2 ENVIRONMENTAL COMPLIANCE. ${tenant} shall comply with all applicable Environmental Laws relating to ${tenant}'s use and occupancy of the Premises, including but not limited to the ${state} Health and Safety Code, the ${state} Water Code, and all implementing regulations.

19.3 LANDLORD'S ENVIRONMENTAL REPRESENTATIONS. ${landlord} represents and warrants that, to ${landlord}'s actual knowledge as of the date of this Lease: (a) the Building and Property are in material compliance with all applicable Environmental Laws; (b) there has been no release or threatened release of Hazardous Materials at, on, under, or from the Property; and (c) there are no pending or threatened environmental claims, actions, or proceedings relating to the Property.

19.4 ENVIRONMENTAL INDEMNIFICATION. ${tenant} shall indemnify, defend, and hold harmless ${landlord} from and against any and all claims, liabilities, costs, and expenses (including remediation costs, fines, penalties, and reasonable attorneys' fees) arising from or related to: (a) any Hazardous Materials introduced to the Premises or the Property by ${tenant} or ${tenant}'s agents; or (b) any violation of Environmental Laws by ${tenant}.

19.5 ${state.toUpperCase()} PROPOSITION 65 DISCLOSURE. In accordance with ${state} Health and Safety Code Section 25249.5 et seq. ("Proposition 65"), ${landlord} hereby notifies ${tenant} that the Building and/or the Property may contain chemicals known to the State of ${state} to cause cancer, birth defects, or other reproductive harm.

19.6 SURVIVAL. The obligations of the parties under this Article shall survive the expiration or earlier termination of this Lease.`;
    },
  },

  /* ARTICLE 20 — ADA COMPLIANCE */
  {
    id: 'sec-20',
    title: 'ARTICLE 20 — AMERICANS WITH DISABILITIES ACT COMPLIANCE',
    level: 1,
    pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `20.1 LANDLORD'S ADA OBLIGATIONS. ${landlord} shall be responsible for ensuring that the Common Areas and the Building's exterior are in compliance with the Americans with Disabilities Act of 1990, as amended (the "ADA"), and all regulations promulgated thereunder, as well as all applicable state and local accessibility requirements.

20.2 TENANT'S ADA OBLIGATIONS. ${tenant} shall be responsible for ensuring that the Premises and ${tenant}'s use thereof comply with the ADA and all applicable state and local accessibility requirements. ${tenant} shall, at its sole cost and expense, make any modifications to the Premises required by the ADA or other accessibility laws as a result of ${tenant}'s specific use of the Premises or any Alterations made by or on behalf of ${tenant}.

20.3 ADA NOTICES. Each party shall promptly notify the other of any claim, demand, or notice received from any governmental authority alleging a violation of the ADA or any other accessibility law with respect to the Premises, the Building, or the Property.`;
    },
  },

  /* ARTICLE 21 — SIGNAGE */
  {
    id: 'sec-21',
    title: 'ARTICLE 21 — SIGNAGE RIGHTS',
    level: 1,
    pageEstimate: 0.5,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `21.1 BUILDING SIGNAGE. ${tenant} shall have the right to install ${tenant}'s name and/or logo on the Building's tenant directory and adjacent to the entry door of the Premises, subject to ${landlord}'s approval as to design, size, and placement. All signage shall comply with applicable Laws and the Building's signage criteria.

21.2 SUITE SIGNAGE. ${landlord} shall provide, at ${landlord}'s expense, Building-standard suite identification signage at the entrance to the Premises.

21.3 REMOVAL. Upon expiration or termination of this Lease, ${tenant} shall remove all signage installed by ${tenant} and restore the affected areas to their condition prior to installation, at ${tenant}'s expense.`;
    },
  },

  /* ARTICLE 22 — PARKING */
  {
    id: 'sec-22',
    title: 'ARTICLE 22 — PARKING',
    level: 1,
    pageEstimate: 0.5,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `22.1 PARKING ALLOCATION. ${landlord} shall provide ${tenant} with a non-exclusive right to use ___ unreserved parking spaces and ___ reserved parking spaces in the Building's parking facility, at the prevailing monthly parking rate. ${tenant}'s parking allocation shall be proportionate to ${tenant}'s Share.

22.2 PARKING RULES. ${tenant} and its employees shall comply with all parking rules and regulations established by ${landlord} from time to time. ${landlord} reserves the right to designate the location of parking spaces available to ${tenant}.

22.3 PARKING CHARGES. Monthly parking charges are in addition to Rent and shall be payable as Additional Rent on the first day of each calendar month.`;
    },
  },

  /* ARTICLE 23 — UTILITIES */
  {
    id: 'sec-23',
    title: 'ARTICLE 23 — UTILITIES AND SERVICES',
    level: 1,
    pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `23.1 BUILDING SERVICES. ${landlord} shall provide the following services to the Premises during Building Standard Hours (Monday through Friday, 8:00 a.m. to 6:00 p.m., excluding holidays):

(a) HVAC sufficient to maintain comfortable temperature conditions;
(b) Electricity for normal office lighting and equipment;
(c) Water for normal restroom use;
(d) Elevator service (passenger and freight, as applicable);
(e) Janitorial services five (5) days per week;
(f) Common Area maintenance.

23.2 AFTER-HOURS SERVICES. ${tenant} may request HVAC and other Building services outside of Building Standard Hours, subject to a per-hour charge established by ${landlord} from time to time.

23.3 EXCESS USAGE. If ${tenant}'s use of any utility exceeds normal office usage (including but not limited to server rooms, data centers, or high-density equipment), ${landlord} may install separate meters and bill ${tenant} directly for such excess consumption.

23.4 INTERRUPTION. ${landlord} shall not be liable for any interruption or failure of utility services caused by circumstances beyond ${landlord}'s reasonable control. If any interruption continues for more than five (5) consecutive business days, Rent shall be abated proportionately until services are restored.`;
    },
  },

  /* ARTICLE 24 — RULES & REGULATIONS */
  {
    id: 'sec-24',
    title: 'ARTICLE 24 — RULES AND REGULATIONS',
    level: 1,
    pageEstimate: 0.5,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `24.1 RULES. ${tenant} shall comply with the rules and regulations attached hereto as Exhibit E, as ${landlord} may reasonably amend from time to time. ${landlord} shall enforce such rules equitably among all tenants of the Building.

24.2 CONFLICT. In the event of any conflict between the rules and regulations and the terms of this Lease, the terms of this Lease shall control.`;
    },
  },

  /* ARTICLE 25 — NOTICES */
  {
    id: 'sec-25',
    title: 'ARTICLE 25 — NOTICES',
    level: 1,
    pageEstimate: 0.5,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `25.1 FORM OF NOTICE. All notices, demands, consents, approvals, and other communications required or permitted under this Lease shall be in writing and shall be deemed duly given: (a) upon personal delivery; (b) one (1) business day after deposit with a nationally recognized overnight courier service; or (c) three (3) business days after deposit in the United States mail, postage prepaid, certified or registered mail, return receipt requested, addressed as follows:

If to ${landlord}:
[${landlord}'s address]
Attention: [Property Manager]
With a copy to: [${landlord}'s counsel]

If to ${tenant}:
[${tenant}'s address]
Attention: [${tenant}'s contact]
With a copy to: [${tenant}'s counsel]

25.2 CHANGE OF ADDRESS. Either party may change its address for notice purposes by written notice to the other party.`;
    },
  },

  /* ARTICLE 26 — GOVERNING LAW */
  {
    id: 'sec-26',
    title: 'ARTICLE 26 — GOVERNING LAW AND JURISDICTION',
    level: 1,
    pageEstimate: 0.5,
    contentGenerator: (a: IntakeAnswers) => {
      const state = gen(a, 'q2', 'California');
      return `26.1 GOVERNING LAW. This Lease shall be governed by and construed in accordance with the laws of the State of ${state}, without regard to its conflict of laws principles.

26.2 JURISDICTION AND VENUE. Any action or proceeding arising out of or relating to this Lease shall be brought exclusively in the state or federal courts located in the State of ${state}, and each party hereby consents to the personal jurisdiction of such courts.

26.3 JURY TRIAL WAIVER. EACH PARTY HEREBY WAIVES ITS RIGHT TO A JURY TRIAL IN ANY ACTION OR PROCEEDING ARISING OUT OF OR RELATING TO THIS LEASE.`;
    },
  },

  /* ARTICLE 27 — MISCELLANEOUS */
  {
    id: 'sec-27',
    title: 'ARTICLE 27 — MISCELLANEOUS PROVISIONS',
    level: 1,
    pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `27.1 ENTIRE AGREEMENT. This Lease, including all Exhibits and Addenda attached hereto, constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior agreements, negotiations, representations, warranties, and understandings, whether oral or written, between the parties relating to the leasing of the Premises.

27.2 AMENDMENTS. This Lease may not be amended, modified, or supplemented except by a written instrument executed by both parties.

27.3 WAIVER. No waiver by either party of any breach or default hereunder shall be deemed a waiver of any subsequent breach or default. No waiver shall be effective unless in writing and signed by the waiving party.

27.4 SEVERABILITY. If any provision of this Lease is held to be invalid, illegal, or unenforceable, the validity, legality, and enforceability of the remaining provisions shall not be affected or impaired thereby.

27.5 SUCCESSORS AND ASSIGNS. This Lease shall be binding upon and inure to the benefit of the parties hereto and their respective heirs, executors, administrators, successors, and assigns, subject to the provisions of Article 13 (Assignment and Subletting).

27.6 HEADINGS. The headings in this Lease are for convenience of reference only and shall not affect the interpretation of this Lease.

27.7 COUNTERPARTS. This Lease may be executed in any number of counterparts, each of which shall be deemed an original and all of which together shall constitute one and the same instrument.

27.8 BROKER'S COMMISSION. Each party represents and warrants to the other that it has not dealt with any real estate broker, agent, or finder in connection with this Lease, except for [Broker Name(s)]. ${landlord} shall pay the commission due to such broker(s) pursuant to a separate agreement. Each party shall indemnify and hold harmless the other from any claims for brokerage commissions or finder's fees arising from a breach of this representation.

27.9 FORCE MAJEURE. Neither party shall be liable for any delay or failure to perform its obligations under this Lease (other than ${tenant}'s obligation to pay Rent) to the extent such delay or failure is caused by fire, earthquake, flood, epidemic, pandemic, government restrictions, labor disputes, shortage of materials, acts of God, or other causes beyond the party's reasonable control.

27.10 TIME OF THE ESSENCE. Time is of the essence with respect to all provisions of this Lease.

27.11 AUTHORITY. Each party represents and warrants that it has the power and authority to execute and deliver this Lease and to perform its obligations hereunder, and that the execution and delivery of this Lease has been duly authorized by all necessary corporate or entity action.`;
    },
  },

  /* PERSONAL GUARANTY */
  {
    id: 'sec-28',
    title: 'ARTICLE 28 — PERSONAL GUARANTY',
    level: 1,
    pageEstimate: 1,
    conditional: { questionId: 'q13', values: ['No'], include: false },
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `28.1 GUARANTY. The undersigned individual(s) (the "Guarantor(s)"), as a material inducement to ${landlord} to enter into this Lease with ${tenant}, hereby unconditionally and irrevocably guarantee to ${landlord} the full and faithful performance by ${tenant} of all terms, covenants, and conditions of this Lease, including the prompt payment of all Rent and other sums due thereunder.

28.2 SCOPE OF GUARANTY. This Guaranty is a guaranty of payment and performance, and not of collection. ${landlord} may proceed directly against the Guarantor(s) without first pursuing any remedy against ${tenant} or any security held by ${landlord}.

28.3 WAIVERS BY GUARANTOR. The Guarantor(s) hereby waive: (a) notice of acceptance of this Guaranty; (b) notice of any amendment to this Lease; (c) notice of default by ${tenant}; (d) demand for payment or performance; (e) any right to require ${landlord} to proceed against ${tenant} or any security before proceeding against the Guarantor(s); and (f) any defense based on the statute of limitations.

28.4 TERM OF GUARANTY. This Guaranty shall remain in full force and effect throughout the Term and any extensions or renewals thereof, until all of ${tenant}'s obligations under this Lease have been fully performed and satisfied.`;
    },
  },

  /* EXHIBIT A — FLOOR PLAN */
  {
    id: 'sec-29',
    title: 'EXHIBIT A — FLOOR PLAN AND PREMISES DESCRIPTION',
    level: 1,
    pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const sqft = gen(a, 'q15', '4,200');
      const address = gen(a, 'q16', '100 Main Street');
      return `EXHIBIT A
FLOOR PLAN AND PREMISES DESCRIPTION

The Premises consists of approximately ${sqft} rentable square feet located at ${address}, as outlined on the floor plan below.

[FLOOR PLAN TO BE ATTACHED]

The rentable square footage has been calculated in accordance with the BOMA Standard Method for Measuring Floor Area in Office Buildings (ANSI/BOMA Z65.1-2017).

The Premises includes:
• Access to the building lobby and common corridors
• Shared access to restroom facilities on the applicable floor(s)
• Access to the building's freight and passenger elevators
• Access to the building's loading dock and service areas during reasonable hours

The exact boundaries of the Premises are depicted on the floor plan and are subject to field verification.`;
    },
  },

  /* EXHIBIT B — RENT SCHEDULE */
  {
    id: 'sec-30',
    title: 'EXHIBIT B — RENT SCHEDULE',
    level: 1,
    pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const rent = gen(a, 'q6', '$18,500');
      const escalation = gen(a, 'q7', '3% Fixed');
      const term = gen(a, 'q3', '5 Years');
      const termYears = parseInt(term) || 5;
      const baseAmount = parseFloat(rent.replace(/[^0-9.]/g, '')) || 18500;
      const rate = escalation.includes('3%') ? 0.03 : escalation.includes('4%') ? 0.04 : 0;

      const rows = Array.from({ length: termYears }, (_, i) => {
        const monthly = baseAmount * Math.pow(1 + rate, i);
        const annual = monthly * 12;
        return `Lease Year ${i + 1}:    $${monthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} monthly    |    $${annual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} annually`;
      }).join('\n');

      return `EXHIBIT B
RENT SCHEDULE

Base Rent: ${rent} per month
Escalation: ${escalation}
Term: ${term}

RENT SCHEDULE:

${rows}

All amounts are exclusive of Operating Expenses, Taxes, and Insurance (which are payable as Additional Rent pursuant to Article 5).

The Rent Commencement Date is the Commencement Date (or as otherwise specified in Section 4.6).`;
    },
  },

  /* EXHIBIT C — WORK LETTER */
  {
    id: 'sec-31',
    title: 'EXHIBIT C — WORK LETTER / TENANT IMPROVEMENT AGREEMENT',
    level: 1,
    pageEstimate: 1.5,
    conditional: { questionId: 'q10', values: [''], include: false },
    contentGenerator: (a: IntakeAnswers) => {
      const tia = gen(a, 'q10', '$45/sqft');
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      return `EXHIBIT C
WORK LETTER — TENANT IMPROVEMENT AGREEMENT

1. TENANT IMPROVEMENT ALLOWANCE. ${landlord} shall provide a Tenant Improvement Allowance of ${tia} per rentable square foot, as further described in Article 9 of the Lease.

2. PLANS AND SPECIFICATIONS. ${tenant} shall, at ${tenant}'s expense, engage a licensed architect to prepare preliminary space plans and construction drawings for the Tenant Improvements. All plans shall be submitted to ${landlord} for approval within thirty (30) days after the date of this Lease.

3. LANDLORD'S APPROVAL. ${landlord} shall review and approve or disapprove ${tenant}'s plans within ten (10) business days after receipt. If ${landlord} disapproves, ${landlord} shall provide specific written reasons, and ${tenant} shall revise and resubmit within ten (10) business days.

4. CONSTRUCTION. Upon approval of the plans, ${tenant} shall retain a licensed general contractor approved by ${landlord} to construct the Tenant Improvements. All work shall comply with applicable building codes and shall be performed during hours approved by ${landlord}.

5. SCHEDULE. ${tenant} shall use commercially reasonable efforts to substantially complete the Tenant Improvements within ${gen(a, 'q19', '120')} days after ${landlord}'s delivery of the Premises.

6. CHANGE ORDERS. Any changes to the approved plans that result in an increase in cost shall require ${landlord}'s prior written approval and shall be at ${tenant}'s sole expense to the extent such costs exceed the TI Allowance.

7. INSPECTION. ${landlord} shall have the right to inspect the work at reasonable intervals during construction to verify compliance with the approved plans.

8. PUNCH LIST. Upon substantial completion, ${landlord} and ${tenant} shall jointly inspect the Premises and prepare a punch list of minor items requiring completion or correction.`;
    },
  },

  /* SIGNATURE BLOCKS */
  {
    id: 'sec-32',
    title: 'SIGNATURE BLOCKS',
    level: 1,
    pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const tenant = gen(a, 'q4', 'Tenant');
      const landlord = gen(a, 'q5', 'Landlord');
      const state = gen(a, 'q2', 'California');
      const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      return `IN WITNESS WHEREOF, the parties hereto have executed this Commercial Lease Agreement as of the date first set forth above.


LANDLORD:

${landlord}

By: ________________________________
Name: ${gen(a, 'q20', '________________________________')}
Title: ${gen(a, 'q21', '________________________________')}
Date: ${date}


TENANT:

${tenant}

By: ________________________________
Name: ${gen(a, 'q22', '________________________________')}
Title: ${gen(a, 'q23', '________________________________')}
Date: ${date}


ACKNOWLEDGMENT

STATE OF ${state.toUpperCase()}

On this ${date}, before me, a Notary Public in and for said State, personally appeared ${gen(a, 'q20', 'the authorized signatory')}, known to me (or proved to me on the basis of satisfactory evidence) to be the person(s) whose name(s) is/are subscribed to the within instrument and acknowledged to me that he/she/they executed the same in his/her/their authorized capacity(ies), and that by his/her/their signature(s) on the instrument the person(s), or the entity upon behalf of which the person(s) acted, executed the instrument.

WITNESS my hand and official seal.


________________________________
Notary Public`;
    },
  },
];

export const commercialLeaseTemplate: DocumentTemplateDef = {
  id: 'dt1',
  name: 'Commercial Lease Agreement',
  category: 'Real Estate',
  description: 'Full commercial lease with rent schedules, CAM charges, build-out provisions, and tenant improvements',
  pages: '28–42',
  sections: sectionSchemas.length,
  avgGenerationTime: '2.4 min',
  questions,
  schema: sectionSchemas,
};

