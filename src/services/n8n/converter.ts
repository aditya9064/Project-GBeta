/**
 * n8n → CrewOS Workflow Converter
 * 
 * Converts n8n workflow JSON format into CrewOS WorkflowDefinition format,
 * making every n8n workflow importable and executable in our system.
 * 
 * n8n format:
 *   { nodes: [{type: "n8n-nodes-base.gmail", name, position, parameters, ...}],
 *     connections: { "NodeName": { main: [[{node: "TargetName", type: "main", index: 0}]] } } }
 * 
 * CrewOS format:
 *   { nodes: WorkflowNodeData[], edges: WorkflowEdge[] }
 */

import {
  WorkflowDefinition,
  WorkflowNodeData,
  WorkflowEdge,
  NodeType,
  AppType,
  TriggerType,
} from '../automation/types';

/* ═══ n8n Raw Types ═══════════════════════════════════════ */

export interface N8nWorkflow {
  id?: number | string;
  name: string;
  description?: string;
  nodes: N8nNode[];
  connections: Record<string, N8nConnectionGroup>;
  active?: boolean;
  settings?: Record<string, any>;
  meta?: Record<string, any>;
  tags?: any[];
  notes?: string;
}

export interface N8nNode {
  id?: string;
  name: string;
  type: string;
  typeVersion?: number;
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, any>;
  webhookId?: string;
  notes?: string;
  disabled?: boolean;
  alwaysOutputData?: boolean;
}

export interface N8nConnectionGroup {
  main?: N8nConnectionTarget[][];
}

export interface N8nConnectionTarget {
  node: string;
  type: string;
  index: number;
}

/* ═══ Node Type Mapping ═══════════════════════════════════ */

