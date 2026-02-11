# Weaviate Collection Strategy

**Concept**: Single vs multiple collections for different document types
**Created**: 2026-02-11
**Updated**: 2026-02-11 (Final decision based on RAG requirements)
**Status**: Design Specification (FINAL)

---

## The Question

Do we need separate Weaviate collections for:
- Memories (user content)
- Templates (structure definitions)
- Audit logs (system events)
- Relationships (memory connections)

Or can we use a single collection with type discrimination?

---

## Analysis

### Option 1: Multiple Collections (Current Plan)

```
Weaviate Collections:
├── Memory_{user_id}        # User memories
├── Template_system         # Default templates
├── Template_{user_id}      # User templates
├── Audit_{user_id}         # Audit logs
└── Relationship_{user_id}  # Relationships
```

**Pros**:
- ✅ Clear separation of concerns
- ✅ Different schemas per collection
- ✅ Optimized indexes per type
- ✅ Easier to manage collection-specific settings
- ✅ Better performance (smaller collections)
- ✅ Simpler queries (no type filtering needed)

**Cons**:
- ❌ More collections to manage
- ❌ Weaviate collection limits (check pricing tier)
- ❌ More complex cross-type queries
- ❌ Duplication of user_id collections

---

### Option 2: Single Collection Per User

```
Weaviate Collections:
└── User_{user_id}          # All user data
    ├── type: "memory"
    ├── type: "template"
    ├── type: "audit"
    └── type: "relationship"
```

**Pros**:
- ✅ Fewer collections (one per user)
- ✅ Easier cross-type queries
- ✅ Single collection management
- ✅ No collection limit concerns

**Cons**:
- ❌ Mixed schemas in one collection
- ❌ Less optimized indexes
- ❌ Slower queries (need type filtering)
- ❌ Harder to manage different retention policies
- ❌ Mixing concerns (memories with audit logs)

---

### Option 3: Hybrid - Separate by Purpose

```
Weaviate Collections:
├── Memory_{user_id}        # User memories (searchable content)
├── Template_system         # System templates (shared resource)
└── System_{user_id}        # System data (audit, history, etc.)
    ├── type: "audit"
    ├── type: "history"
    └── type: "action"
```

**Pros**:
- ✅ Separates user content from system data
- ✅ Optimized for different use cases
- ✅ Fewer collections than Option 1
- ✅ Clear purpose per collection

**Cons**:
- ❌ Still multiple collections
- ❌ Relationships unclear (separate or in Memory?)

---

## Final Decision: Hybrid Approach

### Final Collection Structure (IMPLEMENTED)

```
Weaviate Collections:

1. Memory_{user_id}
   - Stores BOTH memories AND relationships ✅
   - doc_type: "memory" or "relationship"
   - Unified semantic search
   - Essential for RAG context
   - Single query gets memories with relationships
   
2. Template_system
   - Default templates (shared across all users)
   - Immutable, curated by platform
   - Separate because shared resource
   
3. Template_{user_id} (lazy create)
   - User-created templates
   - Private to user
   - Created only when user makes custom template
   
4. Audit_{user_id} (optional, lazy create)
   - Audit logs, action logs, history
   - Separate retention policies
   - Created only if user enables audit logging
```

**Key Change**: Relationships are NOT in a separate collection - they're stored in Memory_{user_id} with doc_type discriminator.

### Rationale

**Memory_{user_id} - Unified Collection**:
- Stores BOTH memories and relationships
- Essential for RAG: LLM needs both together
- Unified semantic search across memories and relationship observations
- Single query gets memory with its connections
- doc_type field discriminates between memory and relationship

**Template_system - Shared Collection**:
- Default templates available to all users
- Immutable, curated by platform
- Separate because it's a shared resource

**Template_{user_id} - Per-User Collection** (lazy):
- User's custom templates
- Private to user
- Created only when user makes first custom template

**Audit_{user_id} - Per-User Collection** (optional, lazy):
- Audit logs, action logs, history
- Different retention policies
- Less frequently searched
- Created only if user enables audit logging

---

## Schema Comparison

### Memory Schema
```yaml
Memory:
  content: text (LARGE, vectorized)
  title: string
  type: string
  weight: float
  trust: float
  location: object
  context: object
  relationships: array (IDs)
  # Optimized for: Semantic search, content retrieval
```

### Relationship Schema
```yaml
Relationship:
  memory_ids: array (2...N IDs)
  type: string
  observation: text (SMALL)
  strength: float
  confidence: float
  context: object
  # Optimized for: Graph traversal, relationship queries
```

### Template Schema
```yaml
Template:
  template_name: string
  fields: array (field definitions)
  trigger_keywords: array
  trigger_context: object
  # Optimized for: Template matching, field validation
```

### Audit Schema
```yaml
Audit:
  event_type: string
  action: string
  target_id: string
  timestamp: datetime
  # Optimized for: Time-series queries, compliance
```

**Conclusion**: These are fundamentally different data types with different schemas and access patterns. Separate collections make sense.

---

## Collection Limit Considerations

### Weaviate Cloud Limits

**Typical Limits** (varies by tier):
- Free tier: ~10 collections
- Standard tier: ~100 collections
- Enterprise: ~1000+ collections

### Our Usage

**Per User** (assuming 1000 users):
- Memory_{user_id}: 1000 collections
- Relationship_{user_id}: 1000 collections
- Template_{user_id}: 1000 collections
- Audit_{user_id}: 1000 collections (optional)
- **Total**: 3000-4000 collections

**Shared**:
- Template_system: 1 collection

**Potential Issue**: May exceed collection limits on lower tiers

### Mitigation Strategies

