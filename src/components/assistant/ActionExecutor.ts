import { MessagesAPI } from '../../services/commsApi';
import type { UnifiedMessage } from '../../services/commsApi';

export interface AppActions {
  navigate: (page: string) => void;
  deployAgent: (name: string, description: string, workflow: any, icon?: string, color?: string) => Promise<any>;
  getAgents: () => any[];
  runAgent: (agentId: string) => Promise<any>;
  searchCatalog: (query: string) => any[];
  setActiveNav: (nav: string) => void;
}

let registeredActions: AppActions | null = null;
let cachedMessages: UnifiedMessage[] | null = null;

export function registerAppActions(actions: AppActions) {
  registeredActions = actions;
}

export function unregisterAppActions() {
  registeredActions = null;
}

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  if (!registeredActions) {
    return { success: false, error: 'App actions not registered. The assistant is not fully initialized.' };
  }

  switch (toolName) {
    case 'navigate_to_page':
      return handleNavigate(args);
    case 'deploy_agent':
      return handleDeployAgent(args);
    case 'search_agents':
      return handleSearchAgents(args);
    case 'read_emails':
      return handleReadEmails(args);
    case 'reply_to_email':
      return handleReplyToEmail(args);
    case 'run_agent':
      return handleRunAgent(args);
    case 'ask_clarification':
      return handleClarification(args);
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

async function handleNavigate(args: Record<string, unknown>) {
  const page = args.page as string;
  const validPages: Record<string, string> = {
    agents: 'agents',
    workflow: 'workflow',
    comms: 'comms',
    docai: 'docai',
    sales: 'sales',
    logs: 'logs',
    settings: 'settings',
  };

  const target = validPages[page];
  if (!target) {
    return { success: false, error: `Unknown page: ${page}. Valid pages: ${Object.keys(validPages).join(', ')}` };
  }

  registeredActions!.setActiveNav(target);
  return { success: true, result: { navigatedTo: target } };
}

async function handleDeployAgent(args: Record<string, unknown>) {
  const agentName = (args.agent_name as string || '').toLowerCase();
  const catalog = registeredActions!.searchCatalog(agentName);

  if (catalog.length === 0) {
    return {
      success: false,
      error: `No agent found matching "${args.agent_name}". Try searching with different keywords.`,
    };
  }

  if (catalog.length > 1) {
    const names = catalog.slice(0, 5).map((a: any) => a.name);
    return {
      success: false,
      error: `Multiple agents match "${args.agent_name}": ${names.join(', ')}. Please be more specific.`,
    };
  }

  const agent = catalog[0];
  try {
    const deployed = await registeredActions!.deployAgent(
      agent.name,
      agent.description,
      { nodes: [], edges: [] },
      agent.icon,
      '#e07a3a'
    );
    return {
      success: true,
      result: {
        deployed: true,
        agentName: agent.name,
        agentId: deployed.id,
        message: `Successfully deployed ${agent.name}`,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to deploy ${agent.name}: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

async function handleSearchAgents(args: Record<string, unknown>) {
  const query = (args.query as string || '').toLowerCase();
  const statusFilter = args.status_filter as string | undefined;

  const deployed = registeredActions!.getAgents();
  const catalog = registeredActions!.searchCatalog(query);

  let filteredDeployed = deployed;
  if (query) {
    filteredDeployed = deployed.filter(
      (a: any) =>
        a.name?.toLowerCase().includes(query) ||
        a.description?.toLowerCase().includes(query)
    );
  }
  if (statusFilter && statusFilter !== 'all') {
    filteredDeployed = filteredDeployed.filter((a: any) => a.status === statusFilter);
  }

  const deployedSummary = filteredDeployed.map((a: any) => ({
    name: a.name,
    status: a.status,
    id: a.id,
  }));

  const catalogSummary = catalog.slice(0, 8).map((a: any) => ({
    name: a.name,
    category: a.category,
  }));

  return {
    success: true,
    result: {
      deployedAgents: deployedSummary,
      deployedCount: deployedSummary.length,
      catalogMatches: catalogSummary,
      catalogCount: catalogSummary.length,
    },
  };
}

async function handleReadEmails(args: Record<string, unknown>) {
  const count = (args.count as number) || 5;
  const fromFilter = args.from_filter as string | undefined;
  const channel = args.channel as string | undefined;

  try {
    const result = await MessagesAPI.getMessages({
      channel: channel,
      search: fromFilter,
    });

    if (!result) {
      return { success: false, error: 'Could not fetch messages. The messaging service may be unavailable.' };
    }

    const messages = result.messages.slice(0, count);
    cachedMessages = messages;

    const summaries = messages.map((m) => ({
      id: m.id,
      from: m.from,
      subject: m.subject || '(no subject)',
      preview: m.preview.substring(0, 100),
      channel: m.channel,
      priority: m.priority,
      status: m.status,
      time: m.relativeTime,
    }));

    return {
      success: true,
      result: {
        messageCount: summaries.length,
        totalAvailable: result.total,
        messages: summaries,
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to read messages: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

async function handleReplyToEmail(args: Record<string, unknown>) {
  const messageId = args.message_id as string;
  const replyText = args.reply_text as string;

  if (!messageId || !replyText) {
    return { success: false, error: 'Both message_id and reply_text are required.' };
  }

  try {
    const sent = await MessagesAPI.sendDraft(messageId, replyText);
    if (sent) {
      return { success: true, result: { sent: true, messageId, message: 'Reply sent successfully.' } };
    }
    return { success: false, error: 'Failed to send the reply.' };
  } catch (err) {
    return { success: false, error: `Failed to send reply: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

async function handleRunAgent(args: Record<string, unknown>) {
  const agentName = (args.agent_name as string || '').toLowerCase();
  const deployed = registeredActions!.getAgents();

  const match = deployed.find(
    (a: any) =>
      a.name?.toLowerCase().includes(agentName) ||
      a.id === agentName
  );

  if (!match) {
    return { success: false, error: `No deployed agent found matching "${args.agent_name}". Deploy it first or check the name.` };
  }

  try {
    const result = await registeredActions!.runAgent(match.id);
    return {
      success: true,
      result: {
        agentName: match.name,
        agentId: match.id,
        executionResult: result.success ? 'completed' : 'failed',
        output: result.output,
        error: result.error,
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to run agent: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

async function handleClarification(args: Record<string, unknown>) {
  return {
    success: true,
    result: {
      type: 'clarification',
      question: args.question,
      options: args.options,
    },
  };
}
