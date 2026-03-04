# Milestone 18: Performance Tuning

**Status**: Not Started
**Priority**: Medium
**Estimated Weeks**: 1
**Dependencies**: None

---

## Objective

Optimize remember-mcp server performance by eliminating redundant database calls, adding caching for rarely-changing data, parallelizing independent operations, and reducing per-request overhead.

---

## Success Criteria

- [ ] Ghost mode requests do not make redundant Firestore queries for friend status
- [ ] Core services are cached per-user instead of recreated on every tool call
- [ ] Server startup parallelizes independent health checks
- [ ] No functional regressions — all existing tests pass
- [ ] Measurable latency improvement for ghost mode access checks

---

## Tasks

| # | Task | Status | Est. Hours |
|---|------|--------|------------|
| 77 | Parallelize checkIfFriend Firestore queries | Not Started | 0.5 |
| 78 | Add TTL cache to checkIfFriend | Not Started | 1 |
| 79 | Memoize createCoreServices per userId | Not Started | 1 |
| 80 | Parallelize startup health checks | Not Started | 0.5 |
| 81 | Optimize ghost-config block/unblock with FieldValue | Not Started | 1 |
| 82 | Use native Weaviate offset in search-memory | Not Started | 0.5 |
| 83 | Eliminate redundant validateToken in confirm flow | Not Started | 1 |
| 84 | Convert dynamic imports to static in server-factory | Not Started | 0.5 |

---

## Notes

- Task 63 in remember-core covers Weaviate collection pooling (separate project)
- Credential provider stub async overhead (#9 from audit) and esbuild parallelization (#10) are too trivial to warrant tasks
- All changes are internal — no API changes for consumers
