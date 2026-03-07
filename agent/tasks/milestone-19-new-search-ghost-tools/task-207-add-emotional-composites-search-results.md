# Task 207: Add Emotional Composites + REM Metadata to Search Results

**Milestone**: M19 — New Search Modes, Ghost Tools & Emotional Exposure
**Status**: Not Started
**Created**: 2026-03-07
**Estimated Hours**: 2-3
**Dependencies**: remember-core schema with composite scores and REM metadata

---

## Objective

Include emotional composite scores (`total_significance`, `feel_significance`, `functional_significance`) and REM metadata (`rem_touched_at`, `rem_visits`) in search result objects across all search tools.

## Context

When REM has scored memories, the composite significance scores and REM visit metadata are stored in Weaviate. These should be included in search results so the LLM and downstream tools have emotional context. Not all memories will have been scored — unscored fields must be omitted (not returned as null).

## Fields to Include

```typescript
// Added to search result memory objects (when non-null):
{
  // ... existing fields (memory_id, title, content, content_type, tags, weight, trust, created_at, etc.) ...

  // Composite scores (computed by REM, 0-1 floats)
  total_significance?: number;       // Combined emotional + functional significance
  feel_significance?: number;        // Weighted sum of Layer 1 (21 discrete emotions)
  functional_significance?: number;  // Weighted sum of Layer 2 (10 functional signals)

  // REM metadata
  rem_touched_at?: string;           // ISO timestamp of last REM scoring update
  rem_visits?: number;               // Number of REM scoring visits
}
```

## Tools to Update

| Tool File | Function | Notes |
|-----------|----------|-------|
| `src/tools/search-memory.ts` | Result serialization | Add composites to each memory result |
| `src/tools/find-similar.ts` | Result serialization | Add composites to each memory result |
| `src/tools/query-memory.ts` | Result serialization | Add composites to each memory result |
| `src/tools/search-space.ts` | Result serialization | Add composites to published memory results |
| `src/tools/search-by.ts` | Result serialization | Add composites (all modes) |

## Implementation Pattern

For each tool, find the result serialization code (where memory objects are mapped to response JSON) and add:

```typescript
// After existing field mappings:
...(memory.total_significance != null && { total_significance: memory.total_significance }),
...(memory.feel_significance != null && { feel_significance: memory.feel_significance }),
...(memory.functional_significance != null && { functional_significance: memory.functional_significance }),
...(memory.rem_touched_at != null && { rem_touched_at: memory.rem_touched_at }),
...(memory.rem_visits != null && { rem_visits: memory.rem_visits }),
```

## Key Decisions

- **Null/undefined values MUST be omitted**: Not all memories have been scored by REM. Never return `null` or `undefined` in the response — only include these fields when they have values.
- **Use conditional spread**: The `...(value != null && { key: value })` pattern ensures clean omission.
- **All search tools get composites**: Consistency across all search surfaces. If a memory has been scored, the scores are always visible.
- **No individual feel_* fields in results**: Only the 3 composites + 2 REM metadata fields. Individual feel_* values are accessible via `byProperty` sorting or future detail tools.

## Steps

1. Identify result serialization pattern in each of the 5 tool files
2. Add composite score and REM metadata fields using conditional spread
3. Update result type definitions if the project has explicit result interfaces
4. Write tests:
   - Composites appear in results when memory has been scored
   - Composites are omitted when memory has NOT been scored (null/undefined)
   - REM metadata (rem_touched_at, rem_visits) included when available
   - All 5 tools include composites consistently

## Verification

- [ ] Composite scores included in search_memory results
- [ ] Composite scores included in find_similar results
- [ ] Composite scores included in query_memory results
- [ ] Composite scores included in search_space results
- [ ] Composite scores included in search_by results
- [ ] REM metadata (rem_touched_at, rem_visits) included when available
- [ ] Null/unscored fields omitted from results (no nulls in output)
- [ ] Tests passing
- [ ] TypeScript clean
