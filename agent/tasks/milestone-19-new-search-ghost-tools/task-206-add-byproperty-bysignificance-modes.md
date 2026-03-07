# Task 206: Add byProperty and bySignificance Modes to search_by

**Milestone**: M19 — New Search Modes, Ghost Tools & Emotional Exposure
**Status**: Not Started
**Created**: 2026-03-07
**Estimated Hours**: 2-3
**Dependencies**: Task 203 (search_by tool exists), remember-core schema with `feel_*` properties and `byProperty()` method

---

## Objective

Add `byProperty` and `bySignificance` modes to the `remember_search_by` tool, enabling sorting by any Weaviate property (especially emotional dimensions and composite significance scores).

## Context

remember-core's emotional weighting design includes a generic `byProperty` sort mode that sorts by any Weaviate property name. `bySignificance` is a shorthand for `byProperty` on `total_significance`. This enables powerful emotional exploration — "show me my most traumatic memories", "find my funniest content", "what has the highest retrieval utility?"

## Schema Changes

Update `src/tools/search-by.ts`:

1. Add to mode enum: `'byProperty', 'bySignificance'`
2. Add `sort_field` parameter:
```typescript
sort_field: {
  type: 'string',
  description: 'Property to sort by (byProperty mode only). Any Weaviate property name, e.g. "feel_trauma", "feel_salience", "weight", "total_significance", "feel_coherence_tension"'
}
```
3. Update tool description to include:
```
- byProperty: Sort by any memory property (e.g., feel_trauma, weight, feel_salience)
- bySignificance: Sort by total_significance (combined emotional + functional score from REM)
```

## Handler Logic

```typescript
case 'byProperty':
  if (!args.sort_field) {
    return { content: [{ type: 'text', text: 'sort_field is required for byProperty mode' }], isError: true };
  }
  results = await services.memoryService.byProperty({
    sort_field: args.sort_field,
    sort_order: args.sort_order,
    query: args.query,
    limit: args.limit,
    offset: args.offset,
    filters: args.filters,
    deleted_filter: args.deleted_filter
  });
  break;

case 'bySignificance':
  // Shorthand for byProperty on total_significance
  results = await services.memoryService.byProperty({
    sort_field: 'total_significance',
    sort_order: args.sort_order ?? 'desc',
    query: args.query,
    limit: args.limit,
    offset: args.offset,
    filters: args.filters,
    deleted_filter: args.deleted_filter
  });
  break;
```

## Usage Examples (for tool description)

```typescript
// Most emotionally significant memories
{ mode: 'byProperty', sort_field: 'total_significance', sort_order: 'desc' }

// Highest coherence tension (conflicting beliefs needing reconciliation)
{ mode: 'byProperty', sort_field: 'feel_coherence_tension', sort_order: 'desc' }

// Most novel memories
{ mode: 'byProperty', sort_field: 'feel_novelty', sort_order: 'desc' }

// Most traumatic memories
{ mode: 'byProperty', sort_field: 'feel_trauma', sort_order: 'desc' }

// Most humorous memories
{ mode: 'byProperty', sort_field: 'feel_humor', sort_order: 'desc' }

// Highest retrieval utility (most likely to be useful in future queries)
{ mode: 'byProperty', sort_field: 'feel_retrieval_utility', sort_order: 'desc' }

// Least visited by REM (candidates for scoring attention)
{ mode: 'byProperty', sort_field: 'rem_visits', sort_order: 'asc' }

// Equivalent calls:
{ mode: 'bySignificance', sort_order: 'desc' }
{ mode: 'byProperty', sort_field: 'total_significance', sort_order: 'desc' }
```

## Three Composite Scores (sortable via byProperty)

| Property | Inputs | Purpose |
|----------|--------|---------|
| `feel_significance` | Weighted sum of Layer 1 (21 discrete emotions) | Emotional intensity composite |
| `functional_significance` | Weighted sum of Layer 2 (10 functional signals) | Functional importance composite |
| `total_significance` | Both layers combined | Overall significance for sorting |

## Key Decisions

- **bySignificance defaults to desc**: Most significant first is the natural use case.
- **byProperty accepts ANY Weaviate property**: Not limited to feel_* fields. Can sort by `weight`, `trust`, `created_at`, `rem_visits`, etc.
- **No property validation in MCP layer**: Let core validate the property name. MCP is a thin adapter.
- **sort_field required for byProperty only**: Other modes don't use it. Return error if omitted for byProperty.

## Steps

1. Update `src/tools/search-by.ts`:
   - Add `byProperty` and `bySignificance` to mode enum
   - Add `sort_field` parameter to inputSchema
   - Add handler cases per logic above
   - Update tool description with examples
2. Write tests:
   - `byProperty` with various `sort_field` values (feel_trauma, feel_humor, weight, etc.)
   - `byProperty` without `sort_field` returns error
   - `bySignificance` dispatches to byProperty with `total_significance`
   - `bySignificance` defaults sort_order to desc
   - Sort order works with both modes

## Verification

- [ ] `byProperty` mode sorts by any specified property
- [ ] `byProperty` requires `sort_field` parameter (error if missing)
- [ ] `bySignificance` is shorthand for `total_significance` sort
- [ ] `bySignificance` defaults to desc sort order
- [ ] Tool description includes examples of emotional dimension sorting
- [ ] Tests passing
- [ ] TypeScript clean
