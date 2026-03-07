/**
 * E2E: Shared Spaces — publish/confirm/deny/search/query/revise/retract
 *
 * Run with:
 *   DOTENV_CONFIG_PATH=.env.e1.local npm run test:e2e -- --testPathPattern=shared-spaces
 */

import {
  e2eInit, e2eUserId, e2eAuthContext, e2eEnsureCollection,
  e2eCleanup, e2eDeleteCollection, parseResult, waitForIndex,
} from './e2e-helpers.js';
import { handleCreateMemory } from './tools/create-memory.js';
import { handleUpdateMemory } from './tools/update-memory.js';
import { handlePublish } from './tools/publish.js';
import { handleConfirm } from './tools/confirm.js';
import { handleDeny } from './tools/deny.js';
import { handleSearchSpace } from './tools/search-space.js';
import { handleQuerySpace } from './tools/query-space.js';
import { handleRevise } from './tools/revise.js';
import { handleRetract } from './tools/retract.js';

const userId = e2eUserId('space');
const auth = e2eAuthContext();
const SPACE = 'the_void';
const SPACE_COLLECTION = 'Memory_spaces_public';

describe('E2E: Shared Spaces', () => {
  let memoryId: string;
  let publishToken: string;

  beforeAll(async () => {
    await e2eInit();
    await e2eEnsureCollection(userId);

    // Create a memory to publish
    const res = parseResult(await handleCreateMemory(
      { content: 'The best sourdough starter tip: feed with rye flour for extra tang.', weight: 0.8, tags: ['sourdough', 'baking', 'tips'] },
      userId, auth,
    ));
    memoryId = res.memory_id;
    await waitForIndex();
  }, 30_000);

  afterAll(async () => {
    await e2eCleanup(userId);
    // Note: we don't delete the shared space collection as other tests may use it
  }, 30_000);

  // -------------------------------------------------------------------------
  // DENY flow (publish → deny)
  // -------------------------------------------------------------------------

  it('publishes a memory and then denies it', async () => {
    const pubRes = parseResult(await handlePublish(
      { memory_id: memoryId, spaces: [SPACE] },
      userId, auth,
    ));
    expect(pubRes.success).toBe(true);
    expect(pubRes.token).toBeTruthy();

    const denyRes = parseResult(await handleDeny(
      { token: pubRes.token },
      userId, auth,
    ));
    expect(denyRes.success).toBe(true);
    console.log('  denied publish');
  });

  // -------------------------------------------------------------------------
  // PUBLISH + CONFIRM
  // -------------------------------------------------------------------------

  it('publishes a memory to the_void', async () => {
    const res = parseResult(await handlePublish(
      { memory_id: memoryId, spaces: [SPACE] },
      userId, auth,
    ));
    expect(res.success).toBe(true);
    publishToken = res.token;
  });

  it('confirms the publish', async () => {
    const res = parseResult(await handleConfirm(
      { token: publishToken },
      userId, auth,
    ));
    expect(res.success).toBe(true);
    expect(res.composite_id).toBeTruthy();
    expect(res.published_to).toBeDefined();
    console.log(`  published as ${res.composite_id}`);
  });

  // -------------------------------------------------------------------------
  // SEARCH SPACE
  // -------------------------------------------------------------------------

  it('finds published memory via search_space', async () => {
    await waitForIndex();

    const res = parseResult(await handleSearchSpace(
      { query: 'sourdough rye flour starter', spaces: [SPACE], limit: 10 },
      userId, auth,
    ));

    expect(res.memories).toBeDefined();
    expect(res.memories.length).toBeGreaterThan(0);
    const contents = res.memories.map((m: any) => m.content || m.properties?.content);
    const found = contents.some((c: string) => c && c.includes('sourdough'));
    expect(found).toBe(true);
    console.log(`  search_space returned ${res.memories.length} results`);
  });

  // -------------------------------------------------------------------------
  // QUERY SPACE (RAG)
  // -------------------------------------------------------------------------

  it('query_space returns relevant results', async () => {
    const res = parseResult(await handleQuerySpace(
      { question: 'How do I make my sourdough more tangy?', spaces: [SPACE], limit: 5 },
      userId, auth,
    ));

    expect(res.memories).toBeDefined();
    expect(res.memories.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // REVISE
  // -------------------------------------------------------------------------

  it('updates source memory then revises published copies', async () => {
    // Update the source memory
    await handleUpdateMemory(
      { memory_id: memoryId, content: 'The best sourdough starter tip: feed with rye flour for extra tang. Also, keep it at 78F for best activity.' },
      userId, auth,
    );
    await waitForIndex();

    // Request revise
    const revRes = parseResult(await handleRevise(
      { memory_id: memoryId },
      userId, auth,
    ));
    expect(revRes.token).toBeTruthy();

    // Confirm revise
    const confirmRes = parseResult(await handleConfirm(
      { token: revRes.token },
      userId, auth,
    ));
    expect(confirmRes.success).toBe(true);
    console.log('  revised published copy');
  });

  it('revised content appears in space search', async () => {
    await waitForIndex();

    const res = parseResult(await handleSearchSpace(
      { query: 'sourdough 78F temperature activity', spaces: [SPACE], limit: 10 },
      userId, auth,
    ));

    const found = res.memories.some((m: any) => {
      const content = m.content || m.properties?.content || '';
      return content.includes('78F');
    });
    expect(found).toBe(true);
  });

  // -------------------------------------------------------------------------
  // RETRACT
  // -------------------------------------------------------------------------

  it('retracts the memory from the_void', async () => {
    const retRes = parseResult(await handleRetract(
      { memory_id: memoryId, spaces: [SPACE] },
      userId, auth,
    ));
    expect(retRes.token).toBeTruthy();

    const confirmRes = parseResult(await handleConfirm(
      { token: retRes.token },
      userId, auth,
    ));
    expect(confirmRes.success).toBe(true);
    console.log('  retracted from the_void');
  });

  it('retracted memory no longer appears in space search', async () => {
    await waitForIndex();

    const res = parseResult(await handleSearchSpace(
      { query: 'sourdough rye flour starter', spaces: [SPACE], limit: 10 },
      userId, auth,
    ));

    // Our specific memory should not be found (or the space may be empty)
    const found = res.memories?.some((m: any) => {
      const content = m.content || m.properties?.content || '';
      return content.includes('sourdough') && content.includes('78F');
    });
    expect(found).toBeFalsy();
  });
});