// Maps n8n node types to CrewOS node types
const N8N_TYPE_TO_CREWOS_TYPE: Record<string, NodeType> = {
  // Triggers
  'n8n-nodes-base.manualTrigger': 'trigger',
  'n8n-nodes-base.webhook': 'trigger',
  'n8n-nodes-base.scheduleTrigger': 'trigger',
  'n8n-nodes-base.cronTrigger': 'trigger',
  'n8n-nodes-base.cron': 'trigger',
  'n8n-nodes-base.interval': 'trigger',
  'n8n-nodes-base.emailTrigger': 'trigger',
  'n8n-nodes-base.emailReadImap': 'trigger',
  'n8n-nodes-base.formTrigger': 'trigger',
  'n8n-nodes-base.stripeTrigger': 'trigger',
  'n8n-nodes-base.githubTrigger': 'trigger',
  'n8n-nodes-base.slackTrigger': 'trigger',
  'n8n-nodes-base.telegramTrigger': 'trigger',
  'n8n-nodes-base.jiraTrigger': 'trigger',
  'n8n-nodes-base.typeformTrigger': 'trigger',
  'n8n-nodes-base.shopifyTrigger': 'trigger',
  'n8n-nodes-base.hubspotTrigger': 'trigger',
  'n8n-nodes-base.woocommerceTrigger': 'trigger',
  'n8n-nodes-base.rssFeedRead': 'trigger',
  'n8n-nodes-base.start': 'trigger',
  'n8n-nodes-base.errorTrigger': 'trigger',
  'n8n-nodes-base.schedule': 'trigger',
  'n8n-nodes-base.facebookLeadAdsTrigger': 'trigger',
  'n8n-nodes-base.surveyMonkeyTrigger': 'trigger',
  'n8n-nodes-base.jotformTrigger': 'trigger',
  'n8n-nodes-base.calendlyTrigger': 'trigger',
  'n8n-nodes-base.acuitySchedulingTrigger': 'trigger',
  'n8n-nodes-base.activecampaignTrigger': 'trigger',

  // AI nodes
  'n8n-nodes-base.openAi': 'ai',
  '@n8n/n8n-nodes-langchain.openAi': 'ai',
  '@n8n/n8n-nodes-langchain.lmChatOpenAi': 'ai',
  '@n8n/n8n-nodes-langchain.agent': 'ai',
  '@n8n/n8n-nodes-langchain.chainLlm': 'ai',
  '@n8n/n8n-nodes-langchain.chainSummarization': 'ai',
  'n8n-nodes-base.awsRekognition': 'ai',
  'n8n-nodes-base.awsTextract': 'ai',

  // Conditions/Filters
  'n8n-nodes-base.if': 'condition',
  'n8n-nodes-base.switch': 'condition',
  'n8n-nodes-base.filter': 'filter',
  'n8n-nodes-base.compareDatasets': 'filter',
  'n8n-nodes-base.removeDuplicates': 'filter',

  // Delay
  'n8n-nodes-base.wait': 'delay',

  // Error/utility (map to action)
  'n8n-nodes-base.stopAndError': 'action',
  'n8n-nodes-base.noOp': 'action',
  'n8n-nodes-base.respondToWebhook': 'action',
  'n8n-nodes-base.executeCommand': 'action',
  'n8n-nodes-base.executeWorkflow': 'action',
  'n8n-nodes-base.code': 'action',
  'n8n-nodes-base.function': 'action',
  'n8n-nodes-base.functionItem': 'action',
  'n8n-nodes-base.set': 'action',
  'n8n-nodes-base.merge': 'action',
  'n8n-nodes-base.splitInBatches': 'action',
  'n8n-nodes-base.splitOut': 'action',
  'n8n-nodes-base.limit': 'action',
  'n8n-nodes-base.aggregate': 'action',
  'n8n-nodes-base.summarize': 'action',
  'n8n-nodes-base.dateTime': 'action',
  'n8n-nodes-base.crypto': 'action',
  'n8n-nodes-base.xml': 'action',
  'n8n-nodes-base.markdown': 'action',
  'n8n-nodes-base.html': 'action',
  'n8n-nodes-base.compression': 'action',
  'n8n-nodes-base.moveBinaryData': 'action',
  'n8n-nodes-base.readBinaryFile': 'action',
  'n8n-nodes-base.readBinaryFiles': 'action',
  'n8n-nodes-base.writeBinaryFile': 'action',
  'n8n-nodes-base.convertToFile': 'action',
  'n8n-nodes-base.extractFromFile': 'action',
  'n8n-nodes-base.stickyNote': 'action',
  'n8n-nodes-base.debugHelper': 'action',
  'n8n-nodes-base.executionData': 'action',
};

// Maps n8n node types to CrewOS AppType (for app nodes)
const N8N_TYPE_TO_APP_TYPE: Record<string, AppType> = {
  'n8n-nodes-base.gmail': 'gmail',
  'n8n-nodes-base.gmailTool': 'gmail',
  'n8n-nodes-base.slack': 'slack',
  'n8n-nodes-base.slackTool': 'slack',
  'n8n-nodes-base.notion': 'notion',
  'n8n-nodes-base.notionTool': 'notion',
  'n8n-nodes-base.googleCalendar': 'calendar',
  'n8n-nodes-base.googleCalendarTool': 'calendar',
  'n8n-nodes-base.hubspot': 'hubspot',
  'n8n-nodes-base.salesforce': 'salesforce',
  'n8n-nodes-base.shopify': 'shopify',
  'n8n-nodes-base.stripe': 'stripe',
  'n8n-nodes-base.github': 'github',
  'n8n-nodes-base.githubTool': 'github',
  'n8n-nodes-base.zendesk': 'zendesk',
  'n8n-nodes-base.httpRequest': 'http',
  'n8n-nodes-base.http': 'http',
  'n8n-nodes-base.webhook': 'webhook',
};

