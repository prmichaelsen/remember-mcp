/**
 * E2E: Core Memory CRUD — remember_create/search/update/delete/find_similar/query
 *
 * Run with:
 *   DOTENV_CONFIG_PATH=.env.e1.local npm run test:e2e -- --testPathPattern=memory-crud
 */

import {
  e2eInit, e2eUserId, e2eAuthContext, e2eEnsureCollection,
  e2eCleanup, parseResult, waitForIndex,
} from './e2e-helpers.js';
import { handleCreateMemory } from './tools/create-memory.js';
import { handleSearchMemory } from './tools/search-memory.js';
import { handleUpdateMemory } from './tools/update-memory.js';
import { handleDeleteMemory } from './tools/delete-memory.js';
import { handleConfirm } from './tools/confirm.js';
import { handleFindSimilar } from './tools/find-similar.js';
import { handleQueryMemory } from './tools/query-memory.js';

const userId = e2eUserId('crud');
const auth = e2eAuthContext();

describe('E2E: Memory CRUD', () => {
  beforeAll(async () => {
    await e2eInit();
    await e2eEnsureCollection(userId);
  }, 30_000);

  afterAll(async () => {
    await e2eCleanup(userId);
  }, 30_000);

  // ---- State shared across ordered tests ----
  let memoryId: string;
  let secondMemoryId: string;
  let thirdMemoryId: string;

  // -------------------------------------------------------------------------
  // CREATE
  // -------------------------------------------------------------------------

  it('creates a memory', async () => {
    const res = parseResult(await handleCreateMemory(
      { content: 'I went camping at Yosemite last weekend. The Half Dome trail was spectacular.', weight: 0.8, trust: 0.5, tags: ['camping', 'yosemite'] },
      userId, auth,
    ));

    expect(res.memory_id).toBeTruthy();
    memoryId = res.memory_id;
    console.log(`  created memory ${memoryId}`);
  });

  it('creates a second related memory', async () => {
    const res = parseResult(await handleCreateMemory(
      { content: 'My favorite camping gear: MSR tent, Jetboil stove, and Osprey backpack.', weight: 0.6, tags: ['camping', 'gear'] },
      userId, auth,
    ));
    secondMemoryId = res.memory_id;
  });

  it('creates a third unrelated memory', async () => {
    const res = parseResult(await handleCreateMemory(
      { content: 'Grandma\'s chocolate chip cookie recipe: 2 cups flour, 1 cup butter, chocolate chips.', weight: 0.7, tags: ['recipe', 'cookies'] },
      userId, auth,
    ));
    thirdMemoryId = res.memory_id;
  });

  // -------------------------------------------------------------------------
  // SEARCH (hybrid)
  // -------------------------------------------------------------------------

  it('searches and finds the camping memory via hybrid search', async () => {
    await waitForIndex();

    const res = parseResult(await handleSearchMemory(
      { query: 'camping yosemite half dome', limit: 10 },
      userId, auth,
    ));

    expect(res.memories.length).toBeGreaterThan(0);
    const ids = res.memories.map((m: any) => m.id);
    expect(ids).toContain(memoryId);
    console.log(`  search returned ${res.memories.length} memories`);
  });

  it('does not return unrelated memories first', async () => {
    const res = parseResult(await handleSearchMemory(
      { query: 'camping trip outdoors', limit: 5 },
      userId, auth,
    ));

    // Cookie recipe should not be the top result
    if (res.memories.length > 0) {
      expect(res.memories[0].id).not.toBe(thirdMemoryId);
    }
  });

  // -------------------------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------------------------

  it('updates the memory content', async () => {
    const res = parseResult(await handleUpdateMemory(
      { memory_id: memoryId, content: 'I went camping at Yosemite last weekend. The Half Dome trail was spectacular. We saw a bear!', tags: ['camping', 'yosemite', 'wildlife'] },
      userId, auth,
    ));

    expect(res.memory_id).toBe(memoryId);
    expect(res.version).toBeGreaterThan(1);
  });

  it('search reflects updated content', async () => {
    await waitForIndex();

    const res = parseResult(await handleSearchMemory(
      { query: 'bear wildlife camping', limit: 5 },
      userId, auth,
    ));

    const found = res.memories.find((m: any) => m.id === memoryId);
    expect(found).toBeTruthy();
    expect(found.content).toContain('bear');
  });

  // -------------------------------------------------------------------------
  // FIND SIMILAR
  // -------------------------------------------------------------------------

  it('find_similar returns related camping memory', async () => {
    const res = parseResult(await handleFindSimilar(
      { memory_id: memoryId, limit: 5, min_similarity: 0.3 },
      userId, auth,
    ));

    expect(res.similar_memories).toBeDefined();
    expect(res.similar_memories.length).toBeGreaterThan(0);
    // The gear memory should be more similar than the cookie recipe
    const ids = res.similar_memories.map((m: any) => m.id);
    expect(ids).toContain(secondMemoryId);
    console.log(`  find_similar returned ${res.similar_memories.length} results`);
  });

  // -------------------------------------------------------------------------
  // QUERY (RAG / semantic)
  // -------------------------------------------------------------------------

  it('query_memory returns relevant results for natural language question', async () => {
    const res = parseResult(await handleQueryMemory(
      { query: 'What outdoor activities have I done recently?', limit: 5, min_relevance: 0.3 },
      userId, auth,
    ));

    expect(res.memories).toBeDefined();
    expect(res.memories.length).toBeGreaterThan(0);
    console.log(`  query returned ${res.memories.length} memories`);
  });

  // -------------------------------------------------------------------------
  // DELETE (soft delete + confirm)
  // -------------------------------------------------------------------------

  it('requests deletion and gets a token', async () => {
    const res = parseResult(await handleDeleteMemory(
      { memory_id: thirdMemoryId, reason: 'e2e cleanup' },
      userId, auth,
    ));

    expect(res.success).toBe(true);
    expect(res.token).toBeTruthy();

    // Confirm the deletion
    const confirmRes = parseResult(await handleConfirm(
      { token: res.token },
      userId, auth,
    ));
    expect(confirmRes.success).toBe(true);
    expect(confirmRes.memory_id).toBe(thirdMemoryId);
    console.log(`  deleted memory ${thirdMemoryId}`);
  });

  it('deleted memory is excluded from default search', async () => {
    await waitForIndex();

    const res = parseResult(await handleSearchMemory(
      { query: 'chocolate chip cookie recipe', limit: 10 },
      userId, auth,
    ));

    const ids = res.memories.map((m: any) => m.id);
    expect(ids).not.toContain(thirdMemoryId);
  });

  it('deleted memory is visible with deleted_filter=only', async () => {
    const res = parseResult(await handleSearchMemory(
      { query: 'chocolate chip cookie recipe', limit: 10, deleted_filter: 'only' } as any,
      userId, auth,
    ));

    const ids = res.memories.map((m: any) => m.id);
    expect(ids).toContain(thirdMemoryId);
  });
});
