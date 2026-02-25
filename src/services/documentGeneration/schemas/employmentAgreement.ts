import { DocumentTemplateDef, IntakeAnswers } from '../types';

function gen(a: IntakeAnswers, id: string, fallback: string): string {
  return a[id] || fallback;
}

function todayFormatted(): string {
  const d = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const questions = [
  { id: 'q1', question: 'Employee Full Name', type: 'text' as const, required: true, placeholder: 'e.g. Jane Smith' },
  { id: 'q2', question: 'Company Name', type: 'text' as const, required: true, placeholder: 'e.g. Acme Technologies, Inc.' },
  { id: 'q3', question: 'Job Title', type: 'text' as const, required: true, placeholder: 'e.g. Senior Software Engineer' },
  { id: 'q4', question: 'Department', type: 'text' as const, required: true, placeholder: 'e.g. Engineering' },
  { id: 'q5', question: 'Employment Type', type: 'select' as const, options: ['Full-Time', 'Part-Time', 'Contract'], required: true },
  { id: 'q6', question: 'Compensation (Annual)', type: 'text' as const, required: true, placeholder: 'e.g. $185,000' },
  { id: 'q7', question: 'Equity / Stock Options', type: 'text' as const, required: false, placeholder: 'e.g. 10,000 options, 4-year vest' },
  { id: 'q8', question: 'Start Date', type: 'text' as const, required: true, placeholder: 'e.g. March 1, 2026', defaultValue: todayFormatted() },
  { id: 'q9', question: 'Work Location', type: 'select' as const, options: ['On-Site', 'Remote', 'Hybrid'], required: true },
  { id: 'q10', question: 'Governing State', type: 'select' as const, options: ['California', 'New York', 'Texas', 'Washington', 'Massachusetts', 'Other'], required: true },
  { id: 'q11', question: 'At-Will Employment', type: 'toggle' as const, options: ['Yes', 'No'], required: true },
  { id: 'q12', question: 'Include Non-Compete', type: 'toggle' as const, options: ['Yes', 'No'], required: true },
  { id: 'q13', question: 'Signing Bonus', type: 'text' as const, required: false, placeholder: 'e.g. $15,000' },
  { id: 'q14', question: 'PTO Policy', type: 'select' as const, options: ['Unlimited PTO', '15 Days', '20 Days', '25 Days'], required: true },
  { id: 'q15', question: 'Severance Terms', type: 'select' as const, options: ['None', '2 Weeks per Year', '1 Month per Year', '3 Months Fixed', '6 Months Fixed'], required: false },
  { id: 'q16', question: 'Annual Bonus (% of Base Salary)', type: 'select' as const, options: ['10%', '15%', '20%', '25%', '30%', 'N/A — No Bonus'], required: true, helpText: 'Target bonus as a percentage of base salary' },
  { id: 'q17', question: 'Health Insurance — Company Pays (Employee)', type: 'select' as const, options: ['100%', '90%', '80%', '75%', '50%'], required: true, helpText: 'Percentage of health premium the company covers for the employee' },
  { id: 'q18', question: 'Health Insurance — Company Pays (Dependents)', type: 'select' as const, options: ['100%', '90%', '80%', '75%', '50%', '0%'], required: true, helpText: 'Percentage of health premium the company covers for dependents' },
  { id: 'q19', question: '401(k) Company Match', type: 'select' as const, options: ['3%', '4%', '5%', '6%', '100% up to 6%', 'No Match'], required: true, helpText: 'Company 401(k) matching contribution' },
  { id: 'q20', question: 'Reporting Manager Name', type: 'text' as const, required: true, placeholder: 'e.g. Michael Chen, VP of Engineering' },
  { id: 'q21', question: 'Company Signatory Name', type: 'text' as const, required: true, placeholder: 'e.g. Sarah Johnson', helpText: 'Person signing on behalf of the company' },
  { id: 'q22', question: 'Company Signatory Title', type: 'text' as const, required: true, placeholder: 'e.g. Chief Executive Officer', helpText: 'Title of the company signatory' },
  { id: 'q23', question: 'Office Address', type: 'text' as const, required: false, placeholder: 'e.g. 100 Main Street, Suite 400, San Francisco, CA 94105', helpText: 'Required if work location is On-Site or Hybrid' },
  { id: 'q24', question: 'Employment Term (Years)', type: 'select' as const, options: ['1 Year', '2 Years', '3 Years', '5 Years'], required: false, helpText: 'Only applies if At-Will Employment is set to No' },
];

const sectionSchemas = [
  {
    id: 'emp-1', title: 'EMPLOYMENT AGREEMENT', level: 1, pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const employee = gen(a, 'q1', 'Employee');
      const company = gen(a, 'q2', 'Company');
      const state = gen(a, 'q10', 'California');
      return `EMPLOYMENT AGREEMENT

This Employment Agreement (this "Agreement") is entered into as of ${gen(a, 'q8', 'the Start Date')}, by and between:

EMPLOYER: ${company}, a ${state} corporation (the "Company");

EMPLOYEE: ${employee} (the "Employee").

WHEREAS, the Company desires to employ the Employee, and the Employee desires to accept such employment, upon the terms and conditions set forth herein;

NOW, THEREFORE, in consideration of the mutual covenants and agreements herein contained, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties agree as follows:`;
    },
  },
  {
    id: 'emp-2', title: 'SECTION 1 — POSITION AND DUTIES', level: 1, pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const employee = gen(a, 'q1', 'Employee');
      const company = gen(a, 'q2', 'Company');
      const title = gen(a, 'q3', 'Senior Software Engineer');
      const department = gen(a, 'q4', 'Engineering');
      const location = gen(a, 'q9', 'Hybrid');
      return `1.1 POSITION. The Company hereby employs the Employee as ${title} in the ${department} department, reporting to ${gen(a, 'q20', 'the designated supervisor')}. The Employee accepts such employment upon the terms and conditions set forth in this Agreement.

1.2 DUTIES. The Employee shall perform all duties and responsibilities customarily associated with the position of ${title}, and such other duties as may be reasonably assigned by the Company from time to time. The Employee shall devote substantially all of the Employee's business time, attention, skill, and efforts to the performance of the Employee's duties.

1.3 WORK LOCATION. The Employee's primary work location shall be ${location === 'Remote' ? 'remote, with occasional travel to the Company\'s offices as reasonably required' : location === 'Hybrid' ? `a hybrid arrangement, with the Employee expected to be present at the Company's offices${gen(a, 'q23', '') ? ' located at ' + gen(a, 'q23', '') : ''} a minimum of three (3) days per week` : `the Company's offices located at ${gen(a, 'q23', 'the Company\'s principal place of business')}`}.

1.4 OUTSIDE ACTIVITIES. During the term of employment, the Employee shall not, without the prior written consent of the Company, engage in any other employment, consulting, or business activity that would conflict with the Employee's obligations under this Agreement or interfere with the Employee's ability to perform duties.

1.5 COMPANY POLICIES. The Employee shall comply with all Company policies, procedures, and codes of conduct as may be adopted or modified from time to time, including the Employee Handbook.`;
    },
  },
  {
    id: 'emp-3', title: 'SECTION 2 — COMPENSATION AND BENEFITS', level: 1, pageEstimate: 2,
    contentGenerator: (a: IntakeAnswers) => {
      const salary = gen(a, 'q6', '$185,000');
      const equity = gen(a, 'q7', '');
      const bonus = gen(a, 'q13', '');
      const pto = gen(a, 'q14', '20 Days');
      const employee = gen(a, 'q1', 'Employee');
      const company = gen(a, 'q2', 'Company');

      let equitySection = '';
      if (equity) {
        equitySection = `\n\n2.3 EQUITY COMPENSATION. Subject to approval by the Company's Board of Directors and the terms of the Company's Equity Incentive Plan, the Employee shall be granted ${equity}. The equity grant shall be subject to the Company's standard vesting schedule and the terms of a separate Stock Option Agreement or Restricted Stock Unit Agreement, as applicable. Vesting shall commence on the Start Date and shall be contingent upon the Employee's continued employment with the Company.`;
      }

      let bonusSection = '';
      if (bonus) {
        bonusSection = `\n\n2.4 SIGNING BONUS. The Company shall pay the Employee a one-time signing bonus of ${bonus}, payable within thirty (30) days of the Start Date. If the Employee voluntarily terminates employment or is terminated for Cause within twelve (12) months of the Start Date, the Employee shall repay the signing bonus on a prorated basis.`;
      }

      const bonusPct = gen(a, 'q16', '15%');
      const healthEmployee = gen(a, 'q17', '80%');
      const healthDependents = gen(a, 'q18', '50%');
      const match401k = gen(a, 'q19', '4%');

      let bonusClause = '';
      if (bonusPct !== 'N/A — No Bonus') {
        bonusClause = `\n\n2.2 BONUS. The Employee shall be eligible to participate in the Company's annual bonus program. The target bonus shall be ${bonusPct} of Base Salary, subject to achievement of individual and company performance goals as determined by the Company. Bonus payments are discretionary and are not guaranteed.`;
      } else {
        bonusClause = `\n\n2.2 BONUS. The Employee shall be eligible to participate in any discretionary bonus program that the Company may establish from time to time. Bonus eligibility and amounts, if any, shall be determined by the Company in its sole discretion.`;
      }

      return `2.1 BASE SALARY. The Company shall pay the Employee an annual base salary of ${salary} ("Base Salary"), payable in accordance with the Company's standard payroll schedule, less applicable withholdings and deductions. The Base Salary shall be reviewed annually by the Company and may be adjusted at the Company's sole discretion.${bonusClause}${equitySection}${bonusSection}

2.5 BENEFITS. The Employee shall be eligible to participate in all employee benefit programs offered by the Company to similarly situated employees, including:

(a) HEALTH INSURANCE: Medical, dental, and vision insurance, with the Company paying ${healthEmployee} of the premium for the Employee (and ${healthDependents} for dependents);

(b) RETIREMENT: Participation in the Company's 401(k) plan, ${match401k === 'No Match' ? 'without a company matching contribution at this time' : `with the Company matching contributions up to ${match401k} of the Employee's eligible compensation`};

(c) PAID TIME OFF: ${pto === 'Unlimited PTO' ? 'Unlimited paid time off, subject to the Company\'s unlimited PTO policy and manager approval' : `${pto} of paid time off per year, accruing on a per-pay-period basis`};

(d) HOLIDAYS: All Company-designated holidays (typically 10-12 per year);

(e) SICK LEAVE: In accordance with applicable state and local laws;

(f) LIFE AND DISABILITY INSURANCE: Company-paid basic life and long-term disability insurance;

(g) OTHER BENEFITS: Such other benefits as the Company may offer from time to time.

2.6 EXPENSE REIMBURSEMENT. The Company shall reimburse the Employee for all reasonable business expenses incurred in the performance of the Employee's duties, in accordance with the Company's expense reimbursement policy.`;
    },
  },
  {
    id: 'emp-4', title: 'SECTION 3 — AT-WILL EMPLOYMENT / TERM', level: 1, pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const atWill = gen(a, 'q11', 'Yes');
      const employee = gen(a, 'q1', 'Employee');
      const company = gen(a, 'q2', 'Company');
      if (atWill === 'Yes') {
        return `3.1 AT-WILL EMPLOYMENT. The Employee's employment with the Company is "at will." This means that either the Employee or the Company may terminate the employment relationship at any time, with or without cause, and with or without notice. Nothing in this Agreement shall be construed as creating a contract of employment for any specific period.

3.2 NO MODIFICATION. The at-will nature of the Employee's employment can only be modified by a written agreement signed by the Employee and an authorized officer of the Company specifically referencing this Section and expressly altering the at-will status.`;
      }
      const termYears = gen(a, 'q24', '2 Years').replace(/\s*years?/i, '');
      return `3.1 TERM OF EMPLOYMENT. The Employee's employment shall commence on the Start Date and shall continue for a period of ${termYears} (${termYears === '1' ? 'one' : termYears === '2' ? 'two' : termYears === '3' ? 'three' : 'five'}) year${termYears === '1' ? '' : 's'} (the "Initial Term"), unless earlier terminated as provided herein. Following the Initial Term, employment shall automatically renew for successive one (1) year periods unless either party provides at least ninety (90) days' written notice of non-renewal.

3.2 TERMINATION DURING TERM. During the Initial Term, employment may only be terminated as set forth in Section 5 of this Agreement.`;
    },
  },
  {
    id: 'emp-5', title: 'SECTION 4 — CONFIDENTIALITY AND PROPRIETARY INFORMATION', level: 1, pageEstimate: 2,
    contentGenerator: (a: IntakeAnswers) => {
      const employee = gen(a, 'q1', 'Employee');
      const company = gen(a, 'q2', 'Company');
      return `4.1 CONFIDENTIAL INFORMATION. The Employee acknowledges that during employment, the Employee will have access to and become acquainted with Confidential Information of the Company. "Confidential Information" includes, but is not limited to: trade secrets, proprietary data, customer lists, business plans, financial information, product roadmaps, source code, algorithms, technical specifications, marketing strategies, pricing information, and any other information not generally known to the public.

4.2 NON-DISCLOSURE. The Employee agrees that, both during and after employment, the Employee shall not directly or indirectly disclose, publish, or use any Confidential Information for any purpose other than the performance of the Employee's duties, without the prior written consent of the Company.

4.3 INVENTION ASSIGNMENT. The Employee agrees that all inventions, discoveries, improvements, ideas, designs, works of authorship, and trade secrets (collectively, "Inventions") that the Employee conceives, develops, or reduces to practice during employment, whether or not during working hours, that: (a) relate to the Company's business or research; (b) result from the use of Company resources; or (c) are conceived or developed during the performance of the Employee's duties, shall be the sole and exclusive property of the Company.

4.4 WORKS MADE FOR HIRE. The Employee acknowledges that all works of authorship created by the Employee within the scope of employment are "works made for hire" under the Copyright Act. To the extent any work does not qualify as a work made for hire, the Employee hereby assigns all rights therein to the Company.

4.5 PRIOR INVENTIONS. The Employee has disclosed on Exhibit A all Inventions that the Employee owns or has an interest in prior to the commencement of employment ("Prior Inventions"). The Employee agrees not to incorporate any Prior Inventions into Company work without prior written consent.

4.6 RETURN OF MATERIALS. Upon termination of employment, the Employee shall immediately return all Company property, including documents, files, equipment, devices, access cards, and all copies of Confidential Information.

4.7 POST-EMPLOYMENT OBLIGATIONS. The Employee's obligations under this Section shall survive the termination of employment indefinitely with respect to trade secrets, and for a period of five (5) years with respect to other Confidential Information.`;
    },
  },
  {
    id: 'emp-6', title: 'SECTION 5 — TERMINATION', level: 1, pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const employee = gen(a, 'q1', 'Employee');
      const company = gen(a, 'q2', 'Company');
      const severance = gen(a, 'q15', 'None');
      let severanceClause = '';
      if (severance !== 'None' && severance) {
        severanceClause = `\n\n5.5 SEVERANCE. In the event of termination without Cause or resignation for Good Reason, and subject to the Employee executing and not revoking a general release of claims in a form acceptable to the Company within twenty-one (21) days of termination, the Company shall provide the Employee with severance pay equal to ${severance} of Base Salary, payable in accordance with the Company's regular payroll schedule. The Company shall also continue the Employee's health insurance benefits during the severance period (or provide COBRA premium reimbursement).`;
      }
      return `5.1 TERMINATION BY COMPANY FOR CAUSE. The Company may terminate the Employee's employment immediately for "Cause," which shall mean: (a) the Employee's material breach of this Agreement; (b) the Employee's conviction of, or plea of guilty or no contest to, a felony; (c) the Employee's willful misconduct or gross negligence in the performance of duties; (d) the Employee's fraud, dishonesty, or embezzlement; (e) the Employee's violation of Company policies; or (f) the Employee's failure to perform assigned duties after written notice and a reasonable opportunity to cure.

5.2 TERMINATION WITHOUT CAUSE. The Company may terminate the Employee's employment without Cause upon thirty (30) days' written notice (or pay in lieu of notice).

5.3 RESIGNATION. The Employee may resign at any time upon thirty (30) days' written notice. The Company may, at its discretion, waive some or all of the notice period and accelerate the termination date.

5.4 TERMINATION FOR GOOD REASON. The Employee may terminate employment for "Good Reason" if: (a) there is a material reduction in Base Salary (greater than 10%); (b) there is a material diminution in duties or responsibilities; (c) the Company requires relocation of more than 50 miles; or (d) the Company materially breaches this Agreement — provided that the Employee gives the Company thirty (30) days' written notice and an opportunity to cure.${severanceClause}

5.6 FINAL PAY. Upon termination for any reason, the Company shall pay the Employee all earned but unpaid Base Salary, accrued but unused vacation (if applicable under Company policy), and any other amounts required by applicable law, in accordance with applicable state law requirements.`;
    },
  },
  {
    id: 'emp-7', title: 'SECTION 6 — RESTRICTIVE COVENANTS', level: 1, pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const nonCompete = gen(a, 'q12', 'No');
      const state = gen(a, 'q10', 'California');
      const employee = gen(a, 'q1', 'Employee');
      const company = gen(a, 'q2', 'Company');

      let nonCompeteClause = '';
      if (nonCompete === 'Yes' && !state.includes('California')) {
        nonCompeteClause = `6.1 NON-COMPETE. During the term of employment and for a period of twelve (12) months following termination (the "Restricted Period"), the Employee shall not, directly or indirectly, engage in, own, manage, operate, control, be employed by, or provide services to any business that competes with the Company's business, within a fifty (50) mile radius of any Company office or in any market where the Company conducts business.

6.2 REASONABLENESS. The Employee acknowledges that the restrictions in this Section are reasonable and necessary to protect the Company's legitimate business interests, including its Confidential Information, customer relationships, and goodwill.

`;
      } else if (state.includes('California')) {
        nonCompeteClause = `6.1 CALIFORNIA LAW. The parties acknowledge that California Business and Professions Code Section 16600 generally prohibits non-compete agreements. Accordingly, this Agreement does not contain a non-compete covenant. However, the Employee remains bound by the confidentiality and non-solicitation obligations set forth herein, which are enforceable under California law.

`;
      }

      return `${nonCompeteClause}6.3 NON-SOLICITATION OF EMPLOYEES. During employment and for a period of twelve (12) months following termination, the Employee shall not, directly or indirectly, solicit, recruit, or hire any employee or contractor of the Company, or encourage any such person to leave the Company's employment or engagement.

6.4 NON-SOLICITATION OF CUSTOMERS. During employment and for a period of twelve (12) months following termination, the Employee shall not, directly or indirectly, solicit or attempt to solicit business from any customer or prospective customer of the Company with whom the Employee had material contact during the last twelve (12) months of employment.

6.5 INJUNCTIVE RELIEF. The Employee acknowledges that a breach of the restrictive covenants in this Section would cause irreparable harm to the Company, and that monetary damages would be inadequate. Accordingly, the Company shall be entitled to seek injunctive relief in addition to any other remedies available at law or in equity.`;
    },
  },
  {
    id: 'emp-8', title: 'SECTION 7 — GENERAL PROVISIONS', level: 1, pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const state = gen(a, 'q10', 'California');
      const employee = gen(a, 'q1', 'Employee');
      const company = gen(a, 'q2', 'Company');
      return `7.1 GOVERNING LAW. This Agreement shall be governed by and construed in accordance with the laws of the State of ${state}.

7.2 ENTIRE AGREEMENT. This Agreement constitutes the entire agreement between the parties regarding the Employee's employment and supersedes all prior agreements and understandings.

7.3 AMENDMENTS. This Agreement may not be amended except by a written instrument signed by both parties.

7.4 SEVERABILITY. If any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall continue in full force and effect.

7.5 WAIVER. The failure of either party to enforce any provision shall not constitute a waiver of such provision.

7.6 NOTICES. All notices shall be in writing and delivered personally, by overnight courier, or by certified mail.

7.7 COUNTERPARTS. This Agreement may be executed in counterparts, each of which shall be deemed an original.

7.8 DISPUTE RESOLUTION. Any dispute arising under this Agreement shall be resolved through binding arbitration in ${state}, in accordance with the rules of the American Arbitration Association.

7.9 SECTION 409A COMPLIANCE. This Agreement is intended to comply with Section 409A of the Internal Revenue Code. Any payments subject to Section 409A shall be made in accordance with Section 409A and applicable Treasury Regulations.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first set forth above.


${company.toUpperCase()}

By: ________________________________
Name: ${gen(a, 'q21', '________________________________')}
Title: ${gen(a, 'q22', '________________________________')}
Date: ${todayFormatted()}


EMPLOYEE:

________________________________
${employee}
Date: ${todayFormatted()}`;
    },
  },
];

export const employmentTemplate: DocumentTemplateDef = {
  id: 'dt6',
  name: 'Employment Agreement',
  category: 'HR',
  description: 'Full employment contract with compensation, equity, non-compete, confidentiality, and benefits schedules',
  pages: '12–20',
  sections: sectionSchemas.length,
  avgGenerationTime: '1.6 min',
  questions,
  schema: sectionSchemas,
};

