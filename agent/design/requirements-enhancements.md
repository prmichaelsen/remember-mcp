# Requirements Enhancements & Gap Analysis

**Project**: remember-mcp (Multi-Tenant Memory System)  
**Based On**: index MCP server architecture  
**Last Updated**: 2026-02-11 (Updated with design decisions)

---

## Executive Summary

This document analyzes the requirements for the `remember-mcp` project and documents all design decisions, enhancements, and clarifications made during the planning phase.

---

## Design Decisions Summary

### ✅ Resolved Design Questions

1. **Tool Mapping**: Clarified - `index_existing` → `remember_update_memory`
2. **Trust Levels**: **Continuous 0-1 scale** (not discrete levels)
3. **Trust Enforcement**: **Prompt-based with LLM validation** (see [`trust-system-implementation.md`](trust-system-implementation.md))
4. **Relationship Types**: **Free-form strings** decided by agent (not enumerated)
5. **Relationship Directionality**: Not tracked (relationships are undirected)
6. **Location Handling**: **Provided by platform via cookies** (see [`location-handling-architecture.md`](location-handling-architecture.md))
7. **Permissions Storage**: **Firestore for permissions**, Weaviate for memories (see [`permissions-storage-architecture.md`](permissions-storage-architecture.md))
8. **Context Summary**: Added to both Memory and Relationship contexts
9. **Access Count Weighting**: Implemented in search ranking (see [`action-audit-memory-types.md`](action-audit-memory-types.md))
10. **Content Types**: Expanded to 21+ types including `checklist` (see [`content-types-expansion.md`](content-types-expansion.md))
11. **Memory Templates**: Designed for structured memory creation (see [`memory-templates-design.md`](memory-templates-design.md))

---

## Complete Schema Specifications

### 1. Memory Schema (FINAL)

```yaml
Memory:
  # Core Identity
  id: uuid
  user_id: string
  
  # Content
  content: text              # Main memory content
  title: string              # Optional short title
  summary: string            # Optional brief summary
  type: string               # Content type (see content-types-expansion.md)
  
  # Significance & Trust
  weight: float              # 0-1, significance/priority (continuous)
  trust: float               # 0-1, access control level (continuous)
  confidence: float          # 0-1, system confidence in accuracy
  
  # Location (provided by platform)
  location:
    address:
      formatted: string      # Full address
      street: string
      city: string
      state: string
      country: string
      postal_code: string
      timezone: string
    gps:
      latitude: float
      longitude: float
      accuracy: float        # GPS accuracy in meters
      altitude: float
      timestamp: datetime
    source: string           # "gps", "ip", "manual", "cached"
    confidence: float        # 0-1
    is_approximate: boolean
  
  # Context
  context:
    conversation_id: string  # Link to conversation
    conversation_title: string
    turn_number: int         # Position in conversation
    summary: string          # ✅ NEW: Brief summary for quick retrieval
    participants: array
      - user_id: string
        role: string         # user, assistant, system
    timestamp: datetime
    timezone: string
    source:
      type: string           # conversation, import, inference, manual
      platform: string       # web, mobile, api
      client: string
    environment:
      location: object       # Same as memory location
      device: string
    tags: array
    notes: string
  
  # Relationships
  relationships: array       # IDs of relationship objects
  
  # Access Tracking (for weight calculation)
  access_count: int          # Total times accessed
  last_accessed_at: datetime # Most recent access
  access_frequency: float    # Accesses per day
  access_history: array      # Recent access timestamps
  
  # Metadata
  created_at: datetime
  updated_at: datetime
  version: int
  
  # Organization
  tags: array
  category: string
  
  # Template Integration (optional)
  template_id: uuid          # Which template was used
  template_version: string
  structured_content: object # Template-structured data
  
  # Vector embedding (for semantic search)
  embedding: vector
  
  # Computed Weight (for search ranking)
  base_weight: float         # User-specified
  computed_weight: float     # Calculated with access multipliers
```

### 2. Relationship Schema (FINAL)

```yaml
Relationship:
  # Core Identity
  id: uuid
  user_id: string
  
  # Connection
  memory_ids: array          # 2...N memory IDs
  type: string               # ✅ FREE-FORM: Agent decides relationship type
                             # Examples: "causes", "contradicts", "supports",
                             # "relates_to", "inspired_by", "depends_on", etc.
  
  # Observation
  observation: text          # Description of the connection
  strength: float            # 0-1, strength of relationship
  confidence: float          # 0-1, confidence in relationship
  
  # Context
  context:
    conversation_id: string
    conversation_title: string
    turn_number: int
    summary: string          # ✅ NEW: Brief summary of discovery context
    discovered_in: string
    timestamp: datetime
    source: string
    participants: array
  
  # Metadata
  created_at: datetime
  updated_at: datetime
  version: int
  
  # Organization
  tags: array
  
  # Note: 'directed' field removed - relationships are undirected
```

