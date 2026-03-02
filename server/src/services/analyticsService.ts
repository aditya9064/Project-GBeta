/* ═══════════════════════════════════════════════════════════
   Analytics Service — Advanced analytics and reporting
   
   Provides comprehensive analytics on agent and crew performance,
   cost trends, and generates PDF reports.
   ═══════════════════════════════════════════════════════════ */

import { MetricsStore } from './metricsStore.js';
import { BudgetStore } from './budgetStore.js';
import { EscalationStore } from './escalationStore.js';
import { logger } from './logger.js';

export interface AnalyticsReport {
  reportId: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'custom';
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  
  // Executive summary
  summary: {
    totalExecutions: number;
    successRate: number;
    totalCost: number;
    averageDuration: number;
    activeAgents: number;
    activeCrews: number;
    escalationsResolved: number;
    healthScore: number;
  };
  
  // Performance breakdown
  performance: {
    byAgent: {
      agentId: string;
      agentName: string;
      executions: number;
      successRate: number;
      avgDuration: number;
      cost: number;
      trend: 'improving' | 'stable' | 'declining';
    }[];
    byCrew: {
      crewId: string;
      crewName: string;
      executions: number;
      successRate: number;
      avgDuration: number;
      cost: number;
    }[];
    byDay: {
      date: string;
      executions: number;
      successRate: number;
      cost: number;
    }[];
  };
  
  // Cost analysis
  costAnalysis: {
    totalSpend: number;
    budgetUtilization: number;
    projectedMonthlySpend: number;
    topCostAgents: { agentId: string; agentName: string; cost: number }[];
    byCategory: { category: string; amount: number }[];
    trend: { period: string; amount: number }[];
  };
  
  // Escalations
  escalations: {
    total: number;
    resolved: number;
    pending: number;
    avgResolutionTime: number;
    byType: { type: string; count: number }[];
    byPriority: { priority: string; count: number }[];
  };
  
  // Recommendations
  recommendations: {
    type: 'optimization' | 'cost_saving' | 'reliability' | 'performance';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    potentialImpact?: string;
  }[];
}

export interface ReportOptions {
  userId: string;
  startDate: string;
  endDate: string;
  includeAgents?: string[];
  includeCrews?: string[];
  format?: 'json' | 'pdf' | 'csv';
}

