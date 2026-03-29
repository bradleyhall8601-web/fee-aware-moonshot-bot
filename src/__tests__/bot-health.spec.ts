// src/__tests__/bot-health.spec.ts
import telemetryLogger from '../telemetry';

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
});
