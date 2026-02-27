/**
 * Unit tests for remember_search_space tool (Memory Collection Pattern v2)
 *
 * Tests cover:
 * - Tool definition schema (name, inputSchema, description)
 * - buildBaseFilters helper
 */

import { searchSpaceTool, buildBaseFilters } from './search-space.js';
import { SUPPORTED_SPACES } from '../types/space-memory.js';

// ---------------------------------------------------------------------------
// searchSpaceTool definition
// ---------------------------------------------------------------------------

describe('searchSpaceTool definition', () => {
  it('has correct tool name', () => {
    expect(searchSpaceTool.name).toBe('remember_search_space');
  });

  it('has a non-empty description', () => {
    expect((searchSpaceTool.description ?? '').length).toBeGreaterThan(0);
  });

  it('requires only query', () => {
    expect(searchSpaceTool.inputSchema.required).toEqual(['query']);
  });

  it('has query property', () => {
    const props = searchSpaceTool.inputSchema.properties as Record<string, any>;
    expect(props.query).toBeDefined();
    expect(props.query.type).toBe('string');
  });

  it('has optional spaces property', () => {
    const props = searchSpaceTool.inputSchema.properties as Record<string, any>;
    expect(props.spaces).toBeDefined();
    expect(props.spaces.type).toBe('array');
    // spaces is NOT in required array
    expect(searchSpaceTool.inputSchema.required).not.toContain('spaces');
  });

  it('has optional groups property', () => {
    const props = searchSpaceTool.inputSchema.properties as Record<string, any>;
    expect(props.groups).toBeDefined();
    expect(props.groups.type).toBe('array');
    expect(searchSpaceTool.inputSchema.required).not.toContain('groups');
  });

  it('has search_type property with correct enum values', () => {
    const props = searchSpaceTool.inputSchema.properties as Record<string, any>;
    expect(props.search_type).toBeDefined();
    expect(props.search_type.enum).toEqual(['hybrid', 'bm25', 'semantic']);
    expect(props.search_type.default).toBe('hybrid');
  });

  it('spaces items enum matches SUPPORTED_SPACES', () => {
    const props = searchSpaceTool.inputSchema.properties as Record<string, any>;
    expect(props.spaces.items.enum).toEqual(SUPPORTED_SPACES);
  });

  it('has include_comments property defaulting to false', () => {
    const props = searchSpaceTool.inputSchema.properties as Record<string, any>;
    expect(props.include_comments).toBeDefined();
    expect(props.include_comments.default).toBe(false);
  });

  it('has limit and offset properties', () => {
    const props = searchSpaceTool.inputSchema.properties as Record<string, any>;
    expect(props.limit).toBeDefined();
    expect(props.limit.default).toBe(10);
    expect(props.offset).toBeDefined();
    expect(props.offset.default).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildBaseFilters helper
// ---------------------------------------------------------------------------

/**
 * Creates a minimal mock Weaviate collection for testing buildBaseFilters.
 * Returns a mock that records filter calls.
 */
function makeMockCollection() {
  const calls: { property: string; method: string; value: unknown }[] = [];

  const makePropertyFilter = (property: string) => ({
    isNull: (val: boolean) => { calls.push({ property, method: 'isNull', value: val }); return {}; },
    equal: (val: unknown) => { calls.push({ property, method: 'equal', value: val }); return {}; },
    notEqual: (val: unknown) => { calls.push({ property, method: 'notEqual', value: val }); return {}; },
    greaterOrEqual: (val: unknown) => { calls.push({ property, method: 'greaterOrEqual', value: val }); return {}; },
    lessOrEqual: (val: unknown) => { calls.push({ property, method: 'lessOrEqual', value: val }); return {}; },
    containsAny: (val: unknown) => { calls.push({ property, method: 'containsAny', value: val }); return {}; },
  });

  const collection = {
    filter: {
      byProperty: (property: string) => makePropertyFilter(property),
    },
    _calls: calls,
  };

  return collection;
}

describe('buildBaseFilters', () => {
  it('always adds deleted_at isNull(true) filter', () => {
    const col = makeMockCollection();
    buildBaseFilters(col, { query: 'test' });
    const deletedFilter = col._calls.find(c => c.property === 'deleted_at' && c.method === 'isNull');
    expect(deletedFilter).toBeDefined();
    expect(deletedFilter?.value).toBe(true);
  });

  it('always adds doc_type equal memory filter', () => {
    const col = makeMockCollection();
    buildBaseFilters(col, { query: 'test' });
    const docTypeFilter = col._calls.find(c => c.property === 'doc_type' && c.method === 'equal');
    expect(docTypeFilter).toBeDefined();
    expect(docTypeFilter?.value).toBe('memory');
  });

  it('excludes comments by default (no content_type, no include_comments)', () => {
    const col = makeMockCollection();
    buildBaseFilters(col, { query: 'test' });
    const commentFilter = col._calls.find(c => c.property === 'type' && c.method === 'notEqual');
    expect(commentFilter).toBeDefined();
    expect(commentFilter?.value).toBe('comment');
  });

  it('does not exclude comments when include_comments is true', () => {
    const col = makeMockCollection();
    buildBaseFilters(col, { query: 'test', include_comments: true });
    const commentFilter = col._calls.find(c => c.property === 'type' && c.method === 'notEqual');
    expect(commentFilter).toBeUndefined();
  });

  it('does not add comment exclusion when content_type is set', () => {
    const col = makeMockCollection();
    buildBaseFilters(col, { query: 'test', content_type: 'note' });
    const commentFilter = col._calls.find(c => c.property === 'type' && c.method === 'notEqual');
    expect(commentFilter).toBeUndefined();
  });

  it('adds content_type filter when specified', () => {
    const col = makeMockCollection();
    buildBaseFilters(col, { query: 'test', content_type: 'note' });
    const typeFilter = col._calls.find(c => c.property === 'type' && c.method === 'equal');
    expect(typeFilter).toBeDefined();
    expect(typeFilter?.value).toBe('note');
  });

  it('adds containsAny filter for each tag', () => {
    const col = makeMockCollection();
    buildBaseFilters(col, { query: 'test', tags: ['cooking', 'recipes'] });
    const tagFilters = col._calls.filter(c => c.property === 'tags' && c.method === 'containsAny');
    expect(tagFilters).toHaveLength(2);
  });

  it('adds min_weight filter when specified', () => {
    const col = makeMockCollection();
    buildBaseFilters(col, { query: 'test', min_weight: 0.5 });
    const weightFilter = col._calls.find(c => c.property === 'weight' && c.method === 'greaterOrEqual');
    expect(weightFilter).toBeDefined();
    expect(weightFilter?.value).toBe(0.5);
  });

  it('adds max_weight filter when specified', () => {
    const col = makeMockCollection();
    buildBaseFilters(col, { query: 'test', max_weight: 0.8 });
    const weightFilter = col._calls.find(c => c.property === 'weight' && c.method === 'lessOrEqual');
    expect(weightFilter).toBeDefined();
    expect(weightFilter?.value).toBe(0.8);
  });

  it('adds date_from filter when specified', () => {
    const col = makeMockCollection();
    buildBaseFilters(col, { query: 'test', date_from: '2025-01-01T00:00:00Z' });
    const dateFilter = col._calls.find(c => c.property === 'created_at' && c.method === 'greaterOrEqual');
    expect(dateFilter).toBeDefined();
  });

  it('adds date_to filter when specified', () => {
    const col = makeMockCollection();
    buildBaseFilters(col, { query: 'test', date_to: '2025-12-31T23:59:59Z' });
    const dateFilter = col._calls.find(c => c.property === 'created_at' && c.method === 'lessOrEqual');
    expect(dateFilter).toBeDefined();
  });

  it('returns no weight/date/tag filters when args omit them', () => {
    const col = makeMockCollection();
    buildBaseFilters(col, { query: 'test' });
    const weightFilters = col._calls.filter(c => c.property === 'weight');
    expect(weightFilters).toHaveLength(0);
    const dateFilters = col._calls.filter(c => c.property === 'created_at');
    expect(dateFilters).toHaveLength(0);
    const tagFilters = col._calls.filter(c => c.property === 'tags');
    expect(tagFilters).toHaveLength(0);
  });
});