// Extended app types that map to HTTP (generic) execution
const N8N_TYPE_TO_GENERIC_APP: Record<string, string> = {
  'n8n-nodes-base.activecampaign': 'Activecampaign',
  'n8n-nodes-base.airtable': 'Airtable',
  'n8n-nodes-base.airtableTool': 'Airtable',
  'n8n-nodes-base.asana': 'Asana',
  'n8n-nodes-base.awsS3': 'AWS S3',
  'n8n-nodes-base.awsSns': 'AWS SNS',
  'n8n-nodes-base.bannerbear': 'Bannerbear',
  'n8n-nodes-base.baserow': 'Baserow',
  'n8n-nodes-base.bitbucket': 'Bitbucket',
  'n8n-nodes-base.bitly': 'Bitly',
  'n8n-nodes-base.bitwarden': 'Bitwarden',
  'n8n-nodes-base.box': 'Box',
  'n8n-nodes-base.calendly': 'Calendly',
  'n8n-nodes-base.chargebee': 'Chargebee',
  'n8n-nodes-base.clickUp': 'ClickUp',
  'n8n-nodes-base.clockify': 'Clockify',
  'n8n-nodes-base.coingecko': 'CoinGecko',
  'n8n-nodes-base.convertKit': 'ConvertKit',
  'n8n-nodes-base.copper': 'Copper',
  'n8n-nodes-base.cortex': 'Cortex',
  'n8n-nodes-base.customerIo': 'Customer.io',
  'n8n-nodes-base.discord': 'Discord',
  'n8n-nodes-base.discordTool': 'Discord',
  'n8n-nodes-base.dropbox': 'Dropbox',
  'n8n-nodes-base.elasticsearch': 'Elasticsearch',
  'n8n-nodes-base.emelia': 'Emelia',
  'n8n-nodes-base.eventbrite': 'Eventbrite',
  'n8n-nodes-base.facebookGraphApi': 'Facebook',
  'n8n-nodes-base.figma': 'Figma',
  'n8n-nodes-base.flow': 'Flow',
  'n8n-nodes-base.getResponse': 'GetResponse',
  'n8n-nodes-base.gitlab': 'GitLab',
  'n8n-nodes-base.googleAnalytics': 'Google Analytics',
  'n8n-nodes-base.googleBigQuery': 'Google BigQuery',
  'n8n-nodes-base.googleContacts': 'Google Contacts',
  'n8n-nodes-base.googleDocs': 'Google Docs',
  'n8n-nodes-base.googleDrive': 'Google Drive',
  'n8n-nodes-base.googleDriveTool': 'Google Drive',
  'n8n-nodes-base.googleSheets': 'Google Sheets',
  'n8n-nodes-base.googleSheetsTool': 'Google Sheets',
  'n8n-nodes-base.googleSlides': 'Google Slides',
  'n8n-nodes-base.googleTasks': 'Google Tasks',
  'n8n-nodes-base.googleTasksTool': 'Google Tasks',
  'n8n-nodes-base.googleTranslate': 'Google Translate',
  'n8n-nodes-base.goToWebinar': 'GoToWebinar',
  'n8n-nodes-base.graphql': 'GraphQL',
  'n8n-nodes-base.grist': 'Grist',
  'n8n-nodes-base.gumroad': 'Gumroad',
  'n8n-nodes-base.helpScout': 'Help Scout',
  'n8n-nodes-base.humanticAi': 'Humantic AI',
  'n8n-nodes-base.hunter': 'Hunter',
  'n8n-nodes-base.intercom': 'Intercom',
  'n8n-nodes-base.invoiceNinja': 'Invoice Ninja',
  'n8n-nodes-base.jira': 'Jira',
  'n8n-nodes-base.jiraTool': 'Jira',
  'n8n-nodes-base.jotform': 'Jotform',
  'n8n-nodes-base.keap': 'Keap',
  'n8n-nodes-base.lemlist': 'Lemlist',
  'n8n-nodes-base.linkedin': 'LinkedIn',
  'n8n-nodes-base.mailcheck': 'Mailcheck',
  'n8n-nodes-base.mailchimp': 'Mailchimp',
  'n8n-nodes-base.mailerLite': 'MailerLite',
  'n8n-nodes-base.mailjet': 'Mailjet',
  'n8n-nodes-base.matrix': 'Matrix',
  'n8n-nodes-base.mattermost': 'Mattermost',
  'n8n-nodes-base.mautic': 'Mautic',
  'n8n-nodes-base.microsoftExcel': 'Microsoft Excel',
  'n8n-nodes-base.microsoftOneDrive': 'Microsoft OneDrive',
  'n8n-nodes-base.microsoftOutlook': 'Microsoft Outlook',
  'n8n-nodes-base.microsoftToDo': 'Microsoft ToDo',
  'n8n-nodes-base.mondayCom': 'Monday.com',
  'n8n-nodes-base.mongoDb': 'MongoDB',
  'n8n-nodes-base.mongoDbTool': 'MongoDB',
  'n8n-nodes-base.mqtt': 'MQTT',
  'n8n-nodes-base.mySql': 'MySQL',
  'n8n-nodes-base.mySqlTool': 'MySQL',
  'n8n-nodes-base.netlify': 'Netlify',
  'n8n-nodes-base.nocodb': 'NocoDB',
  'n8n-nodes-base.odoo': 'Odoo',
  'n8n-nodes-base.onfleet': 'Onfleet',
  'n8n-nodes-base.openWeatherMap': 'OpenWeatherMap',
  'n8n-nodes-base.payPal': 'PayPal',
  'n8n-nodes-base.pipedrive': 'Pipedrive',
  'n8n-nodes-base.postgres': 'PostgreSQL',
  'n8n-nodes-base.postgresTool': 'PostgreSQL',
  'n8n-nodes-base.postHog': 'PostHog',
  'n8n-nodes-base.postmark': 'Postmark',
  'n8n-nodes-base.quickBooks': 'QuickBooks',
  'n8n-nodes-base.raindrop': 'Raindrop',
  'n8n-nodes-base.redis': 'Redis',
  'n8n-nodes-base.sendGrid': 'SendGrid',
  'n8n-nodes-base.signl4': 'SIGNL4',
  'n8n-nodes-base.sse': 'SSE',
  'n8n-nodes-base.strapi': 'Strapi',
  'n8n-nodes-base.supabase': 'Supabase',
  'n8n-nodes-base.taiga': 'Taiga',
  'n8n-nodes-base.telegram': 'Telegram',
  'n8n-nodes-base.telegramTool': 'Telegram',
  'n8n-nodes-base.theHive': 'TheHive',
  'n8n-nodes-base.todoist': 'Todoist',
  'n8n-nodes-base.toggl': 'Toggl',
  'n8n-nodes-base.trello': 'Trello',
  'n8n-nodes-base.twilio': 'Twilio',
  'n8n-nodes-base.twitter': 'Twitter',
  'n8n-nodes-base.twitterTool': 'Twitter',
  'n8n-nodes-base.typeform': 'Typeform',
  'n8n-nodes-base.uptimeRobot': 'UptimeRobot',
  'n8n-nodes-base.webflow': 'Webflow',
  'n8n-nodes-base.whatsApp': 'WhatsApp',
  'n8n-nodes-base.wise': 'Wise',
  'n8n-nodes-base.wooCommerce': 'WooCommerce',
  'n8n-nodes-base.wooCommerceTool': 'WooCommerce',
  'n8n-nodes-base.wordpress': 'WordPress',
  'n8n-nodes-base.wufoo': 'Wufoo',
  'n8n-nodes-base.youtube': 'YouTube',
  'n8n-nodes-base.zohoCrm': 'Zoho CRM',
};

