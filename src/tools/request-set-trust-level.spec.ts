import { requestSetTrustLevelTool, handleRequestSetTrustLevel } from './request-set-trust-level.js';

// Mock core services
jest.mock('../core-services.js', () => ({
  createCoreServices: jest.fn(() => ({
    memory: {
      requestSetTrustLevel: jest.fn().mockResolvedValue({
        token: 'test-token-123',
        memory_id: 'mem-456',
        current_trust_level: 5,
        requested_trust_level: 2,
        expires_at: '2026-03-20T10:05:00Z',
      }),
    },
  })),
}));

jest.mock('../utils/debug.js', () => ({
  createDebugLogger: () => ({
    info: jest.fn(),
    trace: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('remember_request_set_trust_level', () => {
  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(requestSetTrustLevelTool.name).toBe('remember_request_set_trust_level');
    });

    it('should require memory_id and trust_level', () => {
      expect(requestSetTrustLevelTool.inputSchema.required).toEqual(['memory_id', 'trust_level']);
    });

    it('should constrain trust_level to 1-5 integer', () => {
      const trustProp = requestSetTrustLevelTool.inputSchema.properties.trust_level;
      expect(trustProp.type).toBe('integer');
      expect(trustProp.minimum).toBe(1);
      expect(trustProp.maximum).toBe(5);
    });
  });

  describe('handleRequestSetTrustLevel', () => {
    it('should return token on valid request', async () => {
      const result = await handleRequestSetTrustLevel(
        { memory_id: 'mem-456', trust_level: 2 },
        'user-123'
      );
      const parsed = JSON.parse(result!);
      expect(parsed.token).toBe('test-token-123');
      expect(parsed.memory_id).toBe('mem-456');
      expect(parsed.current_trust_level).toBe(5);
      expect(parsed.requested_trust_level).toBe(2);
      expect(parsed.current_trust_name).toBe('SECRET');
      expect(parsed.requested_trust_name).toBe('INTERNAL');
    });

    it('should reject non-integer trust level', async () => {
      const result = await handleRequestSetTrustLevel(
        { memory_id: 'mem-456', trust_level: 1.5 },
        'user-123'
      );
      const parsed = JSON.parse(result!);
      expect(parsed.error).toBe('Invalid trust level');
    });

    it('should reject trust level 0', async () => {
      const result = await handleRequestSetTrustLevel(
        { memory_id: 'mem-456', trust_level: 0 },
        'user-123'
      );
      const parsed = JSON.parse(result!);
      expect(parsed.error).toBe('Invalid trust level');
    });

    it('should reject trust level 6', async () => {
      const result = await handleRequestSetTrustLevel(
        { memory_id: 'mem-456', trust_level: 6 },
        'user-123'
      );
      const parsed = JSON.parse(result!);
      expect(parsed.error).toBe('Invalid trust level');
    });
  });
});
