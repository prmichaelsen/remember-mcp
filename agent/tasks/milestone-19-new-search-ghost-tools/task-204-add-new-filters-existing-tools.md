# Task 204: Add New Filters to Existing Tool Schemas

**Milestone**: M19 — New Search Modes, Ghost Tools & Emotional Exposure
**Status**: Not Started
**Created**: 2026-03-07
**Estimated Hours**: 2-3
**Dependencies**: None (filters already exist in remember-core)

---

## Objective

Update existing MCP tool input schemas to expose filters that already exist in remember-core but aren't in the MCP tool definitions.

## Context

remember-core's `SearchFilters` interface has `rating_min`, `relationship_count_min`, `relationship_count_max`, and `exclude_types` — none are exposed in the current MCP tool schemas. These filters need to be added to the appropriate tools.

## Filter-to-Tool Mapping

| Filter | Type | Description | Add To |
|--------|------|-------------|--------|
| `rating_min` | number | Minimum Bayesian rating average | search_memory, find_similar, query_memory, search_space |
| `relationship_count_min` | number | Minimum relationship count | search_memory, find_similar |
| `relationship_count_max` | number | Maximum relationship count | search_memory, find_similar |
| `exclude_types` | string[] | Exclude specific content types | search_memory, search_space |

## Steps

### 1. Update `src/tools/search-memory.ts`
Add to inputSchema.properties (inside filters object or at top level, matching existing pattern):
```typescript
rating_min: { type: 'number', description: 'Minimum Bayesian rating average' },
relationship_count_min: { type: 'number', description: 'Minimum relationship count' },
relationship_count_max: { type: 'number', description: 'Maximum relationship count' },
exclude_types: { type: 'array', items: { type: 'string' }, description: 'Exclude specific content types' }
```
Pass new filters through to core `memoryService.search()` call.

### 2. Update `src/tools/find-similar.ts`
Add:
```typescript
rating_min: { type: 'number' },
relationship_count_min: { type: 'number' },
relationship_count_max: { type: 'number' }
```

### 3. Update `src/tools/query-memory.ts`
Add:
```typescript
rating_min: { type: 'number' }
```

### 4. Update `src/tools/search-space.ts`
Add:
```typescript
rating_min: { type: 'number' },
exclude_types: { type: 'array', items: { type: 'string' } }
```

### 5. Update unit tests for each modified tool to verify new filters are passed through to core service calls

## Key Decisions

- **rating_min uses Bayesian average**: The `rating_bayesian` field in core, not raw sum. This provides fairer comparison for items with different rating counts.
- **relationship_count filters are for personal search only**: Not applicable to space search (relationships are per-user, not per-space).
- **exclude_types complements existing types filter**: `types` is an include list, `exclude_types` is an exclude list. If both provided, `exclude_types` takes precedence (core behavior).

## Verification

- [ ] `rating_min` available on search_memory, find_similar, query_memory, search_space
- [ ] `relationship_count_min/max` available on search_memory, find_similar
- [ ] `exclude_types` available on search_memory, search_space
- [ ] All new filters pass through to core service calls correctly
- [ ] Existing tests still pass (no regressions)
- [ ] New filter tests added for each tool
- [ ] TypeScript clean
