import { createGhostMemoryTool, handleCreateGhostMemory } from './create-ghost-memory.js';
import { updateGhostMemoryTool, handleUpdateGhostMemory } from './update-ghost-memory.js';
import { searchGhostMemoryTool, handleSearchGhostMemory } from './search-ghost-memory.js';
import { queryGhostMemoryTool, handleQueryGhostMemory } from './query-ghost-memory.js';
import { searchGhostMemoryByTool, handleSearchGhostMemoryBy } from './search-ghost-memory-by.js';

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
      byDensity: jest.fn().mockResolvedValue({ memories: [], total: 0, offset: 0, limit: 10 }),
      byRating: jest.fn().mockResolvedValue({ memories: [], total: 0, offset: 0, limit: 10 }),
      byDiscovery: jest.fn().mockResolvedValue({ memories: [], total: 0, offset: 0, limit: 10 }),
    },
  })),
}));

// Mock search-memory handler
const mockHandleSearchMemory = jest.fn();
jest.mock('./search-memory.js', () => ({
  handleSearchMemory: (...args: any[]) => mockHandleSearchMemory(...args),
}));

// Mock query-memory handler
const mockHandleQueryMemory = jest.fn();
jest.mock('./query-memory.js', () => ({
  handleQueryMemory: (...args: any[]) => mockHandleQueryMemory(...args),
}));

// Mock weaviate schema for update-ghost-memory
const mockFetchObjectById = jest.fn();
jest.mock('../weaviate/schema.js', () => ({
  getMemoryCollection: jest.fn(() => ({
    query: { fetchObjectById: mockFetchObjectById },
  })),
}));

