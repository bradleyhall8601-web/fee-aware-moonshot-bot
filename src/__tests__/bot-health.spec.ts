// src/__tests__/bot-health.spec.ts
import telemetryLogger from '../telemetry';
import confidenceScorer from '../confidence-scorer';
import commandRegistry from '../command-registry';
import { createMockSignal, getDatabaseHealth } from '../handler-test-adapter';

describe('Bot Health Check', () => {
  describe('Telemetry Logger', () => {
    it('should log messages without errors', () => {
      expect(() => {
        telemetryLogger.info('Test message', 'test');
      }).not.toThrow();
    });

    it('should record metrics', () => {
      expect(() => {
        telemetryLogger.recordMetrics({
          activeUsers: 0,
          activeTrades: 0,
          totalProfit: 0,
        });
      }).not.toThrow();
    });

    it('should handle errors gracefully', () => {
      expect(() => {
        telemetryLogger.error('Test error', 'test', new Error('Test'));
      }).not.toThrow();
    });
  });

  describe('System Status', () => {
    it('should expose process metrics', () => {
      const uptime = process.uptime();
      expect(uptime).toBeGreaterThan(0);

      const memUsage = process.memoryUsage();
      expect(memUsage.heapUsed).toBeGreaterThan(0);
      expect(memUsage.heapTotal).toBeGreaterThan(memUsage.heapUsed);
    });
  });

  describe('Database Health', () => {
    it('should initialize database without errors', () => {
      const healthy = getDatabaseHealth();
      expect(healthy).toBe(true);
    });
  });

  describe('Confidence Scorer', () => {
    it('should score a mock signal', () => {
      const signal = createMockSignal();
      const result = confidenceScorer.score(signal);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.threshold).toBeGreaterThan(0);
      expect(typeof result.passes).toBe('boolean');
    });

    it('should return low score for bad signal', () => {
      const signal = createMockSignal({
        liquidity: 100,
        volume1h: 10,
        buyPressure: 20,
        buys1h: 5,
        sells1h: 50,
        priceChange5m: -10,
        rugRisk: true,
      });
      const result = confidenceScorer.score(signal);
      expect(result.score).toBeLessThan(50);
    });
  });

  describe('Command Registry', () => {
    it('should list all commands', () => {
      const commands = commandRegistry.getAllCommands();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(10);
      expect(commands).toContain('/start');
      expect(commands).toContain('/help');
      expect(commands).toContain('/status');
    });

    it('should record and retrieve command stats', () => {
      commandRegistry.record('/test', 'user123', 'testuser', true, 100);
      const stats = commandRegistry.getStats();
      expect(Array.isArray(stats)).toBe(true);
    });
  });

  describe('Environment', () => {
    it('should have ENABLE_LIVE_TRADING defaulting to false', () => {
      const liveEnabled = process.env.ENABLE_LIVE_TRADING === 'true';
      // In test environment, live trading should be disabled
      expect(liveEnabled).toBe(false);
    });
  });
});
