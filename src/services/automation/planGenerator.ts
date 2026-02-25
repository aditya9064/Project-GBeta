// Plan Generator — Converts natural language prompts into structured step-by-step plans
//
// This is the "AI understanding" layer between user intent and workflow execution.
// It produces an editable plan that the user reviews before deployment.

import type { BrowserAction } from './types';

export interface PlanStep {
  id: string;
  order: number;
  type: 'browser_task' | 'ai' | 'app' | 'action' | 'trigger' | 'memory' | 'condition' | 'delay';
  action: string;
  description: string;
  details: Record<string, any>;
  requiresConfirmation: boolean;
  requiresInput: boolean;
  inputFields?: PlanInputField[];
  estimatedDuration?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface PlanInputField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'url' | 'number' | 'select' | 'textarea';
  placeholder?: string;
  required: boolean;
  options?: string[];
  value?: string;
}

export interface GeneratedPlan {
  title: string;
  description: string;
  steps: PlanStep[];
  requiredInputs: PlanInputField[];
  warnings: string[];
  estimatedTotalDuration: string;
  requiresBrowser: boolean;
  riskAssessment: 'low' | 'medium' | 'high';
}

let stepCounter = 0;
function nextId(): string {
  return `step-${++stepCounter}-${Math.random().toString(36).substr(2, 4)}`;
}

// ─── Pattern matchers ───────────────────────────────────

interface TaskPattern {
  keywords: string[];
  generate: (prompt: string, tokens: string[]) => Partial<GeneratedPlan>;
}

function extractQuotedValues(prompt: string): string[] {
  const matches = prompt.match(/"([^"]+)"|'([^']+)'/g);
  return matches ? matches.map((m) => m.replace(/['"]/g, '')) : [];
}

function containsAny(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w));
}

