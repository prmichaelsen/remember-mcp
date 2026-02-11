# Milestone 2: Core Memory System

**Goal**: Implement basic memory CRUD operations with user isolation  
**Duration**: 2 weeks  
**Dependencies**: M1 (Project Foundation)  
**Status**: Not Started

---

## Overview

Implement the core memory system with create, read, update, delete, and search operations. Establish user isolation with per-user Weaviate collections.

---

## Deliverables

### 1. Memory Schema
- Complete Memory interface (25+ fields)
- Weaviate schema for Memory_{user_id} collection
- Support for doc_type discriminator
- Vector embedding configuration

### 2. Memory CRUD Tools (6 tools)
- remember_create_memory
- remember_update_memory
- remember_delete_memory
- remember_search_memory (hybrid search)
- remember_find_similar
- remember_query_memory (RAG)

### 3. User Isolation
- Per-user collection naming: Memory_{sanitized_user_id}
- Collection creation on first use
- Verify no cross-user data access

### 4. Context Integration
- Extract location from request context
- Extract locale and timezone from cookies
- Store context with each memory

---

## Success Criteria

- [ ] Can create memories with all fields (content, type, weight, trust, location, context)
- [ ] Can search memories semantically (hybrid search working)
- [ ] Can update memories (version tracking works)
- [ ] Can delete memories
- [ ] Can find similar memories
- [ ] RAG queries return relevant answers
- [ ] User data completely isolated (tested with multiple users)
- [ ] Location and locale stored correctly from cookies

---

## Key Files to Create

```
src/
├── types/
│   ├── memory.ts           # Memory interface
│   ├── context.ts          # RequestContext interface
│   └── location.ts         # Location/Locale interfaces
├── weaviate/
│   └── memory-schema.ts    # Weaviate schema definition
├── tools/
│   ├── create-memory.ts
│   ├── update-memory.ts
│   ├── delete-memory.ts
│   ├── search-memory.ts
│   ├── find-similar.ts
│   └── query-memory.ts
└── services/
    └── context-extractor.ts  # Extract location/locale from cookies
```

---

## Memory Schema (Weaviate)

```yaml
Memory_{user_id}:
  # Discriminator
  doc_type: text              # "memory" or "relationship"
  
  # Core
  user_id: text
  content: text               # Vectorized
  title: text
  summary: text
  type: text                  # Content type
  
  # Scoring
  weight: number              # 0-1
  trust: number               # 0-1
  confidence: number          # 0-1
  
  # Location (from cookies)
  location_gps_lat: number
  location_gps_lng: number
  location_address: text
  location_city: text
  location_country: text
  
  # Locale (from cookies)
  locale_language: text
  locale_timezone: text
  
  # Context
  context_conversation_id: text
  context_summary: text
  context_timestamp: date
  
  # Relationships
  relationships: text[]       # Array of relationship IDs
  
  # Access tracking
  access_count: number
  last_accessed_at: date
  
  # Metadata
  tags: text[]
  references: text[]          # Source URLs
  created_at: date
  updated_at: date
  version: number
  
  # Template
  template_id: text
```

---

## Testing

- [ ] Create memory test
- [ ] Update memory test
- [ ] Delete memory test
- [ ] Search memory test (semantic + keyword)
- [ ] Find similar test
- [ ] RAG query test
- [ ] User isolation test (critical!)
- [ ] Location extraction test
- [ ] Locale extraction test

---

**Next Milestone**: M3 - Relationships & Graph  
**Blockers**: M1 must be complete