/* ═══ Trigger Type Detection ══════════════════════════════ */

function detectTriggerType(n8nType: string, params: Record<string, any>): TriggerType {
  const t = n8nType.toLowerCase();
  if (t.includes('webhook')) return 'webhook';
  if (t.includes('schedule') || t.includes('cron') || t.includes('interval')) return 'schedule';
  if (t.includes('email') || t.includes('gmail') || t.includes('imap')) return 'email';
  if (t.includes('form') || t.includes('typeform') || t.includes('jotform')) return 'form';
  if (t.includes('trigger')) return 'app_event';
  return 'manual';
}

/* ═══ Node Conversion ═════════════════════════════════════ */

function resolveNodeType(n8nType: string): NodeType {
  // Direct mapping
  if (N8N_TYPE_TO_CREWOS_TYPE[n8nType]) return N8N_TYPE_TO_CREWOS_TYPE[n8nType];
  // App mapping
  if (N8N_TYPE_TO_APP_TYPE[n8nType]) return 'app';
  // Generic app mapping
  if (N8N_TYPE_TO_GENERIC_APP[n8nType]) return 'app';
  // Trigger heuristic
  if (n8nType.toLowerCase().includes('trigger')) return 'trigger';
  // Default to action
  return 'action';
}

function resolveAppType(n8nType: string): AppType | undefined {
  if (N8N_TYPE_TO_APP_TYPE[n8nType]) return N8N_TYPE_TO_APP_TYPE[n8nType];
  return undefined;
}