#### Strategy A: Single Collection with Type Filter (If Limits Hit)

```
Weaviate Collections:
└── User_{user_id}
    ├── doc_type: "memory"
    ├── doc_type: "relationship"
    ├── doc_type: "template"
    └── doc_type: "audit"
```

**Trade-off**: Slower queries, but works within limits

#### Strategy B: Selective Collections

```
Weaviate Collections:
├── Memory_{user_id}        # Always separate (most important)
├── Template_system         # Shared (always separate)
└── Meta_{user_id}          # Combined: relationships, audit, templates
    ├── doc_type: "relationship"
    ├── doc_type: "audit"
    └── doc_type: "template"
```

**Trade-off**: Memories optimized, others combined

#### Strategy C: Lazy Collection Creation

```typescript
// Only create collections when needed
async function ensureCollection(user_id: string, type: string): Promise<void> {
  const collectionName = `${type}_${user_id}`;
  
  const exists = await weaviateClient.collections.exists(collectionName);
  
  if (!exists) {
    await weaviateClient.collections.create({
      name: collectionName,
      // ... schema
    });
  }
}

// Don't create Audit_{user_id} unless user enables audit logging
// Don't create Template_{user_id} unless user creates custom template
```

---

## Recommendation

### Phase 1 (MVP): Minimal Collections

```
Weaviate Collections:
├── Memory_{user_id}        # User memories
├── Template_system         # Default templates only
└── (no user templates yet)
└── (no separate relationships yet - store in memory)
└── (no audit logs yet)
```

**Rationale**: Start simple, add collections as needed

### Phase 2: Add Relationships

```
Weaviate Collections:
├── Memory_{user_id}        # User memories
├── Relationship_{user_id}  # Memory relationships
└── Template_system         # Default templates
```

### Phase 3: Add User Templates & Audit

```
Weaviate Collections:
├── Memory_{user_id}        # User memories
├── Relationship_{user_id}  # Memory relationships
├── Template_system         # Default templates
├── Template_{user_id}      # User templates (lazy create)
└── Audit_{user_id}         # Audit logs (lazy create, optional)
```

---

## Alternative: Relationships in Memory Collection

### Store Relationships as Special Memories

```yaml
Memory_{user_id}:
  # Regular memory
  - id: mem_123
    doc_type: "memory"
    content: "Camping trip to Yosemite"
    
  # Relationship stored as special memory
  - id: rel_456
    doc_type: "relationship"
    memory_ids: [mem_123, mem_789]
    relationship_type: "inspired_by"
    observation: "Yosemite trip inspired planning for Sequoia"
```

**Benefits**:
- ✅ Fewer collections
- ✅ Relationships searchable with memories
- ✅ Single collection per user

**Drawbacks**:
- ❌ Mixed document types
- ❌ Need type filtering on every query
- ❌ Less optimized

---

## Final Recommendation: Hybrid Approach

**Decision**: Store relationships in Memory collection, separate collections for templates and audit

### Final Collection Structure

```
Weaviate Collections:

1. Memory_{user_id}
   - Stores BOTH memories AND relationships
   - doc_type: "memory" or "relationship"
   - ✅ Unified semantic search
   - ✅ Essential for RAG context
   - ✅ Single query gets memories with relationships
   
2. Template_system
   - Default templates (shared across all users)
   - Immutable, curated by platform
   - Separate because shared resource
   
3. Template_{user_id} (lazy create)
   - User-created templates
   - Private to user
   - Created only when user makes custom template
   
4. Audit_{user_id} (optional, lazy create)
   - Audit logs, action logs, history
   - Separate retention policies
   - Created only if user enables audit logging
```

### Rationale

**Relationships in Memory Collection** ✅:
1. **RAG Context**: LLM needs memories AND relationships together
2. **Unified Search**: Search relationship observations semantically
3. **Single Query**: Get memory with its connections efficiently
4. **Graph Context**: Relationships explain memory connections

**Example RAG Query**:
```
User: "What inspired my Sequoia trip?"

Single query to Memory_{user_id}:
- Returns: Yosemite memory + "inspired_by" relationship
- LLM sees full context in one retrieval
- No need to join separate collections
```

**Separate Template Collections** ✅:
- Template_system is shared (can't be per-user)
- Different schema and purpose
- Template matching is separate operation

**Separate Audit Collection** ✅:
- Different retention policies
- Less frequently searched
- Optional feature

### Collection Limits

**Self-Hosted Weaviate**: No collection limits ✅

**Per User** (1000 users):
- Memory_{user_id}: 1000 collections
- Template_{user_id}: ~200 collections (lazy, only if user creates templates)
- Audit_{user_id}: ~100 collections (lazy, only if enabled)
- **Total**: ~1300 collections

**Shared**:
- Template_system: 1 collection

**No Concerns**: Self-hosted Weaviate handles this easily

---

## Benefits of Hybrid Approach

### 1. **RAG Optimization**
- Memories and relationships retrieved together
- LLM gets full context in single query
- Relationship observations are semantically searchable
- Graph structure naturally included

### 2. **Performance**
- Single query for memory + relationships
- No joins needed
- Faster RAG context building
- Efficient graph traversal

### 3. **Simplicity**
- Fewer collections than full separation
- Clear purpose per collection
- Easy to understand

### 4. **Scalability**
- No collection limit concerns (self-hosted)
- Lazy creation reduces actual collection count
- Can scale to millions of users

---

**Status**: Design Specification (FINAL)
**Strategy**: Hybrid - relationships in Memory, separate templates and audit
**Deployment**: Self-hosted Weaviate (no collection limits)
**Key Benefit**: Optimized for RAG with unified memory+relationship search
