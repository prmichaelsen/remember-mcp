/**
 * E2E: Relationships — create/search/update/delete relationships
 *
 * Run with:
 *   DOTENV_CONFIG_PATH=.env.e1.local npm run test:e2e -- --testPathPattern=relationships
 */

import {
  e2eInit, e2eUserId, e2eAuthContext, e2eEnsureCollection,
  e2eCleanup, parseResult, waitForIndex,
} from './e2e-helpers.js';
import { handleCreateMemory } from './tools/create-memory.js';
import { handleCreateRelationship } from './tools/create-relationship.js';
import { handleSearchRelationship } from './tools/search-relationship.js';
import { handleUpdateRelationship } from './tools/update-relationship.js';
import { handleDeleteRelationship } from './tools/delete-relationship.js';
import { handleSearchMemory } from './tools/search-memory.js';

const userId = e2eUserId('rel');
const auth = e2eAuthContext();

describe('E2E: Relationships', () => {
  let memA: string;
  let memB: string;
  let relId: string;

  beforeAll(async () => {
    await e2eInit();
    await e2eEnsureCollection(userId);

    // Create two memories to link
    const a = parseResult(await handleCreateMemory(
      { content: 'Learned TypeScript generics at work today. Mapped types are powerful.', tags: ['typescript', 'learning'] },
      userId, auth,
    ));
    memA = a.memory_id;

    const b = parseResult(await handleCreateMemory(
      { content: 'Built a type-safe API client using TypeScript generics and Zod validation.', tags: ['typescript', 'api'] },
      userId, auth,
    ));
    memB = b.memory_id;

    await waitForIndex();
  }, 30_000);

  afterAll(async () => {
    await e2eCleanup(userId);
  }, 30_000);

  // -------------------------------------------------------------------------
  // CREATE RELATIONSHIP
  // -------------------------------------------------------------------------

  it('creates a relationship linking two memories', async () => {
    const res = parseResult(await handleCreateRelationship(
      {
        memory_ids: [memA, memB],
        relationship_type: 'applied_learning',
        observation: 'The TypeScript generics knowledge was directly applied to build the API client.',
        strength: 0.9,
      },
      userId, auth,
    ));

    expect(res.relationship_id).toBeTruthy();
    expect(res.memory_ids).toContain(memA);
    expect(res.memory_ids).toContain(memB);
    relId = res.relationship_id;
    console.log(`  created relationship ${relId}`);
  });

  // -------------------------------------------------------------------------
  // SEARCH RELATIONSHIP
  // -------------------------------------------------------------------------

  it('finds relationship via semantic search on observation', async () => {
    await waitForIndex();

    const res = parseResult(await handleSearchRelationship(
      { query: 'applied generics knowledge to API', limit: 5 },
      userId, auth,
    ));

    expect(res.relationships).toBeDefined();
    expect(res.relationships.length).toBeGreaterThan(0);
    const ids = res.relationships.map((r: any) => r.id);
    expect(ids).toContain(relId);
  });

  it('search_memory with include_relationships returns both memories and relationships', async () => {
    const res = parseResult(await handleSearchMemory(
      { query: 'TypeScript generics', limit: 10, include_relationships: true },
      userId, auth,
    ));

    expect(res.memories.length).toBeGreaterThan(0);
    expect(res.relationships).toBeDefined();
    expect(res.relationships.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // UPDATE RELATIONSHIP
  // -------------------------------------------------------------------------

  it('updates the relationship observation', async () => {
    const res = parseResult(await handleUpdateRelationship(
      {
        relationship_id: relId,
        observation: 'The TypeScript generics knowledge was applied to build a production API client with full type safety.',
        strength: 1.0,
      },
      userId, auth,
    ));

    expect(res.relationship_id).toBe(relId);
  });

  it('search reflects updated observation', async () => {
    await waitForIndex();

    const res = parseResult(await handleSearchRelationship(
      { query: 'production API client full type safety', limit: 5 },
      userId, auth,
    ));

    const found = res.relationships.find((r: any) => r.id === relId);
    expect(found).toBeTruthy();
    expect(found.observation).toContain('production');
  });

  // -------------------------------------------------------------------------
  // DELETE RELATIONSHIP
  // -------------------------------------------------------------------------

  it('deletes the relationship', async () => {
    const res = parseResult(await handleDeleteRelationship(
      { relationship_id: relId },
      userId, auth,
    ));

    expect(res.deleted).toBe(true);
  });

  it('deleted relationship no longer appears in search', async () => {
    await waitForIndex();

    const res = parseResult(await handleSearchRelationship(
      { query: 'TypeScript generics applied learning', limit: 5 },
      userId, auth,
    ));

    const ids = (res.relationships || []).map((r: any) => r.id);
    expect(ids).not.toContain(relId);
  });
});
