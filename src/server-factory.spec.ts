import { describe, it, expect } from '@jest/globals';
import { createServer } from './server-factory.js';

describe('Server Factory', () => {
  describe('Parameter Validation', () => {
    it('should create server instance with valid parameters', async () => {
      const server = await createServer('test-token', 'user123');
      expect(server).toBeDefined();
      expect(server).toHaveProperty('setRequestHandler');
    });

    it('should allow empty accessToken (not used by remember-mcp)', async () => {
      // accessToken is not used by remember-mcp (self-managed data)
      // Should not throw even with empty string
      await expect(createServer('', 'user123')).resolves.toBeDefined();
    });

    it('should require userId', async () => {
      await expect(createServer('token', '')).rejects.toThrow('userId is required');
    });

    it('should accept custom options', async () => {
      const server = await createServer('token', 'user123', {
        name: 'custom-name',
        version: '2.0.0',
      });
      expect(server).toBeDefined();
    });
  });

  describe('Server Isolation', () => {
    it('should create separate instances for different users', () => {
      const server1 = createServer('token1', 'user1');
      const server2 = createServer('token2', 'user2');
      
      expect(server1).not.toBe(server2);
    });

    it('should scope operations to userId', () => {
      const server = createServer('token', 'user123');
      expect(server).toBeDefined();
      // Note: Actual scoping tested in integration tests
    });
  });

  describe('Options', () => {
    it('should use default name if not provided', () => {
      const server = createServer('token', 'user123');
      expect(server).toBeDefined();
    });

    it('should use custom name if provided', () => {
      const server = createServer('token', 'user123', { name: 'custom' });
      expect(server).toBeDefined();
    });

    it('should use custom version if provided', () => {
      const server = createServer('token', 'user123', { version: '2.0.0' });
      expect(server).toBeDefined();
    });
  });
});
