# Task 524: Health and Drift Tools

**Milestone**: [M22 — Admin Debugging Tools](../../milestones/milestone-22-admin-debugging-tools.md)
**Design Reference**: [local.admin-debugging-tools.md](../../design/local.admin-debugging-tools.md)
**Status**: Not Started
**Estimated Time**: 2-3 hours
**Dependencies**: [Task 520](task-520-admin-gate-infrastructure.md)

---

## Objective

Implement two admin tools: `remember_admin_health` (deep connectivity check) and `remember_admin_detect_weaviate_drift` (expected vs actual schema comparison).

## Context

`health` is a simple connectivity check — can we reach Weaviate and Firestore? `detect_weaviate_drift` is a more detailed diagnostic that compares the expected schema (as defined in code) against the actual schema in Weaviate, identifying missing properties, type mismatches, and unexpected fields.

## Steps

### 1. Implement `remember_admin_health`

Create `src/tools/admin-health.ts`:

**Input**:
```typescript
{} // No parameters — checks all services
```

**Output**:
```typescript
{
  weaviate: { status: 'ok' | 'error', message?: string, latency_ms?: number },
  firestore: { status: 'ok' | 'error', message?: string, latency_ms?: number },
  overall: 'healthy' | 'degraded' | 'unhealthy'
}
```

**Implementation**:
- Weaviate: attempt a simple meta query (e.g., `client.getMeta()`) and measure latency
- Firestore: attempt a simple read (e.g., read a known document or list collection) and measure latency
- Overall: `healthy` if both ok, `degraded` if one fails, `unhealthy` if both fail
- Guard with `isAdmin(userId)` check
- No schema drift detection (that's the separate tool)
- No per-user memory counts

### 2. Implement `remember_admin_detect_weaviate_drift`

Create `src/tools/admin-detect-weaviate-drift.ts`:

**Input**:
```typescript
{
  collection_ids?: string[]; // Optional — check specific collections, or sample if omitted
}
```

**Output**: Per-collection comparison:
```typescript
{
  collection: string;
  status: 'match' | 'drift' | 'error';
  expected_properties: string[];   // Properties defined in code
  actual_properties: string[];     // Properties in Weaviate
  missing_properties: string[];    // In code but not in Weaviate
  extra_properties: string[];      // In Weaviate but not in code
  type_mismatches: Array<{ property: string, expected: string, actual: string }>;
}
```

**Implementation**:
- Get expected schema from remember-core schema definitions (the property lists defined in code)
- Get actual schema from Weaviate collection inspection
- Compare property names, types, and index settings
- Report differences per collection
- If no `collection_ids` provided, check a sample of collections (e.g., first user collection, spaces_public)
- Guard with `isAdmin(userId)` check

### 3. Add Unit Tests

Create spec files:
- `src/tools/admin-health.spec.ts`
- `src/tools/admin-detect-weaviate-drift.spec.ts`

Test cases for `health`:
- Both services reachable → overall: healthy
- Weaviate down, Firestore up → overall: degraded
- Both down → overall: unhealthy
- Non-admin → permission error
- Latency included in response

Test cases for `detect_weaviate_drift`:
- Schema matches expected → status: match, empty diff arrays
- Missing property → reported in missing_properties
- Extra property → reported in extra_properties
- Type mismatch → reported in type_mismatches
- Specific collection_ids → only checks those
- No collection_ids → checks sample
- Non-admin → permission error

### 4. Update CHANGELOG and README

- Add M22 admin tools to CHANGELOG.md
- Update README.md tool count and add admin tools section
- Version bump (patch or minor as appropriate)

---

## Verification

- [ ] `health` checks Weaviate and Firestore connectivity with latency
- [ ] `health` returns correct overall status (healthy/degraded/unhealthy)
- [ ] `detect_weaviate_drift` compares expected vs actual schema properties
- [ ] `detect_weaviate_drift` reports missing, extra, and type-mismatched properties
- [ ] `detect_weaviate_drift` accepts optional collection_ids filter
- [ ] Both tools reject non-admin users
- [ ] Both tools registered conditionally (hidden from non-admins)
- [ ] Unit tests pass for both tools
- [ ] CHANGELOG updated with M22 admin tools
- [ ] README updated with new tool count and admin section
