import { searchSpaceByTool, handleSearchSpaceBy } from './search-space-by.js';

const mockByDiscovery = jest.fn();

jest.mock('../core-services.js', () => ({
  createCoreServices: jest.fn(() => ({
    space: {
      byDiscovery: mockByDiscovery,
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
  memories: [{ id: 'pub-1', content: 'published memory' }],
  total: 1,
  offset: 0,
  limit: 10,
};

describe('remember_search_space_by', () => {
  const userId = 'test-user-1';

  beforeEach(() => {
    jest.clearAllMocks();
    mockByDiscovery.mockResolvedValue(mockResult);
  });

  describe('tool definition', () => {
    it('has correct name', () => {
      expect(searchSpaceByTool.name).toBe('remember_search_space_by');
    });

    it('requires mode', () => {
      expect(searchSpaceByTool.inputSchema.required).toContain('mode');
    });

    it('has all mode options (no byDensity)', () => {
      const modeProp = (searchSpaceByTool.inputSchema.properties as any).mode;
      expect(modeProp.enum).toEqual(['byTime', 'byRating', 'byDiscovery', 'byProperty', 'byBroad', 'byRandom']);
      expect(modeProp.enum).not.toContain('byDensity');
    });

    it('has spaces and groups parameters', () => {
      const props = searchSpaceByTool.inputSchema.properties as any;
      expect(props.spaces).toBeDefined();
      expect(props.groups).toBeDefined();
    });

    it('has moderation_filter and include_comments', () => {
      const props = searchSpaceByTool.inputSchema.properties as any;
      expect(props.moderation_filter).toBeDefined();
      expect(props.include_comments).toBeDefined();
    });
  });

  describe('validation', () => {
    it('returns error when neither spaces nor groups provided', async () => {
      const result = await handleSearchSpaceBy({ mode: 'byDiscovery' }, userId);
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('spaces');
      expect(parsed.error).toContain('groups');
    });

    it('returns error with empty spaces array and no groups', async () => {
      const result = await handleSearchSpaceBy({ mode: 'byDiscovery', spaces: [] }, userId);
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('spaces');
    });
  });

  describe('byDiscovery mode', () => {
    it('dispatches to space.byDiscovery', async () => {
      const result = await handleSearchSpaceBy(
        { mode: 'byDiscovery', spaces: ['public'] },
        userId,
      );
      expect(mockByDiscovery).toHaveBeenCalledTimes(1);
      expect(JSON.parse(result)).toEqual(mockResult);
    });

    it('passes spaces parameter', async () => {
      await handleSearchSpaceBy({ mode: 'byDiscovery', spaces: ['space-1', 'space-2'] }, userId);
      expect(mockByDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({ spaces: ['space-1', 'space-2'] }),
        undefined,
      );
    });

    it('passes groups parameter', async () => {
      await handleSearchSpaceBy({ mode: 'byDiscovery', groups: ['group-1'] }, userId);
      expect(mockByDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({ groups: ['group-1'] }),
        undefined,
      );
    });

    it('passes both spaces and groups', async () => {
      await handleSearchSpaceBy(
        { mode: 'byDiscovery', spaces: ['pub'], groups: ['grp-1'] },
        userId,
      );
      expect(mockByDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({ spaces: ['pub'], groups: ['grp-1'] }),
        undefined,
      );
    });

    it('passes query through', async () => {
      await handleSearchSpaceBy(
        { mode: 'byDiscovery', spaces: ['pub'], query: 'explore' },
        userId,
      );
      expect(mockByDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'explore' }),
        undefined,
      );
    });

    it('passes limit and offset', async () => {
      await handleSearchSpaceBy(
        { mode: 'byDiscovery', spaces: ['pub'], limit: 20, offset: 5 },
        userId,
      );
      expect(mockByDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, offset: 5 }),
        undefined,
      );
    });

    it('defaults limit to 10 and offset to 0', async () => {
      await handleSearchSpaceBy({ mode: 'byDiscovery', spaces: ['pub'] }, userId);
      expect(mockByDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 0 }),
        undefined,
      );
    });

    it('passes moderation_filter', async () => {
      await handleSearchSpaceBy(
        { mode: 'byDiscovery', spaces: ['pub'], moderation_filter: 'approved' },
        userId,
      );
      expect(mockByDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({ moderation_filter: 'approved' }),
        undefined,
      );
    });

    it('passes include_comments', async () => {
      await handleSearchSpaceBy(
        { mode: 'byDiscovery', spaces: ['pub'], include_comments: true },
        userId,
      );
      expect(mockByDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({ include_comments: true }),
        undefined,
      );
    });
  });

  describe('stub modes', () => {
    it('byTime returns not-yet-available', async () => {
      const result = await handleSearchSpaceBy({ mode: 'byTime', spaces: ['pub'] }, userId);
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('not yet available');
    });

    it('byRating returns not-yet-available', async () => {
      const result = await handleSearchSpaceBy({ mode: 'byRating', spaces: ['pub'] }, userId);
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('not yet available');
    });

    it('byBroad returns not-yet-available', async () => {
      const result = await handleSearchSpaceBy({ mode: 'byBroad', spaces: ['pub'] }, userId);
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('not yet available');
    });

    it('byRandom returns not-yet-available', async () => {
      const result = await handleSearchSpaceBy({ mode: 'byRandom', spaces: ['pub'] }, userId);
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('not yet available');
    });
  });

  describe('byProperty mode', () => {
    it('returns error when sort_field missing', async () => {
      const result = await handleSearchSpaceBy({ mode: 'byProperty', spaces: ['pub'] }, userId);
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('sort_field is required');
    });

    it('returns not-yet-available with sort_field', async () => {
      const result = await handleSearchSpaceBy(
        { mode: 'byProperty', spaces: ['pub'], sort_field: 'feel_trauma' },
        userId,
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('not yet available');
    });
  });

  describe('invalid mode', () => {
    it('returns error for unknown mode', async () => {
      const result = await handleSearchSpaceBy(
        { mode: 'byInvalid' as any, spaces: ['pub'] },
        userId,
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Unknown mode');
    });
  });
});
