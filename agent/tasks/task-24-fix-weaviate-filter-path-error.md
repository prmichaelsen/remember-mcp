# Task 24: Fix Weaviate Filter Path Error

**Milestone**: M8 - Testing & Quality
**Estimated Time**: 4 hours
**Dependencies**: None
**Status**: Completed
**Priority**: Critical
**Completed**: 2026-02-15

---

## Objective

Fix the recurring Weaviate gRPC error: "paths needs to have a uneven number of components: property, class, property, ...., got []". This error indicates empty filter paths being sent to Weaviate, breaking search functionality.

## Problem Statement

Production logs show critical error:
```
Query call with protocol gRPC failed with message: 
/weaviate.v1.Weaviate/Search UNKNOWN: 
paths needs to have a uneven number of components: property, class, property, ...., got []
```

**Tool Affected**: `remember_search_relationship`  
**Impact**: Relationship searches fail completely  
**Status**: This error was supposedly fixed in v1.0.2, but still occurring

## Root Cause Analysis

The error occurs when Weaviate receives a filter with an empty path array. This suggests:
1. Filter construction is creating invalid filter objects
2. The v1.0.2 fix didn't cover all edge cases
3. `search-relationship.ts` may use different filter logic than `search-memory.ts`

## Steps

1. **Review Current Filter Implementation**
   - Examine [`src/utils/weaviate-filters.ts`](../../src/utils/weaviate-filters.ts)
   - Check `buildRelationshipOnlyFilters()` function
   - Compare with `buildMemoryOnlyFilters()` and `buildCombinedSearchFilters()`
   - Verify all filter builders handle empty/null cases

2. **Analyze search-relationship.ts**
   - Review [`src/tools/search-relationship.ts`](../../src/tools/search-relationship.ts)
   - Check how filters are constructed
   - Verify it uses the v3 filter API correctly
   - Compare with working `search-memory.ts` implementation

3. **Reproduce the Error**
   - Create unit test that triggers the error
   - Test with empty filters
   - Test with null filter values
   - Test with relationship-only searches

4. **Implement Fix**
   - Update `search-relationship.ts` to use v3 filter builders
   - Add validation to prevent empty filter paths
   - Ensure `buildRelationshipOnlyFilters()` returns valid filters or null
   - Add defensive checks before sending to Weaviate

5. **Update Filter Builders**
   - Review all filter construction in `weaviate-filters.ts`
   - Add validation to reject invalid filter configurations
   - Ensure consistent behavior across all filter types
   - Add JSDoc comments explaining filter structure

6. **Add Comprehensive Tests**
   - Unit test for empty filter handling
   - Unit test for relationship-only filters
   - Unit test for null/undefined filter values
   - Integration test with real Weaviate instance
   - Test all filter combinations

7. **Deploy and Monitor**
   - Deploy fix to production
   - Monitor logs for 48 hours
   - Verify error no longer occurs
   - Test relationship searches manually

## Verification

- [ ] No "paths needs to have a uneven number of components" errors in logs
- [ ] Relationship searches work correctly
- [ ] Empty filters handled gracefully
- [ ] All filter builders validated
- [ ] Unit tests cover all edge cases
- [ ] Integration tests pass with real Weaviate
- [ ] Production monitoring shows zero occurrences

## Files to Modify

- `src/tools/search-relationship.ts` - Update filter construction
- `src/utils/weaviate-filters.ts` - Add validation and fix builders
- `src/utils/weaviate-filters.spec.ts` - Add edge case tests
- `src/tools/search-relationship.spec.ts` - Add tests (create if needed)

## Technical Details

### Current Filter Structure (v3 API)
```typescript
{
  operator: 'Equal',
  target: {
    property: 'doc_type'  // Must not be empty!
  },
  value: 'relationship'
}
```

### Invalid Filter (Causes Error)
```typescript
{
  operator: 'Equal',
  target: {
    property: ''  // Empty path causes gRPC error
  },
  value: 'relationship'
}
```

## Expected Outcome

- Zero Weaviate filter path errors in production
- Relationship searches work reliably
- Clear error messages for invalid filter configurations
- Comprehensive test coverage preventing regression

---

**Next Task**: Task 25 - Fix Update Memory Errors  
**Related**: Task 20 (previous Weaviate v3 filter fix)
