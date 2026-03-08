/**
 * Unit tests for unified internal memory tools (task-218)
 */
import type { AuthContext } from '../types/auth.js';

// Mock core-services
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockByTime = jest.fn();
jest.mock('../core-services.js', () => ({
  createCoreServices: jest.fn(() => ({
    memory: {
      create: mockCreate,
      update: mockUpdate,
      byTime: mockByTime,
    },
  })),
}));

// Mock weaviate schema
const mockFetchObjectById = jest.fn();
jest.mock('../weaviate/schema.js', () => ({
  getMemoryCollection: jest.fn(() => ({
    query: { fetchObjectById: mockFetchObjectById },
  })),
}));

// Mock debug
jest.mock('../utils/debug.js', () => ({
  createDebugLogger: () => ({
    info: jest.fn(),
    trace: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock search-memory and query-memory (used by search/query internal wrappers)
const mockHandleSearchMemory = jest.fn();
const mockHandleQueryMemory = jest.fn();
jest.mock('./search-memory.js', () => ({
  handleSearchMemory: (...args: any[]) => mockHandleSearchMemory(...args),
}));
jest.mock('./query-memory.js', () => ({
  handleQueryMemory: (...args: any[]) => mockHandleQueryMemory(...args),
}));

// Mock search-by (used by search-internal-memory-by wrapper)
const mockHandleSearchBy = jest.fn();
jest.mock('./search-by.js', () => ({
  handleSearchBy: (...args: any[]) => mockHandleSearchBy(...args),
}));

import { handleCreateInternalMemory } from './create-internal-memory.js';
import { handleUpdateInternalMemory } from './update-internal-memory.js';
import { handleSearchInternalMemory } from './search-internal-memory.js';
import { handleQueryInternalMemory } from './query-internal-memory.js';
import { handleSearchInternalMemoryBy } from './search-internal-memory-by.js';

const baseAuth: AuthContext = { accessToken: null, credentials: null };
const userId = 'test-user';

const ghostUserAuth: AuthContext = {
  ...baseAuth,
  internalContext: {
    type: 'ghost',
    ghost_type: 'user',
    owner_user_id: 'alice',
    accessor_user_id: 'bob',
    accessor_trust_level: 0.7,
  },
};

const agentAuth: AuthContext = {
  ...baseAuth,
  internalContext: {
    type: 'agent',
    accessor_user_id: 'agent-1',
  },
};

describe('create-internal-memory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('errors without internalContext', async () => {
    const result = JSON.parse(await handleCreateInternalMemory({ content: 'test' }, userId, baseAuth));
    expect(result.error).toContain('Internal context required');
  });

  it('sets content_type from internalContext.type (ghost)', async () => {
    mockCreate.mockResolvedValue({ memory_id: 'mem-1', created_at: '2026-01-01' });
    const result = JSON.parse(await handleCreateInternalMemory({ content: 'test' }, userId, ghostUserAuth));
    expect(result.content_type).toBe('ghost');
  });

  it('sets content_type from internalContext.type (agent)', async () => {
    mockCreate.mockResolvedValue({ memory_id: 'mem-2', created_at: '2026-01-01' });
    const result = JSON.parse(await handleCreateInternalMemory({ content: 'test' }, userId, agentAuth));
    expect(result.content_type).toBe('agent');
  });

  it('applies ghost source isolation tags for user ghost', async () => {
    mockCreate.mockResolvedValue({ memory_id: 'mem-3', created_at: '2026-01-01' });
    const result = JSON.parse(await handleCreateInternalMemory({ content: 'test' }, userId, ghostUserAuth));
    expect(result.tags).toContain('ghost');
    expect(result.tags).toContain('ghost_type:user');
    expect(result.tags).toContain('ghost_owner:user:alice');
  });

  it('applies agent tag for agent context', async () => {
    mockCreate.mockResolvedValue({ memory_id: 'mem-4', created_at: '2026-01-01' });
    const result = JSON.parse(await handleCreateInternalMemory({ content: 'test' }, userId, agentAuth));
    expect(result.tags).toContain('agent');
    expect(result.tags).not.toContain('ghost');
  });

  it('merges user tags with internal tags', async () => {
    mockCreate.mockResolvedValue({ memory_id: 'mem-5', created_at: '2026-01-01' });
    const result = JSON.parse(await handleCreateInternalMemory(
      { content: 'test', tags: ['custom-tag'] }, userId, ghostUserAuth
    ));
    expect(result.tags).toContain('custom-tag');
    expect(result.tags).toContain('ghost');
  });

  it('passes feel_* fields through to core', async () => {
    mockCreate.mockResolvedValue({ memory_id: 'mem-6', created_at: '2026-01-01' });
    await handleCreateInternalMemory(
      { content: 'test', feel_salience: 0.8, feel_social_weight: 0.5 } as any, userId, ghostUserAuth
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ feel_salience: 0.8, feel_social_weight: 0.5 }),
    );
  });
});