### 3. Trust Relationship Schema (Firestore)

**Location**: `user_permissions/{owner_user_id}/allowed_accessors/{accessor_user_id}`

```yaml
UserPermission:
  # Identity
  owner_user_id: string      # User whose memories can be accessed
  accessor_user_id: string   # User who can access
  
  # Permission
  can_access: boolean
  access_level: string       # "read", "read_write", "admin"
  
  # Trust (continuous 0-1)
  trust_level: float         # ✅ CONTINUOUS 0-1 (not discrete)
  trust_summary: string      # Brief explanation
  trust_reason: string       # Detailed reason
  
  # Scope
  allowed_memory_types: array
  allowed_tags: array
  excluded_tags: array
  
  # Temporal
  granted_at: Timestamp
  expires_at: Timestamp | null
  last_accessed: Timestamp
  access_count: int
  
  # Metadata
  granted_by: string
  revoked: boolean
  revoked_at: Timestamp | null
  revoked_reason: string | null
```

---

## Tool Mapping (FINAL)

```
index tool              → remember-mcp tool
-----------------         -------------------
search_index            → remember_search_memory (hybrid search)
ask_index               → remember_query_memory (GraphQL + NL interpretation)
index_new               → remember_create_memory
index_existing          → remember_update_memory (✅ update existing memory)
unindex                 → remember_delete_memory
find_similar_in_index   → remember_find_similar
(none)                  → remember_create_relationship (NEW)
(none)                  → remember_update_relationship (NEW)
(none)                  → remember_search_relationship (NEW)
(none)                  → remember_delete_relationship (NEW)
```

**Additional Tools** (from templates and action tracking):
- `remember_create_template` - Create memory template
- `remember_list_templates` - List available templates
- `remember_update_template` - Update template
- `remember_delete_template` - Delete template
- `remember_validate_memory` - Validate against template

---

## Architecture Decisions

### 1. Trust System (RESOLVED)

**Decision**: **Prompt-based enforcement with continuous trust levels**

**Implementation**:
- Trust levels are **continuous 0-1** (not discrete)
- Trust enforced by including trust context in LLM prompts
- Low-trust memories (< 0.25) require validation
- "Intimate details" (trust 0.0) means: hint at existence without revealing specifics

**Example** (trust 0.0 - traumatic experience):
```
LLM sees: "Significant personal incident with lasting impact"
Acceptable: "I'm aware something significant happened around that time."
Unacceptable: "You were in a car accident..." ❌ VIOLATION
```

**See**: [`trust-system-implementation.md`](trust-system-implementation.md)

### 2. Location Handling (RESOLVED)

**Decision**: **Platform provides location via cookies/headers**

**Flow**:
1. Platform (agentbase.me) captures GPS from device
2. Geocodes to address
3. Stores in cookies
4. Includes in MCP request context
5. MCP server extracts and stores with memory

**Benefits**:
- Separation of concerns
- Platform handles permissions
- Consistent across features
- User privacy controls

**See**: [`location-handling-architecture.md`](location-handling-architecture.md)

### 3. Permissions Storage (RESOLVED)

**Decision**: **Hybrid - Firestore for permissions, Weaviate for memories**

**Rationale**:
- Firestore optimized for relational queries
- Weaviate optimized for vector search
- Each database does what it's best at
- Firebase security rules for permissions
- Easy to query "who can access my memories?"

**See**: [`permissions-storage-architecture.md`](permissions-storage-architecture.md)

### 4. Relationship Types (RESOLVED)

**Decision**: **Free-form strings decided by agent**

**Rationale**:
- Flexibility for nuanced relationships
- LLMs excel at generating appropriate descriptors
- No schema changes needed for new types
- Natural language descriptions

**Examples**: "causes", "contradicts", "supports", "inspired_by", "depends_on", "similar_to", "prerequisite_for"

### 5. Access Count Weighting (RESOLVED)

**Decision**: **Frequently accessed memories rank higher in search**

**Formula**:
```
effective_weight = base_weight × access_multiplier × recency_multiplier × relationship_multiplier

where:
  access_multiplier = 1 + (access_count / max_access_count) × 0.5
  recency_multiplier = 1 + (days_since_access < 7 ? 0.3 : 0)
  relationship_multiplier = 1 + (relationship_count / 10) × 0.2
```

