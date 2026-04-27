// src/ai-signal-engine.ts
// OpenAI GPT-4o-mini as final signal gate

import telemetryLogger from './telemetry';
import type { AggregatedSignal } from './signal-aggregator';
import type { ConfidenceResult } from './confidence-scorer';
import type { TradingMode } from './adaptive-strategy-engine';

export type AIDecision = 'BUY' | 'SKIP' | 'WATCH';

export interface AISignalResult {
  decision: AIDecision;
  confidence: number;
  reason: string;
  riskNotes: string;
  suggestedMode?: TradingMode;
  usedAI: boolean;
}

class AISignalEngine {
  private openai: any = null;
  private enabled = process.env.OPENAI_API_KEY && process.env.ENABLE_AI_MONITOR === 'true';
  private model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  private recentPerformance: { wins: number; losses: number } = { wins: 0, losses: 0 };

  async initialize(): Promise<void> {
    if (!this.enabled || !process.env.OPENAI_API_KEY) {
      telemetryLogger.info('AI Signal Engine: disabled (no API key or ENABLE_AI_MONITOR=false)', 'ai-signal');
      return;
    }
    try {
      const { default: OpenAI } = await import('openai');
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      telemetryLogger.info('AI Signal Engine: initialized', 'ai-signal');
    } catch (err) {
      telemetryLogger.warn('AI Signal Engine: OpenAI init failed', 'ai-signal');
    }
  }

  async evaluate(
    signal: AggregatedSignal,
    confidence: ConfidenceResult,
    currentMode: TradingMode,
    recentWinRate: number
  ): Promise<AISignalResult> {
    if (!this.openai) {
      // Fallback: use confidence score
      return this.fallbackDecision(signal, confidence);
    }

    try {
      const prompt = this.buildPrompt(signal, confidence, currentMode, recentWinRate);
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a Solana meme-coin trading signal analyst. Analyze the provided token data and return a JSON decision. 
Output ONLY valid JSON with fields: decision (BUY|SKIP|WATCH), confidence (0-100), reason (string), riskNotes (string), suggestedMode (SNIPER|AGGRESSIVE_SCALP|HIGH_CONFIDENCE|SKIP).
Never override hard safety rules. Be conservative with new/unverified tokens.`,
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.3,
      });

      const text = response.choices[0]?.message?.content || '';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

      return {
        decision: parsed.decision || 'SKIP',
        confidence: parsed.confidence || confidence.score,
        reason: parsed.reason || 'AI analysis',
        riskNotes: parsed.riskNotes || '',
        suggestedMode: parsed.suggestedMode,
        usedAI: true,
      };
    } catch (err) {
      telemetryLogger.warn('AI signal evaluation failed, using fallback', 'ai-signal');
      return this.fallbackDecision(signal, confidence);
    }
  }

  private buildPrompt(
    signal: AggregatedSignal,
    confidence: ConfidenceResult,
    currentMode: TradingMode,
    recentWinRate: number
  ): string {
    return `Token: ${signal.symbol} (${signal.mint.slice(0, 8)}...)
Liquidity: $${signal.liquidity.toLocaleString()}
Volume 1h: $${signal.volume1h.toLocaleString()}
Buy Pressure: ${signal.buyPressure.toFixed(1)}%
Buys/Sells 1h: ${signal.buys1h}/${signal.sells1h}
5m Price Change: ${signal.priceChange5m.toFixed(2)}%
Token Age: ${signal.ageHours.toFixed(1)} hours
FDV: $${signal.fdvUsd.toLocaleString()}
Rug Risk: ${signal.rugRisk}
Sources: ${signal.sources.join(', ')} (${signal.sourceCount} sources)
Confidence Score: ${confidence.score}/100
Current Strategy Mode: ${currentMode}
Recent Win Rate: ${recentWinRate.toFixed(1)}%
Is PumpFun: ${signal.isPumpFun}`;
  }

  private fallbackDecision(signal: AggregatedSignal, confidence: ConfidenceResult): AISignalResult {
    if (confidence.passes && !signal.rugRisk) {
      return {
        decision: 'BUY',
        confidence: confidence.score,
        reason: `Confidence ${confidence.score} passes threshold ${confidence.threshold}`,
        riskNotes: signal.ageHours < 1 ? 'Very new token - high risk' : '',
        usedAI: false,
      };
    }
    if (confidence.score >= confidence.threshold - 15) {
      return {
        decision: 'WATCH',
        confidence: confidence.score,
        reason: `Near threshold (${confidence.score}/${confidence.threshold})`,
        riskNotes: '',
        usedAI: false,
      };
    }
    return {
      decision: 'SKIP',
      confidence: confidence.score,
      reason: `Below threshold (${confidence.score}/${confidence.threshold})`,
      riskNotes: '',
      usedAI: false,
    };
  }

  recordOutcome(win: boolean): void {
    if (win) this.recentPerformance.wins++;
    else this.recentPerformance.losses++;
  }

  getWinRate(): number {
    const total = this.recentPerformance.wins + this.recentPerformance.losses;
    return total > 0 ? (this.recentPerformance.wins / total) * 100 : 0;
  }
}

export default new AISignalEngine();
