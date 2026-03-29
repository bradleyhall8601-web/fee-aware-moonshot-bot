// src/encryption.ts
// Encryption service for sensitive data (private keys, API keys)

import crypto from 'crypto';

class EncryptionService {
  private encryptionKey: string;
  private algorithm = 'aes-256-gcm';

  constructor() {
    // Use environment variable or generate from process
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateKey();
    
    if (!process.env.ENCRYPTION_KEY) {
      console.warn('[encryption] Using generated key. Set ENCRYPTION_KEY for production!');
    }
  }

  private generateKey(): string {
    // Generate a secure key if not provided
    return crypto.randomBytes(32).toString('hex');
  }

  encrypt(data: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        this.algorithm,
        Buffer.from(this.encryptionKey, 'hex'),
        iv
      );

      let encrypted = cipher.update(data);
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      const authTag = cipher.getAuthTag();

      // Combine iv + authTag + encrypted
      const combined = Buffer.concat([iv, authTag, encrypted]);
      return combined.toString('hex');
    } catch (err) {
      throw new Error(`Encryption failed: ${err}`);
    }
  }

  decrypt(encryptedData: string): string {
    try {
      const combined = Buffer.from(encryptedData, 'hex');

      // Extract components
      const iv = combined.slice(0, 16);
      const authTag = combined.slice(16, 32);
      const encrypted = combined.slice(32);

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        Buffer.from(this.encryptionKey, 'hex'),
        iv
      );

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString('utf-8');
    } catch (err) {
      throw new Error(`Decryption failed: ${err}`);
    }
  }

  encryptPrivateKey(privateKey: string): string {
    // Extra validation for private keys
    if (!privateKey || privateKey.length < 80) {
      throw new Error('Invalid private key format');
    }
    return this.encrypt(privateKey);
  }

  decryptPrivateKey(encryptedKey: string): string {
    const decrypted = this.decrypt(encryptedKey);
    if (decrypted.length < 80) {
      throw new Error('Decryption failed - invalid key');
    }
    return decrypted;
  }

  hashPassword(password: string): string {
    return crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');
  }

  verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }
}

export default new EncryptionService();
