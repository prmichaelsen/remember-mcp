/**
 * Tests for admin memory inspection tools:
 * - remember_admin_inspect_memory
 * - remember_admin_search_across_users
 */

// Must declare mocks before imports due to jest.mock hoisting
const mockLookup = jest.fn();
const mockFetchObjectById = jest.fn();
const mockSearch = jest.fn();

jest.mock('@prmichaelsen/remember-core', () => ({
  MemoryIndexService: jest.fn().mockImplementation(() => ({
    lookup: mockLookup,
  })),
  createLogger: () => ({ info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

jest.mock('../weaviate/client.js', () => ({
  getWeaviateClient: () => ({
    collections: {
      get: () => ({
        query: { fetchObjectById: mockFetchObjectById },
      }),
    },
  }),
}));

jest.mock('../core-services.js', () => ({
  createCoreServices: () => ({
    memory: { search: mockSearch },
  }),
}));

import { handleAdminInspectMemory } from './admin-inspect-memory.js';
import { handleAdminSearchAcrossUsers } from './admin-search-across-users.js';

describe('remember_admin_inspect_memory', () => {
  const originalEnv = process.env.ADMIN_USER_IDS;

  beforeEach(() => {
    process.env.ADMIN_USER_IDS = 'admin_user';
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_USER_IDS = originalEnv;
    } else {
      delete process.env.ADMIN_USER_IDS;
    }
  });

  it('returns raw memory object for admin user', async () => {
    mockLookup.mockResolvedValue('Memory_users_abc123');
    mockFetchObjectById.mockResolvedValue({
      uuid: 'mem-uuid-1',
      properties: { content: 'test memory', weight: 0.8 },
      metadata: { creationTime: '2026-01-01' },
    });

    const result = await handleAdminInspectMemory(
      { memory_id: 'mem-uuid-1' },
      'admin_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.id).toBe('mem-uuid-1');
    expect(parsed.collection_name).toBe('Memory_users_abc123');
    expect(parsed.properties.content).toBe('test memory');
    expect(parsed.vectors).toBeUndefined();
  });

  it('includes vector when requested', async () => {
    mockLookup.mockResolvedValue('Memory_users_abc123');
    mockFetchObjectById.mockResolvedValue({
      uuid: 'mem-uuid-1',
      properties: { content: 'test' },
      vectors: { default: [0.1, 0.2, 0.3] },
      metadata: {},
    });

    const result = await handleAdminInspectMemory(
      { memory_id: 'mem-uuid-1', include_vector: true },
      'admin_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.vectors).toEqual({ default: [0.1, 0.2, 0.3] });
  });

  it('returns error when memory not in index', async () => {
    mockLookup.mockResolvedValue(null);

    const result = await handleAdminInspectMemory(
      { memory_id: 'nonexistent' },
      'admin_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('not found in index');
  });

  it('returns error when memory in index but not in Weaviate', async () => {
    mockLookup.mockResolvedValue('Memory_users_abc123');
    mockFetchObjectById.mockResolvedValue(null);

    const result = await handleAdminInspectMemory(
      { memory_id: 'orphaned-id' },
      'admin_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('not found in Weaviate');
    expect(parsed.collection_name).toBe('Memory_users_abc123');
  });

  it('returns permission error for non-admin user', async () => {
    const result = await handleAdminInspectMemory(
      { memory_id: 'mem-uuid-1' },
      'regular_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.isError).toBe(true);
    expect(parsed.content[0].text).toContain('Permission denied');
  });
});

describe('remember_admin_search_across_users', () => {
  const originalEnv = process.env.ADMIN_USER_IDS;

  beforeEach(() => {
    process.env.ADMIN_USER_IDS = 'admin_user';
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_USER_IDS = originalEnv;
    } else {
      delete process.env.ADMIN_USER_IDS;
    }
  });

  it('searches across multiple users and includes user_id', async () => {
    mockSearch.mockResolvedValue({
      memories: [
        { id: 'mem1', content: 'memory from user' },
      ],
    });

    const result = await handleAdminSearchAcrossUsers(
      { user_ids: ['user1', 'user2'], query: 'test' },
      'admin_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.total).toBe(2);
    expect(parsed.results[0].user_id).toBe('user1');
    expect(parsed.results[1].user_id).toBe('user2');
  });

  it('applies limit across merged results', async () => {
    mockSearch.mockResolvedValue({
      memories: [
        { id: 'mem1', content: 'a' },
        { id: 'mem2', content: 'b' },
      ],
    });

    const result = await handleAdminSearchAcrossUsers(
      { user_ids: ['user1', 'user2'], query: 'test', limit: 3 },
      'admin_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.total).toBe(3);
  });

  it('returns validation error for empty user_ids', async () => {
    const result = await handleAdminSearchAcrossUsers(
      { user_ids: [], query: 'test' },
      'admin_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('user_ids');
  });

  it('warns on failed user search', async () => {
    mockSearch
      .mockResolvedValueOnce({ memories: [{ id: 'mem1', content: 'ok' }] })
      .mockRejectedValueOnce(new Error('Collection not found'));

    const result = await handleAdminSearchAcrossUsers(
      { user_ids: ['user1', 'bad_user'], query: 'test' },
      'admin_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.total).toBe(1);
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0]).toContain('bad_user');
  });

  it('returns permission error for non-admin user', async () => {
    const result = await handleAdminSearchAcrossUsers(
      { user_ids: ['user1'], query: 'test' },
      'regular_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.isError).toBe(true);
  });
});
