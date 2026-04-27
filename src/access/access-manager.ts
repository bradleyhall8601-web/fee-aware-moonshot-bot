// src/access/access-manager.ts
// Access control management

import database from '../database';
import telemetryLogger from '../telemetry';

export type AccessStatus = 'owner' | 'dev' | 'active' | 'expired' | 'unpaid' | 'revoked' | 'granted' | 'pending';

export interface AccessRecord {
  userId: string;
  telegramId: string;
  status: AccessStatus;
  grantedBy?: string;
  grantedAt?: number;
  expiresAt?: number;
  notes?: string;
  updatedAt: number;
}

class AccessManager {
  private ownerTelegramId = process.env.OWNER_TELEGRAM_ID || '';

  isOwner(telegramId: string): boolean {
    return telegramId === this.ownerTelegramId;
  }

  isAdmin(telegramId: string): boolean {
    if (this.isOwner(telegramId)) return true;
    try {
      const user = database.getUserByTelegramId(telegramId);
      if (!user) return false;
      const access = (database as any).getUserAccess?.(user.id);
      return access?.status === 'dev';
    } catch {
      return false;
    }
  }

  hasAccess(telegramId: string): boolean {
    if (this.isOwner(telegramId)) return true;
    try {
      const user = database.getUserByTelegramId(telegramId);
      if (!user) return false;
      const access = (database as any).getUserAccess?.(user.id);
      if (!access) return false;
      const allowed: AccessStatus[] = ['owner', 'dev', 'active', 'granted'];
      if (!allowed.includes(access.status)) return false;
      if (access.expiresAt && Date.now() > access.expiresAt) return false;
      return true;
    } catch {
      return false;
    }
  }

  grantAccess(userId: string, grantedBy: string, durationDays = 30): void {
    const expiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000;
    try {
      (database as any).setUserAccess?.(userId, 'active', grantedBy, expiresAt);
      telemetryLogger.info(`Access granted to ${userId} by ${grantedBy} for ${durationDays} days`, 'access');
    } catch (err) {
      telemetryLogger.error(`Failed to grant access to ${userId}`, 'access', err);
    }
  }

  revokeAccess(userId: string, revokedBy: string): void {
    try {
      (database as any).setUserAccess?.(userId, 'revoked', revokedBy);
      telemetryLogger.info(`Access revoked for ${userId} by ${revokedBy}`, 'access');
    } catch (err) {
      telemetryLogger.error(`Failed to revoke access for ${userId}`, 'access', err);
    }
  }

  setOwnerAccess(userId: string): void {
    try {
      (database as any).setUserAccess?.(userId, 'owner', 'system');
    } catch {
      // Ignore
    }
  }

  getAccessStatus(userId: string): AccessStatus {
    try {
      const access = (database as any).getUserAccess?.(userId);
      return access?.status || 'unpaid';
    } catch {
      return 'unpaid';
    }
  }

  getExpiryDate(userId: string): Date | null {
    try {
      const access = (database as any).getUserAccess?.(userId);
      if (access?.expiresAt) return new Date(access.expiresAt);
      return null;
    } catch {
      return null;
    }
  }
}

export default new AccessManager();
