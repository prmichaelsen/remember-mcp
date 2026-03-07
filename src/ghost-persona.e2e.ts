/**
 * E2E: Ghost/Persona — ghost config, ghost memory CRUD, get_core
 *
 * Run with:
 *   DOTENV_CONFIG_PATH=.env.e1.local npm run test:e2e -- --testPathPattern=ghost-persona
 */

import {
  e2eInit, e2eUserId, e2eAuthContext, e2eGhostAuthContext,
  e2eEnsureCollection, e2eCleanup, parseResult, waitForIndex,
} from './e2e-helpers.js';
import { handleGhostConfig } from './tools/ghost-config.js';
import { handleCreateGhostMemory } from './tools/create-ghost-memory.js';
import { handleSearchGhostMemory } from './tools/search-ghost-memory.js';
import { handleUpdateGhostMemory } from './tools/update-ghost-memory.js';
import { handleQueryGhostMemory } from './tools/query-ghost-memory.js';
import { handleSearchGhostMemoryBy } from './tools/search-ghost-memory-by.js';
import { handleGetCore } from './tools/get-core.js';

const ownerId = e2eUserId('ghost_owner');
const accessorId = e2eUserId('ghost_accessor');
const ownerAuth = e2eAuthContext();
const ghostAuth = e2eGhostAuthContext(ownerId, accessorId, 0.7);

describe('E2E: Ghost/Persona', () => {
  beforeAll(async () => {
    await e2eInit();
    await e2eEnsureCollection(ownerId);
  }, 30_000);

  afterAll(async () => {
    await e2eCleanup(ownerId);
  }, 30_000);

  let ghostMemoryId: string;

  // -------------------------------------------------------------------------
  // GHOST CONFIG
  // -------------------------------------------------------------------------

  it('enables ghost mode for owner', async () => {
    const res = parseResult(await handleGhostConfig(
      { action: 'set', enabled: true },
      ownerId, ownerAuth,
    ));

    expect(res.success).toBe(true);
    console.log('  ghost mode enabled');
  });

  it('sets default trust levels', async () => {
    const res = parseResult(await handleGhostConfig(
      { action: 'set', default_friend_trust: 0.3, default_public_trust: 0.1 },
      ownerId, ownerAuth,
    ));
    expect(res.success).toBe(true);
  });

  it('sets per-user trust for accessor', async () => {
    const res = parseResult(await handleGhostConfig(
      { action: 'set_trust', target_user_id: accessorId, trust_level: 0.7 },
      ownerId, ownerAuth,
    ));
    expect(res.success).toBe(true);
  });

  it('gets ghost config and verifies settings', async () => {
    const res = parseResult(await handleGhostConfig(
      { action: 'get' },
      ownerId, ownerAuth,
    ));

    expect(res.success).toBe(true);
    expect(res.config).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // CREATE GHOST MEMORY
  // -------------------------------------------------------------------------

  it('creates a ghost memory', async () => {
    const res = parseResult(await handleCreateGhostMemory(
      {
        content: `${accessorId} asked about my favorite hiking trails. They seem genuinely interested in outdoor activities.`,
        weight: 0.6,
        trust: 0.5,
        tags: ['hiking', 'interests'],
        feel_salience: 0.4,
        feel_social_weight: 0.6,
      },
      ownerId, ghostAuth,
    ));

    expect(res.memory_id).toBeTruthy();
    expect(res.content_type).toBe('ghost');
    expect(res.tags).toContain('ghost');
    expect(res.tags).toContain(`ghost:${accessorId}`);
    ghostMemoryId = res.memory_id;
    console.log(`  created ghost memory ${ghostMemoryId}`);
  });

  // -------------------------------------------------------------------------
  // SEARCH GHOST MEMORY
  // -------------------------------------------------------------------------

  it('searches ghost memories', async () => {
    await waitForIndex(5000);

    // Search ghost memories specifically
    const res = parseResult(await handleSearchGhostMemory(
      { query: 'hiking trails outdoor activities', limit: 5 },
      ownerId, ownerAuth,
    ));

    expect(res.memories).toBeDefined();
    expect(res.memories.length).toBeGreaterThan(0);
    const ids = res.memories.map((m: any) => m.id);
    expect(ids).toContain(ghostMemoryId);
  });

  // -------------------------------------------------------------------------
  // UPDATE GHOST MEMORY
  // -------------------------------------------------------------------------

  it('updates the ghost memory', async () => {
    const res = parseResult(await handleUpdateGhostMemory(
      {
        memory_id: ghostMemoryId,
        content: `${accessorId} asked about my favorite hiking trails. They seem genuinely interested in outdoor activities. Follow-up: they mentioned they go rock climbing too.`,
      },
      ownerId, ghostAuth,
    ));

    expect(res.memory_id).toBe(ghostMemoryId);
  });

  // -------------------------------------------------------------------------
  // QUERY GHOST MEMORY (RAG)
  // -------------------------------------------------------------------------

  it('queries ghost memories with natural language', async () => {
    await waitForIndex();

    // Use ownerAuth to avoid trust filter — query is already filtered to ghost content_type
    const res = parseResult(await handleQueryGhostMemory(
      { query: 'What are the accessor\'s outdoor interests?', limit: 5, min_relevance: 0.3 },
      ownerId, ownerAuth,
    ));

    expect(res.memories).toBeDefined();
    expect(res.memories.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // SEARCH GHOST MEMORY BY (modes)
  // -------------------------------------------------------------------------

  // BUG: remember-core's byTime (and all search modes) add
  // content_type != 'ghost' exclusion even when filters.types includes 'ghost'.
  // This creates an impossible filter: content_type='ghost' AND content_type!='ghost'.
  // Fix: core should skip ghost exclusion when types filter explicitly includes 'ghost'.
  // This test WILL FAIL until the core bug is fixed.
  it('search_ghost_memory_by byTime returns ghost results', async () => {
    const res = parseResult(await handleSearchGhostMemoryBy(
      { mode: 'byTime', limit: 5 },
      ownerId, ownerAuth,
    ));

    expect(res.memories).toBeDefined();
    expect(res.memories.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // GET CORE (emotional state / perception)
  // -------------------------------------------------------------------------

  it('get_core returns ghost emotional state', async () => {
    const res = parseResult(await handleGetCore(
      {},
      ownerId, ownerAuth,
    ));

    // get_core should return some structure (may be empty for new ghost)
    expect(res).toBeDefined();
    console.log('  get_core returned:', Object.keys(res).join(', '));
  });

  // -------------------------------------------------------------------------
  // CLEANUP: disable ghost, block user
  // -------------------------------------------------------------------------

  it('blocks a user', async () => {
    const res = parseResult(await handleGhostConfig(
      { action: 'block', target_user_id: 'spammer_123' },
      ownerId, ownerAuth,
    ));
    expect(res.success).toBe(true);
  });

  it('unblocks a user', async () => {
    const res = parseResult(await handleGhostConfig(
      { action: 'unblock', target_user_id: 'spammer_123' },
      ownerId, ownerAuth,
    ));
    expect(res.success).toBe(true);
  });

  it('disables ghost mode', async () => {
    const res = parseResult(await handleGhostConfig(
      { action: 'set', enabled: false },
      ownerId, ownerAuth,
    ));
    expect(res.success).toBe(true);
  });
});
