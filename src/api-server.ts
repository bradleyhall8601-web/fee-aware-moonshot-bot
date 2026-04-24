// src/api-server.ts
// REST API and web dashboard server

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import database from './database';
import userManager from './user-manager';
import telemetryLogger from './telemetry';
import tradingEngine from './trading-engine';
import dexMarketData from './dex-market-data';

class ApiServer {
  private app: Express;
  private port = parseInt(process.env.API_PORT || '3000', 10);
  private server: any = null;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());

    // Logging middleware
    this.app.use((req: Request, res: Response, next: any) => {
      telemetryLogger.debug(`${req.method} ${req.path}`, 'api-server');
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // API Routes
    this.app.get('/api/users', this.getUsers.bind(this));
    this.app.get('/api/users/:userId', this.getUser.bind(this));
    this.app.post('/api/users/:userId/config', this.updateUserConfig.bind(this));

    this.app.get('/api/trades/:userId', this.getUserTrades.bind(this));
    this.app.get('/api/performance/:userId', this.getPerformance.bind(this));
    this.app.get('/api/execution/:userId', this.getExecutionMetrics.bind(this));

    this.app.get('/api/market/moonshots', this.getMoonshots.bind(this));
    this.app.get('/api/market/price/:mint', this.getTokenPrice.bind(this));

    this.app.get('/api/system/status', this.getSystemStatus.bind(this));
    this.app.get('/api/system/logs', this.getSystemLogs.bind(this));
    this.app.get('/debug/telegram', this.getTelegramDebugInfo.bind(this));
    this.app.get('/debug/status', this.getDebugStatus.bind(this));

    // Serve static dashboard
    this.app.use(express.static(process.cwd() + '/public'));
    this.app.get('/', (req: Request, res: Response) => {
      res.sendFile(process.cwd() + '/public/index.html');
    });
    this.app.get('/user', (req: Request, res: Response) => {
      res.sendFile(process.cwd() + '/public/user.html');
    });
    this.app.get('/admin', (req: Request, res: Response) => {
      res.sendFile(process.cwd() + '/public/admin.html');
    });
  }

  private async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const users = userManager.getAllActiveUsers().map(u => ({ ...u, privateKey: undefined }));
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  }

  private async getUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = String(req.params.userId);
      const user = database.getUserById(userId);
      const config = userManager.getUserConfig(userId);
      const metrics = database.getPerformanceMetrics(userId);

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ user: { ...user, privateKey: undefined }, config, metrics });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  }

  private async updateUserConfig(req: Request, res: Response): Promise<void> {
    try {
      const userId = String(req.params.userId);
      const updates = req.body;

      await userManager.updateUserConfig(userId, updates);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  }

  private async getUserTrades(req: Request, res: Response): Promise<void> {
    try {
      const userId = String(req.params.userId);
      const trades = database.getUserTradingSessions(userId);
      res.json(trades);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  }

  private async getPerformance(req: Request, res: Response): Promise<void> {
    try {
      const userId = String(req.params.userId);
      const metrics = database.getPerformanceMetrics(userId);
      res.json(metrics || {});
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  }


  private async getExecutionMetrics(req: Request, res: Response): Promise<void> {
    try {
      const userId = String(req.params.userId);
      const metrics = tradingEngine.getExecutionMetrics(userId);
      res.json(metrics || {});
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  }

  private async getMoonshots(req: Request, res: Response): Promise<void> {
    try {
      const candidates = await dexMarketData.getMoonshotCandidates();
      res.json(candidates);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  }

  private async getTokenPrice(req: Request, res: Response): Promise<void> {
    try {
      const mint = String(req.params.mint);
      const price = await dexMarketData.getPrice(mint);
      res.json({ mint, price });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  }

  private async getSystemStatus(req: Request, res: Response): Promise<void> {
    try {
      const users = userManager.getAllActiveUsers();
      const trades = users.flatMap(u => database.getUserTradingSessions(u.id));

      res.json({
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        activeUsers: users.length,
        activeTrades: trades.filter(t => t.status === 'open').length,
        totalTrades: trades.length,
        totalProfit: trades
          .filter(t => t.status === 'closed')
          .reduce((sum, t) => sum + (t.profit || 0), 0),
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  }

  private async getSystemLogs(req: Request, res: Response): Promise<void> {
    try {
      const lines = parseInt(req.query.lines as string) || 100;
      const logs = telemetryLogger.getLogsForAnalysis(lines);
      res.json({ logs });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  }

  private async getTelegramDebugInfo(req: Request, res: Response): Promise<void> {
    try {
      // Import here to avoid circular deps
      const telegramDebug = require('./telegram-debug').default;
      
      const users = userManager.getAllActiveUsers();
      const telegramUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        telegramId: u.telegramId,
        walletAddress: u.walletAddress.slice(0, 8) + '...',
        createdAt: u.createdAt,
      }));

      res.json({
        timestamp: new Date().toISOString(),
        telegramBotStatus: 'active',
        stats: telegramDebug.getStats(),
        totalUsers: telegramUsers.length,
        users: telegramUsers,
        recentLogs: telegramDebug.getRecentLogs(30),
        allLogs: telegramDebug.getAllLogs(),
        usage: 'View this at http://localhost:3000/debug/telegram',
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  }

  private async getDebugStatus(req: Request, res: Response): Promise<void> {
    try {
      const users = userManager.getAllActiveUsers();
      const trades = users.flatMap(u => database.getUserTradingSessions(u.id));

      res.json({
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        nodeVersion: process.version,
        platform: process.platform,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpuUsage: (process as any).cpuUsage?.() || 'N/A',
        },
        bot: {
          isRunning: true,
          telegramToken: process.env.TELEGRAM_BOT_TOKEN ? '✓ Set' : '✗ Missing',
          totalUsers: users.length,
          activeTrades: trades.filter(t => t.status === 'open').length,
          totalTrades: trades.length,
        },
        endpoints: {
          telegram: 'http://localhost:3000/debug/telegram',
          status: 'http://localhost:3000/api/system/status',
          health: 'http://localhost:3000/health',
        }
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        telemetryLogger.info(`API server started on port ${this.port}`, 'api-server');
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          telemetryLogger.info('API server stopped', 'api-server');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export default new ApiServer();
