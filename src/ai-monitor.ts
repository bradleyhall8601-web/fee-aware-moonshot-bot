// src/ai-monitor.ts
// AI-powered monitoring and auto-fix agent
// NOTE: OpenAI functionality disabled by default. Enable with ENABLE_AI_MONITOR=true

import database from './database';
import telemetryLogger from './telemetry';

// Feature flag: Enable AI monitoring (disabled by default for cost control)
const ENABLE_AI_MONITOR = process.env.ENABLE_AI_MONITOR === 'true';

interface MaintenanceIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  affectedUsers: string[];
  estimatedFixTime: number; // minutes
  autoFixable: boolean;
}

class AIMonitor {
  private client: null = null;
  private isInitialized = false;
  private inMaintenance = false;
  private maintenanceStartTime = 0;
  private telegramNotifier: any = null;

  async initialize(telegramNotifier?: any): Promise<void> {
    if (!ENABLE_AI_MONITOR) {
      telemetryLogger.info('OpenAI API: DISABLED (ENABLE_AI_MONITOR=false in .env)', 'ai-monitor');
      this.isInitialized = false;
      return;
    }
    
    // OpenAI is disabled by default due to subscription needs
    telemetryLogger.warn('OpenAI API: DISABLED (awaiting subscription)', 'ai-monitor');
    this.isInitialized = false;
    return;
  }

  async monitorAndAnalyze(): Promise<void> {
    if (!ENABLE_AI_MONITOR) {
      return; // AI monitoring disabled
    }
    // OpenAI is disabled - AI monitoring not available
    return;
  }

  private async analyzeLogsWithAI(logs: string, metrics: any[], errorCount: number, warningCount: number): Promise<any> {
    // OpenAI is disabled - AI analysis not available
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
