# Relationship Storage Strategy

**Concept**: Store relationships in Memory collection vs separate collection  
**Created**: 2026-02-11  
**Status**: Design Analysis

---

## The Question

Should relationships be stored:
- **Option A**: Separate `Relationship_{user_id}` collection
- **Option B**: In `Memory_{user_id}` collection with `doc_type: "relationship"`

---

## Analysis

### Option A: Separate Collection

```
Weaviate:
├── Memory_{user_id}
│   └── doc_type: "memory"
└── Relationship_{user_id}
    └── doc_type: "relationship"
```

**Pros**:
- ✅ Clear separation
- ✅ Different schemas
- ✅ Optimized indexes per type

**Cons**:
- ❌ Can't query memories and relationships together
- ❌ Need two queries to get memory with relationships
- ❌ More collections to manage
- ❌ Harder to find "memories related to X"

---

### Option B: Same Collection (RECOMMENDED)

```
Weaviate:
└── Memory_{user_id}
    ├── doc_type: "memory"
    └── doc_type: "relationship"
```

**Pros**:
- ✅ **Unified queries**: Search memories and relationships together
- ✅ **Single query**: Get memory with its relationships
- ✅ **Better UX**: "Show me memories about camping and their connections"
- ✅ **Fewer collections**: Simpler management
- ✅ **Relationship search**: Find relationships by observation text

**Cons**:
- ❌ Mixed document types in one collection
- ❌ Need `doc_type` filter on queries

**Verdict**: Pros outweigh cons significantly

---

## Recommended Approach

### Store Relationships as Special Memories

```yaml
Memory_{user_id} Collection:
  
  # Regular memory
  - id: "mem_abc123"
    doc_type: "memory"
    user_id: "user_123"
    content: "Amazing camping trip to Yosemite..."
    type: "event"
    weight: 0.8
    trust: 0.5
    relationships: ["rel_xyz789"]  # IDs of relationships
    
  # Relationship (stored as special memory)
  - id: "rel_xyz789"
    doc_type: "relationship"
    user_id: "user_123"
    memory_ids: ["mem_abc123", "mem_def456"]
    relationship_type: "inspired_by"
    observation: "Yosemite trip inspired planning for Sequoia trip"
    strength: 0.9
    confidence: 0.8
    context:
      conversation_id: "conv_123"
      summary: "Discussing future camping plans"
```

---

## Benefits of Unified Storage

### 1. **Unified Search**

```typescript
// Search memories AND relationships together
remember_search_memory({
  query: "camping trips",
  include_relationships: true
})

// Returns:
{
  memories: [
    { id: "mem_abc123", content: "Yosemite camping...", relationships: ["rel_xyz789"] }
  ],
  relationships: [
    { id: "rel_xyz789", type: "inspired_by", observation: "Yosemite inspired Sequoia..." }
  ]
}

// Single Weaviate query!
const results = await weaviateClient
  .collection(`Memory_${user_id}`)
  .query.nearText("camping trips", {
    // No doc_type filter - get both memories and relationships
    limit: 20
  });
```

### 2. **Relationship Discovery**

```typescript
// Find relationships by observation text
remember_search_memory({
  query: "what inspired my Sequoia trip?",
  doc_types: ["relationship"]  // Only search relationships
})

// Weaviate can semantically search relationship observations
// Returns: "Yosemite trip inspired Sequoia trip"
```

### 3. **Graph Queries**

```typescript
// Get memory with all its relationships in one query
async function getMemoryWithRelationships(memory_id: string, user_id: string) {
  const memory = await weaviateClient
    .collection(`Memory_${user_id}`)
    .data.getById(memory_id);
  
  // Get related relationships (same collection!)
  const relationships = await weaviateClient
    .collection(`Memory_${user_id}`)
    .query.fetch({
      where: {
        operator: 'And',
        operands: [
          { path: 'doc_type', operator: 'Equal', valueText: 'relationship' },
          { path: 'memory_ids', operator: 'ContainsAny', valueTextArray: [memory_id] }
        ]
      }
    });
  
  return {
    memory,
    relationships
  };
}
```

### 4. **Contextual Search**