function getGenericAppName(n8nType: string): string | undefined {
  return N8N_TYPE_TO_GENERIC_APP[n8nType];
}

function convertNode(n8nNode: N8nNode, index: number): WorkflowNodeData {
  const crewosType = resolveNodeType(n8nNode.type);
  const appType = resolveAppType(n8nNode.type);
  const genericAppName = getGenericAppName(n8nNode.type);
  const nodeId = n8nNode.id || `n8n-node-${index}`;

  // Build config based on type
  let config: Record<string, any> = {
    n8nOriginalType: n8nNode.type,
    n8nParameters: n8nNode.parameters || {},
  };

  if (crewosType === 'trigger') {
    config.triggerType = detectTriggerType(n8nNode.type, n8nNode.parameters);
    if (n8nNode.webhookId) config.webhookId = n8nNode.webhookId;
    if (n8nNode.parameters?.events) config.events = n8nNode.parameters.events;
    if (n8nNode.parameters?.rule) config.schedule = n8nNode.parameters.rule;
  }

  if (crewosType === 'app') {
    if (appType) {
      config.appType = appType;
      // Map specific app parameters
      if (appType === 'gmail') {
        config.gmail = {
          action: n8nNode.parameters?.operation || n8nNode.parameters?.resource || 'send',
          to: n8nNode.parameters?.sendTo || n8nNode.parameters?.to || '',
          subject: n8nNode.parameters?.subject || '',
          body: n8nNode.parameters?.message || n8nNode.parameters?.body || '',
        };
      } else if (appType === 'slack') {
        config.slack = {
          action: n8nNode.parameters?.operation || 'send_message',
          channel: n8nNode.parameters?.channel || n8nNode.parameters?.channelId || '',
          message: n8nNode.parameters?.text || n8nNode.parameters?.message || '',
        };
      } else if (appType === 'http') {
        config.http = {
          method: n8nNode.parameters?.method || 'GET',
          url: n8nNode.parameters?.url || '',
          headers: n8nNode.parameters?.headerParameters?.parameter || {},
          body: n8nNode.parameters?.body || n8nNode.parameters?.jsonBody || undefined,
        };
      }
    } else if (genericAppName) {
      // Generic app — route through HTTP executor
      config.appType = 'http';
      config.genericAppName = genericAppName;
      config.operation = n8nNode.parameters?.operation || 'execute';
      config.resource = n8nNode.parameters?.resource || '';
    }
  }

  if (crewosType === 'ai') {
    config.model = 'gpt-4';
    config.prompt = n8nNode.parameters?.prompt || n8nNode.parameters?.text || 'Process input';
    config.systemPrompt = n8nNode.parameters?.systemMessage || '';
    config.temperature = n8nNode.parameters?.temperature || 0.7;
    config.maxTokens = n8nNode.parameters?.maxTokens || 2048;
  }

  if (crewosType === 'condition' || crewosType === 'filter') {
    config.conditions = n8nNode.parameters?.conditions || [];
    config.logic = 'and';
  }

  if (crewosType === 'delay') {
    const amount = n8nNode.parameters?.amount || n8nNode.parameters?.value || 1;
    const unit = n8nNode.parameters?.unit || 'seconds';
    config.duration = amount;
    config.unit = unit;
  }

  // Build description
  let description = n8nNode.notes || '';
  if (!description) {
    const shortType = n8nNode.type.replace('n8n-nodes-base.', '');
    const operation = n8nNode.parameters?.operation || n8nNode.parameters?.resource || '';
    description = operation ? `${shortType}: ${operation}` : shortType;
  }

  return {
    id: nodeId,
    type: crewosType,
    label: n8nNode.name,
    description,
    config,
    position: {
      x: n8nNode.position?.[0] || 250 + index * 50,
      y: n8nNode.position?.[1] || 50 + index * 150,
    },
  };
}

