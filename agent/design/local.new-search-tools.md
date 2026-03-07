# New Search Modes & Ghost Memory Tools

**Concept**: New search modes (search_by, search_broadly, search_random) and dedicated ghost memory tool suite
**Created**: 2026-03-07
**Status**: Proposal

---

## Overview

This design introduces two groups of new MCP tools for remember-mcp:

1. **`remember_search_by`** — A unified search tool exposing multiple search modes (time, density, rating, discovery, random, broad) through a single interface
2. **Ghost memory tools** — A dedicated tool suite for creating and searching ghost memories with hardcoded tags and filters

Additionally, this design addresses gaps where remember-core capabilities are not yet exposed as MCP tools (rating, new search filters).

---

## Problem Statement

- **Search modes**: remember-core already supports `byTime`, `byDensity`, `byRating`, `byDiscovery`, and slice variants, but none are exposed as MCP tools. Users can only use `remember_search_memory` (hybrid) and `remember_find_similar` (vector).
- **Broad search**: No way to fetch large result sets without overloading LLM context. Users need a "scan and drill-in" workflow.
- **Random sampling**: No serendipity mechanism — users can't discover forgotten memories randomly.
- **Ghost memories**: Creating ghost memories requires knowing the correct content_type and tags. A dedicated tool suite would eliminate errors and simplify the ghost workflow.
- **Rating**: remember-core has a full `RatingService` (1-5 stars, Bayesian averaging) but remember-mcp doesn't expose it. Rating is social (for published space memories), not personal (personal importance = `weight`).
- **Missing filters**: `rating_min`, `relationship_count_min/max` filters exist in core but aren't in MCP tool schemas.

---

## Solution

### Tool 1: `remember_search_by`

A single MCP tool with a `mode` parameter that dispatches to the appropriate core service method.

#### Modes

| Mode | Core Method | Description | Status in Core |
|------|-------------|-------------|----------------|
| `byTime` | `MemoryService.byTime()` | Chronological sort (asc/desc) | Exists |
| `byDensity` | `MemoryService.byDensity()` | Sort by relationship count | Exists |
| `byRating` | `MemoryService.byRating()` | Sort by Bayesian rating average | Exists |
| `byDiscovery` | `MemoryService.byDiscovery()` | Interleaved rated (4:1) + unrated | Exists |
| `byRandom` | TBD | Random sampling from collection | **Needs core implementation** |
| `byBroad` | TBD | Massive results with truncated content | **Needs core implementation** |
| `byRecommendation` | TBD | Personalized recommendations | **Needs core implementation** |

#### Parameters

```typescript
{
  name: 'remember_search_by',
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['byTime', 'byDensity', 'byRating', 'byDiscovery', 'byRandom', 'byBroad'],
        description: 'Search mode to use'
      },
      query: {
        type: 'string',
        description: 'Optional search query (used within mode for filtering)'
      },
      // Mode-specific parameters
      sort_order: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort order (byTime, byDensity, byRating). Default: desc'
      },
      // Common parameters
      limit: { type: 'number', description: 'Max results. Default: 10' },
      offset: { type: 'number', description: 'Pagination offset' },
      filters: {
        type: 'object',
        description: 'Standard search filters (types, tags, weight, trust, date, rating_min, etc.)'
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

#### `byBroad` Mode — Truncated Content Response

When `mode: 'byBroad'`, the tool fetches a large number of results but returns truncated content to avoid context overload:

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
}
```

- Default limit: 50-100 (much higher than normal modes)
- Enables "scan and drill-in" workflow: browse broad results, then use `remember_search_memory` or `remember_query_memory` to get full content of interesting items
- **Needs new core method**: `MemoryService.byBroad()` or a `format: 'broad'` option on existing search

#### `byRandom` Mode — Random Sampling

- Fetches random memories from the user's collection
- Optional `query` parameter to constrain the random pool (e.g., random memories tagged "idea")
- **Needs new core method**: Could use Weaviate's `near_random` or a client-side shuffle approach
- Useful for serendipitous rediscovery of forgotten content

---

### Rating — Space-Only (Social Ratings)

Rating is a **social** feature for published memories in spaces, not for personal memories. Personal importance is already covered by the `weight` parameter (0-1).

Rating should be exposed on space tools (e.g., a future action on `remember_search_space` results or a dedicated space interaction), not on `remember_update_memory`. The `RatingService.rate()` in remember-core manages Bayesian averaging (`rating_count`, `rating_sum`, `rating_bayesian`) for published content.

Ghost tools do not need rating — ghosts are read-only accessors.

`byRating` and `byDiscovery` modes on `remember_search_by` work against personal memories using whatever ratings exist (initially empty). These modes are more immediately useful on a future `remember_search_space_by` where social ratings are populated.

---

### Tool 2-7: Ghost Memory Tools

Dedicated tools for ghost memory operations with hardcoded content_type and tags.

#### `remember_create_ghost_memory`