jest.mock('../utils/debug.js', () => ({
  createDebugLogger: () => ({
    info: jest.fn(),
    trace: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('Ghost Memory Tools', () => {
  const userId = 'test-user-1';

  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleSearchMemory.mockResolvedValue(JSON.stringify({ memories: [], total: 0 }));
    mockHandleQueryMemory.mockResolvedValue(JSON.stringify({ memories: [], total: 0 }));
    mockByTime.mockResolvedValue({ memories: [], total: 0, offset: 0, limit: 10 });
  });

  // ── create_ghost_memory ──

  describe('remember_create_ghost_memory', () => {
    it('has correct tool name', () => {
      expect(createGhostMemoryTool.name).toBe('remember_create_ghost_memory');
    });

    it('requires content', () => {
      expect(createGhostMemoryTool.inputSchema.required).toContain('content');
    });

    it('hardcodes content_type to ghost', async () => {
      mockCreate.mockResolvedValue({ memory_id: 'mem-1', created_at: '2026-01-01' });
      await handleCreateGhostMemory({ content: 'test ghost' }, userId);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ghost' }),
      );
    });

    it('adds ghost tag automatically', async () => {
      mockCreate.mockResolvedValue({ memory_id: 'mem-1', created_at: '2026-01-01' });
      await handleCreateGhostMemory({ content: 'test' }, userId);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.arrayContaining(['ghost']),
        }),
      );
    });

    it('adds ghost:{accessor_user_id} tag from auth context', async () => {
      mockCreate.mockResolvedValue({ memory_id: 'mem-1', created_at: '2026-01-01' });
      const authContext = {
        accessToken: 'token',
        credentials: null,
        internalContext: {
          type: 'ghost' as const,
          ghost_type: 'user' as const,
          owner_user_id: 'owner-123',
          accessor_user_id: 'accessor-456',
          accessor_trust_level: 0.7,
        },
      };
      await handleCreateGhostMemory({ content: 'test' }, userId, authContext);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.arrayContaining(['ghost', 'ghost:accessor-456']),
        }),
      );
    });

    it('merges user tags without duplicating ghost', async () => {
      mockCreate.mockResolvedValue({ memory_id: 'mem-1', created_at: '2026-01-01' });
      await handleCreateGhostMemory({ content: 'test', tags: ['ghost', 'custom'] }, userId);
      const callArgs = mockCreate.mock.calls[0][0];
      const ghostCount = callArgs.tags.filter((t: string) => t === 'ghost').length;
      expect(ghostCount).toBe(1);
      expect(callArgs.tags).toContain('custom');
    });

    it('returns memory_id and content_type in response', async () => {
      mockCreate.mockResolvedValue({ memory_id: 'mem-1', created_at: '2026-01-01' });
      const result = await handleCreateGhostMemory({ content: 'test' }, userId);
      const parsed = JSON.parse(result);
      expect(parsed.memory_id).toBe('mem-1');
      expect(parsed.content_type).toBe('ghost');
    });

    it('passes feel_* fields through', async () => {
      mockCreate.mockResolvedValue({ memory_id: 'mem-1', created_at: '2026-01-01' });
      await handleCreateGhostMemory(
        { content: 'test', feel_salience: 0.8, feel_social_weight: 0.5 },
        userId,
      );
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ feel_salience: 0.8, feel_social_weight: 0.5 }),
      );
    });
  });

  // ── update_ghost_memory ──

  describe('remember_update_ghost_memory', () => {
    it('has correct tool name', () => {
      expect(updateGhostMemoryTool.name).toBe('remember_update_ghost_memory');
    });

    it('requires memory_id', () => {
      expect(updateGhostMemoryTool.inputSchema.required).toContain('memory_id');
    });

    it('rejects non-ghost memories', async () => {
      mockFetchObjectById.mockResolvedValue({
        properties: { content_type: 'note' },
      });
      const result = await handleUpdateGhostMemory(
        { memory_id: 'mem-1', content: 'updated' },
        userId,
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('not a ghost memory');
    });

    it('returns error for non-existent memory', async () => {
      mockFetchObjectById.mockResolvedValue(null);
      const result = await handleUpdateGhostMemory(
        { memory_id: 'mem-missing' },
        userId,
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('not found');
    });

    it('updates ghost memory successfully', async () => {
      mockFetchObjectById.mockResolvedValue({
        properties: { content_type: 'ghost' },
      });
      mockUpdate.mockResolvedValue({
        memory_id: 'mem-1',
        updated_at: '2026-01-01',
        version: 2,
        updated_fields: ['content'],
      });
      const result = await handleUpdateGhostMemory(
        { memory_id: 'mem-1', content: 'updated ghost' },
        userId,
      );
      const parsed = JSON.parse(result);
      expect(parsed.memory_id).toBe('mem-1');
      expect(parsed.updated_fields).toContain('content');
    });
  });

  // ── search_ghost_memory ──

  describe('remember_search_ghost_memory', () => {
    it('has correct tool name', () => {
      expect(searchGhostMemoryTool.name).toBe('remember_search_ghost_memory');
    });

    it('requires query', () => {
      expect(searchGhostMemoryTool.inputSchema.required).toContain('query');
    });

    it('hardcodes filters.types to ghost', async () => {
      await handleSearchGhostMemory({ query: 'test' }, userId);
      expect(mockHandleSearchMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ types: ['ghost'] }),
        }),
        userId,
        undefined,
      );
    });

    it('passes query and alpha through', async () => {
      await handleSearchGhostMemory({ query: 'hello', alpha: 0.5 }, userId);
      expect(mockHandleSearchMemory).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'hello', alpha: 0.5 }),
        userId,
        undefined,
      );
    });

    it('passes tags through in filters', async () => {
      await handleSearchGhostMemory({ query: 'test', tags: ['important'] }, userId);
      expect(mockHandleSearchMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ tags: ['important'], types: ['ghost'] }),
        }),
        userId,
        undefined,
      );
    });

    it('passes limit and offset', async () => {
      await handleSearchGhostMemory({ query: 'test', limit: 20, offset: 5 }, userId);
      expect(mockHandleSearchMemory).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, offset: 5 }),
        userId,
        undefined,
      );
    });

    it('passes deleted_filter', async () => {
      await handleSearchGhostMemory({ query: 'test', deleted_filter: 'only' }, userId);
      expect(mockHandleSearchMemory).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_filter: 'only' }),
        userId,
        undefined,
      );
    });
  });

  // ── query_ghost_memory ──

  describe('remember_query_ghost_memory', () => {
    it('has correct tool name', () => {
      expect(queryGhostMemoryTool.name).toBe('remember_query_ghost_memory');
    });

    it('requires query', () => {
      expect(queryGhostMemoryTool.inputSchema.required).toContain('query');
    });

    it('hardcodes filters.types to ghost', async () => {
      await handleQueryGhostMemory({ query: 'what happened?' }, userId);
      expect(mockHandleQueryMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ types: ['ghost'] }),
        }),
        userId,
        undefined,
      );
    });

    it('passes query through', async () => {
      await handleQueryGhostMemory({ query: 'tell me about interactions' }, userId);
      expect(mockHandleQueryMemory).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'tell me about interactions' }),
        userId,
        undefined,
      );
    });

    it('passes limit and min_relevance', async () => {
      await handleQueryGhostMemory({ query: 'test', limit: 10, min_relevance: 0.8 }, userId);
      expect(mockHandleQueryMemory).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, min_relevance: 0.8 }),
        userId,
        undefined,
      );
    });

    it('passes authContext through', async () => {
      const authContext = {
        accessToken: 'token',
        credentials: null,
        internalContext: {
          type: 'ghost' as const,
          ghost_type: 'user' as const,
          owner_user_id: 'owner-123',
          accessor_user_id: 'accessor-456',
          accessor_trust_level: 0.7,
        },
      };
      await handleQueryGhostMemory({ query: 'test' }, userId, authContext);
      expect(mockHandleQueryMemory).toHaveBeenCalledWith(
        expect.anything(),
        userId,
        authContext,
      );
    });
  });

  // ── search_ghost_memory_by ──

  describe('remember_search_ghost_memory_by', () => {
    it('has correct tool name', () => {
      expect(searchGhostMemoryByTool.name).toBe('remember_search_ghost_memory_by');
    });

    it('requires mode', () => {
      expect(searchGhostMemoryByTool.inputSchema.required).toContain('mode');
    });

    it('hardcodes filters.types to ghost for byTime', async () => {
      await handleSearchGhostMemoryBy({ mode: 'byTime' }, userId);
      expect(mockByTime).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ types: ['ghost'] }),
        }),
      );
    });

    it('passes sort_order through', async () => {
      await handleSearchGhostMemoryBy({ mode: 'byTime', sort_order: 'asc' }, userId);
      expect(mockByTime).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'asc' }),
      );
    });

    it('passes limit and offset', async () => {
      await handleSearchGhostMemoryBy({ mode: 'byTime', limit: 20, offset: 5 }, userId);
      expect(mockByTime).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, offset: 5 }),
      );
    });

    it('passes deleted_filter', async () => {
      await handleSearchGhostMemoryBy({ mode: 'byTime', deleted_filter: 'only' }, userId);
      expect(mockByTime).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_filter: 'only' }),
      );
    });

    it('has all mode options in schema', () => {
      const modeProp = (searchGhostMemoryByTool.inputSchema.properties as any).mode;
      expect(modeProp.enum).toEqual(
        expect.arrayContaining(['byTime', 'byDensity', 'byRating', 'byDiscovery', 'byProperty', 'bySignificance', 'byRandom', 'byBroad']),
      );
    });
  });
});
