// src/encryption.ts
// AES-256-GCM encryption service for sensitive data.

import crypto from 'crypto';

class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12;

  private getKey(): Buffer {
    const key = process.env.MASTER_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('MASTER_ENCRYPTION_KEY (or ENCRYPTION_KEY for backward compatibility) is required');
    }

    const isHex = /^[0-9a-fA-F]+$/.test(key) && key.length === 64;
    const decoded = isHex ? Buffer.from(key, 'hex') : Buffer.from(key, 'base64');

    if (decoded.length !== 32) {
      throw new Error('Encryption key must be exactly 32 bytes (64 hex chars or base64-encoded 32 bytes)');
    }

    return decoded;
  }

  encrypt(data: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return JSON.stringify({
      v: 1,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: encrypted.toString('base64'),
    });
  }

  decrypt(encryptedData: string): string {
    const parsed = JSON.parse(encryptedData) as { iv: string; tag: string; data: string };
    const decipher = crypto.createDecipheriv(this.algorithm, this.getKey(), Buffer.from(parsed.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.data, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf-8');
  }

  encryptPrivateKey(privateKey: string): string {
    if (!privateKey || privateKey.length < 64) {
      throw new Error('Invalid private key format');
    }
    return this.encrypt(privateKey);
  }

  decryptPrivateKey(encryptedKey: string): string {
    return this.decrypt(encryptedKey);
  }
}

export default new EncryptionService();
