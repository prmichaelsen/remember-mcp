/**
 * Tests for moderation status wiring in the publish flow.
 *
 * Verifies that executePublishMemory() sets moderation_status
 * based on SpaceConfig.require_moderation for each destination.
 */

import { handleConfirm } from './confirm.js';

// ─── Mocks (factories only — configured in beforeEach) ──────

jest.mock('../weaviate/client.js', () => ({
  getWeaviateClient: jest.fn(),
  getMemoryCollectionName: jest.fn((userId: string) => `Memory_users_${userId}`),
  fetchMemoryWithAllProperties: jest.fn(),
}));

jest.mock('../weaviate/space-schema.js', () => ({
  ensurePublicCollection: jest.fn(),
}));

jest.mock('../services/confirmation-token.service.js', () => ({
  confirmationTokenService: { confirmRequest: jest.fn() },
}));

jest.mock('../services/space-config.service.js', () => ({
  getSpaceConfig: jest.fn(),
}));

jest.mock('../utils/logger.js', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
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

jest.mock('../collections/dot-notation.js', () => ({
  CollectionType: { GROUPS: 'groups' },
  getCollectionName: jest.fn((_: string, id: string) => `Memory_groups_${id}`),
}));

jest.mock('../collections/composite-ids.js', () => ({
  generateCompositeId: jest.fn((u: string, m: string) => `${u}.${m}`),
  parseCompositeId: jest.fn(),
}));

jest.mock('../collections/tracking-arrays.js', () => ({
  addToSpaceIds: jest.fn(),
  addToGroupIds: jest.fn(),
  removeFromSpaceIds: jest.fn(),
  removeFromGroupIds: jest.fn(),
  getPublishedLocations: jest.fn(),
}));

jest.mock('../utils/error-handler.js', () => ({
  handleToolError: jest.fn(),
}));

// ─── Import mocked modules ──────────────────────────────────

import { getWeaviateClient, fetchMemoryWithAllProperties } from '../weaviate/client.js';
import { ensurePublicCollection } from '../weaviate/space-schema.js';
import { confirmationTokenService } from '../services/confirmation-token.service.js';
import { getSpaceConfig } from '../services/space-config.service.js';

const mockGetWeaviateClient = getWeaviateClient as jest.MockedFunction<any>;
const mockFetchMemory = fetchMemoryWithAllProperties as jest.MockedFunction<any>;
const mockEnsurePublicCollection = ensurePublicCollection as jest.MockedFunction<any>;
const mockConfirmRequest = confirmationTokenService.confirmRequest as jest.MockedFunction<any>;
const mockGetSpaceConfig = getSpaceConfig as jest.MockedFunction<any>;

// ─── Shared per-test mock state ──────────────────────────────

let spaceInsert: jest.Mock;
let spaceUpdate: jest.Mock;
let groupInsert: jest.Mock;
let groupUpdate: jest.Mock;
let userUpdate: jest.Mock;

const ORIGINAL_MEMORY = {
  properties: {
    user_id: 'user-1',
    content: 'Test memory',
    content_type: 'text',
    tags: ['test'],
    space_ids: [],
    group_ids: [],
  },
};

function makePublishRequest(overrides: Record<string, any> = {}) {
  return {
    request_id: 'req-1',
    userId: 'user-1',
    action: 'publish_memory' as const,
    payload: { memory_id: 'mem-1', spaces: [], groups: [], ...overrides },
    createdAt: Date.now(),
    expiresAt: Date.now() + 300_000,
    status: 'confirmed',
  };
}

// ─── Tests ───────────────────────────────────────────────────

describe('publish moderation wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Fresh mock functions per test
    spaceInsert = jest.fn().mockResolvedValue(undefined);
    spaceUpdate = jest.fn().mockResolvedValue(undefined);
    groupInsert = jest.fn().mockResolvedValue(undefined);
    groupUpdate = jest.fn().mockResolvedValue(undefined);
    userUpdate = jest.fn().mockResolvedValue(undefined);

    // Weaviate client: route collections by name
    mockGetWeaviateClient.mockReturnValue({
      collections: {
        get: jest.fn().mockImplementation((name: string) => {
          if (name.startsWith('Memory_groups_')) {
            return { data: { insert: groupInsert, update: groupUpdate } };
          }
          // User collection
          return { data: { insert: jest.fn(), update: userUpdate } };
        }),
      },
    });

    // Space collection via ensurePublicCollection
    mockEnsurePublicCollection.mockResolvedValue({
      data: { insert: spaceInsert, update: spaceUpdate },
    });

    // fetchMemoryWithAllProperties: 1st call = original, subsequent = null (not already published)
    mockFetchMemory
      .mockResolvedValueOnce(ORIGINAL_MEMORY)
      .mockResolvedValue(null);

    // Default: unmoderated
    mockGetSpaceConfig.mockResolvedValue({
      require_moderation: false,
      default_write_mode: 'owner_only',
    });
  });

  describe('spaces publication', () => {
    it('sets moderation_status to approved for unmoderated space', async () => {
      mockConfirmRequest.mockResolvedValue(makePublishRequest({ spaces: ['public'] }));

      await handleConfirm({ token: 'tok-1' }, 'user-1');

      expect(mockGetSpaceConfig).toHaveBeenCalledWith('public', 'space');
      expect(spaceInsert).toHaveBeenCalledTimes(1);
      expect(spaceInsert.mock.calls[0][0].properties.moderation_status).toBe('approved');
    });

    it('sets moderation_status to pending for moderated space', async () => {
      mockConfirmRequest.mockResolvedValue(makePublishRequest({ spaces: ['moderated-space'] }));
      mockGetSpaceConfig.mockResolvedValue({ require_moderation: true, default_write_mode: 'owner_only' });

      await handleConfirm({ token: 'tok-2' }, 'user-1');

      expect(mockGetSpaceConfig).toHaveBeenCalledWith('moderated-space', 'space');
      expect(spaceInsert).toHaveBeenCalledTimes(1);
      expect(spaceInsert.mock.calls[0][0].properties.moderation_status).toBe('pending');
    });

    it('sets pending if any of multiple spaces requires moderation', async () => {
      mockConfirmRequest.mockResolvedValue(makePublishRequest({ spaces: ['open', 'strict'] }));
      mockGetSpaceConfig
        .mockResolvedValueOnce({ require_moderation: false, default_write_mode: 'owner_only' })
        .mockResolvedValueOnce({ require_moderation: true, default_write_mode: 'owner_only' });

      await handleConfirm({ token: 'tok-3' }, 'user-1');

      expect(spaceInsert).toHaveBeenCalledTimes(1);
      expect(spaceInsert.mock.calls[0][0].properties.moderation_status).toBe('pending');
    });
  });

  describe('groups publication', () => {
    it('sets moderation_status to approved for unmoderated group', async () => {
      mockConfirmRequest.mockResolvedValue(makePublishRequest({ groups: ['team-alpha'] }));

      await handleConfirm({ token: 'tok-4' }, 'user-1');

      expect(mockGetSpaceConfig).toHaveBeenCalledWith('team-alpha', 'group');
      expect(groupInsert).toHaveBeenCalledTimes(1);
      expect(groupInsert.mock.calls[0][0].properties.moderation_status).toBe('approved');
    });

    it('sets moderation_status to pending for moderated group', async () => {
      mockConfirmRequest.mockResolvedValue(makePublishRequest({ groups: ['strict-group'] }));
      mockGetSpaceConfig.mockResolvedValue({ require_moderation: true, default_write_mode: 'owner_only' });

      await handleConfirm({ token: 'tok-5' }, 'user-1');

      expect(mockGetSpaceConfig).toHaveBeenCalledWith('strict-group', 'group');
      expect(groupInsert).toHaveBeenCalledTimes(1);
      expect(groupInsert.mock.calls[0][0].properties.moderation_status).toBe('pending');
    });

    it('sets independent moderation status per group', async () => {
      mockConfirmRequest.mockResolvedValue(makePublishRequest({ groups: ['open-group', 'strict-group'] }));
      // Reset fetchMemory: 1st = original, 2nd = null (open-group), 3rd = null (strict-group)
      mockFetchMemory.mockReset();
      mockFetchMemory
        .mockResolvedValueOnce(ORIGINAL_MEMORY)
        .mockResolvedValue(null);

      mockGetSpaceConfig
        .mockResolvedValueOnce({ require_moderation: false, default_write_mode: 'owner_only' })
        .mockResolvedValueOnce({ require_moderation: true, default_write_mode: 'owner_only' });

      await handleConfirm({ token: 'tok-6' }, 'user-1');

      expect(groupInsert).toHaveBeenCalledTimes(2);
      expect(groupInsert.mock.calls[0][0].properties.moderation_status).toBe('approved');
      expect(groupInsert.mock.calls[1][0].properties.moderation_status).toBe('pending');
    });
  });

  describe('default behavior', () => {
    it('defaults to approved when getSpaceConfig returns defaults', async () => {
      mockConfirmRequest.mockResolvedValue(makePublishRequest({ spaces: ['unknown-space'] }));

      await handleConfirm({ token: 'tok-7' }, 'user-1');

      expect(spaceInsert).toHaveBeenCalledTimes(1);
      expect(spaceInsert.mock.calls[0][0].properties.moderation_status).toBe('approved');
    });
  });
});
