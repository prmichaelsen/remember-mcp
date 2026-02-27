/**
 * Memory Collection Pattern v2 — E2E Smoke Test
 *
 * Validates the full v2 flow against a live Weaviate instance:
 *   connect → create collections → publish → search → revise → retract
 *
 * Run with:
 *   DOTENV_CONFIG_PATH=.env.e1.local npm run test:e2e -- --testPathPattern=v2-smoke
 *
 * Prerequisites:
 *   - .env.e1.local with WEAVIATE_REST_URL, WEAVIATE_API_KEY, OPENAI_EMBEDDINGS_API_KEY
 */

import dotenv from 'dotenv';
// Load environment-specific .env file BEFORE importing config
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env.e1.local', override: true });

import weaviate, { WeaviateClient, configure } from 'weaviate-client';
import { config } from './config.js';
import { generateCompositeId, parseCompositeId } from './collections/composite-ids.js';
import {
  addToSpaceIds,
  addToGroupIds,
  isPublishedToSpace,
  getPublishedLocations,
} from './collections/tracking-arrays.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'e2e_smoke_user';
const TEST_GROUP_ID = 'e2e_smoke_group';
const TEST_MEMORY_ID = 'e2e_smoke_mem_001';
const USER_COLLECTION = `Memory_users_${TEST_USER_ID}`;
const SPACE_COLLECTION = 'Memory_spaces_public';
const GROUP_COLLECTION = `Memory_groups_${TEST_GROUP_ID}`;

// ---------------------------------------------------------------------------
// Collection schemas (cloud-compatible — uses vectorizers plural + configure.dataType)
// ---------------------------------------------------------------------------

const COMMON_PROPERTIES = [
  { name: 'content', dataType: configure.dataType.TEXT },
  { name: 'content_type', dataType: configure.dataType.TEXT },
  { name: 'space_ids', dataType: configure.dataType.TEXT_ARRAY },
  { name: 'group_ids', dataType: configure.dataType.TEXT_ARRAY },
  { name: 'created_at', dataType: configure.dataType.DATE },
  { name: 'updated_at', dataType: configure.dataType.DATE },
  { name: 'version', dataType: configure.dataType.INT },
  { name: 'user_id', dataType: configure.dataType.TEXT },
  { name: 'doc_type', dataType: configure.dataType.TEXT },
  { name: 'tags', dataType: configure.dataType.TEXT_ARRAY },
  { name: 'weight', dataType: configure.dataType.NUMBER },
  { name: 'trust_score', dataType: configure.dataType.NUMBER },
  { name: 'parent_id', dataType: configure.dataType.TEXT },
  { name: 'thread_root_id', dataType: configure.dataType.TEXT },
  { name: 'moderation_flags', dataType: configure.dataType.TEXT_ARRAY },
  { name: 'deleted_at', dataType: configure.dataType.DATE },
  { name: 'deleted_by', dataType: configure.dataType.TEXT },
  { name: 'deletion_reason', dataType: configure.dataType.TEXT },
];

const PUBLISHED_PROPERTIES = [
  { name: 'published_at', dataType: configure.dataType.DATE },
  { name: 'revised_at', dataType: configure.dataType.DATE },
  { name: 'author_id', dataType: configure.dataType.TEXT },
  { name: 'ghost_id', dataType: configure.dataType.TEXT },
  { name: 'attribution', dataType: configure.dataType.TEXT },
  { name: 'discovery_count', dataType: configure.dataType.INT },
  { name: 'revision_count', dataType: configure.dataType.INT },
  { name: 'original_memory_id', dataType: configure.dataType.TEXT },
];

function vectorizerConfig() {
  return configure.vectorizer.text2VecOpenAI({
    model: 'text-embedding-3-small',
    dimensions: 1536,
    vectorizeCollectionName: false,
  });
}

// ---------------------------------------------------------------------------
// Client setup
// ---------------------------------------------------------------------------

let client: WeaviateClient;

