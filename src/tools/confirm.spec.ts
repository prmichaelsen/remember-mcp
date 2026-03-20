/**
 * Tests for confirm tool — secret_token passthrough and set_trust_level handling.
 */

import { handleConfirm } from './confirm.js';

// ─── Mocks ──────────────────────────────────────────────────

jest.mock('../core-services.js', () => ({
  createCoreServices: jest.fn(),
}));

jest.mock('../weaviate/client.js', () => ({
  getWeaviateClient: jest.fn(),
  getMemoryCollectionName: jest.fn((userId: string) => `Memory_users_${userId}`),
}));

jest.mock('../utils/debug.js', () => ({
  createDebugLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    error: jest.fn(),
    time: jest.fn((_: string, fn: () => any) => fn()),
  })),
}));

jest.mock('../utils/error-handler.js', () => ({
  handleToolError: jest.fn(),
}));

import { createCoreServices } from '../core-services.js';
const mockCreateCoreServices = createCoreServices as jest.MockedFunction<any>;

// ─── Tests ───────────────────────────────────────────────────

describe('confirm tool', () => {
  let mockConfirm: jest.Mock;
  let mockValidateToken: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm = jest.fn();
    mockValidateToken = jest.fn();

    mockCreateCoreServices.mockReturnValue({
      space: { confirm: mockConfirm },
      token: { validateToken: mockValidateToken, confirmRequest: jest.fn() },
    });
  });

  it('passes secret_token through to space.confirm when provided', async () => {
    mockValidateToken.mockResolvedValue({ action: 'publish_memory' });
    mockConfirm.mockResolvedValue({
      action: 'publish_memory',
      success: true,
      composite_id: 'u1.m1',
      published_to: ['spaces: public'],
      space_ids: ['public'],
      group_ids: [],
    });

    await handleConfirm({ token: 'tok-1', secret_token: 'sec-abc' }, 'user-1');

    expect(mockConfirm).toHaveBeenCalledWith({ token: 'tok-1', secret_token: 'sec-abc' });
  });

  it('works without secret_token (backward compatible)', async () => {
    mockValidateToken.mockResolvedValue({ action: 'publish_memory' });
    mockConfirm.mockResolvedValue({
      action: 'publish_memory',
      success: true,
      composite_id: 'u1.m1',
      published_to: ['spaces: public'],
      space_ids: ['public'],
      group_ids: [],
    });

    await handleConfirm({ token: 'tok-1' }, 'user-1');

    expect(mockConfirm).toHaveBeenCalledWith({ token: 'tok-1', secret_token: undefined });
  });

  it('handles set_trust_level action via memory.confirmSetTrustLevel', async () => {
    const mockConfirmSetTrustLevel = jest.fn().mockResolvedValue({
      memory_id: 'mem-1',
      previous_trust_level: 'normal',
      new_trust_level: 'core',
      updated_at: '2026-03-20T00:00:00Z',
    });

    mockValidateToken.mockResolvedValue({ action: 'set_trust_level' });
    mockCreateCoreServices.mockReturnValue({
      space: { confirm: mockConfirm },
      token: { validateToken: mockValidateToken, confirmRequest: jest.fn() },
      memory: { confirmSetTrustLevel: mockConfirmSetTrustLevel },
    });

    const result = JSON.parse(await handleConfirm({ token: 'tok-trust' }, 'user-1') as string);

    expect(result.success).toBe(true);
    expect(result.memory_id).toBe('mem-1');
    expect(result.previous_trust_level).toBe('normal');
    expect(result.new_trust_level).toBe('core');
    expect(result.message).toBe('Trust level changed from normal to core');
    expect(mockConfirmSetTrustLevel).toHaveBeenCalledWith('tok-trust');
  });
});