/* ═══ Connection Conversion ═══════════════════════════════ */

function convertConnections(
  n8nConnections: Record<string, N8nConnectionGroup>,
  nodeNameToId: Map<string, string>
): WorkflowEdge[] {
  const edges: WorkflowEdge[] = [];
  let edgeIndex = 0;

  for (const [sourceName, connectionGroup] of Object.entries(n8nConnections)) {
    const sourceId = nodeNameToId.get(sourceName);
    if (!sourceId) continue;

    const mainOutputs = connectionGroup.main || [];
    for (let outputIndex = 0; outputIndex < mainOutputs.length; outputIndex++) {
      const targets = mainOutputs[outputIndex] || [];
      for (const target of targets) {
        const targetId = nodeNameToId.get(target.node);
        if (!targetId) continue;

        edges.push({
          id: `e-${edgeIndex++}`,
          source: sourceId,
          target: targetId,
          sourceHandle: outputIndex > 0 ? `output-${outputIndex}` : undefined,
          targetHandle: target.index > 0 ? `input-${target.index}` : undefined,
        });
      }
    }
  }

  return edges;
}

/* ═══ Main Converter ══════════════════════════════════════ */

export function convertN8nToCrewOS(n8nWorkflow: N8nWorkflow): WorkflowDefinition {
  // Build name→id map (n8n connections use node names)
  const nodeNameToId = new Map<string, string>();

  // Convert nodes
  const nodes: WorkflowNodeData[] = n8nWorkflow.nodes
    .filter(n => n.type !== 'n8n-nodes-base.stickyNote') // Skip sticky notes
    .map((n8nNode, index) => {
      const converted = convertNode(n8nNode, index);
      nodeNameToId.set(n8nNode.name, converted.id);
      return converted;
    });

  // Convert connections
  const edges = convertConnections(n8nWorkflow.connections || {}, nodeNameToId);

  // If no connections exist, create a linear chain based on position
  if (edges.length === 0 && nodes.length > 1) {
    // Sort by x position, then y position
    const sorted = [...nodes].sort((a, b) => {
      const dx = a.position.x - b.position.x;
      if (Math.abs(dx) > 50) return dx;
      return a.position.y - b.position.y;
    });

    for (let i = 0; i < sorted.length - 1; i++) {
      edges.push({
        id: `auto-e-${i}`,
        source: sorted[i].id,
        target: sorted[i + 1].id,
      });
    }
  }

  return {
    nodes,
    edges,
    variables: {
      _n8nSource: true,
      _n8nWorkflowName: n8nWorkflow.name,
      _n8nSettings: n8nWorkflow.settings || {},
    },
  };
}

/* ═══ Reverse Converter (CrewOS → n8n) ════════════════════ */

