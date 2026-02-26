# Milestone 14: Memory Collection Pattern v2

**Goal**: Implement new remember-mcp memory collections using dot notation and composite IDs
**Duration**: 2-3 weeks
**Dependencies**: None (fresh implementation)
**Status**: Not Started

---

## Overview

This milestone implements Memory Collection Pattern v2 for remember-mcp, introducing a three-tier collection structure with dot notation (Memory.users, Memory.spaces, Memory.groups) and composite IDs for published memories. This redesign enables multi-user social features including user profiles, friend systems, P2P conversations, and group conversations.

**Key Innovations**:
- **Dot Notation Collections**: Memory.users.{userId}, Memory.spaces.public, Memory.groups.{groupId}
- **Composite IDs**: {userId}.{memoryId} format preserves source reference
- **Tracking Arrays**: space_ids and group_ids track publication locations
- **Dual Publication**: Memories can exist in both spaces and groups
- **Revision Support**: remember_revise updates published memories in-place
- **Orphaned Memories**: Retracted memories remain for historical reference

---

## Deliverables

### Core Infrastructure
- [ ] Weaviate schema updates with dot notation collections
- [ ] Composite ID generation utilities
- [ ] Collection name mapping and validation
- [ ] space_ids and group_ids array management

### Tool Updates
- [ ] remember_publish (multi-space/group support)
- [ ] remember_retract (selective retraction)
- [ ] remember_revise (sync all published copies)
- [ ] remember_search_space (query by space_ids)
- [ ] remember_create_memory (add tracking arrays)
- [ ] remember_update_memory (maintain tracking)

### Testing Suite
- [ ] Unit tests (composite IDs, tracking arrays)
- [ ] Integration tests (publish, retract, revise)
- [ ] Performance tests (query optimization)

### Documentation
- [ ] API documentation for updated tools
- [ ] Architecture documentation
- [ ] Example usage patterns

---

## Success Criteria

- [ ] All three collection types (users, spaces, groups) working correctly
- [ ] Composite IDs generated and validated properly
- [ ] space_ids and group_ids arrays track publications accurately
- [ ] remember_publish creates/updates memories in multiple locations
- [ ] remember_retract removes from specific spaces/groups
- [ ] remember_revise syncs content across all published copies
- [ ] All unit tests passing (>95% coverage)
- [ ] All integration tests passing
- [ ] Performance benchmarks meet targets (<200ms queries)
- [ ] Documentation complete and accurate

---

## Key Files to Create

- `src/collections/dot-notation.ts` - Collection name utilities
- `src/collections/composite-ids.ts` - Composite ID generation
- `src/collections/tracking-arrays.ts` - space_ids/group_ids management
- `src/schema/v2-collections.ts` - Weaviate schema definitions
- `src/tools/remember-publish.ts` - Publish tool (update)
- `src/tools/remember-retract.ts` - Retract tool (update)
- `src/tools/remember-revise.ts` - Revise tool (new)
- `src/tools/remember-search-space.ts` - Search tool (update)
- `src/tools/remember-create-memory.ts` - Create tool (update)
- `src/tools/remember-update-memory.ts` - Update tool (update)
- `tests/unit/core-infrastructure.test.ts` - Unit tests
- `tests/integration/publish-retract-revise.test.ts` - Integration tests
- `docs/api/memory-collection-v2.md` - API documentation
- `docs/architecture/memory-collection-v2.md` - Architecture guide

---

## Technical Approach

### Phase 1: Core Infrastructure (Week 1)
1. Implement dot notation collection utilities
2. Implement composite ID generation and validation
3. Implement tracking array management (space_ids, group_ids)
4. Create Weaviate schema definitions for all three collection types
5. Write unit tests for core utilities

### Phase 2: Tool Updates (Week 2)
1. Update remember_publish for multi-space/group support
2. Update remember_retract for selective retraction
3. Implement remember_revise for content synchronization
4. Update remember_search_space for space_ids filtering
5. Update remember_create_memory and remember_update_memory
6. Write integration tests for all tools

### Phase 3: Testing & Documentation (Week 3)
1. Complete unit test suite (>95% coverage)
2. Complete integration test suite
3. Performance testing and optimization
4. Write API documentation
5. Write architecture documentation
6. Create example usage patterns

---

## Dependencies

**External**:
- Weaviate v3 (vector database)
- TypeScript MCP SDK

**Internal**:
- Milestone 1-13 (completed)

---

## Risks & Mitigations

### Risk 1: Performance Degradation
**Impact**: Medium - Single Memory.spaces.public collection could be slow
**Mitigation**:
- Benchmark query performance early
- Optimize Weaviate indexes
- Consider sharding if needed
- Monitor query times in testing

### Risk 2: Storage Duplication
**Impact**: Low - Dual publication means 2x storage
**Mitigation**:
- Accept storage cost for query performance
- Monitor storage usage
- Consider cleanup job for orphaned memories (future)

### Risk 3: Data Model Complexity
**Impact**: Medium - Complex three-tier structure could be confusing
**Mitigation**:
- Clear documentation with examples
- Comprehensive test coverage
- Simple, intuitive tool APIs
- Good error messages

---

## Timeline

**Week 1**: Core Infrastructure
- Days 1-2: Dot notation and composite IDs
- Days 3-4: Tracking arrays and schema
- Day 5: Unit tests

**Week 2**: Tool Updates
- Days 1-2: remember_publish and remember_retract
- Day 3: remember_revise
- Day 4: remember_search_space updates
- Day 5: Integration tests

**Week 3**: Testing & Documentation
- Days 1-2: Complete test suite
- Day 3: Performance testing
- Days 4-5: Documentation

---

## Next Milestone

**Milestone 15**: Integration with agentbase.me-e1
- Service layer for Memory Collection v2
- MCP client updates
- UI components for memory browsing

---

**Status**: In Progress (37% - 3/8 tasks completed)
**Blockers**: None
**Notes**: Foundation for all social features. Tasks 165, 166, 167 complete (pending commit). Next: Task 168 (remember_revise).