```typescript
{
  name: 'remember_create_ghost_memory',
  description: 'Create a ghost memory (cross-user interaction record)',
  inputSchema: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'Ghost memory content' },
      title: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      weight: { type: 'number' },
      trust: { type: 'number' }
    },
    required: ['content']
  }
}
```

Handler hardcodes:
- `content_type: 'ghost'`
- Adds ghost-specific tags (e.g., `ghost`, `ghost:{accessor_user_id}`)

#### `remember_update_ghost_memory`

Same as `remember_update_memory` but validates the memory has `content_type: 'ghost'` before allowing updates.

#### `remember_search_ghost_memory`

Wraps `remember_search_memory` with:
- `filters.types: ['ghost']` hardcoded
- Ghost-specific default tags applied

#### `remember_query_ghost_memory`

Wraps `remember_query_memory` with:
- `filters.types: ['ghost']` hardcoded

#### `remember_search_ghost_memory_by`

Wraps `remember_search_by` with:
- `filters.types: ['ghost']` hardcoded
- All modes available (byTime, byDiscovery, byBroad, etc.)

---

### Schema Updates for Existing Tools

Update existing tool schemas to expose new core filters:

| Filter | Core Support | Add To |
|--------|-------------|--------|
| `rating_min` | Yes | search_memory, find_similar, query_memory, search_space |
| `relationship_count_min` | Yes | search_memory, find_similar |
| `relationship_count_max` | Yes | search_memory, find_similar |
| `exclude_types` | Yes | search_memory, search_space |

---

## Implementation

### Phase 1: Expose Existing Core Capabilities
1. Add `remember_search_by` tool with modes `byTime`, `byDensity`, `byRating`, `byDiscovery`
2. Update existing tool schemas with `rating_min`, `relationship_count_min/max`, `exclude_types`

### Phase 2: New Core Modes
4. Implement `byBroad` in remember-core (truncated content response)
5. Implement `byRandom` in remember-core (random sampling)
6. Add `byBroad` and `byRandom` modes to `remember_search_by`

### Phase 3: Ghost Tools
7. Implement ghost memory tool suite (create, update, search, query, search_by)
8. Wire hardcoded ghost content_type and tags

### Phase 4: Space Variants
9. Add `remember_search_space_by` (wraps `SpaceService.byDiscovery()` and future space modes)
10. Add `byRecommendation` mode (future — needs recommendation algorithm in core)

---

## Benefits

- **Unified interface**: Single `search_by` tool replaces what would be 6+ separate tools
- **Context-efficient**: `byBroad` enables scanning large collections without context overload
- **Serendipity**: `byRandom` helps users rediscover forgotten memories
- **Ghost safety**: Dedicated ghost tools prevent content_type/tag errors
- **Rating exposure**: Unlocks the existing rating system for end users
- **Filter parity**: MCP tools match core filter capabilities

---

## Trade-offs

- **`search_by` complexity**: One tool with many modes vs. many simple tools. Mitigated by clear mode documentation and mode-specific parameter validation.
- **Ghost tool duplication**: 5 ghost tools duplicate logic from existing tools with filters hardcoded. Mitigated by thin wrapper pattern — each ghost handler delegates to the corresponding non-ghost handler with preset filters.
- **`byBroad` response shape**: Different from other modes (truncated content). Mitigated by clear documentation and the `mode` parameter signaling different output.
- **`byRandom` implementation**: Weaviate doesn't natively support random sampling. May need client-side shuffle or offset-based random. Performance implications for large collections.

---

## Dependencies

- **remember-core** (existing): `MemoryService.byTime/byDensity/byRating/byDiscovery`, `RatingService.rate()`, `SpaceService.byDiscovery()`
- **remember-core** (new): `byBroad` method, `byRandom` method
- **Weaviate**: May need exploration for random sampling support

---

## Testing Strategy

- **Unit tests**: Each mode of `search_by` tested independently
- **Ghost tools**: Verify content_type and tags are correctly hardcoded
- **`byBroad`**: Verify content truncation (head/mid/tail slicing)
- **`byRandom`**: Verify randomness distribution and filter support
- **Rating**: Verify rating submission and Bayesian score updates
- **Schema updates**: Verify new filters work in existing tools

---

## Future Considerations

- `byRecommendation` mode — personalized suggestions based on user history and ratings
- `byTimeSlice` / `byDensitySlice` — expose slice-based search from core (already exists as utility functions)
- `remember_search_space_by` — space-specific search modes
- Ghost memory analytics — aggregate ghost interaction patterns

---

**Status**: Proposal
**Recommendation**: Implement Phase 1 first (expose existing core capabilities), then Phase 2-3
**Related Documents**:
- [complete-tool-set.md](complete-tool-set.md) — Current 21-tool inventory
- [local.ghost-persona-system.md](local.ghost-persona-system.md) — Ghost system design
- [agent/drafts/new-tools.md](../drafts/new-tools.md) — Original draft
