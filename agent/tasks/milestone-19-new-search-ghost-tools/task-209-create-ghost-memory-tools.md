# Task 209: Create Ghost Memory Tool Suite (5 Tools)

**Milestone**: M19 — New Search Modes, Ghost Tools & Emotional Exposure
**Status**: Not Started
**Created**: 2026-03-07
**Estimated Hours**: 4-6
**Dependencies**: Task 203 (search_by tool exists for ghost_search_by wrapper)

---

## Objective

Create 5 dedicated ghost memory MCP tools that hardcode `content_type: 'ghost'` and ghost-specific tags. Each tool is a thin wrapper around the corresponding non-ghost tool.

## Context

Ghost memories track cross-user interaction records. Currently, creating ghost memories requires manually setting the correct content_type and tags. Dedicated tools eliminate this error-prone process. Ghost memories are excluded from default searches — they are only visible when explicitly searching with content_type: 'ghost' or using ghost memory tools.

## Tool 1: `remember_create_ghost_memory` (`src/tools/create-ghost-memory.ts`)

```typescript
{
  name: 'remember_create_ghost_memory',
  description: `Create a ghost memory (cross-user interaction record).

  Ghost memories track what happened during ghost conversations — observations,
  impressions, and insights about the accessor. Automatically sets content_type
  to 'ghost' and adds ghost-specific tags.

  Ghost memories are excluded from default searches. They are only visible when
  explicitly searching with content_type: 'ghost' or using ghost memory tools.`,
  inputSchema: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'Ghost memory content' },
      title: { type: 'string', description: 'Optional title' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Additional tags (ghost-specific tags added automatically)' },
      weight: { type: 'number', minimum: 0, maximum: 1, description: 'Significance (0-1)' },
      trust: { type: 'number', minimum: 0, maximum: 1, description: 'Trust level (0-1)' },
      // Select feel_* fields relevant to ghost interactions
      feel_salience: { type: 'number', minimum: 0, maximum: 1 },
      feel_social_weight: { type: 'number', minimum: 0, maximum: 1 },
      feel_narrative_importance: { type: 'number', minimum: 0, maximum: 1 }
    },
    required: ['content']
  }
}
```

**Handler hardcodes**:
- `content_type: 'ghost'`
- Adds tags: `ghost`, `ghost:{accessor_user_id}` (accessor_user_id from auth context)
- Merges hardcoded tags with any user-provided tags
- Calls `handleCreateMemory` (or core `memoryService.create()`) with merged args

## Tool 2: `remember_update_ghost_memory` (`src/tools/update-ghost-memory.ts`)

```typescript
{
  name: 'remember_update_ghost_memory',
  description: 'Update a ghost memory. Only works on memories with content_type: ghost.',
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: { type: 'string', description: 'Ghost memory ID to update' },
      content: { type: 'string' },
      title: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      weight: { type: 'number', minimum: 0, maximum: 1 },
      trust: { type: 'number', minimum: 0, maximum: 1 }
    },
    required: ['memory_id']
  }
}
```

**Handler logic**:
1. Fetch the memory by ID first
2. Validate `content_type === 'ghost'` — reject with clear error if not ghost
3. Delegate to `handleUpdateMemory` / core `memoryService.update()`

## Tool 3: `remember_search_ghost_memory` (`src/tools/search-ghost-memory.ts`)

```typescript
{
  name: 'remember_search_ghost_memory',
  description: `Search ghost memories using hybrid semantic + keyword search.
  Automatically filters to content_type: ghost. Use this to find specific
  ghost interaction records.`,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      alpha: { type: 'number', minimum: 0, maximum: 1, description: 'Semantic vs keyword balance. Default: 0.7' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
      limit: { type: 'number', description: 'Max results. Default: 10' },
      offset: { type: 'number' },
      deleted_filter: { type: 'string', enum: ['exclude', 'include', 'only'] }
    },
    required: ['query']
  }
}
```

**Handler hardcodes**: `filters.types: ['ghost']` before calling `handleSearchMemory` / core search.

## Tool 4: `remember_query_ghost_memory` (`src/tools/query-ghost-memory.ts`)

