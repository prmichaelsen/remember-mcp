/**
 * Tests for remember_moderate tool.
 */

import { moderateTool, handleModerate } from './moderate.js';
import type { AuthContext, GroupPermissions } from '../types/auth.js';

// ─── Mocks ───────────────────────────────────────────────────

const mockUpdate = jest.fn().mockResolvedValue(undefined);

jest.mock('../weaviate/client.js', () => ({
  getWeaviateClient: jest.fn(() => ({
    collections: {
      get: jest.fn().mockReturnValue({
        data: { update: jest.fn().mockResolvedValue(undefined) },
      }),
    },
  })),
  fetchMemoryWithAllProperties: jest.fn(),
}));

jest.mock('../weaviate/space-schema.js', () => ({
  ensurePublicCollection: jest.fn(),
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

jest.mock('../utils/error-handler.js', () => ({
  handleToolError: jest.fn(() => '{"success":false,"error":"internal"}'),
}));

import { getWeaviateClient, fetchMemoryWithAllProperties } from '../weaviate/client.js';
import { ensurePublicCollection } from '../weaviate/space-schema.js';

const mockFetchMemory = fetchMemoryWithAllProperties as jest.MockedFunction<any>;
const mockGetWeaviateClient = getWeaviateClient as jest.MockedFunction<any>;
const mockEnsurePublicCollection = ensurePublicCollection as jest.MockedFunction<any>;

// ─── Helpers ─────────────────────────────────────────────────

const BASE_PERMISSIONS: GroupPermissions = {
  can_read: true,
  can_publish: true,
  can_revise: false,
  can_propose: false,
  can_overwrite: false,
  can_comment: true,
  can_retract_own: true,
  can_retract_any: false,
  can_manage_members: false,
  can_moderate: false,
};

function makeModeratorAuth(groupId: string): AuthContext {
  return {
    accessToken: 'tok',
    credentials: {
      user_id: 'moderator-1',
      group_memberships: [{
        group_id: groupId,
        permissions: { ...BASE_PERMISSIONS, can_moderate: true },
      }],
    },
  };
}

function makeNonModeratorAuth(): AuthContext {
  return {
    accessToken: 'tok',
    credentials: {
      user_id: 'user-1',
      group_memberships: [{
        group_id: 'some-group',
        permissions: { ...BASE_PERMISSIONS, can_moderate: false },
      }],
    },
  };
}

const PUBLISHED_MEMORY = {
  properties: {
    content: 'Published memory',
    moderation_status: 'pending',
    author_id: 'author-1',
  },
};

// ─── Tests ───────────────────────────────────────────────────

describe('moderateTool definition', () => {
  it('has correct tool name', () => {
    expect(moderateTool.name).toBe('remember_moderate');
  });

  it('requires memory_id and action', () => {
    expect(moderateTool.inputSchema.required).toEqual(['memory_id', 'action']);
  });

  it('has action enum with approve, reject, remove', () => {
    const props = moderateTool.inputSchema.properties as Record<string, any>;
    expect(props.action.enum).toEqual(['approve', 'reject', 'remove']);
  });
});

describe('handleModerate', () => {
  let groupUpdate: jest.Mock;
  let spaceUpdate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    groupUpdate = jest.fn().mockResolvedValue(undefined);
    spaceUpdate = jest.fn().mockResolvedValue(undefined);

    mockGetWeaviateClient.mockReturnValue({
      collections: {
        get: jest.fn().mockReturnValue({
          data: { update: groupUpdate },
        }),
      },
    });

    mockEnsurePublicCollection.mockResolvedValue({
      data: { update: spaceUpdate },
    });

    mockFetchMemory.mockResolvedValue(PUBLISHED_MEMORY);
  });

  it('returns error when no space_id or group_id provided', async () => {
    const result = JSON.parse(
      await handleModerate({ memory_id: 'mem-1', action: 'approve' }, 'mod-1', makeModeratorAuth('g1'))
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing destination');
  });

  it('returns permission error for non-moderator on group', async () => {
    const result = JSON.parse(
      await handleModerate(
        { memory_id: 'mem-1', action: 'approve', group_id: 'team-1' },
        'user-1',
        makeNonModeratorAuth()
      )
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('Permission denied');
  });

  it('returns permission error for non-moderator on space', async () => {
    const result = JSON.parse(
      await handleModerate(
        { memory_id: 'mem-1', action: 'approve', space_id: 'public' },
        'user-1',
        makeNonModeratorAuth()
      )
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('Permission denied');
  });

  it('returns error when memory not found', async () => {
    mockFetchMemory.mockResolvedValue(null);

    const result = JSON.parse(
      await handleModerate(
        { memory_id: 'missing', action: 'approve', group_id: 'g1' },
        'mod-1',
        makeModeratorAuth('g1')
      )
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('Memory not found');
  });

  it('approves a memory in a group', async () => {
    const result = JSON.parse(
      await handleModerate(
        { memory_id: 'mem-1', action: 'approve', group_id: 'g1' },
        'mod-1',
        makeModeratorAuth('g1')
      )
    );
    expect(result.success).toBe(true);
    expect(result.moderation_status).toBe('approved');
    expect(result.moderated_by).toBe('mod-1');
    expect(result.moderated_at).toBeDefined();

    expect(groupUpdate).toHaveBeenCalledWith({
      id: 'mem-1',
      properties: expect.objectContaining({
        moderation_status: 'approved',
        moderated_by: 'mod-1',
      }),
    });
  });

  it('rejects a memory in a group', async () => {
    const result = JSON.parse(
      await handleModerate(
        { memory_id: 'mem-1', action: 'reject', group_id: 'g1', reason: 'Spam' },
        'mod-1',
        makeModeratorAuth('g1')
      )
    );
    expect(result.success).toBe(true);
    expect(result.moderation_status).toBe('rejected');
    expect(result.reason).toBe('Spam');
  });

  it('removes a memory in a group', async () => {
    const result = JSON.parse(
      await handleModerate(
        { memory_id: 'mem-1', action: 'remove', group_id: 'g1' },
        'mod-1',
        makeModeratorAuth('g1')
      )
    );
    expect(result.success).toBe(true);
    expect(result.moderation_status).toBe('removed');
  });

  it('moderates a memory in a space', async () => {
    const result = JSON.parse(
      await handleModerate(
        { memory_id: 'mem-1', action: 'approve', space_id: 'public' },
        'mod-1',
        makeModeratorAuth('some-group')
      )
    );
    expect(result.success).toBe(true);
    expect(result.moderation_status).toBe('approved');
    expect(result.location).toBe('space:public');

    expect(spaceUpdate).toHaveBeenCalledWith({
      id: 'mem-1',
      properties: expect.objectContaining({
        moderation_status: 'approved',
        moderated_by: 'mod-1',
      }),
    });
  });

  it('sets moderated_at to a valid ISO date', async () => {
    const before = new Date().toISOString();

    const result = JSON.parse(
      await handleModerate(
        { memory_id: 'mem-1', action: 'approve', group_id: 'g1' },
        'mod-1',
        makeModeratorAuth('g1')
      )
    );

    const after = new Date().toISOString();
    expect(result.moderated_at >= before).toBe(true);
    expect(result.moderated_at <= after).toBe(true);
  });
});
