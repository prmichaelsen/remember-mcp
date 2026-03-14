/**
 * Tests for admin schema and collection tools:
 * - remember_admin_get_weaviate_schema
 * - remember_admin_list_collections
 * - remember_admin_collection_stats
 */

import { handleAdminGetWeaviateSchema } from './admin-get-weaviate-schema.js';
import { handleAdminListCollections } from './admin-list-collections.js';
import { handleAdminCollectionStats } from './admin-collection-stats.js';

// Mock the Weaviate client
const mockGet = jest.fn();
const mockListAll = jest.fn();
const mockConfigGet = jest.fn();
const mockLength = jest.fn();

jest.mock('../weaviate/client.js', () => ({
  getWeaviateClient: () => ({
    collections: {
      get: (name: string) => {
        mockGet(name);
        return {
          config: { get: mockConfigGet },
          length: mockLength,
        };
      },
      listAll: mockListAll,
    },
  }),
}));

const sampleConfig = {
  properties: [
    { name: 'content', dataType: 'text', description: 'Memory content', indexFilterable: true, indexSearchable: true, tokenization: 'word' },
    { name: 'weight', dataType: 'number', description: 'Significance', indexFilterable: true, indexSearchable: false, tokenization: null },
  ],
  vectorizers: [{ name: 'default', type: 'text2vec-openai' }],
  generative: null,
  multiTenancy: { enabled: false },
  replication: { factor: 1 },
};

describe('remember_admin_get_weaviate_schema', () => {
  const originalEnv = process.env.ADMIN_USER_IDS;

  beforeEach(() => {
    process.env.ADMIN_USER_IDS = 'admin_user';
    jest.clearAllMocks();
    mockConfigGet.mockResolvedValue(sampleConfig);
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_USER_IDS = originalEnv;
    } else {
      delete process.env.ADMIN_USER_IDS;
    }
  });

  it('returns schema for admin user', async () => {
    const result = await handleAdminGetWeaviateSchema(
      { collection_name: 'Memory_users_test' },
      'admin_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.collection_name).toBe('Memory_users_test');
    expect(parsed.properties).toHaveLength(2);
    expect(parsed.properties[0].name).toBe('content');
    expect(parsed.properties[1].name).toBe('weight');
  });

  it('returns permission error for non-admin user', async () => {
    const result = await handleAdminGetWeaviateSchema(
      { collection_name: 'Memory_users_test' },
      'regular_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.isError).toBe(true);
    expect(parsed.content[0].text).toContain('Permission denied');
  });
});

describe('remember_admin_list_collections', () => {
  const originalEnv = process.env.ADMIN_USER_IDS;

  beforeEach(() => {
    process.env.ADMIN_USER_IDS = 'admin_user';
    jest.clearAllMocks();
    mockListAll.mockResolvedValue([
      { name: 'Memory_users_abc123' },
      { name: 'Memory_users_def456' },
      { name: 'Memory_spaces_public' },
      { name: 'Memory_groups_team1' },
    ]);
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_USER_IDS = originalEnv;
    } else {
      delete process.env.ADMIN_USER_IDS;
    }
  });

  it('lists all collections with type categorization', async () => {
    const result = await handleAdminListCollections({}, 'admin_user');
    const parsed = JSON.parse(result);
    expect(parsed.total).toBe(4);
    expect(parsed.collections[0]).toEqual({ name: 'Memory_users_abc123', type: 'user' });
    expect(parsed.collections[2]).toEqual({ name: 'Memory_spaces_public', type: 'space' });
    expect(parsed.collections[3]).toEqual({ name: 'Memory_groups_team1', type: 'group' });
  });

  it('filters collections by prefix', async () => {
    const result = await handleAdminListCollections({ filter: 'Memory_users_' }, 'admin_user');
    const parsed = JSON.parse(result);
    expect(parsed.total).toBe(2);
    expect(parsed.collections.every((c: any) => c.type === 'user')).toBe(true);
  });

  it('returns permission error for non-admin user', async () => {
    const result = await handleAdminListCollections({}, 'regular_user');
    const parsed = JSON.parse(result);
    expect(parsed.isError).toBe(true);
  });
});

describe('remember_admin_collection_stats', () => {
  const originalEnv = process.env.ADMIN_USER_IDS;

  beforeEach(() => {
    process.env.ADMIN_USER_IDS = 'admin_user';
    jest.clearAllMocks();
    mockConfigGet.mockResolvedValue(sampleConfig);
    mockLength.mockResolvedValue(42);
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_USER_IDS = originalEnv;
    } else {
      delete process.env.ADMIN_USER_IDS;
    }
  });

  it('returns stats for admin user', async () => {
    const result = await handleAdminCollectionStats(
      { collection_name: 'Memory_users_test' },
      'admin_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.collection_name).toBe('Memory_users_test');
    expect(parsed.object_count).toBe(42);
    expect(parsed.property_count).toBe(2);
    expect(parsed.properties).toEqual(['content', 'weight']);
  });

  it('returns permission error for non-admin user', async () => {
    const result = await handleAdminCollectionStats(
      { collection_name: 'Memory_users_test' },
      'regular_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.isError).toBe(true);
  });
});
