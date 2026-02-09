import { DocumentTemplateDef, IntakeAnswers } from '../types';

function gen(a: IntakeAnswers, id: string, fallback: string): string {
  return a[id] || fallback;
}

const questions = [
  { id: 'q1', question: 'Client Company Name', type: 'text' as const, required: true, placeholder: 'e.g. Enterprise Corp.' },
  { id: 'q2', question: 'Service Provider Name', type: 'text' as const, required: true, placeholder: 'e.g. TechServices LLC' },
  { id: 'q3', question: 'Governing State', type: 'select' as const, options: ['California', 'New York', 'Texas', 'Delaware', 'Florida', 'Illinois'], required: true },
  { id: 'q4', question: 'Agreement Term', type: 'select' as const, options: ['1 Year', '2 Years', '3 Years', '5 Years', 'Perpetual (with termination clause)'], required: true },
  { id: 'q5', question: 'Service Type', type: 'select' as const, options: ['Software Development', 'IT Consulting', 'Managed Services', 'Professional Services', 'Staff Augmentation', 'SaaS'], required: true },
  { id: 'q6', question: 'Payment Terms', type: 'select' as const, options: ['Net 30', 'Net 45', 'Net 60', 'Milestone-Based', 'Monthly Retainer'], required: true },
  { id: 'q7', question: 'Liability Cap', type: 'text' as const, required: true, placeholder: 'e.g. $1,000,000 or 12 months fees' },
  { id: 'q8', question: 'Include SLA Terms', type: 'toggle' as const, options: ['Yes', 'No'], required: true },
  { id: 'q9', question: 'IP Ownership', type: 'select' as const, options: ['Client Owns All', 'Provider Retains Background IP', 'Joint Ownership', 'Work-for-Hire'], required: true },
  { id: 'q10', question: 'Confidentiality Period', type: 'select' as const, options: ['2 Years', '3 Years', '5 Years', 'Indefinite'], required: true },
  { id: 'q11', question: 'Include Non-Solicitation', type: 'toggle' as const, options: ['Yes', 'No'], required: false },
  { id: 'q12', question: 'Client Signatory Name', type: 'text' as const, required: true, placeholder: 'e.g. Sarah Johnson', helpText: 'Person signing on behalf of the client' },
  { id: 'q13', question: 'Client Signatory Title', type: 'text' as const, required: true, placeholder: 'e.g. VP of Operations' },
  { id: 'q14', question: 'Provider Signatory Name', type: 'text' as const, required: true, placeholder: 'e.g. David Lee', helpText: 'Person signing on behalf of the service provider' },
  { id: 'q15', question: 'Provider Signatory Title', type: 'text' as const, required: true, placeholder: 'e.g. Chief Executive Officer' },
];

