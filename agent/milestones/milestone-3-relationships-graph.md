# Milestone 3: Relationships & Graph

**Goal**: Implement memory relationships stored in Memory collection  
**Duration**: 1 week  
**Dependencies**: M2 (Core Memory System)  
**Status**: Not Started

---

## Overview

Implement relationship system that connects memories together. Relationships are stored in the same Memory_{user_id} collection with doc_type: "relationship" for unified RAG queries.

---

## Deliverables

### 1. Relationship Schema
- Relationship interface with free-form types
- Store in Memory_{user_id} with doc_type: "relationship"
- Support N-way relationships (2...N memories)
- Context with summary

### 2. Relationship Tools (4 tools)
- remember_create_relationship
- remember_update_relationship
- remember_search_relationship
- remember_delete_relationship

### 3. Bidirectional Tracking
- Update connected memories' relationships arrays
- Maintain consistency on create/delete
- Handle orphaned relationships

### 4. Unified Queries
- Search memories and relationships together
- Filter by doc_type when needed
- RAG queries include relationship context

---

## Success Criteria

- [ ] Can create relationships between 2...N memories
- [ ] Relationship types are free-form strings (agent decides)
- [ ] Can search relationships by observation text
- [ ] Relationships and memories queryable together (single query)
- [ ] RAG includes relationship context
- [ ] Bidirectional updates work correctly
- [ ] Deleting memory handles relationships appropriately

---

## Key Files to Create

```
src/
├── types/
│   └── relationship.ts     # Relationship interface
├── tools/
│   ├── create-relationship.ts
│   ├── update-relationship.ts
│   ├── search-relationship.ts
│   └── delete-relationship.ts
└── services/
    └── relationship-manager.ts  # Bidirectional updates
```

---

## Relationship Schema (in Memory_{user_id})

```yaml
Relationship (doc_type: "relationship"):
  # Discriminator
  doc_type: "relationship"
  
  # Core
  user_id: text
  memory_ids: text[]          # 2...N memory IDs
  relationship_type: text     # Free-form: "inspired_by", "contradicts", etc.
  
  # Description
  observation: text           # Vectorized for semantic search
  strength: number            # 0-1
  confidence: number          # 0-1
  
  # Context
  context_conversation_id: text
  context_summary: text
  context_timestamp: date
  
  # Metadata
  tags: text[]
  created_at: date
  updated_at: date
  version: number
```

---

## Testing

- [ ] Create 2-way relationship test
- [ ] Create N-way relationship test
- [ ] Search relationships test
- [ ] Update relationship test
- [ ] Delete relationship test
- [ ] Bidirectional update test
- [ ] Unified memory+relationship query test (RAG)
- [ ] Orphan handling test

---

**Next Milestone**: M4 - User Preferences  
**Blockers**: M2 must be complete
