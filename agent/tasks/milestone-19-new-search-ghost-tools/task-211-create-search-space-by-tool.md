# Task 211: Create `remember_search_space_by` Tool

**Milestone**: M19 — New Search Modes, Ghost Tools & Emotional Exposure
**Status**: Not Started
**Created**: 2026-03-07
**Estimated Hours**: 3-4
**Dependencies**: Task 203 (search_by pattern established), remember-core SpaceService sort methods

---

## Objective

Create `remember_search_space_by` MCP tool — the space/group variant of `remember_search_by`. Wraps `SpaceService.byDiscovery()` and future space sort modes.

## Context

`SpaceService` in remember-core already has `byDiscovery()` for spaces. This tool follows the same pattern as `remember_search_by` but operates on published memories in spaces and groups. Rating is particularly relevant here — rating is a **social** feature for published space memories (personal importance = `weight`, social importance = `rating`).

## Tool Definition

```typescript
{
  name: 'remember_search_space_by',
  description: `Search shared spaces using specialized modes. Similar to remember_search_by
  but operates on published memories in spaces and groups.

  Modes:
  - byTime: Chronological sort of published memories
  - byRating: Sort by Bayesian rating average (social ratings)
  - byDiscovery: Interleaved rated + unrated for exploration
  - byProperty: Sort by any property (e.g., feel_trauma, total_significance)
  - byBroad: Massive results with truncated content
  - byRandom: Random sampling from space

  At least one of 'spaces' or 'groups' must be provided.`,
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['byTime', 'byRating', 'byDiscovery', 'byProperty', 'byBroad', 'byRandom'],
        description: 'Search mode'
      },
      spaces: {
        type: 'array',
        items: { type: 'string' },
        description: 'Space names to search'
      },
      groups: {
        type: 'array',
        items: { type: 'string' },
        description: 'Group IDs to search'
      },
      query: { type: 'string', description: 'Optional search query' },
      sort_order: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort order. Default: desc'
      },
      sort_field: {
        type: 'string',
        description: 'Property to sort by (byProperty mode only)'
      },
      limit: { type: 'number', description: 'Max results. Default: 10 (byBroad: 50)' },
      offset: { type: 'number', description: 'Pagination offset' },
      moderation_filter: {
        type: 'string',
        description: 'Moderation filter level'
      },
      include_comments: {
        type: 'boolean',
        description: 'Include comments on published memories. Default: false'
      }
    },
    required: ['mode']
  }
}
```

## Handler Logic

```typescript
async function handleSearchSpaceBy(userId: string, args: SearchSpaceByArgs): Promise<ToolResult> {
  // Validate at least one of spaces or groups is provided
  if (!args.spaces?.length && !args.groups?.length) {
    return {
      content: [{ type: 'text', text: 'At least one of "spaces" or "groups" must be provided' }],
      isError: true
    };
  }

  const services = await createCoreServices(userId);
  const spaceParams = {
    spaces: args.spaces,
    groups: args.groups,
    query: args.query,
    sort_order: args.sort_order,
    sort_field: args.sort_field,
    limit: args.limit,
    offset: args.offset,
    moderation_filter: args.moderation_filter,
    include_comments: args.include_comments
  };

  let results;
  switch (args.mode) {
    case 'byTime':
      results = await services.spaceService.byTime(spaceParams);
      break;
    case 'byRating':
      results = await services.spaceService.byRating(spaceParams);
      break;
    case 'byDiscovery':
      results = await services.spaceService.byDiscovery(spaceParams);
      break;
    case 'byProperty':
      if (!args.sort_field) {
        return { content: [{ type: 'text', text: 'sort_field is required for byProperty mode' }], isError: true };
      }
      results = await services.spaceService.byProperty(spaceParams);
      break;
    case 'byBroad':
      results = await services.spaceService.byBroad({ ...spaceParams, limit: args.limit ?? 50 });
      break;
    case 'byRandom':
      results = await services.spaceService.byRandom(spaceParams);
      break;
    default:
      return { content: [{ type: 'text', text: `Unknown mode: ${args.mode}` }], isError: true };
  }

  // Apply moderation filter if provided
  // Include comments if requested
  // Include emotional composites when available

  return { content: [{ type: 'text', text: JSON.stringify(results) }] };
}
```

## Key Decisions

- **No byDensity mode**: Density (relationship count) is per-user, not meaningful in space context. Omitted from space variant.
- **byRating is primary here**: Rating is a social feature — this is where it's most useful. Bayesian averaging provides fair ranking across items with different rating counts.
- **byDiscovery interleaves**: 4:1 ratio of rated to unrated, same as personal search_by.
- **byProperty works on space memories**: Sort by emotional dimensions, significance scores, etc. on published content.
- **Validation**: At least one of `spaces` or `groups` must be provided. Error if both are empty/omitted.
- **moderation_filter**: Space content goes through moderation. This filter controls what moderation levels are included.
- **include_comments**: Space memories can have comments. Default false to reduce response size.
- **Emotional composites in results**: When available, include `total_significance`, `feel_significance`, `functional_significance` (same as Task 207).
- **byBroad default limit 50**: Same as personal search_by byBroad.

## Steps

1. Create `src/tools/search-space-by.ts` with tool definition and handler per above
2. Register in `src/server-factory.ts`
3. Write unit tests:
   - Each mode dispatches correctly
   - Validation: error when neither spaces nor groups provided
   - Spaces parameter works
   - Groups parameter works
   - Both spaces and groups together works
   - byProperty requires sort_field
   - Moderation filter passed through
   - include_comments parameter passed through
   - Emotional composites included in results when available
   - byBroad default limit is 50

## Verification

- [ ] Tool definition exports `searchSpaceByTool` and `handleSearchSpaceBy`
- [ ] All modes dispatch correctly (byTime, byRating, byDiscovery, byProperty, byBroad, byRandom)
- [ ] Validation: error when neither spaces nor groups provided
- [ ] Spaces and groups parameters work independently and together
- [ ] byProperty requires sort_field (error if missing)
- [ ] Moderation filter applied
- [ ] include_comments parameter works
- [ ] Emotional composites in results when available
- [ ] byBroad default limit is 50
- [ ] Registered in server-factory.ts
- [ ] Unit tests passing
- [ ] TypeScript clean
- [ ] Build passing