**See**: [`action-audit-memory-types.md`](action-audit-memory-types.md)

---

## Additional Features Designed

### 1. Content Types Expansion

**Added**: 21+ content types including:
- `checklist` - For grocery lists, packing, camping prep
- `recipe` - Cooking recipes and instructions
- `bookmark` - Web bookmarks and resources
- `journal` - Daily journal entries
- `reference` - Quick reference guides

**See**: [`content-types-expansion.md`](content-types-expansion.md)

### 2. Memory Templates

**Purpose**: Guide structured memory creation

**Features**:
- Field definitions with validation
- Template inheritance
- Auto-suggestion based on context
- Computed fields
- Conditional fields

**See**: [`memory-templates-design.md`](memory-templates-design.md)

### 3. Action & Audit Tracking

**Memory Types**:
- `action` - Track agent actions
- `audit` - Compliance and security trail
- `event-log` - System events (optional)
- `history` - Memory change history

**Cost**: ~$1.70/user/year with recommended strategy

**See**: [`action-audit-memory-types.md`](action-audit-memory-types.md)

---

## Implementation Priorities

### 🔴 Phase 1: Core Functionality (MVP)

1. **Memory CRUD Operations**
   - `remember_create_memory`
   - `remember_update_memory`
   - `remember_delete_memory`
   - `remember_search_memory`
   - `remember_find_similar`

2. **Basic Relationships**
   - `remember_create_relationship`
   - `remember_search_relationship`
   - `remember_delete_relationship`

3. **Multi-Tenancy**
   - Per-user Weaviate collections
   - User isolation
   - Firebase authentication

4. **Location Integration**
   - Extract from request context
   - Store with memories
   - Basic location search

### 🟡 Phase 2: Trust & Permissions

5. **Trust System**
   - Prompt-based enforcement
   - Validation for low-trust memories
   - Trust relationship storage (Firestore)

6. **Cross-User Access**
   - Permission management
   - Trust level filtering
   - Access auditing

7. **GraphQL Queries**
   - `remember_query_memory`
   - Query validation
   - Security restrictions

### 🟢 Phase 3: Advanced Features

8. **Templates**
   - Template creation and management
   - Validation
   - Auto-suggestion

9. **Action Tracking**
   - Action memory type
   - Audit logging
   - Trust violation tracking

10. **Analytics**
    - Access count tracking
    - Weight calculation
    - Usage metrics

---

## Reference Documents

All design specifications:

1. [`requirements.md`](requirements.md) - Original requirements
2. [`requirements-enhancements.md`](requirements-enhancements.md) - This document
3. [`content-types-expansion.md`](content-types-expansion.md) - Content type analysis
4. [`memory-templates-design.md`](memory-templates-design.md) - Template system
5. [`action-audit-memory-types.md`](action-audit-memory-types.md) - Action tracking
6. [`location-handling-architecture.md`](location-handling-architecture.md) - Location architecture
7. [`trust-system-implementation.md`](trust-system-implementation.md) - Trust enforcement
8. [`permissions-storage-architecture.md`](permissions-storage-architecture.md) - Permission storage
9. [`trust-escalation-prevention.md`](trust-escalation-prevention.md) - Trust escalation prevention
10. [`access-control-result-pattern.md`](access-control-result-pattern.md) - Type-safe error handling

---

## Questions Resolved

### ✅ Answered During Planning

1. **Trust System**: Continuous 0-1, prompt-based enforcement
2. **Cross-User Access**: Firestore permissions, trust-based filtering
3. **GraphQL Access**: Restricted subset with validation
4. **Location**: Platform-provided via cookies
5. **Weight**: Auto-calculated with access count multiplier
6. **Relationships**: Free-form types, undirected, 2...N memories
7. **Storage**: Hybrid - Firestore + Weaviate
8. **Tool Mapping**: `index_existing` → `remember_update_memory`

### ❓ Remaining Questions

1. **Storage Limits**: Max memories/relationships per user?
2. **Migration**: Existing data to migrate?
3. **MVP Scope**: Which features for initial release?
4. **Pricing**: Cost structure for users?

---

## Next Steps

1. ✅ **Planning Complete** - All major design decisions made
2. **Create Bootstrap Document** - Comprehensive guide for implementation
3. **Begin Phase 1** - Implement core memory operations
4. **Set up Infrastructure** - Weaviate + Firestore + Firebase Auth
5. **Implement Multi-Tenancy** - Per-user collections and isolation

---

**Document Status**: Complete - All design decisions documented  
**Ready For**: Implementation phase  
**Last Updated**: 2026-02-11
