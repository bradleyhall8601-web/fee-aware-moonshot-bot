// src/user-manager.ts
// Multi-user management system

import { v4 as uuidv4 } from 'uuid';
import database, { User, UserConfig } from './database';
import telemetryLogger from './telemetry';

class UserManager {
  private activeUsers: Map<string, any> = new Map();

  async registerUser(telegramId: string, username: string, walletAddress: string, privateKey: string): Promise<User> {
    const existingUser = database.getUserByTelegramId(String(telegramId));
    if (existingUser) {
      throw new Error('User already registered');
    }

    const userId = uuidv4();
    const user = database.createUser({
      id: userId,
      telegramId: String(telegramId),
      username,
      walletAddress,
      privateKey: this.encryptPrivateKey(privateKey),
      isActive: true,
    });

    // Create default config for user
    const defaultConfig: UserConfig = {
      userId,
      minLiquidityUsd: 7500,
      maxPoolAgeMs: 48 * 60 * 60 * 1000,
      minTxns: 15,
      maxTxns: 1200,
      profitTargetPct: 30,
      trailingStopPct: 15,
      enableLiveTrading: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    database.updateUserConfig(defaultConfig);
    telemetryLogger.info(`User registered: ${username} (${telegramId})`);

    return user;
  }

  async unregisterUser(userId: string): Promise<void> {
    const user = database.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // TODO: Deactivate user in database (soft delete)
    telemetryLogger.info(`User deregistered: ${user.username}`);
  }

  getUser(userId: string): User | null {
    return database.getUserById(userId);
  }

  getUserByTelegramId(telegramId: string): User | null {
    return database.getUserByTelegramId(String(telegramId));
  }

  getAllActiveUsers(): User[] {
    return database.getAllActiveUsers();
  }

  getUserConfig(userId: string): UserConfig | null {
    return database.getUserConfig(userId);
  }

  async updateUserConfig(userId: string, updates: Partial<UserConfig>): Promise<void> {
    const existing = database.getUserConfig(userId);
    if (!existing) {
      throw new Error('User config not found');
    }

    const updated: UserConfig = {
      ...existing,
      ...updates,
      userId, // Ensure userId stays the same
      updatedAt: Date.now(),
    };

    database.updateUserConfig(updated);
    telemetryLogger.info(`User config updated: ${userId}`);
  }

  decryptPrivateKey(encrypted: string): string {
    // TODO: Implement proper encryption/decryption
    // For now, return as-is (NEVER do this in production!)
    return encrypted;
  }

  private encryptPrivateKey(privateKey: string): string {
    // TODO: Implement proper encryption
    // For now, return as-is (NEVER do this in production!)
    return privateKey;
  }

  setUserActive(userId: string, active: boolean): void {
    const user = database.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    telemetryLogger.info(`User ${active ? 'activated' : 'deactivated'}: ${userId}`);
  }
}

export default new UserManager();
