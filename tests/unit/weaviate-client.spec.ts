import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  initWeaviateClient,
  testWeaviateConnection,
  sanitizeUserId,
  getMemoryCollectionName,
  getTemplateCollectionName,
  getAuditCollectionName,
} from '../../src/weaviate/client.js';

describe('Weaviate Client', () => {
  describe('User ID Sanitization', () => {
    it('should sanitize email addresses', () => {
      expect(sanitizeUserId('user@example.com')).toBe('User_example_com');
    });

    it('should sanitize user IDs with hyphens', () => {
      expect(sanitizeUserId('user-123')).toBe('User_123');
    });

    it('should handle IDs starting with numbers', () => {
      expect(sanitizeUserId('123user')).toBe('_123user');
    });

    it('should handle special characters', () => {
      expect(sanitizeUserId('user!@#$%123')).toBe('User_____123');
    });
  });

  describe('Collection Name Generation', () => {
    it('should generate memory collection names', () => {
      expect(getMemoryCollectionName('user123')).toBe('Memory_User123');
      expect(getMemoryCollectionName('user@test.com')).toBe('Memory_User_test_com');
    });

    it('should generate template collection names', () => {
      expect(getTemplateCollectionName('user123')).toBe('Template_User123');
      expect(getTemplateCollectionName('user@test.com')).toBe('Template_User_test_com');
    });

    it('should generate audit collection names', () => {
      expect(getAuditCollectionName('user123')).toBe('Audit_User123');
      expect(getAuditCollectionName('user@test.com')).toBe('Audit_User_test_com');
    });
  });

  // Integration tests (require Weaviate instance)
  describe.skip('Weaviate Connection', () => {
    beforeAll(async () => {
      await initWeaviateClient();
    });

    it('should initialize client', async () => {
      const result = await testWeaviateConnection();
      expect(result).toBe(true);
    });
  });
});
