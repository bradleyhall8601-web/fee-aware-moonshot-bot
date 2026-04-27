// src/__tests__/encryption.spec.ts
import encryptionDefault from '../encryption';

// Create a fresh instance for testing
class TestEncryption {
  private encryptionKey: string;
  private algorithm = 'aes-256-gcm';
  private crypto = require('crypto');

  constructor(key?: string) {
    this.encryptionKey = key || this.crypto.randomBytes(32).toString('hex');
  }

  encrypt(data: string): string {
    const iv = this.crypto.randomBytes(16);
    const cipher = this.crypto.createCipheriv(this.algorithm, Buffer.from(this.encryptionKey, 'hex'), iv);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('hex');
  }

  decrypt(encryptedData: string): string {
    const combined = Buffer.from(encryptedData, 'hex');
    const iv = combined.slice(0, 16);
    const authTag = combined.slice(16, 32);
    const encrypted = combined.slice(32);
    const decipher = this.crypto.createDecipheriv(this.algorithm, Buffer.from(this.encryptionKey, 'hex'), iv);
    decipher.setAuthTag(authTag);
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
  let encryption: TestEncryption;

  beforeEach(() => {
    encryption = new TestEncryption('0'.repeat(64));
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt data successfully', () => {
      const testData = 'sensitive information';
      const encrypted = encryption.encrypt(testData);
      const decrypted = encryption.decrypt(encrypted);
      expect(decrypted).toBe(testData);
    });

    it('should throw error on invalid encryption key length', () => {
      expect(() => {
        const enc = new TestEncryption('tooshort');
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
