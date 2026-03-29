// src/__tests__/encryption.spec.ts
import Encryption from '../encryption';

describe('Encryption Service', () => {
  let encryption: any;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = '0'.repeat(64); // 32 bytes in hex = 64 chars
    encryption = new (require('../encryption').default.constructor)();
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
        const enc = new (require('../encryption').default.constructor)();
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
