// src/user-manager.ts
// Multi-user management system

import { v4 as uuidv4 } from 'uuid';
import { Keypair, PublicKey } from '@solana/web3.js';
import database, { User, UserConfig } from './database';
import telemetryLogger from './telemetry';
import encryption from './encryption';

const bs58 = require('bs58');

class UserManager {
  async registerUser(telegramId: string, username: string, walletAddress: string, privateKey: string): Promise<User> {
    const existingUser = database.getUserByTelegramId(String(telegramId));
    if (existingUser) {
      throw new Error('User already registered');
    }

    const secret = bs58.decode(privateKey.trim());
    const keypair = Keypair.fromSecretKey(secret);
    const derivedAddress = keypair.publicKey.toBase58();

    if (walletAddress && walletAddress !== derivedAddress) {
      throw new Error('Wallet address does not match private key');
    }

    // Validate address format
    new PublicKey(derivedAddress);

    const encryptedPrivateKey = encryption.encryptPrivateKey(privateKey.trim());

    const userId = uuidv4();
    const user = database.createUser({
      id: userId,
      telegramId: String(telegramId),
      username,
      walletAddress: derivedAddress,
      privateKey: encryptedPrivateKey,
      isActive: true,
    });

    const defaultConfig: UserConfig = {
      userId,
      minLiquidityUsd: 7500,
      maxPoolAgeMs: 48 * 60 * 60 * 1000,
      minTxns: 15,
      maxTxns: 1200,
      profitTargetPct: 30,
      trailingStopPct: 15,
      enableLiveTrading: false,
      tradeSize: 25,
      maxOpenTrades: 3,
      dailyLossCapUsd: 100,
      gasReserveSol: 0.02,
      maxTradeSizeUsd: 50,
      emergencyStop: false,
      userSuspended: false,
      failureCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    database.updateUserConfig(defaultConfig);
    telemetryLogger.info(`User registered: ${username} (${telegramId})`);

    return user;
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
      userId,
      updatedAt: Date.now(),
    };

    database.updateUserConfig(updated);
    telemetryLogger.info(`User config updated: ${userId}`);
  }

  decryptPrivateKey(encrypted: string): string {
    try {
      return encryption.decryptPrivateKey(encrypted);
    } catch {
      // Legacy fallback: if old rows were stored plain base58, accept and migrate on next wallet update.
      return encrypted;
    }
  }

  rotateWallet(userId: string, newPrivateKeyBase58: string): string {
    const user = database.getUserById(userId);
    if (!user) throw new Error('User not found');

    const keypair = Keypair.fromSecretKey(bs58.decode(newPrivateKeyBase58.trim()));
    const walletAddress = keypair.publicKey.toBase58();
    const encrypted = encryption.encryptPrivateKey(newPrivateKeyBase58.trim());

    database.updateUserWallet(userId, walletAddress, encrypted);
    telemetryLogger.info(`Wallet rotated for user ${userId}`, 'user-manager');
    return walletAddress;
  }

  async revokeWallet(userId: string): Promise<void> {
    const cfg = this.getUserConfig(userId);
    if (!cfg) throw new Error('User not found');
    await this.updateUserConfig(userId, { enableLiveTrading: false, emergencyStop: true });
    telemetryLogger.warn(`Wallet revoked (trading disabled) for user ${userId}`, 'user-manager');
  }
}

export default new UserManager();