```typescript
// "Show me camping memories and how they're connected"
const results = await weaviateClient
  .collection(`Memory_${user_id}`)
  .query.nearText("camping", {
    limit: 20
    // Gets both memories and relationships about camping
  });

// Filter by type
const memories = results.filter(r => r.doc_type === 'memory');
const relationships = results.filter(r => r.doc_type === 'relationship');
```

---

## Schema Design

### Unified Schema with Discriminator

```yaml
Memory_{user_id} Collection Schema:
  # Common fields (all documents)
  doc_type: string              # "memory" or "relationship"
  user_id: string
  created_at: datetime
  updated_at: datetime
  weight: float
  trust: float
  tags: array
  
  # Memory-specific fields (when doc_type = "memory")
  content: text
  title: string
  type: string
  location: object
  context: object
  relationships: array          # IDs of relationship documents
  
  # Relationship-specific fields (when doc_type = "relationship")
  memory_ids: array             # IDs of connected memories
  relationship_type: string
  observation: text
  strength: float
  confidence: float
```

**Weaviate Configuration**:
```typescript
await weaviateClient.collections.create({
  name: `Memory_${user_id}`,
  properties: [
    // Common
    { name: 'doc_type', dataType: 'text' },
    { name: 'user_id', dataType: 'text' },
    { name: 'weight', dataType: 'number' },
    { name: 'trust', dataType: 'number' },
    
    // Memory fields
    { name: 'content', dataType: 'text' },
    { name: 'title', dataType: 'text' },
    { name: 'type', dataType: 'text' },
    
    // Relationship fields
    { name: 'memory_ids', dataType: 'text[]' },
    { name: 'relationship_type', dataType: 'text' },
    { name: 'observation', dataType: 'text' },
    { name: 'strength', dataType: 'number' },
    
    // ... other fields
  ],
  vectorizers: weaviate.configure.vectorizer.text2VecOpenAI({
    model: 'text-embedding-3-small',
    // Vectorize both memory content and relationship observations
    sourceProperties: ['content', 'observation']
  })
});
```

---

## Query Patterns

### Search Memories Only

```typescript
remember_search_memory({
  query: "camping",
  doc_types: ["memory"]  // Filter to memories only
})

// Weaviate query
await weaviateClient
  .collection(`Memory_${user_id}`)
  .query.nearText("camping", {
    where: { path: 'doc_type', operator: 'Equal', valueText: 'memory' }
  });
```

### Search Relationships Only

```typescript
remember_search_relationship({
  query: "inspired by",
  limit: 10
})

// Weaviate query
await weaviateClient
  .collection(`Memory_${user_id}`)
  .query.nearText("inspired by", {
    where: { path: 'doc_type', operator: 'Equal', valueText: 'relationship' }
  });
```

### Search Both

```typescript
remember_search_memory({
  query: "camping",
  include_relationships: true  // Don't filter by doc_type
})

// Weaviate query
await weaviateClient
  .collection(`Memory_${user_id}`)
  .query.nearText("camping", {
    // No doc_type filter - returns both
  });
```

---

## Recommendation

**Store relationships in Memory collection with `doc_type` discriminator**

### Rationale

1. **Unified Search**: Query memories and relationships together
2. **Better UX**: "Show camping memories and connections" in one query
3. **Semantic Search**: Search relationship observations semantically
4. **Fewer Collections**: Simpler management
5. **Graph Queries**: Get memory with relationships efficiently

### Trade-offs

- Need to filter by `doc_type` when querying specific types
- Mixed schemas in one collection
- Slightly more complex schema

**Verdict**: Benefits far outweigh trade-offs

---

## Updated Collection Strategy

### Weaviate Collections (FINAL)

```
1. Memory_{user_id}
   - Stores both memories AND relationships
   - doc_type field discriminates
   - Unified semantic search
   - Optimized for: content search, relationship discovery
   
2. Template_system
   - Default templates (shared)
   - Immutable, curated
   - Optimized for: template matching
   
3. Template_{user_id} (lazy create)
   - User's custom templates
   - Private, modifiable
   - Optimized for: template matching
   
4. Audit_{user_id} (optional, lazy create)
   - Audit logs, action logs
   - Separate retention policies
   - Optimized for: time-series queries
```

**Simplified from 5 collections to 3-4 collections per user**

---

**Status**: Design Recommendation (FINAL)  
**Decision**: Store relationships in Memory collection  
**Benefit**: Unified search, better UX, fewer collections