const sectionSchemas = [
  {
    id: 'msa-1', title: 'ARTICLE 1 — RECITALS AND DEFINITIONS', level: 1, pageEstimate: 2,
    contentGenerator: (a: IntakeAnswers) => {
      const client = gen(a, 'q1', 'Client Company');
      const provider = gen(a, 'q2', 'Service Provider');
      const state = gen(a, 'q3', 'Delaware');
      return `This Master Service Agreement ("MSA" or "Agreement") is entered into as of the Effective Date by and between:

CLIENT: ${client} ("Client"), a corporation organized under the laws of the State of ${state};

SERVICE PROVIDER: ${provider} ("Provider"), a limited liability company organized under the laws of the State of ${state}.

WHEREAS, Provider is engaged in the business of providing ${gen(a, 'q5', 'professional services')} and related technology services; and

WHEREAS, Client desires to engage Provider to perform certain services as described in one or more Statements of Work ("SOW") to be executed pursuant to this Agreement;

NOW, THEREFORE, in consideration of the mutual covenants and agreements herein contained, the parties agree as follows:

1.1 DEFINITIONS. As used in this Agreement:

(a) "Confidential Information" means any non-public information disclosed by either party to the other, including technical data, trade secrets, business plans, financial information, customer lists, and proprietary technology.

(b) "Deliverables" means all work product, reports, documentation, software, and other materials to be delivered by Provider to Client as specified in an applicable SOW.

(c) "Effective Date" means the date of the last signature on this Agreement.

(d) "Intellectual Property" or "IP" means all patents, copyrights, trademarks, trade secrets, and other proprietary rights.

(e) "Personnel" means Provider's employees, subcontractors, and agents assigned to perform Services.

(f) "Services" means the services to be performed by Provider as described in each SOW executed under this Agreement.

(g) "Statement of Work" or "SOW" means a document executed by both parties describing specific Services, Deliverables, timelines, and fees, substantially in the form attached as Exhibit A.`;
    },
  },
  {
    id: 'msa-2', title: 'ARTICLE 2 — SCOPE OF SERVICES', level: 1, pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const provider = gen(a, 'q2', 'Provider');
      const client = gen(a, 'q1', 'Client');
      const serviceType = gen(a, 'q5', 'professional services');
      return `2.1 SERVICES. ${provider} shall perform the ${serviceType} services described in each SOW executed by the parties under this Agreement. Each SOW shall specify: (a) a description of the Services; (b) the Deliverables; (c) the timeline and milestones; (d) the fees and payment schedule; (e) acceptance criteria; and (f) any additional terms specific to the SOW.

2.2 SOW EXECUTION. No SOW shall be effective unless executed by authorized representatives of both parties. Each SOW shall be deemed incorporated into and governed by this Agreement.

2.3 ORDER OF PRECEDENCE. In the event of any conflict between the terms of this Agreement and the terms of any SOW, the terms of this Agreement shall control, unless the SOW expressly states that it is modifying a specific provision of this Agreement.

2.4 STANDARD OF PERFORMANCE. ${provider} shall perform all Services in a professional and workmanlike manner, consistent with industry standards and best practices, and in accordance with all applicable laws and regulations. ${provider} shall assign qualified Personnel with the requisite skills and experience to perform the Services.

2.5 CHANGE ORDERS. Either party may request changes to the scope of Services under an SOW by submitting a written change order request. No change shall be effective until a written change order is executed by both parties specifying the impact on scope, timeline, and fees.

2.6 COOPERATION. ${client} shall provide reasonable cooperation and access to information, systems, and personnel as reasonably necessary for ${provider} to perform the Services. ${client}'s failure to provide such cooperation may extend timelines and affect Deliverables.`;
    },
  },
  {
    id: 'msa-3', title: 'ARTICLE 3 — TERM AND TERMINATION', level: 1, pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const term = gen(a, 'q4', '3 Years');
      const client = gen(a, 'q1', 'Client');
      const provider = gen(a, 'q2', 'Provider');
      return `3.1 TERM. This Agreement shall commence on the Effective Date and continue for a period of ${term} (the "Initial Term"), unless earlier terminated as provided herein. Following the Initial Term, this Agreement shall automatically renew for successive one (1) year periods (each, a "Renewal Term") unless either party provides written notice of non-renewal at least ninety (90) days prior to the expiration of the then-current term.

3.2 TERMINATION FOR CONVENIENCE. Either party may terminate this Agreement for convenience upon sixty (60) days' prior written notice to the other party. In the event of termination for convenience by ${client}, ${client} shall pay ${provider} for all Services performed and Deliverables delivered through the effective date of termination, plus any non-cancellable costs incurred by ${provider}.

3.3 TERMINATION FOR CAUSE. Either party may terminate this Agreement immediately upon written notice if the other party: (a) materially breaches this Agreement and fails to cure such breach within thirty (30) days after written notice; (b) becomes insolvent or files for bankruptcy; or (c) is dissolved or ceases operations.

3.4 EFFECT OF TERMINATION. Upon termination: (a) ${provider} shall promptly deliver to ${client} all Deliverables completed or in progress; (b) each party shall return or destroy all Confidential Information of the other party; (c) all outstanding invoices shall become immediately due and payable; and (d) the provisions of this Agreement that by their nature should survive termination shall survive.

3.5 TRANSITION SERVICES. Upon ${client}'s request at any time during the sixty (60) day period following termination, ${provider} shall provide reasonable transition assistance services at ${provider}'s then-current rates.`;
    },
  },
  {
    id: 'msa-4', title: 'ARTICLE 4 — FEES AND PAYMENT', level: 1, pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const paymentTerms = gen(a, 'q6', 'Net 30');
      const client = gen(a, 'q1', 'Client');
      const provider = gen(a, 'q2', 'Provider');
      return `4.1 FEES. ${client} shall pay ${provider} the fees set forth in each applicable SOW. Unless otherwise specified in the SOW, fees shall be based on time and materials at the hourly rates set forth in Exhibit B (Rate Card).

4.2 INVOICING. ${provider} shall submit invoices monthly (or as specified in the applicable SOW) in arrears, itemizing the Services performed, hours worked, and expenses incurred.

4.3 PAYMENT TERMS. ${client} shall pay all undisputed invoices within ${paymentTerms} days of receipt. Late payments shall accrue interest at the rate of 1.5% per month (or the maximum rate permitted by law, whichever is less).

4.4 DISPUTED INVOICES. ${client} shall notify ${provider} in writing within fifteen (15) days of receipt of any invoice of any disputed amounts, specifying the nature of the dispute. The parties shall work in good faith to resolve any disputes. Undisputed amounts shall be paid when due notwithstanding any pending dispute.

4.5 EXPENSES. ${provider} shall be reimbursed for reasonable, pre-approved out-of-pocket expenses incurred in connection with the performance of Services. All expenses exceeding Five Hundred Dollars ($500) shall require prior written approval from ${client}.

4.6 TAXES. All fees are exclusive of taxes. ${client} shall be responsible for all sales, use, and value-added taxes arising from the Services (excluding taxes based on ${provider}'s income).`;
    },
  },
  {
    id: 'msa-5', title: 'ARTICLE 5 — INTELLECTUAL PROPERTY', level: 1, pageEstimate: 2,
    contentGenerator: (a: IntakeAnswers) => {
      const ipOwnership = gen(a, 'q9', 'Client Owns All');
      const client = gen(a, 'q1', 'Client');
      const provider = gen(a, 'q2', 'Provider');

      let ipClause = '';
      if (ipOwnership.includes('Client Owns All')) {
        ipClause = `5.1 OWNERSHIP OF DELIVERABLES. All Deliverables and all Intellectual Property rights therein shall be the sole and exclusive property of ${client}. ${provider} hereby assigns and agrees to assign to ${client} all right, title, and interest in and to all Deliverables, including all Intellectual Property rights therein. ${provider} shall execute all documents and take all actions reasonably requested by ${client} to perfect ${client}'s ownership of the Deliverables.`;
      } else if (ipOwnership.includes('Provider Retains Background IP')) {
        ipClause = `5.1 OWNERSHIP. (a) "Background IP" means any Intellectual Property owned or developed by ${provider} prior to or independent of this Agreement. ${provider} retains all rights in its Background IP. (b) "Foreground IP" means any Intellectual Property created by ${provider} specifically for ${client} under this Agreement. All Foreground IP shall be the sole property of ${client}. (c) To the extent any Background IP is incorporated into any Deliverable, ${provider} hereby grants ${client} a perpetual, irrevocable, worldwide, non-exclusive, royalty-free license to use, modify, and distribute such Background IP solely as part of the Deliverable.`;
      } else if (ipOwnership.includes('Work-for-Hire')) {
        ipClause = `5.1 WORK FOR HIRE. All Deliverables shall be considered "works made for hire" as defined under the United States Copyright Act (17 U.S.C. § 101). To the extent any Deliverable does not qualify as a work made for hire, ${provider} hereby irrevocably assigns to ${client} all right, title, and interest in and to such Deliverable, including all Intellectual Property rights therein.`;
      } else {
        ipClause = `5.1 JOINT OWNERSHIP. The parties shall jointly own all Deliverables created under this Agreement. Each party may use, license, and exploit the jointly-owned Deliverables without accounting to or obtaining consent from the other party.`;
      }

      return `${ipClause}

5.2 CLIENT MATERIALS. ${client} retains all rights in any materials, data, information, or intellectual property provided by ${client} to ${provider} ("Client Materials"). ${provider} shall use Client Materials solely for the purpose of performing the Services.

5.3 PRE-EXISTING IP. Each party retains all rights in its pre-existing Intellectual Property. Nothing in this Agreement shall be construed as a transfer of either party's pre-existing IP to the other party, except as expressly stated herein.

5.4 MORAL RIGHTS. To the extent permitted by applicable law, ${provider} hereby waives all moral rights in the Deliverables, including the right of attribution and the right of integrity.

5.5 THIRD-PARTY MATERIALS. ${provider} shall not incorporate any third-party materials into any Deliverable without the prior written consent of ${client}. If third-party materials are incorporated with ${client}'s consent, ${provider} shall ensure that appropriate licenses are obtained.`;
    },
  },
  {
    id: 'msa-6', title: 'ARTICLE 6 — CONFIDENTIALITY', level: 1, pageEstimate: 1.5,
    contentGenerator: (a: IntakeAnswers) => {
      const confPeriod = gen(a, 'q10', '5 Years');
      const client = gen(a, 'q1', 'Client');
      const provider = gen(a, 'q2', 'Provider');
      return `6.1 OBLIGATIONS. Each party (the "Receiving Party") agrees to: (a) hold in confidence all Confidential Information of the other party (the "Disclosing Party"); (b) not disclose such Confidential Information to any third party except as permitted herein; (c) use such Confidential Information solely for the purposes of this Agreement; and (d) protect such Confidential Information with at least the same degree of care it uses to protect its own confidential information, but in no event less than reasonable care.

6.2 PERMITTED DISCLOSURES. The Receiving Party may disclose Confidential Information to its employees, officers, directors, contractors, and advisors who have a need to know and are bound by confidentiality obligations at least as protective as those set forth herein.

6.3 EXCLUSIONS. Confidential Information does not include information that: (a) is or becomes publicly available through no fault of the Receiving Party; (b) was known to the Receiving Party prior to disclosure; (c) is independently developed by the Receiving Party without use of the Confidential Information; or (d) is rightfully received from a third party without restriction.

6.4 REQUIRED DISCLOSURES. The Receiving Party may disclose Confidential Information to the extent required by law, regulation, or court order, provided that the Receiving Party gives the Disclosing Party prompt written notice and cooperates with the Disclosing Party's efforts to obtain a protective order.

6.5 DURATION. The obligations set forth in this Article shall continue for a period of ${confPeriod} following the termination or expiration of this Agreement; provided, however, that obligations with respect to trade secrets shall continue for as long as such information remains a trade secret under applicable law.

6.6 RETURN OF INFORMATION. Upon termination or upon the Disclosing Party's request, the Receiving Party shall promptly return or destroy all Confidential Information and certify such return or destruction in writing.`;
    },
  },
  {
    id: 'msa-7', title: 'ARTICLE 7 — REPRESENTATIONS AND WARRANTIES', level: 1, pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const provider = gen(a, 'q2', 'Provider');
      const client = gen(a, 'q1', 'Client');
      return `7.1 MUTUAL REPRESENTATIONS. Each party represents and warrants that: (a) it has the legal power and authority to enter into and perform this Agreement; (b) the execution of this Agreement does not conflict with any other agreement to which it is a party; (c) this Agreement constitutes a valid and binding obligation enforceable in accordance with its terms.

7.2 PROVIDER WARRANTIES. ${provider} represents and warrants that: (a) the Services will be performed in a professional and workmanlike manner; (b) the Deliverables will conform to the specifications set forth in the applicable SOW; (c) the Deliverables will not infringe any third-party Intellectual Property rights; (d) ${provider} will comply with all applicable laws and regulations; (e) all Personnel assigned to perform Services are qualified and properly authorized to work.

7.3 WARRANTY PERIOD. ${provider} warrants that Deliverables will conform to their specifications for a period of ninety (90) days following acceptance (the "Warranty Period"). During the Warranty Period, ${provider} shall correct any non-conformities at no additional cost.

7.4 DISCLAIMER. EXCEPT AS EXPRESSLY SET FORTH IN THIS AGREEMENT, NEITHER PARTY MAKES ANY OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.`;
    },
  },
  {
    id: 'msa-8', title: 'ARTICLE 8 — INDEMNIFICATION', level: 1, pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const provider = gen(a, 'q2', 'Provider');
      const client = gen(a, 'q1', 'Client');
      return `8.1 PROVIDER INDEMNIFICATION. ${provider} shall indemnify, defend, and hold harmless ${client} from and against any claims, damages, losses, and expenses arising from: (a) ${provider}'s breach of this Agreement; (b) ${provider}'s negligence or willful misconduct; (c) any claim that the Deliverables infringe a third party's Intellectual Property rights; (d) ${provider}'s violation of applicable laws.

8.2 CLIENT INDEMNIFICATION. ${client} shall indemnify, defend, and hold harmless ${provider} from and against any claims, damages, losses, and expenses arising from: (a) ${client}'s breach of this Agreement; (b) ${client}'s negligence or willful misconduct; (c) any claim that Client Materials infringe a third party's rights.

8.3 INDEMNIFICATION PROCEDURE. The indemnified party shall: (a) promptly notify the indemnifying party in writing; (b) grant the indemnifying party sole control of the defense; (c) cooperate in the defense at the indemnifying party's expense. Failure to provide timely notice shall not relieve the indemnifying party of its obligations except to the extent prejudiced.`;
    },
  },
  {
    id: 'msa-9', title: 'ARTICLE 9 — LIMITATION OF LIABILITY', level: 1, pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const liabilityCap = gen(a, 'q7', '$1,000,000');
      return `9.1 LIMITATION. EXCEPT FOR OBLIGATIONS UNDER ARTICLES 6 (CONFIDENTIALITY) AND 8 (INDEMNIFICATION), NEITHER PARTY'S TOTAL AGGREGATE LIABILITY UNDER THIS AGREEMENT SHALL EXCEED ${liabilityCap}.

9.2 CONSEQUENTIAL DAMAGES WAIVER. IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF PROFITS, REVENUE, DATA, OR BUSINESS OPPORTUNITIES, REGARDLESS OF THE THEORY OF LIABILITY AND EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

9.3 EXCEPTIONS. The limitations set forth in this Article shall not apply to: (a) a party's indemnification obligations under Article 8; (b) breaches of confidentiality obligations under Article 6; (c) infringement of Intellectual Property rights; (d) a party's gross negligence or willful misconduct; or (e) a party's obligations to pay fees due under this Agreement.

9.4 ESSENTIAL BASIS. The parties acknowledge that the limitations of liability set forth in this Article reflect the allocation of risk between the parties and constitute an essential element of the basis of the bargain between the parties.`;
    },
  },
  {
    id: 'msa-10', title: 'ARTICLE 10 — SERVICE LEVELS AND SLA', level: 1, pageEstimate: 1.5,
    conditional: { questionId: 'q8', values: ['No'], include: false },
    contentGenerator: (a: IntakeAnswers) => {
      const provider = gen(a, 'q2', 'Provider');
      const client = gen(a, 'q1', 'Client');
      return `10.1 SERVICE LEVEL COMMITMENTS. ${provider} shall meet the service level targets specified in this Article and in each applicable SOW (collectively, the "SLAs").

10.2 AVAILABILITY. For any hosted or managed services, ${provider} shall maintain a minimum uptime of 99.9% measured on a monthly basis, excluding scheduled maintenance windows.

10.3 RESPONSE TIMES. ${provider} shall respond to ${client}'s support requests within the following timeframes:

Priority 1 (Critical — service down): Response within 1 hour, resolution target 4 hours
Priority 2 (High — major feature impaired): Response within 4 hours, resolution target 1 business day
Priority 3 (Medium — minor issue): Response within 1 business day, resolution target 5 business days
Priority 4 (Low — informational): Response within 2 business days

10.4 SERVICE CREDITS. If ${provider} fails to meet the SLA targets in any calendar month, ${client} shall be entitled to service credits as follows:

Uptime 99.0% – 99.9%: 5% credit on monthly fees
Uptime 98.0% – 99.0%: 10% credit on monthly fees
Uptime below 98.0%: 25% credit on monthly fees

10.5 REPORTING. ${provider} shall provide ${client} with monthly SLA performance reports within ten (10) business days after the end of each calendar month.

10.6 CHRONIC FAILURE. If ${provider} fails to meet the SLA targets for three (3) or more consecutive months, ${client} may terminate this Agreement upon thirty (30) days' written notice.`;
    },
  },
  {
    id: 'msa-11', title: 'ARTICLE 11 — GENERAL PROVISIONS', level: 1, pageEstimate: 2,
    contentGenerator: (a: IntakeAnswers) => {
      const state = gen(a, 'q3', 'Delaware');
      const client = gen(a, 'q1', 'Client');
      const provider = gen(a, 'q2', 'Provider');
      const nonSolicit = gen(a, 'q11', 'Yes');
      let nonSolicitClause = '';
      if (nonSolicit === 'Yes') {
        nonSolicitClause = `\n\n11.9 NON-SOLICITATION. During the term of this Agreement and for a period of twelve (12) months following its termination, neither party shall directly or indirectly solicit, hire, or engage any employee or contractor of the other party who was involved in the performance of Services, without the prior written consent of the other party. This restriction shall not apply to general employment advertisements or solicitations not specifically targeting the other party's personnel.`;
      }
      return `11.1 GOVERNING LAW. This Agreement shall be governed by the laws of the State of ${state}, without regard to conflict of laws principles.

11.2 DISPUTE RESOLUTION. Any dispute arising out of this Agreement shall first be submitted to good-faith negotiations between senior executives of the parties for a period of thirty (30) days. If not resolved, the dispute shall be submitted to binding arbitration under the rules of the American Arbitration Association.

11.3 INDEPENDENT CONTRACTOR. ${provider} is an independent contractor and nothing in this Agreement shall create an employment, agency, joint venture, or partnership relationship.

11.4 ASSIGNMENT. Neither party may assign this Agreement without the prior written consent of the other party, except that either party may assign this Agreement to an affiliate or in connection with a merger, acquisition, or sale of substantially all its assets.

11.5 FORCE MAJEURE. Neither party shall be liable for delays or failures caused by events beyond its reasonable control, including natural disasters, pandemics, government actions, or infrastructure failures.

11.6 NOTICES. All notices shall be in writing and deemed given upon receipt when delivered by hand, one business day after deposit with a nationally recognized overnight courier, or three business days after mailing by certified mail.

11.7 ENTIRE AGREEMENT. This Agreement, together with all SOWs and Exhibits, constitutes the entire agreement between the parties and supersedes all prior negotiations and agreements.

11.8 SEVERABILITY. If any provision is held invalid, the remaining provisions shall continue in full force and effect.${nonSolicitClause}

IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.


${client.toUpperCase()}

By: ________________________________
Name: ${gen(a, 'q12', '________________________________')}
Title: ${gen(a, 'q13', '________________________________')}
Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}


${provider.toUpperCase()}

By: ________________________________
Name: ${gen(a, 'q14', '________________________________')}
Title: ${gen(a, 'q15', '________________________________')}
Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    },
  },
];

export const msaTemplate: DocumentTemplateDef = {
  id: 'dt2',
  name: 'Master Service Agreement',
  category: 'Legal',
  description: 'Enterprise MSA with SLAs, IP provisions, indemnification, limitation of liability, and SOW templates',
  pages: '18–26',
  sections: sectionSchemas.length,
  avgGenerationTime: '1.8 min',
  questions,
  schema: sectionSchemas,
};

