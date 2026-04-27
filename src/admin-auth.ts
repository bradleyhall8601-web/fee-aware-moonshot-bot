// src/admin-auth.ts
// Admin authentication with session management

import crypto from 'crypto';
import telemetryLogger from './telemetry';

interface Session {
  token: string;
  createdAt: number;
  expiresAt: number;
  ip?: string;
}

interface FailedAttempt {
  count: number;
  lockedUntil: number;
}

class AdminAuth {
  private sessions = new Map<string, Session>();
  private failedAttempts = new Map<string, FailedAttempt>();
  private readonly SESSION_TTL = 12 * 60 * 60 * 1000; // 12 hours
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

  private getPasswordHash(): string {
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  login(password: string, ip?: string): { success: boolean; token?: string; error?: string } {
    const ipKey = ip || 'unknown';

    // Check lockout
    const failed = this.failedAttempts.get(ipKey);
    if (failed && Date.now() < failed.lockedUntil) {
      const remaining = Math.ceil((failed.lockedUntil - Date.now()) / 60000);
      return { success: false, error: `Too many attempts. Try again in ${remaining} minutes.` };
    }

    const inputHash = crypto.createHash('sha256').update(password).digest('hex');
    if (inputHash !== this.getPasswordHash()) {
      const current = this.failedAttempts.get(ipKey) || { count: 0, lockedUntil: 0 };
      current.count++;
      if (current.count >= this.MAX_ATTEMPTS) {
        current.lockedUntil = Date.now() + this.LOCKOUT_MS;
        telemetryLogger.warn(`Admin login locked for IP ${ipKey} after ${current.count} attempts`, 'admin-auth');
      }
      this.failedAttempts.set(ipKey, current);
      return { success: false, error: 'Invalid password' };
    }

    // Clear failed attempts
    this.failedAttempts.delete(ipKey);

    const token = crypto.randomBytes(32).toString('hex');
    const session: Session = {
      token,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.SESSION_TTL,
      ip,
    };
    this.sessions.set(token, session);
    telemetryLogger.info(`Admin login successful from ${ipKey}`, 'admin-auth');
    return { success: true, token };
  }

  validateToken(token: string): boolean {
    const session = this.sessions.get(token);
    if (!session) return false;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }

  logout(token: string): void {
    this.sessions.delete(token);
  }

  cleanExpiredSessions(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions) {
      if (now > session.expiresAt) this.sessions.delete(token);
    }
  }
}

export default new AdminAuth();