function generateReportId(): string {
  return `rpt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function calculateTrend(current: number, previous: number): 'improving' | 'stable' | 'declining' {
  if (!previous || previous === 0) return 'stable';
  const change = (current - previous) / previous;
  if (change > 0.1) return 'improving';
  if (change < -0.1) return 'declining';
  return 'stable';
}

export const AnalyticsService = {
  /** Generate comprehensive analytics report */
  async generateReport(options: ReportOptions): Promise<AnalyticsReport> {
    const { userId, startDate, endDate } = options;
    const reportId = generateReportId();
    
    logger.info(`📊 Generating analytics report for ${userId}: ${startDate} to ${endDate}`);
    
    // Gather data from various stores
    const [
      metricsSummary,
      executionStats,
      budgetSummary,
      escalationSummary,
      agentMetrics,
      crewMetrics,
    ] = await Promise.all([
      MetricsStore.getSummary(userId),
      MetricsStore.getExecutionStats(startDate, endDate),
      BudgetStore.getSpendingSummary(userId),
      EscalationStore.getSummary(userId),
      MetricsStore.getAllAgentMetrics('weekly'),
      MetricsStore.getAllCrewMetrics('weekly'),
    ]);
    
    // Calculate health score
    const healthScore = Math.round(
      (metricsSummary.successRate * 40) +
      ((1 - (escalationSummary.pending / Math.max(escalationSummary.total, 1))) * 30) +
      ((budgetSummary.budgetRemaining > 0 ? 1 : 0) * 20) +
      (metricsSummary.activeAgents > 0 ? 10 : 0)
    );
    
    // Build performance data
    const byAgent = agentMetrics.map(m => ({
      agentId: m.agentId,
      agentName: m.agentName,
      executions: m.totalExecutions,
      successRate: m.successRate,
      avgDuration: m.avgDurationMs,
      cost: m.totalCost,
      trend: calculateTrend(m.successRate, 0.8), // Compare to baseline
    }));
    
    const byCrew = crewMetrics.map(m => ({
      crewId: m.crewId,
      crewName: m.crewName,
      executions: m.totalExecutions,
      successRate: m.successRate,
      avgDuration: m.avgDurationMs,
      cost: m.totalCost,
    }));
    
    // Generate recommendations
    const recommendations = this.generateRecommendations({
      metricsSummary,
      budgetSummary,
      escalationSummary,
      agentMetrics,
    });
    
    const report: AnalyticsReport = {
      reportId,
      reportType: 'custom',
      generatedAt: new Date().toISOString(),
      periodStart: startDate,
      periodEnd: endDate,
      
      summary: {
        totalExecutions: executionStats.total,
        successRate: executionStats.total > 0 ? executionStats.successful / executionStats.total : 0,
        totalCost: budgetSummary.totalSpend,
        averageDuration: executionStats.avgDuration,
        activeAgents: metricsSummary.activeAgents,
        activeCrews: crewMetrics.length,
        escalationsResolved: escalationSummary.resolved,
        healthScore,
      },
      
      performance: {
        byAgent,
        byCrew,
        byDay: budgetSummary.trends.map(t => ({
          date: t.period,
          executions: 0, // Would need to aggregate from execution logs
          successRate: 0,
          cost: t.amount,
        })),
      },
      
      costAnalysis: {
        totalSpend: budgetSummary.totalSpend,
        budgetUtilization: budgetSummary.budgetUtilization,
        projectedMonthlySpend: budgetSummary.projectedMonthlySpend,
        topCostAgents: budgetSummary.byAgent.slice(0, 5).map(a => ({
          agentId: a.agentId,
          agentName: a.agentName,
          cost: a.amount,
        })),
        byCategory: budgetSummary.byCategory.map(c => ({ category: c.category, amount: c.amount })),
        trend: budgetSummary.trends,
      },
      
      escalations: {
        total: escalationSummary.total,
        resolved: escalationSummary.resolved,
        pending: escalationSummary.pending,
        avgResolutionTime: 0, // Would need to calculate from escalation timestamps
        byType: escalationSummary.byType.map(t => ({ type: t.type, count: t.count })),
        byPriority: escalationSummary.byPriority.map(p => ({ priority: p.priority, count: p.count })),
      },
      
      recommendations,
    };
    
    logger.info(`📊 Report generated: ${reportId}`);
    return report;
  },

  /** Generate actionable recommendations */
  generateRecommendations(data: {
    metricsSummary: any;
    budgetSummary: any;
    escalationSummary: any;
    agentMetrics: any[];
  }): AnalyticsReport['recommendations'] {
    const recommendations: AnalyticsReport['recommendations'] = [];
    
    // Low success rate
    if (data.metricsSummary.successRate < 0.9) {
      recommendations.push({
        type: 'reliability',
        priority: data.metricsSummary.successRate < 0.7 ? 'high' : 'medium',
        title: 'Improve Agent Success Rate',
        description: `Current success rate is ${Math.round(data.metricsSummary.successRate * 100)}%. Review failing agents and add error handling.`,
        potentialImpact: 'Could reduce failed executions by 20-30%',
      });
    }
    
    // High cost agents
    if (data.budgetSummary.byAgent.length > 0) {
      const topCostAgent = data.budgetSummary.byAgent[0];
      if (topCostAgent && topCostAgent.amount > data.budgetSummary.totalSpend * 0.3) {
        recommendations.push({
          type: 'cost_saving',
          priority: 'medium',
          title: `Optimize ${topCostAgent.agentName}`,
          description: `This agent accounts for ${Math.round(topCostAgent.amount / data.budgetSummary.totalSpend * 100)}% of total spend. Consider optimizing prompts or using a cheaper model.`,
          potentialImpact: 'Could reduce costs by 15-25%',
        });
      }
    }
    
    // Budget utilization
    if (data.budgetSummary.budgetUtilization > 0.8) {
      recommendations.push({
        type: 'cost_saving',
        priority: 'high',
        title: 'Budget Warning',
        description: `You've used ${Math.round(data.budgetSummary.budgetUtilization * 100)}% of your budget. Consider increasing budget or reducing execution frequency.`,
      });
    }
    
    // Pending escalations
    if (data.escalationSummary.pending > 5) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        title: 'Address Pending Escalations',
        description: `${data.escalationSummary.pending} escalations are awaiting review. Address them to maintain system reliability.`,
      });
    }
    
    // Underperforming agents
    const underperformers = data.agentMetrics.filter(m => 
      m.totalExecutions >= 5 && m.successRate < 0.7
    );
    if (underperformers.length > 0) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        title: `${underperformers.length} Underperforming Agents`,
        description: `Review and improve: ${underperformers.map(a => a.agentName).join(', ')}`,
        potentialImpact: 'Could improve overall success rate by 10-15%',
      });
    }
    
    // No recent activity
    if (data.metricsSummary.totalExecutions === 0) {
      recommendations.push({
        type: 'optimization',
        priority: 'low',
        title: 'No Recent Activity',
        description: 'No agent executions recorded this period. Consider setting up scheduled triggers.',
      });
    }
    
    return recommendations;
  },

  /** Generate PDF report (returns base64 or URL) */
  async generatePDFReport(options: ReportOptions): Promise<string> {
    const report = await this.generateReport(options);
    
    // In a production system, this would use a PDF library like PDFKit or Puppeteer
    // For now, return a markdown representation that could be converted
    const markdown = this.reportToMarkdown(report);
    
    // Return as base64-encoded "PDF" placeholder
    const pdfContent = `
=== WORKFORCE ANALYTICS REPORT ===
Generated: ${report.generatedAt}
Period: ${report.periodStart} to ${report.periodEnd}

${markdown}
    `;
    
    return Buffer.from(pdfContent).toString('base64');
  },

  /** Convert report to markdown format */
  reportToMarkdown(report: AnalyticsReport): string {
    let md = `# Workforce Analytics Report

**Report ID:** ${report.reportId}
**Period:** ${report.periodStart} to ${report.periodEnd}
**Generated:** ${new Date(report.generatedAt).toLocaleString()}

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Executions | ${report.summary.totalExecutions} |
| Success Rate | ${Math.round(report.summary.successRate * 100)}% |
| Total Cost | $${report.summary.totalCost.toFixed(2)} |
| Average Duration | ${Math.round(report.summary.averageDuration)}ms |
| Active Agents | ${report.summary.activeAgents} |
| Active Crews | ${report.summary.activeCrews} |
| Health Score | ${report.summary.healthScore}/100 |

---

## Performance by Agent

| Agent | Executions | Success Rate | Avg Duration | Cost | Trend |
|-------|------------|--------------|--------------|------|-------|
`;

    for (const agent of report.performance.byAgent.slice(0, 10)) {
      md += `| ${agent.agentName} | ${agent.executions} | ${Math.round(agent.successRate * 100)}% | ${Math.round(agent.avgDuration)}ms | $${agent.cost.toFixed(2)} | ${agent.trend} |\n`;
    }

    md += `

---

## Cost Analysis

- **Total Spend:** $${report.costAnalysis.totalSpend.toFixed(2)}
- **Budget Utilization:** ${Math.round(report.costAnalysis.budgetUtilization * 100)}%
- **Projected Monthly:** $${report.costAnalysis.projectedMonthlySpend.toFixed(2)}

---

## Escalations

- **Total:** ${report.escalations.total}
- **Resolved:** ${report.escalations.resolved}
- **Pending:** ${report.escalations.pending}

---

## Recommendations

`;

    for (const rec of report.recommendations) {
      md += `### [${rec.priority.toUpperCase()}] ${rec.title}

${rec.description}

${rec.potentialImpact ? `**Potential Impact:** ${rec.potentialImpact}` : ''}

`;
    }

    return md;
  },

  /** Get quick stats for dashboard */
  async getQuickStats(userId: string): Promise<{
    executionsToday: number;
    successRateToday: number;
    costToday: number;
    pendingEscalations: number;
    healthScore: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const [stats, escalations, budgetSummary] = await Promise.all([
      MetricsStore.getExecutionStats(today, tomorrow),
      EscalationStore.getPendingCount(userId),
      BudgetStore.getSpendingSummary(userId),
    ]);
    
    // Find today's cost
    const todayCost = budgetSummary.trends.find(t => t.period === today)?.amount || 0;
    
    return {
      executionsToday: stats.total,
      successRateToday: stats.total > 0 ? stats.successful / stats.total : 1,
      costToday: todayCost,
      pendingEscalations: escalations,
      healthScore: Math.round(
        ((stats.total > 0 ? stats.successful / stats.total : 1) * 50) +
        ((escalations === 0 ? 1 : 1 / (escalations + 1)) * 30) +
        ((budgetSummary.budgetUtilization < 0.8 ? 1 : 0.5) * 20)
      ),
    };
  },
};
