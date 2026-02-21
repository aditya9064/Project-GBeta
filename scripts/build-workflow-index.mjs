#!/usr/bin/env node
/**
 * build-workflow-index.mjs
 * 
 * Builds a searchable index.json from local workflow JSON files.
 * Reads raw n8n JSON from workflow-sources/ and embeds minimal
 * workflow data (nodes + connections) in the index so that no
 * individual workflow files need to be served in production.
 * 
 * Usage: node scripts/build-workflow-index.mjs
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SOURCES_DIR = path.join(PROJECT_ROOT, 'workflow-sources');
const INDEX_PATH = path.join(PROJECT_ROOT, 'public', 'workflows', 'index.json');

const NODE_TYPE_TO_CATEGORY = {
  'gmail': 'Email', 'emailsend': 'Email', 'emailreadimap': 'Email',
  'microsoftoutlook': 'Email', 'mailchimp': 'Email', 'mailjet': 'Email',
  'mailerlite': 'Email', 'postmark': 'Email', 'convertkit': 'Email',
  'slack': 'Communication', 'discord': 'Communication', 'telegram': 'Communication',
  'mattermost': 'Communication', 'matrix': 'Communication', 'whatsapp': 'Communication',
  'twilio': 'Communication', 'twitter': 'Social Media', 'facebook': 'Social Media',
  'linkedin': 'Social Media', 'facebookleadads': 'Social Media',
  'hubspot': 'CRM & Sales', 'salesforce': 'CRM & Sales', 'pipedrive': 'CRM & Sales',
  'zohocrm': 'CRM & Sales', 'copper': 'CRM & Sales', 'affinity': 'CRM & Sales',
  'activecampaign': 'CRM & Sales', 'keap': 'CRM & Sales',
  'googlesheets': 'Productivity', 'airtable': 'Productivity', 'notion': 'Productivity',
  'todoist': 'Productivity', 'trello': 'Productivity', 'asana': 'Productivity',
  'clickup': 'Productivity', 'mondaycom': 'Productivity', 'baserow': 'Productivity',
  'github': 'Development', 'gitlab': 'Development', 'bitbucket': 'Development',
  'jira': 'Development', 'travisci': 'Development',
  'stripe': 'Finance', 'paypal': 'Finance', 'quickbooks': 'Finance',
  'invoiceninja': 'Finance', 'wise': 'Finance', 'chargebee': 'Finance',
  'shopify': 'E-Commerce', 'woocommerce': 'E-Commerce', 'gumroad': 'E-Commerce', 'webflow': 'E-Commerce',
  'googledrive': 'File Storage', 'dropbox': 'File Storage', 'box': 'File Storage',
  'microsoftonedrive': 'File Storage', 'awss3': 'File Storage',
  'googlecalendar': 'Scheduling', 'calendly': 'Scheduling', 'acuityscheduling': 'Scheduling',
  'openai': 'AI & ML', 'awsrekognition': 'AI & ML', 'awstextract': 'AI & ML',
  'deep': 'AI & ML', 'humanticai': 'AI & ML',
  'postgres': 'Database', 'mysql': 'Database', 'mongodb': 'Database',
  'redis': 'Database', 'elasticsearch': 'Database', 'supabase': 'Database',
  'wordpress': 'CMS', 'strapi': 'CMS', 'nocodb': 'CMS', 'grist': 'CMS',
  'webhook': 'Triggers', 'cron': 'Triggers', 'schedule': 'Triggers',
  'form': 'Triggers', 'rssfeedread': 'Triggers',
  'http': 'Utilities', 'code': 'Utilities', 'filter': 'Utilities',
  'aggregate': 'Utilities', 'comparedatasets': 'Utilities', 'crypto': 'Utilities',
  'xml': 'Utilities', 'markdown': 'Utilities', 'compression': 'Utilities',
  'splitinbatches': 'Utilities', 'splitout': 'Utilities', 'limit': 'Utilities',
  'removeduplicates': 'Utilities', 'summarize': 'Utilities', 'datetime': 'Utilities',
  'executecommand': 'Utilities', 'executeworkflow': 'Utilities',
  'zendesk': 'Support', 'helpscout': 'Support', 'intercom': 'Support',
  'googleanalytics': 'Analytics', 'posthog': 'Analytics',
  'googledocs': 'Documents', 'googleslides': 'Documents',
  'microsoftexcel': 'Productivity', 'microsofttodo': 'Productivity',
  'googletasks': 'Productivity', 'googletranslate': 'Utilities',
  'googlecontacts': 'CRM & Sales', 'jotform': 'Triggers',
  'typeform': 'Triggers', 'surveymonkey': 'Triggers',
  'figma': 'Design', 'bannerbear': 'Design', 'editimage': 'Design',
  'mqtt': 'Development', 'amqp': 'Development', 'sse': 'Development',
  'graphql': 'Development',
  'gmailtool': 'Email', 'googlecalendartool': 'Scheduling',
  'googledrivetool': 'File Storage', 'googlesheetstool': 'Productivity',
  'googletaskstool': 'Productivity', 'jiratool': 'Development',
  'slacktool': 'Communication', 'telegramtool': 'Communication',
  'discordtool': 'Communication', 'twittertool': 'Social Media',
  'airtabletool': 'Productivity', 'airtoptool': 'AI & ML',
  'woocommercetool': 'E-Commerce', 'postgrestool': 'Database',
  'mysqltool': 'Database', 'mongodbtool': 'Database',
  'manual': 'Triggers', 'stickynote': 'Utilities', 'noop': 'Utilities',
  'automate': 'Utilities', 'automation': 'Utilities',
  'send': 'Communication', 'create': 'Utilities', 'process': 'Utilities',
  'export': 'Utilities', 'error': 'Utilities', 'stopanderror': 'Utilities',
  'wait': 'Utilities', 'respondtowebhook': 'Utilities',
  'localfile': 'File Storage', 'readbinaryfile': 'File Storage',
  'readbinaryfiles': 'File Storage', 'writebinaryfile': 'File Storage',
  'functionitem': 'Utilities', 'executiondata': 'Utilities',
  'extractfromfile': 'Utilities', 'converttofile': 'Utilities',
  'debughelper': 'Utilities', 'templates': 'Utilities',
  'n8ntrainingcustomermessenger': 'Communication',
  'customerio': 'CRM & Sales', 'signl4': 'Communication',
  'clockify': 'Productivity', 'uptimerobot': 'Development',
  'mautic': 'CRM & Sales', 'wufoo': 'Triggers',
  'apitemplateio': 'Utilities', 'autopilot': 'CRM & Sales',
  'beeminder': 'Productivity', 'bitly': 'Utilities',
  'bitwarden': 'Utilities', 'calcslive': 'Utilities',
  'cortex': 'AI & ML', 'emelia': 'Email',
  'eventbrite': 'Scheduling', 'flow': 'Productivity',
  'getresponse': 'Email', 'gotowebinar': 'Scheduling',
  'hunter': 'CRM & Sales', 'lemlist': 'Email',
  'mailcheck': 'Email', 'netlify': 'Development',
  'odoo': 'CRM & Sales', 'onfleet': 'Utilities',
  'openweathermap': 'Utilities', 'raindrop': 'Productivity',
  'taiga': 'Development', 'thehive': 'Development',
  'toggl': 'Productivity', 'coingecko': 'Finance',
  'interval': 'Triggers', 'deep': 'AI & ML',
};

function inferCategory(categoryDir, nodes) {
  const dir = categoryDir.toLowerCase();
  if (NODE_TYPE_TO_CATEGORY[dir]) return NODE_TYPE_TO_CATEGORY[dir];
  if (nodes && nodes.length > 0) {
    for (const node of nodes) {
      const shortType = (node.type || '').replace('n8n-nodes-base.', '').replace('@n8n/n8n-nodes-langchain.', '').toLowerCase();
      if (NODE_TYPE_TO_CATEGORY[shortType]) return NODE_TYPE_TO_CATEGORY[shortType];
    }
  }
  return 'Other';
}

function inferComplexity(nodes) {
  if (!nodes) return 'low';
  const count = nodes.length;
  if (count <= 4) return 'low';
  if (count <= 8) return 'medium';
  return 'high';
}

function inferTriggerType(nodes) {
  if (!nodes) return 'manual';
  for (const node of nodes) {
    const t = (node.type || '').toLowerCase();
    if (t.includes('webhook') || t.includes('trigger')) {
      if (t.includes('schedule') || t.includes('cron') || t.includes('interval')) return 'schedule';
      if (t.includes('webhook')) return 'webhook';
      if (t.includes('email') || t.includes('gmail') || t.includes('imap')) return 'email';
      if (t.includes('form')) return 'form';
      return 'event';
    }
  }
  return 'manual';
}

function extractServices(nodes) {
  if (!nodes) return [];
  const services = new Set();
  const skip = new Set(['manualTrigger', 'set', 'if', 'switch', 'merge', 'code', 'function',
    'functionItem', 'stopAndError', 'noOp', 'stickyNote', 'start',
    'splitInBatches', 'splitOut', 'limit', 'filter', 'removeDuplicates',
    'aggregate', 'summarize', 'compareDatasets', 'wait', 'respondToWebhook',
    'executeWorkflow', 'executionData', 'errorTrigger', 'debugHelper',
    'moveBinaryData', 'readBinaryFile', 'readBinaryFiles', 'writeBinaryFile',
    'convertToFile', 'extractFromFile', 'compression', 'crypto',
    'dateTime', 'xml', 'markdown', 'html', 'noop', 'manualTrigger',
    'scheduleTrigger', 'cronTrigger', 'stickynote', 'interval']);
  for (const node of nodes) {
    let shortType = (node.type || '').replace('n8n-nodes-base.', '').replace('@n8n/n8n-nodes-langchain.', '');
    if (skip.has(shortType) || skip.has(shortType.toLowerCase())) continue;
    shortType = shortType.replace(/Trigger$/, '');
    if (shortType && shortType.length > 1) {
      const clean = shortType.charAt(0).toUpperCase() + shortType.slice(1);
      services.add(clean);
    }
  }
  return [...services];
}

/**
 * Minify n8n workflow data for embedding in the index.
 * We keep only what's needed: nodes (type, name, position, parameters) and connections.
 * Strips credentials, notes, verbose metadata.
 */
