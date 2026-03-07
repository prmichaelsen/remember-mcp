/**
 * E2E: Advanced Search Modes — search_by and search_space_by
 *
 * Run with:
 *   DOTENV_CONFIG_PATH=.env.e1.local npm run test:e2e -- --testPathPattern=search-modes
 */

import {
  e2eInit, e2eUserId, e2eAuthContext, e2eEnsureCollection,
  e2eCleanup, parseResult, waitForIndex,
} from './e2e-helpers.js';
import { handleCreateMemory } from './tools/create-memory.js';
import { handleSearchBy } from './tools/search-by.js';
import { handlePublish } from './tools/publish.js';
import { handleConfirm } from './tools/confirm.js';
import { handleSearchSpaceBy } from './tools/search-space-by.js';

const userId = e2eUserId('modes');
const auth = e2eAuthContext();
const SPACE = 'the_void';

describe('E2E: Search Modes', () => {
  const memoryIds: string[] = [];

  beforeAll(async () => {
    await e2eInit();
    await e2eEnsureCollection(userId);

    // Create several memories with varying weights and tags
    const memories = [
      { content: 'Morning run along the river trail, 5 miles in 42 minutes.', weight: 0.5, tags: ['fitness', 'running'] },
      { content: 'Read "Thinking Fast and Slow" by Kahneman. Chapter on anchoring bias was eye-opening.', weight: 0.9, tags: ['reading', 'psychology'] },
      { content: 'Cooked pad thai for dinner. Used tamarind paste instead of ketchup this time.', weight: 0.3, tags: ['cooking', 'thai'] },
      { content: 'Team standup: discussed migration plan for database sharding.', weight: 0.7, tags: ['work', 'database'] },
      { content: 'Guitar practice: learned the intro to Stairway to Heaven.', weight: 0.6, tags: ['music', 'guitar'] },
    ];

    for (const mem of memories) {
      const res = parseResult(await handleCreateMemory(mem, userId, auth));
      memoryIds.push(res.memory_id);
    }

    // Publish one to space for search_space_by tests
    const pubRes = parseResult(await handlePublish(
      { memory_id: memoryIds[1], spaces: [SPACE] },
      userId, auth,
    ));
    const confirmRes = parseResult(await handleConfirm(
      { token: pubRes.token },
      userId, auth,
    ));

    await waitForIndex(2000);
  }, 60_000);

  afterAll(async () => {
    await e2eCleanup(userId);
  }, 30_000);

  // -------------------------------------------------------------------------
  // search_by modes
  // -------------------------------------------------------------------------

  describe('search_by', () => {
    it('byTime returns memories in chronological order', async () => {
      const res = parseResult(await handleSearchBy(
        { mode: 'byTime', sort_order: 'desc', limit: 5 },
        userId, auth,
      ));

      expect(res.memories).toBeDefined();
      expect(res.memories.length).toBe(5);
      // Should be newest first
      const dates = res.memories.map((m: any) => new Date(m.created_at).getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
      console.log(`  byTime returned ${res.memories.length} memories`);
    });

    it('byTime ascending returns oldest first', async () => {
      const res = parseResult(await handleSearchBy(
        { mode: 'byTime', sort_order: 'asc', limit: 5 },
        userId, auth,
      ));

      const dates = res.memories.map((m: any) => new Date(m.created_at).getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i + 1]);
      }
    });

    it('byBroad returns truncated content for scanning', async () => {
      const res = parseResult(await handleSearchBy(
        { mode: 'byBroad', limit: 10 },
        userId, auth,
      ));

      // byBroad returns { results: [...] } not { memories: [...] }
      expect(res.results).toBeDefined();
      expect(res.results.length).toBeGreaterThan(0);
      // Verify truncated content fields exist
      const first = res.results[0];
      expect(first.content_head).toBeDefined();
      console.log(`  byBroad returned ${res.results.length} results`);
    });

    it('byRandom returns results', async () => {
      const res = parseResult(await handleSearchBy(
        { mode: 'byRandom', limit: 3 },
        userId, auth,
      ));

      // byRandom returns { results: [...], total_pool_size }
      expect(res.results).toBeDefined();
      expect(res.results.length).toBeGreaterThan(0);
      expect(res.results.length).toBeLessThanOrEqual(3);
    });

    it('byProperty sorts by weight', async () => {
      const res = parseResult(await handleSearchBy(
        { mode: 'byProperty', sort_field: 'weight', sort_order: 'desc', limit: 5 },
        userId, auth,
      ));

      expect(res.memories).toBeDefined();
      expect(res.memories.length).toBeGreaterThan(0);
      // Highest weight memory (0.9 — the reading one) should be first
      const weights = res.memories.map((m: any) => m.weight);
      for (let i = 0; i < weights.length - 1; i++) {
        expect(weights[i]).toBeGreaterThanOrEqual(weights[i + 1]);
      }
    });

    it('byDensity returns results (may be 0 if no relationships)', async () => {
      const res = parseResult(await handleSearchBy(
        { mode: 'byDensity', limit: 5 },
        userId, auth,
      ));

      expect(res.memories).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // search_space_by modes
  // -------------------------------------------------------------------------

  // BUG: Most search_space_by modes are unimplemented in remember-core's SpaceService.
  // byTime, byRating, byProperty, byBroad, byRandom all return hardcoded error strings.
  // Fix: implement these modes in SpaceService, mirroring MemoryService equivalents.
  // These tests WILL FAIL until the core methods are implemented.
  describe('search_space_by', () => {
    it('byTime returns space memories chronologically', async () => {
      const res = parseResult(await handleSearchSpaceBy(
        { mode: 'byTime', spaces: [SPACE], sort_order: 'desc', limit: 5 },
        userId, auth,
      ));

      expect(res.memories).toBeDefined();
      expect(res.memories.length).toBeGreaterThan(0);
    });

    it('byBroad returns space memories with truncated content', async () => {
      const res = parseResult(await handleSearchSpaceBy(
        { mode: 'byBroad', spaces: [SPACE], limit: 10 },
        userId, auth,
      ));

      expect(res.results).toBeDefined();
      expect(res.results.length).toBeGreaterThan(0);
    });

    it('byRandom returns space memories', async () => {
      const res = parseResult(await handleSearchSpaceBy(
        { mode: 'byRandom', spaces: [SPACE], limit: 3 },
        userId, auth,
      ));

      expect(res.results).toBeDefined();
      expect(res.results.length).toBeGreaterThan(0);
    });
  });
});
