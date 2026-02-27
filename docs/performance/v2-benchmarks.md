# Memory Collection Pattern v2 — Performance Benchmarks

## Overview

This document defines performance targets and tracks benchmark results for
Memory Collection Pattern v2 operations.

## Running Benchmarks

```bash
# Pure performance tests (no Weaviate required)
npm test -- --testPathPattern=test-data-generator

# E2E performance tests (requires live Weaviate)
WEAVIATE_URL=http://localhost:8080 npm run test:e2e -- --testPathPattern=v2-performance
```

## Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Single-space query (1K memories) | < 200ms | hybrid search |
| Multi-space query (1K memories) | < 200ms | containsAny filter |
| All-public query (1K memories) | < 200ms | no space_ids filter |
| Group query (1K memories) | < 200ms | per-group collection |
| Create memory | < 100ms | personal collection |
| Update memory | < 100ms | replace operation |
| Publish (single space) | < 100ms | insert to spaces_public |
| Publish (multi-space/group) | < 200ms | parallel inserts |
| Retract | < 100ms | delete + tracking update |
| Revise published | < 200ms | update all copies |
| Deduplication (1K results) | < 10ms | Set-based UUID dedup |

## Optimizations Applied

| Optimization | Impact | Commit |
|-------------|--------|--------|
| Set-based dedup in `addMultipleSpaceIds`/`addMultipleGroupIds` | O(n*m) → O(n+m) for bulk tracking array updates | v3.7.0 |
| `indexNullState: true` on all collections | Enables efficient `deleted_at isNull` filter | v3.0.0 |
| `space_ids.containsAny()` filter | Weaviate inverted index on text[] field | v3.5.0 |
| Fetch limit pre-pagination | Single query per source, paginate in memory | v3.5.0 |

## Benchmark Results

> Results pending live Weaviate benchmarking session.
> Run the E2E suite and record results here.

### Query Performance

| Scenario | Dataset | p50 | p95 | Target | Status |
|----------|---------|-----|-----|--------|--------|
| Single-space search | 1K | — | — | 200ms | Pending |
| Multi-space search | 1K | — | — | 200ms | Pending |
| All-public search | 1K | — | — | 200ms | Pending |
| Group search | 1K | — | — | 200ms | Pending |

### Write Performance

| Operation | p50 | p95 | Target | Status |
|-----------|-----|-----|--------|--------|
| Create memory | — | — | 100ms | Pending |
| Update memory | — | — | 100ms | Pending |
| Publish (single) | — | — | 100ms | Pending |
| Publish (multi) | — | — | 200ms | Pending |
| Retract | — | — | 100ms | Pending |
| Revise | — | — | 200ms | Pending |

### Deduplication Performance (pure, no Weaviate)

| Dataset | Elapsed | Target | Status |
|---------|---------|--------|--------|
| 1K objects (with 200 dupes) | < 1ms | 10ms | ✅ Passing |
| 10K objects (50% dupes) | < 5ms | 50ms | ✅ Passing |

## Notes

- All query benchmarks use `search_type: "hybrid"` (default)
- p95 is the primary SLO metric (not p50/avg)
- Network latency to Weaviate (~1–5ms local) is included in measurements
- Benchmarks should be rerun after schema changes or Weaviate upgrades
