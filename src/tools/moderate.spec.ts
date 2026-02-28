/**
 * Tests for remember_moderate tool.
 */

import { moderateTool, handleModerate } from './moderate.js';
import type { AuthContext, GroupPermissions } from '../types/auth.js';

// ─── Mocks ───────────────────────────────────────────────────

jest.mock('../core-services.js', () => ({
  createCoreServices: jest.fn(),
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
  handleToolError: jest.fn(() => '{"success":false,"error":"internal"}'),
}));

import { createCoreServices } from '../core-services.js';
const mockCreateCoreServices = createCoreServices as jest.MockedFunction<any>;

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
  let mockModerate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockModerate = jest.fn();
    mockCreateCoreServices.mockReturnValue({
      space: { moderate: mockModerate },
    });
  });

  it('returns error when core throws for missing destination', async () => {
    mockModerate.mockRejectedValue(new Error('Must specify either space_id or group_id'));

    const result = JSON.parse(
      await handleModerate({ memory_id: 'mem-1', action: 'approve' }, 'mod-1', makeModeratorAuth('g1'))
    );
    expect(result.success).toBe(false);
  });

  it('returns error when core throws for non-moderator on group', async () => {
    mockModerate.mockRejectedValue(new Error('Permission denied'));

    const result = JSON.parse(
      await handleModerate(
        { memory_id: 'mem-1', action: 'approve', group_id: 'team-1' },
        'user-1',
        makeNonModeratorAuth()
      )
    );
    expect(result.success).toBe(false);
  });

  it('returns error when core throws for non-moderator on space', async () => {
    mockModerate.mockRejectedValue(new Error('Permission denied'));

    const result = JSON.parse(
      await handleModerate(
        { memory_id: 'mem-1', action: 'approve', space_id: 'public' },
        'user-1',
        makeNonModeratorAuth()
      )
    );
    expect(result.success).toBe(false);
  });

  it('returns error when core throws for memory not found', async () => {
    mockModerate.mockRejectedValue(new Error('Memory not found'));

    const result = JSON.parse(
      await handleModerate(
        { memory_id: 'missing', action: 'approve', group_id: 'g1' },
        'mod-1',
        makeModeratorAuth('g1')
      )
    );
    expect(result.success).toBe(false);
  });

  it('approves a memory in a group', async () => {
    mockModerate.mockResolvedValue({
      memory_id: 'mem-1',
      action: 'approve',
      moderation_status: 'approved',
      moderated_by: 'mod-1',
      moderated_at: new Date().toISOString(),
      location: 'group:g1',
    });

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
  });

  it('rejects a memory in a group', async () => {
    mockModerate.mockResolvedValue({
      memory_id: 'mem-1',
      action: 'reject',
      moderation_status: 'rejected',
      moderated_by: 'mod-1',
      moderated_at: new Date().toISOString(),
      location: 'group:g1',
    });

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
    mockModerate.mockResolvedValue({
      memory_id: 'mem-1',
      action: 'remove',
      moderation_status: 'removed',
      moderated_by: 'mod-1',
      moderated_at: new Date().toISOString(),
      location: 'group:g1',
    });

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
    mockModerate.mockResolvedValue({
      memory_id: 'mem-1',
      action: 'approve',
      moderation_status: 'approved',
      moderated_by: 'mod-1',
      moderated_at: new Date().toISOString(),
      location: 'space:public',
    });

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
  });

  it('sets moderated_at to a valid ISO date', async () => {
    const before = new Date().toISOString();
    const moderatedAt = new Date().toISOString();

    mockModerate.mockResolvedValue({
      memory_id: 'mem-1',
      action: 'approve',
      moderation_status: 'approved',
      moderated_by: 'mod-1',
      moderated_at: moderatedAt,
      location: 'group:g1',
    });

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
