// src/ai-support.ts
// NOVA - AI support assistant for users

import telemetryLogger from './telemetry';

export interface SupportTicket {
  id: string;
  userId: string;
  telegramId: string;
  question: string;
  response: string;
  createdAt: number;
  resolved: boolean;
}

class AISupport {
  private openai: any = null;
  private tickets: SupportTicket[] = [];

  async initialize(): Promise<void> {
    if (!process.env.OPENAI_API_KEY) return;
    try {
      const { default: OpenAI } = await import('openai');
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } catch {
      telemetryLogger.warn('NOVA: OpenAI init failed', 'ai-support');
    }
  }

  async answer(
    question: string,
    userId: string,
    telegramId: string,
    isAdmin = false,
    isOwner = false
  ): Promise<string> {
    const systemContext = this.buildContext(isAdmin, isOwner);

    if (this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemContext },
            { role: 'user', content: question },
          ],
          max_tokens: 400,
          temperature: 0.6,
        });
        const answer = response.choices[0]?.message?.content || this.fallbackAnswer(question);
        this.createTicket(userId, telegramId, question, answer);
        return answer;
      } catch {
        return this.fallbackAnswer(question);
      }
    }

    return this.fallbackAnswer(question);
  }

  private buildContext(isAdmin: boolean, isOwner: boolean): string {
    const role = isOwner ? 'owner' : isAdmin ? 'admin' : 'user';
    return `You are NOVA, the friendly AI support assistant for MoonShotForge - a Solana meme-coin trading bot.
You are speaking with a ${role}.
Help with: bot features, trading modes (paper/live), subscriptions ($49.99/month via PayPal or SOL), wallet setup, signals, performance.
Never bypass access rules. Never expose secrets or private keys.
For ${role === 'user' ? 'subscription questions, direct them to /join or /pay' : 'admin questions, provide detailed system info'}.
Keep responses concise and helpful.`;
  }

  private fallbackAnswer(question: string): string {
    const q = question.toLowerCase();
    if (q.includes('subscribe') || q.includes('pay') || q.includes('price')) {
      return `💳 Subscription is $${process.env.SUBSCRIPTION_PRICE_DISPLAY || '$49.99/month'}\n\nPayment options:\n• PayPal: /pay\n• SOL: /subscribe\n\nUse /join to get started!`;
    }
    if (q.includes('paper') || q.includes('live') || q.includes('mode')) {
      return `📊 Trading Modes:\n• Paper Mode: Simulated trades (default, safe)\n• Live Mode: Real trades with your wallet (requires subscription + approval)\n\nUse /mode to see your current mode.`;
    }
    if (q.includes('wallet') || q.includes('connect')) {
      return `💼 Wallet Setup:\n1. Use /start to register\n2. Connect your Solana wallet\n3. Paper trade first to test\n4. Enable live mode when ready\n\nYour private key is never stored in plain text.`;
    }
    if (q.includes('signal') || q.includes('trade')) {
      return `🎯 Signals:\nThe bot scans DexScreener, GeckoTerminal, PumpFun and more.\nSignals are scored 0-100 and filtered by AI.\nUse /signals to see current signals.`;
    }
    return `👋 Hi! I'm NOVA, your MoonShotForge assistant.\n\nI can help with:\n• Subscriptions (/join, /pay)\n• Trading modes (/mode)\n• Wallet setup\n• Signals & performance\n\nWhat do you need help with?`;
  }

  private createTicket(userId: string, telegramId: string, question: string, response: string): void {
    const ticket: SupportTicket = {
      id: `ticket_${Date.now()}`,
      userId,
      telegramId,
      question,
      response,
      createdAt: Date.now(),
      resolved: true,
    };
    this.tickets.push(ticket);
    if (this.tickets.length > 500) this.tickets.shift();
  }

  getTickets(userId?: string): SupportTicket[] {
    return userId ? this.tickets.filter(t => t.userId === userId) : this.tickets;
  }
}

export default new AISupport();
