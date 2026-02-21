#!/usr/bin/env node
/**
 * fetch-n8n-workflows.mjs
 * 
 * Downloads ALL n8n workflow JSON files from Zie619/n8n-workflows repo
 * and builds a searchable index for the template gallery.
 * 
 * Usage: node scripts/fetch-n8n-workflows.mjs
 * 
 * Output:
 *   public/workflows/<Category>/<filename>.json  — individual workflow files
 *   public/workflows/index.json                  — searchable template index
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'public', 'workflows');
const INDEX_PATH = path.join(OUTPUT_DIR, 'index.json');

const GITHUB_API = 'https://api.github.com/repos/Zie619/n8n-workflows/contents/workflows';
const RAW_BASE = 'https://raw.githubusercontent.com/Zie619/n8n-workflows/main/workflows';

// Rate limit helper
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// n8n node type → human-friendly category mapping
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
  'invoiceninja': 'Finance', 'wise': 'Finance', 'shopify': 'E-Commerce',
  'woocommerce': 'E-Commerce', 'gumroad': 'E-Commerce', 'webflow': 'E-Commerce',
  'googledrive': 'File Storage', 'dropbox': 'File Storage', 'box': 'File Storage',
  'microsoftonedrive': 'File Storage', 'awss3': 'File Storage',
  'googlecalendar': 'Scheduling', 'calendly': 'Scheduling', 'acuityscheduling': 'Scheduling',
  'openai': 'AI & ML', 'awsrekognition': 'AI & ML', 'awstextract': 'AI & ML',
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
};

function inferCategory(categoryDir, nodes) {
  const dir = categoryDir.toLowerCase();
  // Try matching directory name first
  if (NODE_TYPE_TO_CATEGORY[dir]) return NODE_TYPE_TO_CATEGORY[dir];
  
  // Then check node types
  if (nodes && nodes.length > 0) {
    for (const node of nodes) {
      const shortType = (node.type || '').replace('n8n-nodes-base.', '').toLowerCase();
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
  for (const node of nodes) {
    const shortType = (node.type || '').replace('n8n-nodes-base.', '').replace('Tool', '').replace('tool', '');
    // Skip utility nodes
    if (['manualTrigger', 'set', 'if', 'switch', 'merge', 'code', 'function', 
         'functionItem', 'stopAndError', 'noOp', 'stickyNote', 'start',
         'splitInBatches', 'splitOut', 'limit', 'filter', 'removeDuplicates',
         'aggregate', 'summarize', 'compareDatasets', 'wait', 'respondToWebhook',
         'executeWorkflow', 'executionData', 'errorTrigger', 'debugHelper',
         'moveBinaryData', 'readBinaryFile', 'readBinaryFiles', 'writeBinaryFile',
         'convertToFile', 'extractFromFile', 'compression', 'crypto',
         'dateTime', 'xml', 'markdown', 'html', 'noop'].includes(shortType)) continue;
    if (shortType && shortType.length > 1) {
      // Clean up the name
      const clean = shortType.charAt(0).toUpperCase() + shortType.slice(1);
      services.add(clean);
    }
  }
  return [...services];
}

async function fetchJSON(url) {
  const resp = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'CrewOS-Workflow-Fetcher/1.0'
    }
  });
  if (!resp.ok) {
    if (resp.status === 403 || resp.status === 429) {
      console.log('   ⏳ Rate limited, waiting 60s...');
      await sleep(60000);
      return fetchJSON(url);
    }
    throw new Error(`HTTP ${resp.status}: ${url}`);
  }
  return resp.json();
}

async function main() {
  console.log('🚀 Fetching n8n workflows from Zie619/n8n-workflows...\n');

  // Create output directories
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Step 1: Get all category directories
  console.log('📂 Fetching category list...');
  const categories = await fetchJSON(GITHUB_API);
  const dirs = categories.filter(c => c.type === 'dir').map(c => c.name);
  console.log(`   Found ${dirs.length} integration categories\n`);

  const index = [];
  let totalDownloaded = 0;
  let totalErrors = 0;

  // Step 2: For each category, fetch workflow files
  for (let i = 0; i < dirs.length; i++) {
    const cat = dirs[i];
    const catDir = path.join(OUTPUT_DIR, cat);
    await fs.mkdir(catDir, { recursive: true });

    process.stdout.write(`[${i + 1}/${dirs.length}] ${cat}... `);

    try {
      const files = await fetchJSON(`${GITHUB_API}/${cat}`);
      const jsonFiles = files.filter(f => f.name.endsWith('.json'));
      
      for (const file of jsonFiles) {
        try {
          const rawUrl = `${RAW_BASE}/${cat}/${file.name}`;
          const workflow = await fetchJSON(rawUrl);
          
          // Save the workflow JSON
          const filePath = path.join(catDir, file.name);
          await fs.writeFile(filePath, JSON.stringify(workflow, null, 2));

          // Build index entry
          const nodes = workflow.nodes || [];
          const entry = {
            id: file.name.replace('.json', ''),
            name: workflow.name || file.name.replace('.json', '').replace(/_/g, ' '),
            description: workflow.description || '',
            category: inferCategory(cat, nodes),
            integrationDir: cat,
            fileName: file.name,
            nodeCount: nodes.length,
            complexity: inferComplexity(nodes),
            triggerType: inferTriggerType(nodes),
            services: extractServices(nodes),
            tags: workflow.tags || [],
            filePath: `workflows/${cat}/${file.name}`,
          };
          index.push(entry);
          totalDownloaded++;
        } catch (err) {
          totalErrors++;
        }
        
        // Small delay to avoid rate limiting
        await sleep(50);
      }
      
      console.log(`${jsonFiles.length} workflows`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      totalErrors++;
    }
    
    // Longer delay between categories
    await sleep(200);
  }

  // Step 3: Save the index
  console.log(`\n📝 Building index with ${index.length} workflows...`);

  // Sort by name
  index.sort((a, b) => a.name.localeCompare(b.name));

  // Compute category stats
  const categoryStats = {};
  for (const entry of index) {
    categoryStats[entry.category] = (categoryStats[entry.category] || 0) + 1;
  }

  const fullIndex = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalWorkflows: index.length,
    categories: Object.entries(categoryStats).map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    integrations: [...new Set(index.map(e => e.integrationDir))].sort(),
    workflows: index,
  };

  await fs.writeFile(INDEX_PATH, JSON.stringify(fullIndex, null, 2));

  console.log(`\n✅ Done!`);
  console.log(`   Downloaded: ${totalDownloaded} workflows`);
  console.log(`   Errors: ${totalErrors}`);
  console.log(`   Categories: ${Object.keys(categoryStats).length}`);
  console.log(`   Index saved to: ${INDEX_PATH}`);
  console.log(`\nCategory breakdown:`);
  for (const [cat, count] of Object.entries(categoryStats).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${cat}: ${count}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});


