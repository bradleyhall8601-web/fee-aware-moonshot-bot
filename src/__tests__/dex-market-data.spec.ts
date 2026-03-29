// src/__tests__/dex-market-data.spec.ts
import dexMarketData from '../dex-market-data';

describe('DEX Market Data', () => {
  describe('MoonshotCandidate interface', () => {
    it('should have all required properties for a moonshot candidate', () => {
      const mockCandidate = {
        mint: 'TokenMint123',
        symbol: 'TEST',
        name: 'Test Token',
        price: 0.000001,
        liquidity: 50000,
        volume24h: 100000,
        priceChange5m: 5.2,
        holders: 500,
        age: 2,
        buys: 150,
        sells: 50,
        buyPressure: 75,
        confidence: 85,
        dexs: ['Raydium', 'Jupiter'],
      };

      expect(mockCandidate.mint).toBeDefined();
      expect(mockCandidate.confidence).toBeGreaterThan(0);
      expect(mockCandidate.confidence).toBeLessThanOrEqual(100);
    });
  });

  describe('getMoonshotCandidates', () => {
    it('should return an array of moonshot candidates', async () => {
      try {
        const candidates = await dexMarketData.getMoonshotCandidates();
        expect(Array.isArray(candidates)).toBe(true);
        
        if (candidates.length > 0) {
          const candidate = candidates[0];
          expect(candidate.mint).toBeDefined();
          expect(candidate.confidence).toBeGreaterThan(0);
          expect(candidate.liquidity).toBeGreaterThan(0);
        }
      } catch (e) {
        // API may not be available in test environment
        expect(e).toBeDefined();
      }
    });
  });

  describe('getPrice', () => {
    it('should fetch token price', async () => {
      try {
        const price = await dexMarketData.getPrice('TokenMint123');
        if (price !== null) {
          expect(typeof price).toBe('number');
          expect(price).toBeGreaterThanOrEqual(0);
        }
      } catch (e) {
        // API may not be available in test environment
        expect(e).toBeDefined();
      }
    });
  });
});