describe('update-internal-memory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('errors without internalContext', async () => {
    const result = JSON.parse(await handleUpdateInternalMemory({ memory_id: 'mem-1' }, userId, baseAuth));
    expect(result.error).toContain('Internal context required');
  });

  it('errors when memory not found', async () => {
    mockFetchObjectById.mockResolvedValue(null);
    const result = JSON.parse(await handleUpdateInternalMemory({ memory_id: 'missing' }, userId, ghostUserAuth));
    expect(result.error).toContain('not found');
  });

  it('errors when content_type does not match session type', async () => {
    mockFetchObjectById.mockResolvedValue({ properties: { content_type: 'note' } });
    const result = JSON.parse(await handleUpdateInternalMemory({ memory_id: 'mem-1' }, userId, ghostUserAuth));
    expect(result.error).toContain('content_type: note');
    expect(result.error).toContain('ghost');
  });

  it('updates when content_type matches', async () => {
    mockFetchObjectById.mockResolvedValue({ properties: { content_type: 'ghost' } });
    mockUpdate.mockResolvedValue({ memory_id: 'mem-1', updated_at: '2026-01-01', version: 2, updated_fields: ['content'] });
    const result = JSON.parse(await handleUpdateInternalMemory(
      { memory_id: 'mem-1', content: 'updated' }, userId, ghostUserAuth
    ));
    expect(result.memory_id).toBe('mem-1');
    expect(result.version).toBe(2);
  });
});

describe('search-internal-memory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('errors without internalContext', async () => {
    const result = JSON.parse(await handleSearchInternalMemory({ query: 'test' }, userId, baseAuth));
    expect(result.error).toContain('Internal context required');
  });

  it('auto-scopes to ghost content_type and source tags', async () => {
    mockHandleSearchMemory.mockResolvedValue('{"memories":[]}');
    await handleSearchInternalMemory({ query: 'hiking' }, userId, ghostUserAuth);
    expect(mockHandleSearchMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'hiking',
        filters: {
          types: ['ghost'],
          tags: ['ghost_type:user', 'ghost_owner:user:alice'],
        },
      }),
      userId,
      ghostUserAuth
    );
  });

  it('auto-scopes to agent content_type with no scope tags', async () => {
    mockHandleSearchMemory.mockResolvedValue('{"memories":[]}');
    await handleSearchInternalMemory({ query: 'notes' }, userId, agentAuth);
    expect(mockHandleSearchMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          types: ['agent'],
          tags: undefined,
        },
      }),
      userId,
      agentAuth
    );
  });

  it('merges user-provided tags with scope tags', async () => {
    mockHandleSearchMemory.mockResolvedValue('{"memories":[]}');
    await handleSearchInternalMemory({ query: 'test', tags: ['hiking'] }, userId, ghostUserAuth);
    const callArgs = mockHandleSearchMemory.mock.calls[0][0];
    expect(callArgs.filters.tags).toContain('hiking');
    expect(callArgs.filters.tags).toContain('ghost_type:user');
    expect(callArgs.filters.tags).toContain('ghost_owner:user:alice');
  });
});

describe('query-internal-memory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('errors without internalContext', async () => {
    const result = JSON.parse(await handleQueryInternalMemory({ query: 'test' }, userId, baseAuth));
    expect(result.error).toContain('Internal context required');
  });

  it('auto-scopes to ghost content_type and source tags', async () => {
    mockHandleQueryMemory.mockResolvedValue('{"memories":[]}');
    await handleQueryInternalMemory({ query: 'interests' }, userId, ghostUserAuth);
    expect(mockHandleQueryMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'interests',
        filters: {
          types: ['ghost'],
          tags: ['ghost_type:user', 'ghost_owner:user:alice'],
        },
      }),
      userId,
      ghostUserAuth
    );
  });

  it('auto-scopes to agent with no scope tags', async () => {
    mockHandleQueryMemory.mockResolvedValue('{"memories":[]}');
    await handleQueryInternalMemory({ query: 'notes' }, userId, agentAuth);
    expect(mockHandleQueryMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          types: ['agent'],
          tags: undefined,
        },
      }),
      userId,
      agentAuth
    );
  });
});

describe('search-internal-memory-by', () => {
  beforeEach(() => jest.clearAllMocks());

  it('errors without internalContext', async () => {
    const result = JSON.parse(await handleSearchInternalMemoryBy({ mode: 'byTime' }, userId, baseAuth));
    expect(result.error).toContain('Internal context required');
  });

  it('auto-scopes to ghost content_type and source tags', async () => {
    mockHandleSearchBy.mockResolvedValue('{"memories":[]}');
    await handleSearchInternalMemoryBy({ mode: 'byTime' }, userId, ghostUserAuth);
    expect(mockHandleSearchBy).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'byTime',
        filters: {
          types: ['ghost'],
          tags: ['ghost_type:user', 'ghost_owner:user:alice'],
        },
      }),
      userId,
      ghostUserAuth
    );
  });

  it('passes mode, sort_order, sort_field through', async () => {
    mockHandleSearchBy.mockResolvedValue('{"memories":[]}');
    await handleSearchInternalMemoryBy(
      { mode: 'byProperty', sort_field: 'feel_trauma', sort_order: 'desc' },
      userId, ghostUserAuth
    );
    expect(mockHandleSearchBy).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'byProperty',
        sort_field: 'feel_trauma',
        sort_order: 'desc',
      }),
      userId,
      ghostUserAuth
    );
  });

  it('auto-scopes agent with no scope tags', async () => {
    mockHandleSearchBy.mockResolvedValue('{"memories":[]}');
    await handleSearchInternalMemoryBy({ mode: 'byRandom' }, userId, agentAuth);
    expect(mockHandleSearchBy).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          types: ['agent'],
          tags: undefined,
        },
      }),
      userId,
      agentAuth
    );
  });
});