export function convertCrewOSToN8n(workflow: WorkflowDefinition, name: string): N8nWorkflow {
  const nodes: N8nNode[] = workflow.nodes.map((node, index) => {
    const cfg = node.config as Record<string, any> | undefined;
    const n8nType = cfg?.n8nOriginalType || mapCrewOSTypeToN8n(node);
    return {
      id: node.id,
      name: node.label,
      type: n8nType,
      position: [node.position.x, node.position.y] as [number, number],
      parameters: cfg?.n8nParameters || {},
      typeVersion: 1,
    };
  });

  // Build name lookup
  const idToName = new Map<string, string>();
  workflow.nodes.forEach(n => idToName.set(n.id, n.label));

  // Convert edges to n8n connections
  const connections: Record<string, N8nConnectionGroup> = {};
  for (const edge of workflow.edges) {
    const sourceName = idToName.get(edge.source);
    const targetName = idToName.get(edge.target);
    if (!sourceName || !targetName) continue;

    if (!connections[sourceName]) {
      connections[sourceName] = { main: [[]] };
    }
    const main = connections[sourceName].main!;
    if (!main[0]) main[0] = [];
    main[0].push({ node: targetName, type: 'main', index: 0 });
  }

  return {
    name,
    nodes,
    connections,
    active: false,
    settings: {
      executionOrder: 'v1',
      saveManualExecutions: true,
    },
  };
}

function mapCrewOSTypeToN8n(node: WorkflowNodeData): string {
  switch (node.type) {
    case 'trigger': return 'n8n-nodes-base.manualTrigger';
    case 'app': {
      const appType = (node.config as any)?.appType;
      const reverseMap: Record<string, string> = {
        gmail: 'n8n-nodes-base.gmail',
        slack: 'n8n-nodes-base.slack',
        notion: 'n8n-nodes-base.notion',
        calendar: 'n8n-nodes-base.googleCalendar',
        hubspot: 'n8n-nodes-base.hubspot',
        salesforce: 'n8n-nodes-base.salesforce',
        shopify: 'n8n-nodes-base.shopify',
        stripe: 'n8n-nodes-base.stripe',
        github: 'n8n-nodes-base.github',
        zendesk: 'n8n-nodes-base.zendesk',
        http: 'n8n-nodes-base.httpRequest',
      };
      return reverseMap[appType] || 'n8n-nodes-base.httpRequest';
    }
    case 'ai': return 'n8n-nodes-base.openAi';
    case 'condition': return 'n8n-nodes-base.if';
    case 'filter': return 'n8n-nodes-base.filter';
    case 'delay': return 'n8n-nodes-base.wait';
    case 'knowledge': return 'n8n-nodes-base.httpRequest';
    default: return 'n8n-nodes-base.set';
  }
}

/* ═══ Utility ═════════════════════════════════════════════ */

export function getN8nNodeTypeLabel(n8nType: string): string {
  const short = n8nType
    .replace('n8n-nodes-base.', '')
    .replace('@n8n/n8n-nodes-langchain.', '');
  return short.charAt(0).toUpperCase() + short.slice(1);
}

export function getN8nWorkflowSummary(n8nWorkflow: N8nWorkflow) {
  const nodeTypes = new Set(n8nWorkflow.nodes.map(n => n.type));
  const services = n8nWorkflow.nodes
    .map(n => getN8nNodeTypeLabel(n.type))
    .filter(label => !['ManualTrigger', 'Set', 'If', 'Switch', 'Code', 'StickyNote', 'NoOp', 'StopAndError'].includes(label));
  
  return {
    name: n8nWorkflow.name,
    description: n8nWorkflow.description || '',
    nodeCount: n8nWorkflow.nodes.length,
    services: [...new Set(services)],
    hasAI: [...nodeTypes].some(t => t.includes('openAi') || t.includes('langchain')),
    hasTrigger: [...nodeTypes].some(t => t.toLowerCase().includes('trigger')),
  };
}

