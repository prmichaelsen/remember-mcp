# Milestone 11: Unified Public Collection

**Goal**: Implement unified `Memory_public` collection with multi-space support
**Duration**: 1-2 weeks
**Dependencies**: M10 (Shared Spaces & Confirmation Flow)
**Status**: Not Started

---

## Overview

Replace per-space collections (`Memory_the_void`, `Memory_dogs`, etc.) with a unified `Memory_public` collection where memories can belong to multiple spaces simultaneously. This enables multi-space search, eliminates duplication, and provides a more flexible and scalable architecture.

This milestone introduces:
- **Unified Collection**: Single `Memory_public` for all public spaces
- **Multi-Space Support**: `spaces: string[]` array instead of single `space_id`
- **Multi-Space Search**: Query multiple spaces in one call
- **No Duplication**: One memory, multiple spaces
- **Efficient Storage**: N× reduction in documents

---

## Deliverables

### 1. Type System Updates
- Update `SpaceMemory` interface: `space_id: string` → `spaces: string[]`
- Update type exports and constants
- Backward compatibility considerations

### 2. Schema Updates
- Add `spaces` array field to Weaviate schema
- Create `Memory_public` collection
- Update space schema utilities
- Collection name constants

### 3. Tool Updates (5 tools)
- Update `remember_publish` - Support `spaces` array parameter
- Update `remember_confirm` - Handle multi-space publishing
- Update `remember_search_space` - Multi-space search with `containsAny`
- Update `remember_query_space` - Multi-space RAG queries
- Update `remember_deny` - No changes needed

### 4. Migration Strategy
- Backward compatibility during transition
- Data migration plan (if needed)
- Deprecation timeline

### 5. Testing & Documentation
- Update unit tests for all affected tools
- Add multi-space test scenarios
- Update README with multi-space examples
- Update API documentation

---

## Success Criteria

- [ ] `SpaceMemory` type uses `spaces: string[]`
- [ ] `Memory_public` collection created successfully
- [ ] `remember_publish` accepts `spaces` array
- [ ] Can publish to multiple spaces in one call
- [ ] `remember_search_space` accepts `spaces` array
- [ ] Multi-space search returns results from all requested spaces
- [ ] No memory duplication across spaces
- [ ] All 5 space tools work with new architecture
- [ ] TypeScript compiles without errors
- [ ] All tests passing (including new multi-space tests)
- [ ] Build successful
- [ ] README updated with multi-space examples
- [ ] Backward compatibility maintained (if applicable)

---

## Key Files to Modify

```
src/
├── types/
│   └── space-memory.ts              # Update SpaceMemory interface
├── weaviate/
│   └── space-schema.ts              # Update schema, add Memory_public
└── tools/
    ├── publish.ts                   # Support spaces array
    ├── confirm.ts                   # Handle multi-space publish
    ├── search-space.ts              # Multi-space search
    └── query-space.ts               # Multi-space query

tests/
└── unit/
    ├── space-schema.test.ts         # Add multi-space tests
    ├── publish.test.ts              # Add multi-space tests
    ├── search-space.test.ts         # Add multi-space tests
    └── query-space.test.ts          # Add multi-space tests
```

---

## Implementation Tasks

See individual task documents:
- Task 46: Update SpaceMemory Types for Multi-Space
- Task 47: Update Space Schema with Spaces Array
- Task 48: Create Memory_public Collection
- Task 49: Update remember_publish for Multi-Space
- Task 50: Update remember_confirm for Multi-Space
- Task 51: Update remember_search_space for Multi-Space
- Task 52: Update remember_query_space for Multi-Space
- Task 53: Add Multi-Space Unit Tests
- Task 54: Update Documentation for Multi-Space

---

## Architecture Notes

### Before (Per-Space Collections)
```
Memory_the_void     → Only "The Void" memories
Memory_dogs         → Only "Dogs" memories
Memory_cats         → Only "Cats" memories
```

**Problems**:
- Can't search multiple spaces at once
- Memory duplication if published to multiple spaces
- Collection proliferation

### After (Unified Collection)
```
Memory_public       → ALL public memories
  - spaces: ["the_void"]
  - spaces: ["dogs", "cats"]
  - spaces: ["the_void", "dogs"]
```

**Benefits**:
- ✅ Multi-space search in one query
- ✅ No duplication
- ✅ Efficient storage
- ✅ Flexible space management

### Multi-Space Search Example
```typescript
remember_search_space({
  spaces: ["the_void", "dogs"],  // ✅ Multiple spaces!
  query: "cute dog pictures"
})

// Weaviate filter:
collection.filter.byProperty('spaces').containsAny(['the_void', 'dogs'])
```

---

## Migration Strategy

### Phase 1: Add Support (v2.4.0 - Backward Compatible)
- Add `spaces` field to schema (keep `space_id` temporarily)
- Support both `space` and `spaces` parameters
- Create `Memory_public` collection
- Dual-write to both old and new collections

### Phase 2: Migrate Data (v2.5.0)
- Copy existing memories from per-space to unified
- Verify data integrity
- Mark old collections as deprecated

### Phase 3: Remove Old (v3.0.0 - Breaking Change)
- Remove `space_id` field
- Remove per-space collections
- Remove backward compatibility code
- Update all documentation

---

## Testing Strategy

1. **Unit Tests**: Each tool with multi-space scenarios
2. **Integration Tests**: Full publish → search workflow
3. **Migration Tests**: Data migration validation
4. **Performance Tests**: Compare single vs. multi-space queries

---

## Breaking Changes

**v3.0.0 (Future)**:
- Remove `space_id` field from SpaceMemory
- Remove per-space collections
- Remove `space` parameter (use `spaces` only)

**Migration Guide**:
```typescript
// Before (v2.3.x)
remember_publish({ memory_id: "abc", target: "the_void" })
remember_search_space({ space: "the_void", query: "..." })

// After (v3.0.0)
remember_publish({ memory_id: "abc", spaces: ["the_void"] })
remember_search_space({ spaces: ["the_void"], query: "..." })
```

---

**Next Milestone**: M12 - Comment System (3 schema fields only!)
**Blockers**: None (builds on M10)
