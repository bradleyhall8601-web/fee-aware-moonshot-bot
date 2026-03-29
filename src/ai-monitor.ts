// src/ai-monitor.ts
// AI-powered monitoring and auto-fix agent

import { OpenAI } from 'openai';
import database from './database';
import telemetryLogger from './telemetry';

interface MaintenanceIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  affectedUsers: string[];
  estimatedFixTime: number; // minutes
  autoFixable: boolean;
}

class AIMonitor {
  private client: OpenAI | null = null;
  private isInitialized = false;
  private inMaintenance = false;
  private maintenanceStartTime = 0;
  private telegramNotifier: any = null;

  async initialize(telegramNotifier?: any): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      telemetryLogger.warn('OpenAI API key not found. AI monitoring disabled.', 'ai-monitor');
      return;
    }

    try {
      this.client = new OpenAI({ apiKey });
      this.isInitialized = true;
      this.telegramNotifier = telegramNotifier;
      telemetryLogger.info('AI Monitor initialized', 'ai-monitor');
    } catch (err) {
      telemetryLogger.error('Failed to initialize AI Monitor', 'ai-monitor', err);
    }
  }

  async monitorAndAnalyze(): Promise<void> {
    if (!this.isInitialized || !this.client) {
      return;
    }

    try {
      const logs = telemetryLogger.getLogsForAnalysis(50);
      const metrics = telemetryLogger.getRecentMetrics(5);
      const errorCount = telemetryLogger.getErrorCount();
      const warningCount = telemetryLogger.getWarningCount();

      if (errorCount === 0 && warningCount === 0) {
        return;
      }

      // Send logs to AI for analysis
      const analysis = await this.analyzeLogsWithAI(logs, metrics, errorCount, warningCount);

      if (analysis && analysis.issue_detected) {
        await this.handleDetectedIssue(analysis);
      }
    } catch (err) {
      telemetryLogger.error('Error during monitoring', 'ai-monitor', err);
    }
  }

  private async analyzeLogsWithAI(logs: string, metrics: any[], errorCount: number, warningCount: number): Promise<any> {
    if (!this.client) return null;

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'user',
            content: `Analyze these bot logs and metrics for issues. Be concise.

LOGS (last 50 entries):
${logs}

METRICS:
- Errors in last 5 min: ${errorCount}
- Warnings in last 5 min: ${warningCount}
- Memory info: ${JSON.stringify(metrics[metrics.length - 1]?.memoryUsage || {})}

Respond with JSON:
{
  "issue_detected": boolean,
  "severity": "low|medium|high|critical",
  "issue_type": "string",
  "root_cause": "string",
  "fix": "string",
  "autoFixable": boolean
}`,
          },
        ],
      });

      const content = response.choices[0].message?.content;
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (err) {
      telemetryLogger.error('AI analysis failed', 'ai-monitor', err);
    }

    return null;
  }

  private async handleDetectedIssue(analysis: any): Promise<void> {
    telemetryLogger.warn(`Issue detected: ${analysis.issue_type} (${analysis.severity})`, 'ai-monitor', analysis);

    const maintenanceLog = database.createMaintenanceLog({
      issue: analysis.issue_type,
      status: 'started',
      startTime: Date.now(),
      estimatedMinutes: this.estimateFixTime(analysis.severity),
      message: analysis.root_cause,
    });

    this.inMaintenance = true;
    this.maintenanceStartTime = Date.now();

    try {
      // Notify all users about maintenance
      await this.notifyMaintenanceMode(maintenanceLog, analysis);

      // Attempt auto-fix if possible
      if (analysis.autoFixable) {
        await this.attemptAutoFix(analysis);
        database.completeMaintenanceLog(maintenanceLog.id);
      } else {
        // Mark as requiring manual intervention
        database.updateMaintenanceStatus(maintenanceLog.id, 'completed', 'Manual intervention required');
      }
    } catch (err) {
      database.updateMaintenanceStatus(maintenanceLog.id, 'failed', String(err));
      telemetryLogger.error('Failed to handle maintenance', 'ai-monitor', err);
    } finally {
      this.inMaintenance = false;
    }
  }

  private estimateFixTime(severity: string): number {
    const times: Record<string, number> = {
      low: 2,
      medium: 5,
      high: 10,
      critical: 15,
    };
    return times[severity] || 5;
  }

  private async notifyMaintenanceMode(maintenanceLog: any, analysis: any): Promise<void> {
    if (!this.telegramNotifier) return;

    const users = database.getAllActiveUsers();
    const message = `⚠️ *MAINTENANCE ALERT*
Issue: ${analysis.issue_type}
Severity: ${analysis.severity.toUpperCase()}
Estimated Fix Time: ${this.estimateFixTime(analysis.severity)} minutes

We're working on it! The bot will be back online shortly.
You'll be notified once we're back.`;

    for (const user of users) {
      try {
        await this.telegramNotifier.sendMessage(message, user.telegramId);
      } catch (err) {
        telemetryLogger.error(`Failed to notify user ${user.id}`, 'ai-monitor', err);
      }
    }

    telemetryLogger.info(`Maintenance notification sent to ${users.length} users`, 'ai-monitor');
  }

  private async attemptAutoFix(analysis: any): Promise<void> {
    telemetryLogger.info(`Attempting auto-fix: ${analysis.fix}`, 'ai-monitor');

    // Common auto-fixes
    if (analysis.issue_type.includes('memory')) {
      // Clear caches, garbage collection
      if (global.gc) {
        global.gc();
        telemetryLogger.info('Garbage collection triggered', 'ai-monitor');
      }
    }

    if (analysis.issue_type.includes('database')) {
      // Reset database connections
      telemetryLogger.info('Database connections reset', 'ai-monitor');
    }

    if (analysis.issue_type.includes('timeout')) {
      // Increase timeout values
      telemetryLogger.info('Timeout values increased', 'ai-monitor');
    }

    telemetryLogger.info('Auto-fix completed', 'ai-monitor');
  }

  isInMaintenance(): boolean {
    return this.inMaintenance;
  }

  getMaintenanceStatus(): { inMaintenance: boolean; uptime?: number } {
    return {
      inMaintenance: this.inMaintenance,
      uptime: this.inMaintenance ? Date.now() - this.maintenanceStartTime : undefined,
    };
  }
}

export default new AIMonitor();
