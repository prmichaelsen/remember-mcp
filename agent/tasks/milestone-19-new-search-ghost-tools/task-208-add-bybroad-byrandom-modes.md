# Task 208: Add byBroad and byRandom Modes to search_by

**Milestone**: M19 — New Search Modes, Ghost Tools & Emotional Exposure
**Status**: Not Started
**Created**: 2026-03-07
**Estimated Hours**: 3-4
**Dependencies**: Task 203 (search_by tool exists), remember-core byBroad and byRandom implementations

---

## Objective

Add `byBroad` and `byRandom` modes to `remember_search_by`. These require new core methods that don't exist yet — this task is blocked until remember-core implements them.

## Context

- **byBroad**: Fetches massive result sets with truncated content (head/mid/tail slices ~100 chars each). Default limit 50-100. Enables "scan and drill-in" workflow — browse broad results, then use `remember_search_memory` or `remember_query_memory` to get full content of interesting items. Includes emotional composites in truncated results.
- **byRandom**: Random sampling from the collection. Optional query to constrain the random pool. Useful for serendipitous rediscovery of forgotten content.

## Schema Changes

Update `src/tools/search-by.ts`:

1. Add to mode enum: `'byBroad', 'byRandom'`
2. Update tool description:
```
- byBroad: Massive results with truncated content for scan-and-drill-in workflow (default limit: 50)
- byRandom: Random sampling for serendipitous rediscovery
```

## `byBroad` Response Shape

byBroad returns a DIFFERENT response shape than other modes — truncated content instead of full content:

```typescript
interface BroadSearchResult {
  memory_id: string;
  title?: string;
  content_type: string;
  content_head: string;   // First ~100 chars
  content_mid: string;    // ~100 chars from middle
  content_tail: string;   // Last ~100 chars
  created_at: string;
  tags: string[];
  weight: number;
  // Include emotional composites for context
  total_significance?: number;
  feel_significance?: number;
  functional_significance?: number;
}
```

## Handler Logic

```typescript
case 'byBroad':
  results = await services.memoryService.byBroad({
    query: args.query,
    limit: args.limit ?? 50,  // Default limit is 50, much higher than normal
    offset: args.offset,
    filters: args.filters,
    deleted_filter: args.deleted_filter
  });
  // Results already have truncated content (content_head/mid/tail) from core
  break;

case 'byRandom':
  results = await services.memoryService.byRandom({
    query: args.query,  // Optional: constrains the random pool
    limit: args.limit,
    filters: args.filters,
    deleted_filter: args.deleted_filter
  });
  // sort_order is not applicable for byRandom
  break;
```

## Key Decisions

- **byBroad default limit is 50**: Much higher than normal modes (10). The truncated content format makes this feasible without context overload.
- **byBroad response shape differs**: `content_head`, `content_mid`, `content_tail` replace the full `content` field. The handler may need to serialize differently.
- **byBroad includes composites**: `total_significance`, `feel_significance`, `functional_significance` in truncated results for emotional context during scanning.
- **byRandom query is optional**: When provided, constrains the random pool (e.g., "only random memories tagged 'idea'"). When omitted, samples from entire collection.
- **byRandom ignores sort_order**: Random is random — sort_order is not applicable.
- **Both modes support standard filters**: types, tags, weight, trust, date, etc. all work with byBroad and byRandom.
- **Blocked on core implementation**: Core needs `MemoryService.byBroad()` and `MemoryService.byRandom()`. byRandom could use Weaviate's `near_random` or a client-side shuffle approach.

## Steps

1. Update `src/tools/search-by.ts`:
   - Add `byBroad` and `byRandom` to mode enum
   - Add handler cases per logic above
   - Handle byBroad's different response serialization (content_head/mid/tail)
   - Update tool description with byBroad and byRandom documentation
2. Write tests:
   - `byBroad` returns truncated content format (content_head/mid/tail, NOT full content)
   - `byBroad` default limit is 50
   - `byBroad` includes emotional composites
   - `byRandom` returns results
   - `byRandom` with query constrains pool
   - `byRandom` ignores sort_order
   - Both modes support standard filters and deleted_filter

## Verification

- [ ] `byBroad` returns truncated content (content_head/mid/tail)
- [ ] `byBroad` does NOT return full content field
- [ ] `byBroad` default limit is 50
- [ ] `byBroad` includes emotional composites in results
- [ ] `byRandom` returns random results
- [ ] `byRandom` query parameter constrains pool
- [ ] `byRandom` ignores sort_order
- [ ] Both modes support standard filters
- [ ] Tests passing
- [ ] TypeScript clean
