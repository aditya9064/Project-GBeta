import { DocumentTemplateDef, IntakeAnswers } from '../types';

function gen(a: IntakeAnswers, id: string, fallback: string): string {
  return a[id] || fallback;
}

const questions = [
  { id: 'q1', question: 'From (Company Name)', type: 'text' as const, required: true, placeholder: 'Your company name' },
  { id: 'q2', question: 'Bill To (Client Name)', type: 'text' as const, required: true, placeholder: 'Client company name' },
  { id: 'q3', question: 'Invoice Number', type: 'text' as const, required: true, placeholder: 'e.g. INV-2026-0042' },
  { id: 'q4', question: 'Payment Terms', type: 'select' as const, options: ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Due on Receipt'], required: true },
  { id: 'q5', question: 'Currency', type: 'select' as const, options: ['USD', 'EUR', 'GBP', 'CAD'], required: true },
  { id: 'q6', question: 'Tax Rate (%)', type: 'text' as const, required: true, placeholder: 'e.g. 8.5' },
  { id: 'q7', question: 'Line Items (describe services)', type: 'textarea' as const, required: true, placeholder: 'e.g. Software Development - 120 hours at $175/hr' },
  { id: 'q8', question: 'Include Late Fee Terms', type: 'toggle' as const, options: ['Yes', 'No'], required: true },
];

const sectionSchemas = [
  {
    id: 'inv-1', title: 'INVOICE HEADER', level: 1, pageEstimate: 0.5,
    contentGenerator: (a: IntakeAnswers) => {
      const from = gen(a, 'q1', 'Sender Company');
      const to = gen(a, 'q2', 'Client Company');
      const invNum = gen(a, 'q3', 'INV-2026-0001');
      const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      return `INVOICE

Invoice Number: ${invNum}
Invoice Date: ${date}
Due Date: [Calculated based on payment terms]

FROM:
${from}
[Company Address]
[City, State ZIP]
[Phone] | [Email]

BILL TO:
${to}
[Client Address]
[City, State ZIP]
[Attention: Accounts Payable]`;
    },
  },
  {
    id: 'inv-2', title: 'LINE ITEMS AND CALCULATIONS', level: 1, pageEstimate: 2,
    contentGenerator: (a: IntakeAnswers) => {
      const items = gen(a, 'q7', 'Professional Services');
      const currency = gen(a, 'q5', 'USD');
      const taxRate = gen(a, 'q6', '8.5');
      const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
      return `DESCRIPTION OF SERVICES

${items}

────────────────────────────────────────────────────────────
ITEM                          QTY    RATE        AMOUNT
────────────────────────────────────────────────────────────
[Line Item 1]                  __    ${sym}___.__    ${sym}___.__
[Line Item 2]                  __    ${sym}___.__    ${sym}___.__
[Line Item 3]                  __    ${sym}___.__    ${sym}___.__
[Line Item 4]                  __    ${sym}___.__    ${sym}___.__
────────────────────────────────────────────────────────────

                              Subtotal:           ${sym}___.__
                              Tax (${taxRate}%):          ${sym}___.__
                              ─────────────────────────────
                              TOTAL DUE:          ${sym}___.__

Currency: ${currency}`;
    },
  },
  {
    id: 'inv-3', title: 'PAYMENT TERMS AND INSTRUCTIONS', level: 1, pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const terms = gen(a, 'q4', 'Net 30');
      const lateFee = gen(a, 'q8', 'Yes');
      const from = gen(a, 'q1', 'Sender Company');
      let lateFeeClause = '';
      if (lateFee === 'Yes') {
        lateFeeClause = `\n\nLATE PAYMENT: Invoices not paid within the specified payment terms will be subject to a late fee of 1.5% per month (18% per annum) on the outstanding balance. ${from} reserves the right to suspend services for accounts more than 60 days past due.`;
      }
      return `PAYMENT TERMS

Payment Terms: ${terms}
Please reference Invoice Number on all payments.

PAYMENT METHODS:

1. Wire Transfer / ACH:
   Bank Name: [Bank Name]
   Routing Number: [Routing Number]
   Account Number: [Account Number]
   Account Name: ${from}

2. Check:
   Make payable to: ${from}
   Mail to: [Remittance Address]

3. Online Payment:
   [Payment Portal URL]${lateFeeClause}

NOTES:
- All prices are in the specified currency
- This invoice is due upon receipt of goods/services rendered
- Please contact [email] with any billing questions`;
    },
  },
  {
    id: 'inv-4', title: 'TERMS AND CONDITIONS', level: 1, pageEstimate: 1,
    contentGenerator: (a: IntakeAnswers) => {
      const from = gen(a, 'q1', 'Sender Company');
      const to = gen(a, 'q2', 'Client Company');
      return `TERMS AND CONDITIONS

1. PAYMENT. Payment is due in accordance with the payment terms specified above. Partial payments will be applied first to accrued interest and fees, then to the oldest outstanding invoice.

2. DISPUTES. ${to} must notify ${from} of any billing disputes within fifteen (15) days of the invoice date. Undisputed amounts must be paid by the due date regardless of any pending dispute.

3. TAXES. The amounts shown on this invoice are exclusive of applicable taxes unless otherwise stated. ${to} is responsible for all applicable sales, use, and value-added taxes.

4. RETENTION OF TITLE. ${from} retains all intellectual property rights in deliverables until full payment is received.

5. GOVERNING LAW. This invoice and any disputes arising from it shall be governed by the laws of [State/Jurisdiction].

Thank you for your business.

${from}`;
    },
  },
];

export const invoiceTemplate: DocumentTemplateDef = {
  id: 'dt3',
  name: 'Invoice Package',
  category: 'Finance',
  description: 'Multi-page invoice with line items, tax calculations, payment terms, and remittance details',
  pages: '3–8',
  sections: sectionSchemas.length,
  avgGenerationTime: '0.6 min',
  questions,
  schema: sectionSchemas,
};



