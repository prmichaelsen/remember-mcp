import { searchByTool, handleSearchBy } from './search-by.js';

// Mock core-services
const mockByTime = jest.fn();
const mockByDensity = jest.fn();
const mockByRating = jest.fn();
const mockByDiscovery = jest.fn();
const mockByProperty = jest.fn();
const mockByBroad = jest.fn();
const mockByRandom = jest.fn();

jest.mock('../core-services.js', () => ({
  createCoreServices: jest.fn(() => ({
    memory: {
      byTime: mockByTime,
      byDensity: mockByDensity,
      byRating: mockByRating,
      byDiscovery: mockByDiscovery,
      byProperty: mockByProperty,
      byBroad: mockByBroad,
      byRandom: mockByRandom,
    },
  })),
}));

jest.mock('../utils/debug.js', () => ({
  createDebugLogger: () => ({
    info: jest.fn(),
    trace: jest.fn(),
    error: jest.fn(),
  }),
}));

const mockResult = {
  memories: [{ id: 'mem-1', content: 'test memory' }],
  total: 1,
  offset: 0,
  limit: 10,
};

describe('remember_search_by', () => {
  const userId = 'test-user-1';

  beforeEach(() => {
    jest.clearAllMocks();
    mockByTime.mockResolvedValue(mockResult);
    mockByDensity.mockResolvedValue(mockResult);
    mockByRating.mockResolvedValue(mockResult);
    mockByDiscovery.mockResolvedValue(mockResult);
    mockByProperty.mockResolvedValue(mockResult);
    mockByBroad.mockResolvedValue(mockResult);
    mockByRandom.mockResolvedValue(mockResult);
  });

  describe('tool definition', () => {
    it('has correct name', () => {
      expect(searchByTool.name).toBe('remember_search_by');
    });

    it('requires mode parameter', () => {
      expect(searchByTool.inputSchema.required).toContain('mode');
    });

    it('has all mode options', () => {
      const modeProp = (searchByTool.inputSchema.properties as any).mode;
      expect(modeProp.enum).toEqual(['byTime', 'byDensity', 'byRating', 'byDiscovery', 'byProperty', 'bySignificance', 'byBroad', 'byRandom']);
    });

    it('has sort_field parameter', () => {
      const sortFieldProp = (searchByTool.inputSchema.properties as any).sort_field;
      expect(sortFieldProp).toBeDefined();
      expect(sortFieldProp.type).toBe('string');
    });

    it('has sort_order parameter', () => {
      const sortProp = (searchByTool.inputSchema.properties as any).sort_order;
      expect(sortProp.enum).toEqual(['asc', 'desc']);
    });

    it('has filters object with all filter properties', () => {
      const filtersProp = (searchByTool.inputSchema.properties as any).filters;
      expect(filtersProp.properties.types).toBeDefined();
      expect(filtersProp.properties.exclude_types).toBeDefined();
      expect(filtersProp.properties.tags).toBeDefined();
      expect(filtersProp.properties.weight_min).toBeDefined();
      expect(filtersProp.properties.rating_min).toBeDefined();
      expect(filtersProp.properties.relationship_count_min).toBeDefined();
      expect(filtersProp.properties.relationship_count_max).toBeDefined();
      expect(filtersProp.properties.has_relationships).toBeDefined();
    });

    it('has deleted_filter parameter', () => {
      const deletedProp = (searchByTool.inputSchema.properties as any).deleted_filter;
      expect(deletedProp.enum).toEqual(['exclude', 'include', 'only']);
    });
  });

  describe('byTime mode', () => {
    it('dispatches to memory.byTime', async () => {
      const result = await handleSearchBy({ mode: 'byTime' }, userId);
      expect(mockByTime).toHaveBeenCalledTimes(1);
      expect(JSON.parse(result)).toEqual(mockResult);
    });

    it('passes sort_order as direction', async () => {
      await handleSearchBy({ mode: 'byTime', sort_order: 'asc' }, userId);
      expect(mockByTime).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'asc' }),
      );
    });

    it('defaults direction to desc', async () => {
      await handleSearchBy({ mode: 'byTime' }, userId);
      expect(mockByTime).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'desc' }),
      );
    });

    it('passes limit and offset', async () => {
      await handleSearchBy({ mode: 'byTime', limit: 20, offset: 5 }, userId);
      expect(mockByTime).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, offset: 5 }),
      );
    });

    it('defaults limit to 10 and offset to 0', async () => {
      await handleSearchBy({ mode: 'byTime' }, userId);
      expect(mockByTime).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 0 }),
      );
    });
  });

  describe('byDensity mode', () => {
    it('dispatches to memory.byDensity', async () => {
      const result = await handleSearchBy({ mode: 'byDensity' }, userId);
      expect(mockByDensity).toHaveBeenCalledTimes(1);
      expect(JSON.parse(result)).toEqual(mockResult);
    });

    it('passes filters through', async () => {
      const filters = { types: ['note'], tags: ['important'] };
      await handleSearchBy({ mode: 'byDensity', filters }, userId);
      expect(mockByDensity).toHaveBeenCalledWith(
        expect.objectContaining({ filters }),
      );
    });
  });

  describe('byRating mode', () => {
    it('dispatches to memory.byRating', async () => {
      const result = await handleSearchBy({ mode: 'byRating' }, userId);
      expect(mockByRating).toHaveBeenCalledTimes(1);
      expect(JSON.parse(result)).toEqual(mockResult);
    });

    it('passes sort_order as direction', async () => {
      await handleSearchBy({ mode: 'byRating', sort_order: 'asc' }, userId);
      expect(mockByRating).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'asc' }),
      );
    });
  });

  describe('byDiscovery mode', () => {
    it('dispatches to memory.byDiscovery', async () => {
      const result = await handleSearchBy({ mode: 'byDiscovery' }, userId);
      expect(mockByDiscovery).toHaveBeenCalledTimes(1);
      expect(JSON.parse(result)).toEqual(mockResult);
    });

    it('passes filters to byDiscovery', async () => {
      const filters = { tags: ['music'] };
      await handleSearchBy({ mode: 'byDiscovery', filters }, userId);
      expect(mockByDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({ filters }),
      );
    });

    it('does not pass sort_order (not applicable)', async () => {
      await handleSearchBy({ mode: 'byDiscovery', sort_order: 'asc' }, userId);
      const callArgs = mockByDiscovery.mock.calls[0][0];
      expect(callArgs.direction).toBeUndefined();
    });
  });

  describe('byProperty mode', () => {
    it('returns error when sort_field is missing', async () => {
      const result = await handleSearchBy({ mode: 'byProperty' }, userId);
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('sort_field is required');
    });

    it('dispatches to memory.byProperty with sort_field', async () => {
      const result = await handleSearchBy({ mode: 'byProperty', sort_field: 'feel_trauma' }, userId);
      expect(mockByProperty).toHaveBeenCalledWith(
        expect.objectContaining({ sort_field: 'feel_trauma', sort_direction: 'desc' }),
      );
      expect(JSON.parse(result)).toEqual(mockResult);
    });

    it('passes sort_order as sort_direction', async () => {
      await handleSearchBy({ mode: 'byProperty', sort_field: 'weight', sort_order: 'asc' }, userId);
      expect(mockByProperty).toHaveBeenCalledWith(
        expect.objectContaining({ sort_field: 'weight', sort_direction: 'asc' }),
      );
    });
  });

  describe('bySignificance mode', () => {
    it('dispatches to memory.byProperty with total_significance', async () => {
      const result = await handleSearchBy({ mode: 'bySignificance' }, userId);
      expect(mockByProperty).toHaveBeenCalledWith(
        expect.objectContaining({ sort_field: 'total_significance', sort_direction: 'desc' }),
      );
      expect(JSON.parse(result)).toEqual(mockResult);
    });

    it('respects sort_order', async () => {
      await handleSearchBy({ mode: 'bySignificance', sort_order: 'asc' }, userId);
      expect(mockByProperty).toHaveBeenCalledWith(
        expect.objectContaining({ sort_direction: 'asc' }),
      );
    });
  });

  describe('byBroad mode', () => {
    it('dispatches to memory.byBroad', async () => {
      const result = await handleSearchBy({ mode: 'byBroad' }, userId);
      expect(mockByBroad).toHaveBeenCalledTimes(1);
      expect(JSON.parse(result)).toEqual(mockResult);
    });

    it('passes query through', async () => {
      await handleSearchBy({ mode: 'byBroad', query: 'explore' }, userId);
      expect(mockByBroad).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'explore' }),
      );
    });
  });

  describe('byRandom mode', () => {
    it('dispatches to memory.byRandom', async () => {
      const result = await handleSearchBy({ mode: 'byRandom' }, userId);
      expect(mockByRandom).toHaveBeenCalledTimes(1);
      expect(JSON.parse(result)).toEqual(mockResult);
    });
  });

  describe('invalid mode', () => {
    it('returns error for unknown mode', async () => {
      const result = await handleSearchBy({ mode: 'byInvalid' as any }, userId);
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Unknown mode');
    });
  });

  describe('filters passthrough', () => {
    it('passes all filter properties to core', async () => {
      const filters = {
        types: ['note', 'idea'],
        exclude_types: ['ghost'],
        tags: ['important', 'work'],
        weight_min: 0.5,
        weight_max: 1.0,
        trust_min: 0.3,
        trust_max: 0.9,
        date_from: '2026-01-01T00:00:00Z',
        date_to: '2026-03-07T00:00:00Z',
        rating_min: 3.5,
        relationship_count_min: 2,
        relationship_count_max: 10,
        has_relationships: true,
      };
      await handleSearchBy({ mode: 'byTime', filters }, userId);
      expect(mockByTime).toHaveBeenCalledWith(
        expect.objectContaining({ filters }),
      );
    });
  });

  describe('deleted_filter passthrough', () => {
    it('passes deleted_filter to core', async () => {
      await handleSearchBy({ mode: 'byTime', deleted_filter: 'only' }, userId);
      expect(mockByTime).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_filter: 'only' }),
      );
    });
  });

  describe('ghost mode', () => {
    it('searches owner collection in ghost mode', async () => {
      const { createCoreServices } = require('../core-services.js');
      const authContext = {
        accessToken: 'token',
        credentials: null,
        ghostMode: {
          owner_user_id: 'owner-123',
          accessor_user_id: 'accessor-456',
          accessor_trust_level: 0.7,
        },
      };
      await handleSearchBy({ mode: 'byTime' }, 'accessor-456', authContext);
      expect(createCoreServices).toHaveBeenCalledWith('owner-123');
    });

    it('passes ghost_context to core', async () => {
      const authContext = {
        accessToken: 'token',
        credentials: null,
        ghostMode: {
          owner_user_id: 'owner-123',
          accessor_user_id: 'accessor-456',
          accessor_trust_level: 0.7,
        },
      };
      await handleSearchBy({ mode: 'byTime' }, 'accessor-456', authContext);
      expect(mockByTime).toHaveBeenCalledWith(
        expect.objectContaining({
          ghost_context: { accessor_trust_level: 0.7, owner_user_id: 'owner-123' },
        }),
      );
    });
  });
});
