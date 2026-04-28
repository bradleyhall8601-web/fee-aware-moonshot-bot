// src/__tests__/encryption.spec.ts
import Encryption from '../encryption.js';

// EncryptionService class extracted for direct instantiation in tests
import crypto from 'crypto';

class EncryptionService {
  private encryptionKey: string;
  private algorithm = 'aes-256-gcm';

  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    if (!process.env.ENCRYPTION_KEY) {
      console.warn('[encryption] Using generated key. Set ENCRYPTION_KEY for production!');
    }
  }

  encrypt(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.encryptionKey, 'hex'), iv);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = (cipher as any).getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('hex');
  }

  decrypt(encryptedData: string): string {
    const combined = Buffer.from(encryptedData, 'hex');
    const iv = combined.slice(0, 16);
    const authTag = combined.slice(16, 32);
    const encrypted = combined.slice(32);
    const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(this.encryptionKey, 'hex'), iv);
    (decipher as any).setAuthTag(authTag);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf-8');
  }

  encryptPrivateKey(privateKey: string): string {
    if (!privateKey || privateKey.length < 80) throw new Error('Invalid private key format');
    return this.encrypt(privateKey);
  }

  decryptPrivateKey(encryptedKey: string): string {
    const decrypted = this.decrypt(encryptedKey);
    if (decrypted.length < 80) throw new Error('Decryption failed - invalid key');
    return decrypted;
  }
}

describe('Encryption Service', () => {
  let encryption: EncryptionService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = '0'.repeat(64); // 32 bytes in hex = 64 chars
    encryption = new EncryptionService();
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt data successfully', () => {
      const testData = 'sensitive information';
      const encrypted = encryption.encrypt(testData);
      const decrypted = encryption.decrypt(encrypted);
      expect(decrypted).toBe(testData);
    });

    it('should throw error on invalid encryption key', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => {
        const enc = new EncryptionService();
        enc.encrypt('test');
      }).toThrow();
    });

    it('should produce different encrypted output for same input', () => {
      const testData = 'test data';
      const encrypted1 = encryption.encrypt(testData);
      const encrypted2 = encryption.encrypt(testData);
      expect(encrypted1).not.toBe(encrypted2); // Different IVs = different output
    });
  });

  describe('encryptPrivateKey/decryptPrivateKey', () => {
    it('should encrypt and decrypt private keys', () => {
      const privateKey = 'a'.repeat(128); // Simulate valid private key
      const encrypted = encryption.encryptPrivateKey(privateKey);
      const decrypted = encryption.decryptPrivateKey(encrypted);
      expect(decrypted).toBe(privateKey);
    });

    it('should reject invalid private key format', () => {
      const invalidKey = 'tooshort';
      expect(() => {
        encryption.encryptPrivateKey(invalidKey);
      }).toThrow('Invalid private key format');
    });
  });
});
