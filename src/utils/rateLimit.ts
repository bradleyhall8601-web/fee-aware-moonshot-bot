/**
 * Token-bucket rate limiter.
 * Ensures we stay within a requests-per-minute budget.
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;
  private lastRefill: number;

  constructor(rpm: number) {
    this.maxTokens = rpm;
    this.tokens = rpm;
    this.refillIntervalMs = 60_000;
    this.lastRefill = Date.now();
  }

  /** Acquire one token, waiting if necessary. */
  async acquire(): Promise<void> {
    this.refill();
    while (this.tokens < 1) {
      const wait = this.refillIntervalMs / this.maxTokens;
      await sleep(wait);
      this.refill();
    }
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= this.refillIntervalMs) {
      // Full interval elapsed — reset to max tokens.
      this.tokens = this.maxTokens;
      this.lastRefill = now;
    } else {
      // Partial interval — add proportional tokens (sliding-window approach).
      // We update lastRefill on every call so that the next call measures
      // only the delta since the last refill, preventing double-counting.
      const refillAmount = (elapsed / this.refillIntervalMs) * this.maxTokens;
      this.tokens = Math.min(this.maxTokens, this.tokens + refillAmount);
      this.lastRefill = now;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
