// src/api-server.ts
// MoonShotForge REST API and web dashboard server

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import database from './database';
import userManager from './user-manager';
import telemetryLogger from './telemetry';
import tradingEngine from './trading-engine';
import dexMarketData from './dex-market-data';
import paperTrading from './paper-trading';
import signalAggregator from './signal-aggregator';
import confidenceScorer from './confidence-scorer';
import adminAuth from './admin-auth';
import accessManager from './access/access-manager';
import systemHealth from './system-health';
import stabilityMonitor from './stability-monitor';
import aiSelfImprove from './ai-self-improve';
import winStreakLearner from './win-streak-learner';
import cascadeState from './cascade-state';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Resolve the frontend dist directory relative to the compiled output location.
// In production: dist/api-server.js → ../../frontend/dist
// In dev (tsx):  src/api-server.ts  → ../frontend/dist
const FRONTEND_DIST = path.resolve(__dirname, '..', 'frontend', 'dist');

class ApiServer {
  private app: Express;
  private port = parseInt(process.env.PORT || process.env.API_PORT || '5000', 10);
  private server: any = null;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Relax CSP so the React SPA (with Vite-bundled assets) loads correctly.
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc:  ["'self'"],
            scriptSrc:   ["'self'", "'unsafe-inline'"],
            styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
            imgSrc:      ["'self'", 'data:', 'https:'],
            connectSrc:  ["'self'"],
          },
        },
      })
    );
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
    this.app.get('/health', async (req: Request, res: Response) => {
      const health = await systemHealth.getHealth();
      res.json(health);
    });

    this.app.get('/api/health', async (req: Request, res: Response) => {
      const health = await systemHealth.getHealth();
      res.json(health);
    });

    // Admin auth
    this.app.post('/api/admin/login', (req: Request, res: Response) => {
      const { password } = req.body;
      const ip = req.ip;
      const result = adminAuth.login(password, ip);
      if (result.success) {
        res.json({ success: true, token: result.token });
      } else {
        res.status(401).json({ success: false, error: result.error });
      }
    });

    this.app.post('/api/admin/logout', (req: Request, res: Response) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) adminAuth.logout(token);
      res.json({ success: true });
    });

    // Admin middleware
    const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
      const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token as string;
      if (!token || !adminAuth.validateToken(token)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      next();
    };

    // Admin endpoints
    this.app.post('/api/admin/grant', requireAdmin, async (req: Request, res: Response) => {
      const { userId, days } = req.body;
      accessManager.grantAccess(userId, 'admin', days || 30);
      res.json({ success: true });
    });

    this.app.post('/api/admin/revoke', requireAdmin, async (req: Request, res: Response) => {
      const { userId } = req.body;
      accessManager.revokeAccess(userId, 'admin');
      res.json({ success: true });
    });

    this.app.post('/api/admin/kill', requireAdmin, (req: Request, res: Response) => {
      process.env.ENABLE_LIVE_TRADING = 'false';
      telemetryLogger.warn('Emergency kill via API', 'api-server');
      res.json({ success: true, message: 'Live trading disabled' });
    });

    this.app.post('/api/admin/resume', requireAdmin, (req: Request, res: Response) => {
      res.json({ success: true, message: 'Bot resumed' });
    });

    this.app.post('/api/admin/broadcast', requireAdmin, async (req: Request, res: Response) => {
      const { message } = req.body;
      res.json({ success: true, message: 'Broadcast queued' });
    });

    // API Routes
    this.app.get('/api/users', requireAdmin, this.getUsers.bind(this));
    this.app.get('/api/users/:userId', requireAdmin, this.getUser.bind(this));
    this.app.post('/api/users/:userId/config', requireAdmin, this.updateUserConfig.bind(this));

    this.app.get('/api/trades/:userId', requireAdmin, this.getUserTrades.bind(this));
    this.app.get('/api/performance/:userId', this.getPerformance.bind(this));

    this.app.get('/api/signals', async (req: Request, res: Response) => {
      try {
        const signals = database.getRecentSignals(50);
        res.json(signals);
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    this.app.get('/api/positions', async (req: Request, res: Response) => {
      try {
        const positions = paperTrading.getOpenPositions();
        res.json(positions);
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    this.app.get('/api/paper', async (req: Request, res: Response) => {
      try {
        const stats = paperTrading.getStats();
        const simulations = paperTrading.getWalletSimulations();
        const closed = paperTrading.getClosedPositions(undefined, 20);
        res.json({ stats, simulations, recentTrades: closed });
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    this.app.get('/api/wallets', requireAdmin, async (req: Request, res: Response) => {
      try {
        const users = userManager.getAllActiveUsers();
        const wallets = users.map(u => ({
          userId: u.id,
          username: u.username,
          address: u.walletAddress ? u.walletAddress.slice(0, 8) + '...' : 'Not set',
        }));
        res.json(wallets);
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    this.app.get('/api/logs', requireAdmin, this.getSystemLogs.bind(this));

    this.app.get('/api/market/moonshots', this.getMoonshots.bind(this));
    this.app.get('/api/market/price/:mint', this.getTokenPrice.bind(this));

    this.app.get('/api/status', this.getSystemStatus.bind(this));
    this.app.get('/api/system/status', this.getSystemStatus.bind(this));
    this.app.get('/api/system/logs', requireAdmin, this.getSystemLogs.bind(this));
    this.app.get('/debug/telegram', this.getTelegramDebugInfo.bind(this));
    this.app.get('/debug/status', this.getDebugStatus.bind(this));

    // Support
    this.app.post('/api/support', async (req: Request, res: Response) => {
      try {
        const { question, userId, telegramId } = req.body;
        res.json({ message: 'Support ticket created. Use /support in Telegram for faster response.' });
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    // ── Serve public static pages ─────────────────────────────────────────────
    const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
    this.app.use(express.static(PUBLIC_DIR, { index: false }));

    // Try React frontend dist if available
    this.app.use(express.static(FRONTEND_DIST, { maxAge: '1d', index: false }));

    // Named page routes
    this.app.get('/', (req: Request, res: Response) => {
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) res.redirect('/landing.html');
      });
    });

    this.app.get('/admin/login', (req: Request, res: Response) => {
      res.sendFile(path.join(PUBLIC_DIR, 'admin-login.html'), (err) => {
        if (err) res.status(404).send('Admin login page not found');
      });
    });

    this.app.get('/admin', (req: Request, res: Response) => {
      res.sendFile(path.join(PUBLIC_DIR, 'admin-login.html'), (err) => {
        if (err) res.status(404).send('Admin page not found');
      });
    });

    // SPA catch-all
    this.app.get('*', async (req: Request, res: Response) => {
      // Try public dir first
      const publicIndex = path.join(PUBLIC_DIR, 'index.html');
      const frontendIndex = path.join(FRONTEND_DIST, 'index.html');
      try {
        await res.sendFile(frontendIndex);
      } catch {
        try {
          await res.sendFile(publicIndex);
        } catch {
          res.status(200).send(`<!DOCTYPE html>
<html>
<head><title>MoonShotForge</title>
<style>body{font-family:monospace;background:#0a0a0f;color:#22c55e;padding:2rem;margin:0}
h1{font-size:2rem;margin-bottom:1rem}a{color:#22c55e}
.badge{background:#1a1a2e;padding:0.5rem 1rem;border-radius:4px;display:inline-block;margin:0.25rem}
</style>
</head>
<body>
<h1>🚀 MoonShotForge</h1>
<p>Production-ready Solana meme-coin signal & trading bot</p>
<p>API is running on port ${this.port}</p>
<div>
  <span class="badge">📡 <a href="/health">/health</a></span>
  <span class="badge">📊 <a href="/api/status">/api/status</a></span>
  <span class="badge">🎯 <a href="/api/signals">/api/signals</a></span>
  <span class="badge">📄 <a href="/api/paper">/api/paper</a></span>
  <span class="badge">🔧 <a href="/admin/login">/admin/login</a></span>
  <span class="badge">🐛 <a href="/debug/status">/debug/status</a></span>
</div>
<p style="margin-top:2rem;color:#666">Mode: ${process.env.ENABLE_LIVE_TRADING === 'true' ? '🟢 LIVE' : '📄 PAPER'}</p>
</body>
</html>`);
        }
      }
    });
  }

  private async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const users = userManager.getAllActiveUsers();
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

      res.json({ user, config, metrics });
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
      res.json(metrics);
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
      const paperStats = paperTrading.getStats();
      const stability = stabilityMonitor.getStatus();

      res.json({
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        activeUsers: users.length,
        activeTrades: paperStats.openPositions,
        totalTrades: paperStats.totalTrades,
        winRate: paperStats.winRate,
        totalProfit: paperStats.totalProfit,
        mode: process.env.ENABLE_LIVE_TRADING === 'true' ? 'LIVE' : 'PAPER',
        stability: stability.healthy,
        threshold: confidenceScorer.getThreshold(),
        timestamp: new Date().toISOString(),
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
      const { default: telegramDebug } = await import('./telegram-debug.js');
      
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
      const paperStats = paperTrading.getStats();
      const port = this.port;

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
          openaiKey: process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Missing',
          totalUsers: users.length,
          activeTrades: paperStats.openPositions,
          totalTrades: paperStats.totalTrades,
          winRate: paperStats.winRate,
          liveTrading: process.env.ENABLE_LIVE_TRADING === 'true',
        },
        endpoints: {
          health: `http://localhost:${port}/health`,
          status: `http://localhost:${port}/api/status`,
          signals: `http://localhost:${port}/api/signals`,
          paper: `http://localhost:${port}/api/paper`,
          admin: `http://localhost:${port}/admin/login`,
          debug: `http://localhost:${port}/debug/status`,
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
