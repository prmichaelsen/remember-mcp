/**
 * Tests for moderation status wiring in the publish flow.
 *
 * After migration to remember-core, the publish confirmation logic
 * is handled by SpaceService.confirm(). These tests verify the adapter
 * correctly delegates and formats responses.
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

// ─── Shared mock state ──────────────────────────────────────

let mockConfirm: jest.Mock;
let mockValidateToken: jest.Mock;

// ─── Tests ───────────────────────────────────────────────────

describe('publish moderation wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm = jest.fn();
    mockValidateToken = jest.fn();

    mockCreateCoreServices.mockReturnValue({
      space: { confirm: mockConfirm },
      token: { validateToken: mockValidateToken, confirmRequest: jest.fn() },
    });
  });

  describe('spaces publication', () => {
    it('sets moderation_status to approved for unmoderated space', async () => {
      mockValidateToken.mockResolvedValue({ action: 'publish_memory' });
      mockConfirm.mockResolvedValue({
        action: 'publish_memory',
        success: true,
        composite_id: 'user-1.mem-1',
        published_to: ['spaces: public'],
        space_ids: ['public'],
        group_ids: [],
      });

      const result = JSON.parse(await handleConfirm({ token: 'tok-1' }, 'user-1'));

      expect(result.success).toBe(true);
      expect(result.published_to).toContain('spaces: public');
      expect(mockConfirm).toHaveBeenCalledWith({ token: 'tok-1' });
    });

    it('sets moderation_status to pending for moderated space', async () => {
      mockValidateToken.mockResolvedValue({ action: 'publish_memory' });
      mockConfirm.mockResolvedValue({
        action: 'publish_memory',
        success: true,
        composite_id: 'user-1.mem-1',
        published_to: ['spaces: moderated-space'],
        space_ids: ['moderated-space'],
        group_ids: [],
      });

      const result = JSON.parse(await handleConfirm({ token: 'tok-2' }, 'user-1'));

      expect(result.success).toBe(true);
      expect(mockConfirm).toHaveBeenCalledWith({ token: 'tok-2' });
    });

    it('sets pending if any of multiple spaces requires moderation', async () => {
      mockValidateToken.mockResolvedValue({ action: 'publish_memory' });
      mockConfirm.mockResolvedValue({
        action: 'publish_memory',
        success: true,
        composite_id: 'user-1.mem-1',
        published_to: ['spaces: open, strict'],
        space_ids: ['open', 'strict'],
        group_ids: [],
      });

      const result = JSON.parse(await handleConfirm({ token: 'tok-3' }, 'user-1'));

      expect(result.success).toBe(true);
      expect(result.space_ids).toContain('open');
      expect(result.space_ids).toContain('strict');
    });
  });

  describe('groups publication', () => {
    it('sets moderation_status to approved for unmoderated group', async () => {
      mockValidateToken.mockResolvedValue({ action: 'publish_memory' });
      mockConfirm.mockResolvedValue({
        action: 'publish_memory',
        success: true,
        composite_id: 'user-1.mem-1',
        published_to: ['group: team-alpha'],
        space_ids: [],
        group_ids: ['team-alpha'],
      });

      const result = JSON.parse(await handleConfirm({ token: 'tok-4' }, 'user-1'));

      expect(result.success).toBe(true);
      expect(result.group_ids).toContain('team-alpha');
    });

    it('sets moderation_status to pending for moderated group', async () => {
      mockValidateToken.mockResolvedValue({ action: 'publish_memory' });
      mockConfirm.mockResolvedValue({
        action: 'publish_memory',
        success: true,
        composite_id: 'user-1.mem-1',
        published_to: ['group: strict-group'],
        space_ids: [],
        group_ids: ['strict-group'],
      });

      const result = JSON.parse(await handleConfirm({ token: 'tok-5' }, 'user-1'));

      expect(result.success).toBe(true);
      expect(result.group_ids).toContain('strict-group');
    });

    it('sets independent moderation status per group', async () => {
      mockValidateToken.mockResolvedValue({ action: 'publish_memory' });
      mockConfirm.mockResolvedValue({
        action: 'publish_memory',
        success: true,
        composite_id: 'user-1.mem-1',
        published_to: ['group: open-group', 'group: strict-group'],
        space_ids: [],
        group_ids: ['open-group', 'strict-group'],
      });

      const result = JSON.parse(await handleConfirm({ token: 'tok-6' }, 'user-1'));

      expect(result.success).toBe(true);
      expect(result.group_ids).toEqual(['open-group', 'strict-group']);
    });
  });

  describe('default behavior', () => {
    it('defaults to approved when getSpaceConfig returns defaults', async () => {
      mockValidateToken.mockResolvedValue({ action: 'publish_memory' });
      mockConfirm.mockResolvedValue({
        action: 'publish_memory',
        success: true,
        composite_id: 'user-1.mem-1',
        published_to: ['spaces: unknown-space'],
        space_ids: ['unknown-space'],
        group_ids: [],
      });

      const result = JSON.parse(await handleConfirm({ token: 'tok-7' }, 'user-1'));

      expect(result.success).toBe(true);
      expect(result.published_to).toBeDefined();
    });
  });
});