function extractUrl(prompt: string): string | null {
  const match = prompt.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

function extractSiteName(prompt: string): string | null {
  const sites = [
    'amazon', 'ebay', 'walmart', 'target', 'bestbuy',
    'google', 'youtube', 'twitter', 'facebook', 'instagram', 'linkedin',
    'github', 'stackoverflow', 'reddit',
    'uber', 'doordash', 'grubhub', 'instacart',
    'airbnb', 'booking', 'expedia',
  ];
  const lower = prompt.toLowerCase();
  return sites.find((s) => lower.includes(s)) || null;
}

// ─── Shopping / E-Commerce ──────────────────────────────

function generateShoppingPlan(prompt: string): Partial<GeneratedPlan> {
  const site = extractSiteName(prompt) || 'amazon';
  const url = extractUrl(prompt) || `https://www.${site}.com`;
  const quoted = extractQuotedValues(prompt);
  const searchTerm = quoted[0] || '';
  const hasSpecificItem = searchTerm.length > 0 || containsAny(prompt, ['specific', 'exact', 'this item']);
  const wantsCheckout = containsAny(prompt, ['order', 'buy', 'purchase', 'checkout']);

  const steps: PlanStep[] = [
    {
      id: nextId(), order: 1,
      type: 'browser_task', action: 'navigate',
      description: `Open ${site.charAt(0).toUpperCase() + site.slice(1)}`,
      details: { url, browserAction: 'navigate' as BrowserAction },
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '2-3s', riskLevel: 'low',
    },
    {
      id: nextId(), order: 2,
      type: 'browser_task', action: 'login',
      description: `Log in to your ${site} account`,
      details: { browserAction: 'login' as BrowserAction, url: `${url}/ap/signin` },
      requiresConfirmation: false, requiresInput: true,
      inputFields: [
        { key: 'username', label: `${site} Email`, type: 'email', placeholder: 'your@email.com', required: true },
        { key: 'password', label: `${site} Password`, type: 'password', placeholder: 'Password', required: true },
      ],
      estimatedDuration: '3-5s', riskLevel: 'medium',
    },
    {
      id: nextId(), order: 3,
      type: 'browser_task', action: 'search',
      description: `Search for ${searchTerm || 'the item'}`,
      details: { browserAction: 'search' as BrowserAction, selector: '#twotabsearchtextbox', value: searchTerm },
      requiresConfirmation: false,
      requiresInput: !searchTerm,
      inputFields: !searchTerm ? [
        { key: 'searchTerm', label: 'What to search for', type: 'text', placeholder: 'e.g. wireless headphones', required: true },
      ] : undefined,
      estimatedDuration: '2-3s', riskLevel: 'low',
    },
  ];

  if (hasSpecificItem) {
    steps.push({
      id: nextId(), order: 4,
      type: 'browser_task', action: 'click',
      description: 'Select the best matching result',
      details: { browserAction: 'click' as BrowserAction, selector: '.s-result-item:first-child a' },
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '2s', riskLevel: 'low',
    });
  } else {
    steps.push({
      id: nextId(), order: 4,
      type: 'ai', action: 'analyze',
      description: 'AI analyzes search results and picks the best match based on ratings, price, and reviews',
      details: { prompt: 'Analyze the search results and select the best product based on ratings, reviews, and value.' },
      requiresConfirmation: true, requiresInput: false,
      estimatedDuration: '3-5s', riskLevel: 'low',
    });
    steps.push({
      id: nextId(), order: 5,
      type: 'browser_task', action: 'click',
      description: 'Click on the AI-selected product',
      details: { browserAction: 'click' as BrowserAction },
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '2s', riskLevel: 'low',
    });
  }

  if (wantsCheckout) {
    steps.push({
      id: nextId(), order: steps.length + 1,
      type: 'browser_task', action: 'add_to_cart',
      description: 'Add item to cart',
      details: { browserAction: 'add_to_cart' as BrowserAction, selector: '#add-to-cart-button' },
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '2s', riskLevel: 'medium',
    });
    steps.push({
      id: nextId(), order: steps.length + 1,
      type: 'browser_task', action: 'navigate',
      description: 'Go to cart',
      details: { browserAction: 'navigate' as BrowserAction, url: `${url}/cart` },
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '2s', riskLevel: 'low',
    });
    steps.push({
      id: nextId(), order: steps.length + 1,
      type: 'browser_task', action: 'checkout',
      description: 'Proceed to checkout — PAUSES for your review before placing order',
      details: { browserAction: 'checkout' as BrowserAction },
      requiresConfirmation: true, requiresInput: false,
      estimatedDuration: '5s', riskLevel: 'high',
    });
    steps.push({
      id: nextId(), order: steps.length + 1,
      type: 'browser_task', action: 'screenshot',
      description: 'Take screenshot of order confirmation',
      details: { browserAction: 'screenshot' as BrowserAction },
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '1s', riskLevel: 'low',
    });
    steps.push({
      id: nextId(), order: steps.length + 1,
      type: 'memory', action: 'write',
      description: 'Save order details to agent memory',
      details: { action: 'write', scope: 'agent', key: `order_${Date.now()}` },
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '< 1s', riskLevel: 'low',
    });
  }

  return {
    title: `${wantsCheckout ? 'Order' : 'Search'} on ${site.charAt(0).toUpperCase() + site.slice(1)}`,
    description: `Agent will open a separate browser window, ${wantsCheckout ? 'search for and order' : 'search for'} ${searchTerm || 'an item'} on ${site}.`,
    steps,
    requiresBrowser: true,
    riskAssessment: wantsCheckout ? 'high' : 'low',
    warnings: wantsCheckout
      ? [
          'This agent will make a purchase. It will pause at checkout for your confirmation.',
          'Make sure your shipping address and payment method are already saved on your account.',
        ]
      : [],
    estimatedTotalDuration: wantsCheckout ? '30-60s' : '15-20s',
  };
}

// ─── Web Scraping / Data Extraction ─────────────────────

function generateScrapingPlan(prompt: string): Partial<GeneratedPlan> {
  const url = extractUrl(prompt) || '';
  const site = extractSiteName(prompt) || 'the website';

  const steps: PlanStep[] = [
    {
      id: nextId(), order: 1,
      type: 'browser_task', action: 'navigate',
      description: `Open ${url || site}`,
      details: { browserAction: 'navigate' as BrowserAction, url },
      requiresConfirmation: false,
      requiresInput: !url,
      inputFields: !url ? [{ key: 'url', label: 'Website URL', type: 'url', placeholder: 'https://...', required: true }] : undefined,
      estimatedDuration: '2-3s', riskLevel: 'low',
    },
    {
      id: nextId(), order: 2,
      type: 'browser_task', action: 'wait',
      description: 'Wait for page to fully load',
      details: { browserAction: 'wait' as BrowserAction, waitAfterMs: 2000 },
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '2s', riskLevel: 'low',
    },
    {
      id: nextId(), order: 3,
      type: 'browser_task', action: 'extract',
      description: 'Extract content from the page',
      details: { browserAction: 'extract' as BrowserAction },
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '2-3s', riskLevel: 'low',
    },
    {
      id: nextId(), order: 4,
      type: 'ai', action: 'analyze',
      description: 'AI processes and structures the extracted data',
      details: { prompt: 'Structure the extracted data into a clean, organized format.' },
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '3-5s', riskLevel: 'low',
    },
    {
      id: nextId(), order: 5,
      type: 'memory', action: 'write',
      description: 'Save extracted data to memory',
      details: { action: 'write', scope: 'agent', key: 'extracted_data' },
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '< 1s', riskLevel: 'low',
    },
  ];

  return {
    title: `Extract data from ${site}`,
    description: `Agent will open a browser window and extract structured data from ${url || site}.`,
    steps,
    requiresBrowser: true,
    riskAssessment: 'low',
    warnings: [],
    estimatedTotalDuration: '10-15s',
  };
}

// ─── Form Filling / Account Actions ─────────────────────

function generateFormPlan(prompt: string): Partial<GeneratedPlan> {
  const url = extractUrl(prompt) || '';
  const site = extractSiteName(prompt) || 'the website';

  const steps: PlanStep[] = [
    {
      id: nextId(), order: 1,
      type: 'browser_task', action: 'navigate',
      description: `Open ${url || site}`,
      details: { browserAction: 'navigate' as BrowserAction, url },
      requiresConfirmation: false,
      requiresInput: !url,
      inputFields: !url ? [{ key: 'url', label: 'Form URL', type: 'url', placeholder: 'https://...', required: true }] : undefined,
      estimatedDuration: '2-3s', riskLevel: 'low',
    },
    {
      id: nextId(), order: 2,
      type: 'browser_task', action: 'login',
      description: 'Log in if required',
      details: { browserAction: 'login' as BrowserAction },
      requiresConfirmation: false, requiresInput: true,
      inputFields: [
        { key: 'username', label: 'Email / Username', type: 'email', placeholder: 'your@email.com', required: false },
        { key: 'password', label: 'Password', type: 'password', placeholder: 'Password', required: false },
      ],
      estimatedDuration: '3-5s', riskLevel: 'medium',
    },
    {
      id: nextId(), order: 3,
      type: 'ai', action: 'analyze',
      description: 'AI analyzes the form fields and determines what to fill in',
      details: { prompt: 'Identify all form fields on the page and determine appropriate values.' },
      requiresConfirmation: true, requiresInput: false,
      estimatedDuration: '3-5s', riskLevel: 'medium',
    },
    {
      id: nextId(), order: 4,
      type: 'browser_task', action: 'type',
      description: 'Fill in the form fields',
      details: { browserAction: 'type' as BrowserAction },
      requiresConfirmation: false, requiresInput: true,
      inputFields: [
        { key: 'formData', label: 'What information should be filled in?', type: 'textarea', placeholder: 'Describe the data to enter...', required: true },
      ],
      estimatedDuration: '5-10s', riskLevel: 'medium',
    },
    {
      id: nextId(), order: 5,
      type: 'browser_task', action: 'screenshot',
      description: 'Take screenshot of filled form for review',
      details: { browserAction: 'screenshot' as BrowserAction },
      requiresConfirmation: true, requiresInput: false,
      estimatedDuration: '1s', riskLevel: 'low',
    },
    {
      id: nextId(), order: 6,
      type: 'browser_task', action: 'submit',
      description: 'Submit the form — PAUSES for your approval',
      details: { browserAction: 'submit' as BrowserAction },
      requiresConfirmation: true, requiresInput: false,
      estimatedDuration: '2s', riskLevel: 'high',
    },
  ];

  return {
    title: `Fill form on ${site}`,
    description: `Agent will open a browser and fill out a form on ${url || site}.`,
    steps,
    requiresBrowser: true,
    riskAssessment: 'medium',
    warnings: ['The agent will pause before submitting so you can review the filled form.'],
    estimatedTotalDuration: '20-30s',
  };
}

// ─── Generic Browser Task ───────────────────────────────

function generateGenericBrowserPlan(prompt: string): Partial<GeneratedPlan> {
  const url = extractUrl(prompt) || '';
  const site = extractSiteName(prompt) || 'the website';

  const steps: PlanStep[] = [
    {
      id: nextId(), order: 1,
      type: 'browser_task', action: 'navigate',
      description: `Open ${url || site || 'the target page'}`,
      details: { browserAction: 'navigate' as BrowserAction, url },
      requiresConfirmation: false,
      requiresInput: !url,
      inputFields: !url ? [{ key: 'url', label: 'Website URL', type: 'url', placeholder: 'https://...', required: true }] : undefined,
      estimatedDuration: '2-3s', riskLevel: 'low',
    },
    {
      id: nextId(), order: 2,
      type: 'ai', action: 'analyze',
      description: 'AI analyzes the page and determines the next actions needed',
      details: { prompt: `The user wants to: ${prompt}. Analyze the page and determine the required steps.` },
      requiresConfirmation: true, requiresInput: false,
      estimatedDuration: '3-5s', riskLevel: 'low',
    },
    {
      id: nextId(), order: 3,
      type: 'browser_task', action: 'custom',
      description: 'Execute the planned browser actions',
      details: { browserAction: 'custom' as BrowserAction, description: prompt },
      requiresConfirmation: true, requiresInput: false,
      estimatedDuration: '10-20s', riskLevel: 'medium',
    },
    {
      id: nextId(), order: 4,
      type: 'browser_task', action: 'screenshot',
      description: 'Take a screenshot of the result',
      details: { browserAction: 'screenshot' as BrowserAction },
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '1s', riskLevel: 'low',
    },
  ];

  return {
    title: `Browser task: ${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}`,
    description: `Agent will open a separate browser window and perform the requested task.`,
    steps,
    requiresBrowser: true,
    riskAssessment: 'medium',
    warnings: ['The agent will ask for confirmation at critical steps.'],
    estimatedTotalDuration: '15-30s',
  };
}

// ─── Non-Browser Task (API / workflow only) ─────────────

function generateWorkflowPlan(prompt: string): Partial<GeneratedPlan> {
  const steps: PlanStep[] = [];
  const lower = prompt.toLowerCase();

  // Detect trigger
  if (containsAny(lower, ['every', 'daily', 'weekly', 'schedule', 'morning'])) {
    steps.push({
      id: nextId(), order: 1,
      type: 'trigger', action: 'schedule',
      description: containsAny(lower, ['daily', 'morning']) ? 'Run daily' : 'Run on schedule',
      details: { triggerType: 'schedule' },
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '-', riskLevel: 'low',
    });
  } else if (containsAny(lower, ['when email', 'new email', 'receive email'])) {
    steps.push({
      id: nextId(), order: 1,
      type: 'trigger', action: 'email',
      description: 'Triggered by incoming email',
      details: { triggerType: 'email' },
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '-', riskLevel: 'low',
    });
  } else {
    steps.push({
      id: nextId(), order: 1,
      type: 'trigger', action: 'manual',
      description: 'Manually triggered',
      details: { triggerType: 'manual' },
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '-', riskLevel: 'low',
    });
  }

  // Detect AI step
  if (containsAny(lower, ['analyze', 'summarize', 'process', 'classify', 'ai'])) {
    steps.push({
      id: nextId(), order: steps.length + 1,
      type: 'ai', action: 'process',
      description: 'AI processes the input data',
      details: { prompt },
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '3-5s', riskLevel: 'low',
    });
  }

  // Detect app integrations
  if (containsAny(lower, ['email', 'gmail', 'send email'])) {
    steps.push({
      id: nextId(), order: steps.length + 1,
      type: 'app', action: 'send_email',
      description: 'Send email via Gmail',
      details: { appType: 'gmail', gmail: { action: 'send' } },
      requiresConfirmation: false, requiresInput: true,
      inputFields: [
        { key: 'to', label: 'Recipient email', type: 'email', required: true },
        { key: 'subject', label: 'Subject', type: 'text', required: true },
      ],
      estimatedDuration: '2-3s', riskLevel: 'low',
    });
  }

  if (containsAny(lower, ['slack', 'message', 'notify', 'notification'])) {
    steps.push({
      id: nextId(), order: steps.length + 1,
      type: 'app', action: 'send_message',
      description: 'Send Slack message',
      details: { appType: 'slack', slack: { action: 'send_message' } },
      requiresConfirmation: false, requiresInput: true,
      inputFields: [
        { key: 'channel', label: 'Slack channel', type: 'text', placeholder: '#general', required: true },
      ],
      estimatedDuration: '1-2s', riskLevel: 'low',
    });
  }

  if (containsAny(lower, ['notion', 'document', 'page', 'save'])) {
    steps.push({
      id: nextId(), order: steps.length + 1,
      type: 'app', action: 'create_page',
      description: 'Save to Notion',
      details: { appType: 'notion' },
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '2-3s', riskLevel: 'low',
    });
  }

  // If only trigger was added, add a generic action
  if (steps.length <= 1) {
    steps.push({
      id: nextId(), order: 2,
      type: 'action', action: 'custom',
      description: prompt.slice(0, 100),
      details: {},
      requiresConfirmation: false, requiresInput: false,
      estimatedDuration: '1-2s', riskLevel: 'low',
    });
  }

  return {
    title: prompt.slice(0, 60) + (prompt.length > 60 ? '...' : ''),
    description: `Automation workflow: ${prompt}`,
    steps,
    requiresBrowser: false,
    riskAssessment: 'low',
    warnings: [],
    estimatedTotalDuration: '5-10s',
  };
}

// ─── Main Entry Point ───────────────────────────────────

export function generatePlan(prompt: string): GeneratedPlan {
  stepCounter = 0;
  const lower = prompt.toLowerCase();

  const isBrowserTask = containsAny(lower, [
    'go to', 'open', 'browse', 'navigate', 'website', 'page', 'click',
    'amazon', 'ebay', 'walmart', 'order', 'buy', 'purchase', 'checkout',
    'fill form', 'fill out', 'sign up', 'register', 'login', 'log in',
    'scrape', 'extract', 'download from',
    'browser', 'web page',
  ]);

  let partial: Partial<GeneratedPlan>;

  if (isBrowserTask) {
    if (containsAny(lower, ['order', 'buy', 'purchase', 'add to cart', 'checkout', 'shop'])) {
      partial = generateShoppingPlan(prompt);
    } else if (containsAny(lower, ['scrape', 'extract', 'crawl', 'download from', 'get data from'])) {
      partial = generateScrapingPlan(prompt);
    } else if (containsAny(lower, ['fill', 'form', 'sign up', 'register', 'apply'])) {
      partial = generateFormPlan(prompt);
    } else {
      partial = generateGenericBrowserPlan(prompt);
    }
  } else {
    partial = generateWorkflowPlan(prompt);
  }

  // Collect all required inputs across steps
  const requiredInputs: PlanInputField[] = [];
  for (const step of partial.steps || []) {
    if (step.inputFields) {
      for (const field of step.inputFields) {
        if (field.required && !requiredInputs.some((f) => f.key === field.key)) {
          requiredInputs.push(field);
        }
      }
    }
  }

  return {
    title: partial.title || 'New Agent',
    description: partial.description || prompt,
    steps: partial.steps || [],
    requiredInputs,
    warnings: partial.warnings || [],
    estimatedTotalDuration: partial.estimatedTotalDuration || 'Unknown',
    requiresBrowser: partial.requiresBrowser || false,
    riskAssessment: partial.riskAssessment || 'low',
  };
}
