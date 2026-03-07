# Task 203: Create `remember_search_by` Tool

**Milestone**: M19 — New Search Modes, Ghost Tools & Emotional Exposure
**Status**: Not Started
**Created**: 2026-03-07
**Estimated Hours**: 3-4
**Dependencies**: remember-core MemoryService.byTime/byDensity/byRating/byDiscovery methods

---

## Objective

Create the `remember_search_by` MCP tool with initial modes: byTime, byDensity, byRating, byDiscovery. This is the foundation tool that later tasks extend with additional modes (byProperty, bySignificance, byBroad, byRandom).

## Context

remember-core already has `MemoryService.byTime()`, `byDensity()`, `byRating()`, `byDiscovery()`. This task creates the MCP tool definition and a thin handler that dispatches by mode.

## Complete Tool Definition

```typescript
{
  name: 'remember_search_by',
  description: `Search memories using specialized modes beyond hybrid search.

  Modes:
  - byTime: Chronological sort (newest/oldest first)
  - byDensity: Sort by relationship count (most connected memories)
  - byRating: Sort by Bayesian rating average (social ratings from spaces)
  - byDiscovery: Interleaved rated + unrated content for exploration (4:1 ratio)

  Use remember_search_memory for hybrid semantic+keyword search.
  Use remember_find_similar for vector similarity.
  Use this tool for structured browsing, sorting, and discovery.`,
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['byTime', 'byDensity', 'byRating', 'byDiscovery'],
        description: 'Search mode to use'
      },
      query: {
        type: 'string',
        description: 'Optional search query (used within mode for filtering)'
      },
      sort_order: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort order (byTime, byDensity, byRating). Default: desc'
      },
      limit: { type: 'number', description: 'Max results. Default: 10' },
      offset: { type: 'number', description: 'Pagination offset' },
      filters: {
        type: 'object',
        description: 'Standard search filters',
        properties: {
          types: { type: 'array', items: { type: 'string' }, description: 'Include specific content types' },
          exclude_types: { type: 'array', items: { type: 'string' }, description: 'Exclude specific content types' },
          tags: { type: 'array', items: { type: 'string' } },
          weight_min: { type: 'number' },
          weight_max: { type: 'number' },
          trust_min: { type: 'number' },
          trust_max: { type: 'number' },
          date_from: { type: 'string', description: 'ISO 8601' },
          date_to: { type: 'string', description: 'ISO 8601' },
          rating_min: { type: 'number', description: 'Minimum Bayesian rating' },
          relationship_count_min: { type: 'number' },
          relationship_count_max: { type: 'number' },
          has_relationships: { type: 'boolean' }
        }
      },
      deleted_filter: {
        type: 'string',
        enum: ['exclude', 'include', 'only'],
        description: 'Default: exclude'
      }
    },
    required: ['mode']
  }
}
```

## Handler Logic

```typescript
async function handleSearchBy(userId: string, args: SearchByArgs): Promise<ToolResult> {
  const services = await createCoreServices(userId);
  const { mode, query, sort_order, limit, offset, filters, deleted_filter } = args;

  let results;
  switch (mode) {
    case 'byTime':
      results = await services.memoryService.byTime({ query, sort_order, limit, offset, filters, deleted_filter });
      break;
    case 'byDensity':
      results = await services.memoryService.byDensity({ query, sort_order, limit, offset, filters, deleted_filter });
      break;
    case 'byRating':
      results = await services.memoryService.byRating({ query, sort_order, limit, offset, filters, deleted_filter });
      break;
    case 'byDiscovery':
      // byDiscovery interleaves rated (4) + unrated (1) results
      results = await services.memoryService.byDiscovery({ query, limit, offset, filters, deleted_filter });
      break;
    default:
      return { content: [{ type: 'text', text: `Unknown mode: ${mode}` }], isError: true };
  }

  return { content: [{ type: 'text', text: JSON.stringify(results) }] };
}
```

## Key Decisions

- **Mode enum is extensible**: Later tasks (206, 208) add byProperty, bySignificance, byBroad, byRandom to the enum. Design the switch statement to be easily extendable.
- **Filters object matches core's SearchFilters**: Pass through directly — don't transform. The MCP schema mirrors core's interface.
- **byDiscovery interleaves**: 4:1 ratio of rated to unrated content. sort_order is not applicable for byDiscovery.
- **byRating uses Bayesian averaging**: `rating_bayesian` field, not raw `rating_sum`. Social rating from spaces.
- **Default limit**: 10 for all initial modes. byBroad (added later) defaults to 50.

## Steps

1. Create `src/tools/search-by.ts` with tool definition and handler per above
2. Register in `src/server-factory.ts` (imports, ListTools, CallTool switch)
3. Write unit tests in `src/tools/search-by.spec.ts`:
   - Each mode dispatches to correct core method
   - Invalid mode returns error
   - Filters pass through to core
   - sort_order parameter passed correctly
   - Default limit/offset behavior
   - byDiscovery ignores sort_order

## Verification

- [ ] Tool definition exports `searchByTool` and `handleSearchBy`
- [ ] Modes byTime, byDensity, byRating, byDiscovery all dispatch correctly
- [ ] Full filter object passed through (types, exclude_types, tags, weight, trust, date, rating, relationship count)
- [ ] sort_order works for byTime, byDensity, byRating
- [ ] Tool registered in server-factory.ts
- [ ] Unit tests passing
- [ ] TypeScript clean
- [ ] Build passing