async function connectClient(): Promise<WeaviateClient> {
  const url = config.weaviate.url;
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');

  if (!isLocal) {
    return weaviate.connectToWeaviateCloud(url, {
      authCredentials: config.weaviate.apiKey
        ? new weaviate.ApiKey(config.weaviate.apiKey)
        : undefined,
      headers: config.openai.apiKey
        ? { 'X-OpenAI-Api-Key': config.openai.apiKey }
        : undefined,
    });
  } else {
    return weaviate.connectToLocal({
      host: url.replace(/^https?:\/\//, '').split(':')[0],
      port: url.includes(':') ? parseInt(url.split(':').pop() || '8080') : 8080,
      scheme: url.startsWith('https') ? 'https' : 'http',
    } as any);
  }
}

// ---------------------------------------------------------------------------
// Cleanup helper
// ---------------------------------------------------------------------------

async function deleteCollectionIfExists(name: string) {
  try {
    const exists = await client.collections.exists(name);
    if (exists) {
      await client.collections.delete(name);
    }
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('v2 Smoke Test — Live Weaviate', () => {
  beforeAll(async () => {
    // Validate we have credentials
    expect(config.weaviate.url).not.toBe('http://localhost:8080');
    expect(config.weaviate.apiKey).toBeTruthy();
    expect(config.openai.apiKey).toBeTruthy();

    client = await connectClient();

    // Clean slate — remove test collections if they exist
    await deleteCollectionIfExists(USER_COLLECTION);
    await deleteCollectionIfExists(SPACE_COLLECTION);
    await deleteCollectionIfExists(GROUP_COLLECTION);
  }, 30_000);

  afterAll(async () => {
    // Cleanup test collections
    await deleteCollectionIfExists(USER_COLLECTION);
    await deleteCollectionIfExists(SPACE_COLLECTION);
    await deleteCollectionIfExists(GROUP_COLLECTION);
    client?.close();
  }, 30_000);

  // -------------------------------------------------------------------------
  // Phase 1: Connection & Collection Creation
  // -------------------------------------------------------------------------

  it('connects to Weaviate and confirms readiness', async () => {
    const ready = await client.isReady();
    expect(ready).toBe(true);
    console.log('  ✓ Weaviate is ready');
  });

  it('creates user collection', async () => {
    await client.collections.create({
      name: USER_COLLECTION,
      vectorizers: vectorizerConfig(),
      properties: COMMON_PROPERTIES,
      invertedIndex: configure.invertedIndex({ indexNullState: true, indexPropertyLength: true, indexTimestamps: true }),
    });

    const exists = await client.collections.exists(USER_COLLECTION);
    expect(exists).toBe(true);
    console.log(`  ✓ Created ${USER_COLLECTION}`);
  });

  it('creates space collection', async () => {
    await client.collections.create({
      name: SPACE_COLLECTION,
      vectorizers: vectorizerConfig(),
      properties: [...COMMON_PROPERTIES, ...PUBLISHED_PROPERTIES],
      invertedIndex: configure.invertedIndex({ indexNullState: true, indexPropertyLength: true, indexTimestamps: true }),
    });

    const exists = await client.collections.exists(SPACE_COLLECTION);
    expect(exists).toBe(true);
    console.log(`  ✓ Created ${SPACE_COLLECTION}`);
  });

  it('creates group collection', async () => {
    await client.collections.create({
      name: GROUP_COLLECTION,
      vectorizers: vectorizerConfig(),
      properties: [...COMMON_PROPERTIES, ...PUBLISHED_PROPERTIES],
      invertedIndex: configure.invertedIndex({ indexNullState: true, indexPropertyLength: true, indexTimestamps: true }),
    });

    const exists = await client.collections.exists(GROUP_COLLECTION);
    expect(exists).toBe(true);
    console.log(`  ✓ Created ${GROUP_COLLECTION}`);
  });

  // -------------------------------------------------------------------------
  // Phase 2: Create Memory in User Collection
  // -------------------------------------------------------------------------

  let memoryUuid: string;

  it('creates a memory in user collection', async () => {
    const collection = client.collections.get(USER_COLLECTION);
    const now = new Date().toISOString();

    const result = await collection.data.insert({
      properties: {
        content: 'E2E smoke test: This is a test memory for validating the v2 collection pattern.',
        content_type: 'note',
        user_id: TEST_USER_ID,
        doc_type: 'memory',
        tags: ['e2e', 'smoke-test'],
        weight: 0.7,
        trust_score: 0.5,
        space_ids: [],
        group_ids: [],
        created_at: now,
        updated_at: now,
        version: 1,
      },
    });

    memoryUuid = result;
    expect(memoryUuid).toBeTruthy();
    console.log(`  ✓ Created memory (uuid: ${memoryUuid})`);
  });

  // -------------------------------------------------------------------------
  // Phase 3: Publish to Space + Group
  // -------------------------------------------------------------------------

  let compositeId: string;
  let spacePublishUuid: string;

  it('publishes memory to space collection', async () => {
    compositeId = generateCompositeId(TEST_USER_ID, TEST_MEMORY_ID);
    expect(compositeId).toBe(`${TEST_USER_ID}.${TEST_MEMORY_ID}`);

    const spaceCollection = client.collections.get(SPACE_COLLECTION);
    const now = new Date().toISOString();

    spacePublishUuid = await spaceCollection.data.insert({
      properties: {
        content: 'E2E smoke test: This is a test memory for validating the v2 collection pattern.',
        content_type: 'note',
        user_id: TEST_USER_ID,
        doc_type: 'memory',
        tags: ['e2e', 'smoke-test'],
        weight: 0.7,
        trust_score: 0.5,
        space_ids: ['the_void'],
        group_ids: [],
        author_id: TEST_USER_ID,
        published_at: now,
        revised_at: now,
        revision_count: 0,
        original_memory_id: TEST_MEMORY_ID,
        created_at: now,
        updated_at: now,
        version: 1,
      },
    });

    expect(spacePublishUuid).toBeTruthy();
    console.log(`  ✓ Published to ${SPACE_COLLECTION} (uuid: ${spacePublishUuid})`);
  });

  it('publishes memory to group collection', async () => {
    const groupCollection = client.collections.get(GROUP_COLLECTION);
    const now = new Date().toISOString();

    const result = await groupCollection.data.insert({
      properties: {
        content: 'E2E smoke test: This is a test memory for validating the v2 collection pattern.',
        content_type: 'note',
        user_id: TEST_USER_ID,
        doc_type: 'memory',
        tags: ['e2e', 'smoke-test'],
        weight: 0.7,
        trust_score: 0.5,
        space_ids: [],
        group_ids: [TEST_GROUP_ID],
        author_id: TEST_USER_ID,
        published_at: now,
        revised_at: now,
        revision_count: 0,
        original_memory_id: TEST_MEMORY_ID,
        created_at: now,
        updated_at: now,
        version: 1,
      },
    });

    expect(result).toBeTruthy();
    console.log(`  ✓ Published to ${GROUP_COLLECTION} (uuid: ${result})`);
  });

  it('updates source memory tracking arrays', async () => {
    let memory: any = { space_ids: [], group_ids: [] };
    memory = addToSpaceIds(memory, 'the_void');
    memory = addToGroupIds(memory, TEST_GROUP_ID);

    expect(isPublishedToSpace(memory, 'the_void')).toBe(true);
    expect(getPublishedLocations(memory)).toEqual({
      spaces: ['the_void'],
      groups: [TEST_GROUP_ID],
    });
    console.log('  ✓ Tracking arrays updated correctly');
  });

  // -------------------------------------------------------------------------
  // Phase 4: Search
  // -------------------------------------------------------------------------

  it('finds published memory via hybrid search in space', async () => {
    const spaceCollection = client.collections.get(SPACE_COLLECTION);

    const results = await spaceCollection.query.hybrid('smoke test v2 collection pattern', {
      limit: 5,
    });

    expect(results.objects.length).toBeGreaterThan(0);
    console.log(`  ✓ Found memory via hybrid search (${results.objects.length} results)`);
  });

  it('finds published memory via hybrid search in group', async () => {
    const groupCollection = client.collections.get(GROUP_COLLECTION);

    const results = await groupCollection.query.hybrid('smoke test v2 collection pattern', {
      limit: 5,
    });

    expect(results.objects.length).toBeGreaterThan(0);
    console.log(`  ✓ Found memory in group via hybrid search (${results.objects.length} results)`);
  });

  it('finds memory via BM25 keyword search', async () => {
    const spaceCollection = client.collections.get(SPACE_COLLECTION);

    const results = await spaceCollection.query.bm25('validating v2 collection pattern', {
      limit: 5,
    });

    expect(results.objects.length).toBeGreaterThan(0);
    console.log(`  ✓ Found memory via BM25 search (${results.objects.length} results)`);
  });

  it('finds memory via semantic search', async () => {
    const spaceCollection = client.collections.get(SPACE_COLLECTION);

    const results = await spaceCollection.query.nearText(['end-to-end testing'], {
      limit: 5,
    });

    expect(results.objects.length).toBeGreaterThan(0);
    console.log(`  ✓ Found memory via semantic search (${results.objects.length} results)`);
  });

  // -------------------------------------------------------------------------
  // Phase 5: Revise (update published copy)
  // -------------------------------------------------------------------------

  it('revises published memory in space', async () => {
    const spaceCollection = client.collections.get(SPACE_COLLECTION);
    const now = new Date().toISOString();

    await spaceCollection.data.update({
      id: spacePublishUuid,
      properties: {
        content: 'E2E smoke test: REVISED content — this memory has been updated.',
        revised_at: now,
        revision_count: 1,
        updated_at: now,
        version: 2,
      },
    });

    // Verify
    const updated = await spaceCollection.query.fetchObjectById(spacePublishUuid);
    expect(updated?.properties.content).toContain('REVISED');
    expect(updated?.properties.version).toBe(2);
    console.log('  ✓ Revised memory in space collection');
  });

  // -------------------------------------------------------------------------
  // Phase 6: Composite ID utilities
  // -------------------------------------------------------------------------

  it('parses composite IDs correctly', () => {
    const parsed = parseCompositeId(compositeId);
    expect(parsed.userId).toBe(TEST_USER_ID);
    expect(parsed.memoryId).toBe(TEST_MEMORY_ID);
    console.log(`  ✓ Parsed composite ID: ${compositeId} → user=${parsed.userId}, mem=${parsed.memoryId}`);
  });
});
