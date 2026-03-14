/**
 * Tests for admin health and drift tools.
 */

const mockTestWeaviate = jest.fn();
const mockTestFirestore = jest.fn();
const mockConfigGet = jest.fn();
const mockListAll = jest.fn();
const mockGetUserProps = jest.fn();
const mockGetPublishedProps = jest.fn();

jest.mock('../weaviate/client.js', () => ({
  testWeaviateConnection: mockTestWeaviate,
  getWeaviateClient: () => ({
    collections: {
      get: () => ({ config: { get: mockConfigGet } }),
      listAll: mockListAll,
    },
  }),
}));

jest.mock('../firestore/init.js', () => ({
  testFirestoreConnection: mockTestFirestore,
}));

jest.mock('@prmichaelsen/remember-core/database/weaviate', () => ({
  getUserCollectionProperties: mockGetUserProps,
  getPublishedCollectionProperties: mockGetPublishedProps,
}));

import { handleAdminHealth } from './admin-health.js';
import { handleAdminDetectWeaviateDrift } from './admin-detect-weaviate-drift.js';

describe('remember_admin_health', () => {
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

  it('returns healthy when both services are up', async () => {
    mockTestWeaviate.mockResolvedValue(true);
    mockTestFirestore.mockResolvedValue(true);

    const result = await handleAdminHealth({}, 'admin_user');
    const parsed = JSON.parse(result);
    expect(parsed.overall).toBe('healthy');
    expect(parsed.weaviate.status).toBe('ok');
    expect(parsed.firestore.status).toBe('ok');
    expect(parsed.weaviate.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it('returns degraded when one service is down', async () => {
    mockTestWeaviate.mockResolvedValue(false);
    mockTestFirestore.mockResolvedValue(true);

    const result = await handleAdminHealth({}, 'admin_user');
    const parsed = JSON.parse(result);
    expect(parsed.overall).toBe('degraded');
  });

  it('returns unhealthy when both services are down', async () => {
    mockTestWeaviate.mockResolvedValue(false);
    mockTestFirestore.mockResolvedValue(false);

    const result = await handleAdminHealth({}, 'admin_user');
    const parsed = JSON.parse(result);
    expect(parsed.overall).toBe('unhealthy');
  });

  it('handles exceptions gracefully', async () => {
    mockTestWeaviate.mockRejectedValue(new Error('connection refused'));
    mockTestFirestore.mockResolvedValue(true);

    const result = await handleAdminHealth({}, 'admin_user');
    const parsed = JSON.parse(result);
    expect(parsed.overall).toBe('degraded');
    expect(parsed.weaviate.status).toBe('error');
    expect(parsed.weaviate.message).toContain('connection refused');
  });

  it('returns permission error for non-admin', async () => {
    const result = await handleAdminHealth({}, 'regular_user');
    const parsed = JSON.parse(result);
    expect(parsed.isError).toBe(true);
  });
});

describe('remember_admin_detect_weaviate_drift', () => {
  const originalEnv = process.env.ADMIN_USER_IDS;

  beforeEach(() => {
    process.env.ADMIN_USER_IDS = 'admin_user';
    jest.clearAllMocks();
    mockGetUserProps.mockReturnValue(['content', 'weight', 'tags']);
    mockGetPublishedProps.mockReturnValue(['content', 'weight', 'tags', 'spaces']);
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_USER_IDS = originalEnv;
    } else {
      delete process.env.ADMIN_USER_IDS;
    }
  });

  it('reports match when schema matches expected', async () => {
    mockConfigGet.mockResolvedValue({
      properties: [
        { name: 'content' },
        { name: 'weight' },
        { name: 'tags' },
      ],
    });

    const result = await handleAdminDetectWeaviateDrift(
      { collection_ids: ['Memory_users_abc'] },
      'admin_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.results[0].status).toBe('match');
    expect(parsed.results[0].missing_properties).toEqual([]);
    expect(parsed.results[0].extra_properties).toEqual([]);
  });

  it('reports drift when properties are missing', async () => {
    mockConfigGet.mockResolvedValue({
      properties: [{ name: 'content' }],
    });

    const result = await handleAdminDetectWeaviateDrift(
      { collection_ids: ['Memory_users_abc'] },
      'admin_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.results[0].status).toBe('drift');
    expect(parsed.results[0].missing_properties).toContain('weight');
    expect(parsed.results[0].missing_properties).toContain('tags');
  });

  it('reports extra properties in Weaviate', async () => {
    mockConfigGet.mockResolvedValue({
      properties: [
        { name: 'content' },
        { name: 'weight' },
        { name: 'tags' },
        { name: 'legacy_field' },
      ],
    });

    const result = await handleAdminDetectWeaviateDrift(
      { collection_ids: ['Memory_users_abc'] },
      'admin_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.results[0].status).toBe('drift');
    expect(parsed.results[0].extra_properties).toContain('legacy_field');
  });

  it('uses published properties for space collections', async () => {
    mockConfigGet.mockResolvedValue({
      properties: [
        { name: 'content' },
        { name: 'weight' },
        { name: 'tags' },
        { name: 'spaces' },
      ],
    });

    const result = await handleAdminDetectWeaviateDrift(
      { collection_ids: ['Memory_spaces_public'] },
      'admin_user'
    );
    const parsed = JSON.parse(result);
    expect(parsed.results[0].status).toBe('match');
    expect(mockGetPublishedProps).toHaveBeenCalled();
  });

  it('returns permission error for non-admin', async () => {
    const result = await handleAdminDetectWeaviateDrift({}, 'regular_user');
    const parsed = JSON.parse(result);
    expect(parsed.isError).toBe(true);
  });
});