function minifyWorkflow(workflow) {
  const nodes = (workflow.nodes || [])
    .filter(n => n.type !== 'n8n-nodes-base.stickyNote')
    .map(n => {
      const min = {
        id: n.id || undefined,
        name: n.name,
        type: n.type,
        position: n.position,
        parameters: n.parameters || {},
      };
      if (n.webhookId) min.webhookId = n.webhookId;
      return min;
    });

  return {
    name: workflow.name || '',
    description: workflow.description || '',
    nodes,
    connections: workflow.connections || {},
    settings: workflow.settings ? {
      executionOrder: workflow.settings.executionOrder,
    } : undefined,
  };
}

async function main() {
  console.log('📦 Building workflow index from workflow-sources/...\n');

  // Ensure output directory exists
  await fs.mkdir(path.dirname(INDEX_PATH), { recursive: true });

  // Get all category directories from workflow-sources
  let entries;
  try {
    entries = await fs.readdir(SOURCES_DIR, { withFileTypes: true });
  } catch (err) {
    console.log('⚠️  workflow-sources/ directory not found. Writing empty index.');
    const emptyIndex = {
      version: '2.0.0',
      generatedAt: new Date().toISOString(),
      totalWorkflows: 0,
      categories: [],
      integrations: [],
      workflows: [],
    };
    await fs.writeFile(INDEX_PATH, JSON.stringify(emptyIndex));
    return;
  }

  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  console.log(`Found ${dirs.length} integration categories`);

  const index = [];
  let totalProcessed = 0;
  let totalErrors = 0;

  for (const dir of dirs) {
    const catPath = path.join(SOURCES_DIR, dir);
    const files = await fs.readdir(catPath);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(catPath, file), 'utf-8');
        const workflow = JSON.parse(content);
        const nodes = workflow.nodes || [];

        const entry = {
          id: file.replace('.json', ''),
          name: workflow.name || file.replace('.json', '').replace(/_/g, ' '),
          description: workflow.description || '',
          category: inferCategory(dir, nodes),
          integrationDir: dir,
          fileName: file,
          nodeCount: nodes.length,
          complexity: inferComplexity(nodes),
          triggerType: inferTriggerType(nodes),
          services: extractServices(nodes),
          tags: workflow.tags || [],
          // Embed minified workflow data directly — no need to serve individual files
          workflowData: minifyWorkflow(workflow),
        };
        index.push(entry);
        totalProcessed++;
      } catch (err) {
        totalErrors++;
      }
    }
  }

  // Sort by name
  index.sort((a, b) => a.name.localeCompare(b.name));

  // Compute category stats
  const categoryStats = {};
  for (const entry of index) {
    categoryStats[entry.category] = (categoryStats[entry.category] || 0) + 1;
  }

  const fullIndex = {
    version: '2.0.0',
    generatedAt: new Date().toISOString(),
    totalWorkflows: index.length,
    categories: Object.entries(categoryStats).map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    integrations: [...new Set(index.map(e => e.integrationDir))].sort(),
    workflows: index,
  };

  const json = JSON.stringify(fullIndex);
  await fs.writeFile(INDEX_PATH, json);

  const sizeMB = (json.length / (1024 * 1024)).toFixed(1);
  console.log(`\n✅ Index built successfully!`);
  console.log(`   Total workflows: ${totalProcessed}`);
  console.log(`   Errors: ${totalErrors}`);
  console.log(`   Categories: ${Object.keys(categoryStats).length}`);
  console.log(`   Index file: ${INDEX_PATH}`);
  console.log(`   Index size: ${sizeMB} MB\n`);
  console.log(`Category breakdown:`);
  for (const [cat, count] of Object.entries(categoryStats).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${cat}: ${count}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