```typescript
{
  name: 'remember_query_ghost_memory',
  description: `Query ghost memories using natural language (pure semantic search).
  Automatically filters to content_type: ghost.`,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural language question' },
      limit: { type: 'number', description: 'Max results. Default: 5' },
      min_relevance: { type: 'number', description: 'Minimum relevance score. Default: 0.6' }
    },
    required: ['query']
  }
}
```

**Handler hardcodes**: `filters.types: ['ghost']` before calling `handleQueryMemory` / core query.

## Tool 5: `remember_search_ghost_memory_by` (`src/tools/search-ghost-memory-by.ts`)

```typescript
{
  name: 'remember_search_ghost_memory_by',
  description: `Search ghost memories using specialized modes (byTime, byDensity,
  byProperty, byBroad, etc.). Automatically filters to content_type: ghost.`,
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['byTime', 'byDensity', 'byRating', 'byDiscovery', 'byProperty', 'bySignificance', 'byRandom', 'byBroad'],
        description: 'Search mode'
      },
      query: { type: 'string', description: 'Optional search query' },
      sort_order: { type: 'string', enum: ['asc', 'desc'] },
      sort_field: { type: 'string', description: 'Property to sort by (byProperty mode)' },
      limit: { type: 'number' },
      offset: { type: 'number' },
      deleted_filter: { type: 'string', enum: ['exclude', 'include', 'only'] }
    },
    required: ['mode']
  }
}
```

**Handler hardcodes**: `filters.types: ['ghost']` before calling `handleSearchBy`.

## Key Decisions

- **Ghost tools don't need rating**: Ghosts are read-only accessors. No rating parameters on ghost tools.
- **Only 3 feel_* fields on create_ghost_memory**: `feel_salience`, `feel_social_weight`, `feel_narrative_importance` — the most relevant for ghost interaction records. NOT all 31.
- **update_ghost_memory validates content_type**: Must fetch memory first, check `content_type === 'ghost'`, reject if not. This prevents using the ghost update tool on non-ghost memories.
- **All search/query ghost tools hardcode `filters.types: ['ghost']`**: This is the core behavioral difference from the non-ghost versions. User-provided filters are merged, not replaced.
- **search_ghost_memory_by has ALL modes**: Even byRating and byDiscovery, though these are less useful for ghost memories. Consistency over restriction.
- **Tags merging on create**: User-provided tags are merged with hardcoded `['ghost', 'ghost:{accessor_user_id}']`. If user already includes 'ghost' tag, don't duplicate.

## Steps

1. Create 5 tool files in `src/tools/`
2. Each file exports tool definition + handler function
3. Register all 5 tools in `src/server-factory.ts` (imports, ListTools, CallTool switch cases)
4. Write unit tests for each tool:
   - create: content_type hardcoded to 'ghost', ghost tags added automatically, user tags merged
   - update: validates content_type before update, rejects non-ghost memories with error
   - search: filters.types hardcoded to ['ghost'], query/alpha/tags passthrough
   - query: filters.types hardcoded to ['ghost'], query/limit/min_relevance passthrough
   - search_by: filters.types hardcoded to ['ghost'], all modes work, sort_field passthrough

## Verification

- [ ] 5 tool files created in src/tools/
- [ ] All 5 tools registered in server-factory.ts
- [ ] create_ghost_memory hardcodes content_type: 'ghost'
- [ ] create_ghost_memory adds 'ghost' and 'ghost:{accessor_user_id}' tags
- [ ] create_ghost_memory merges user tags without duplicating 'ghost'
- [ ] update_ghost_memory fetches memory and validates content_type before update
- [ ] update_ghost_memory rejects non-ghost memories with clear error message
- [ ] search_ghost_memory hardcodes filters.types: ['ghost']
- [ ] query_ghost_memory hardcodes filters.types: ['ghost']
- [ ] search_ghost_memory_by hardcodes filters.types: ['ghost'], all modes work
- [ ] Unit tests for all 5 tools
- [ ] TypeScript clean
- [ ] Build passing
