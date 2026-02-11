# Action & Audit Memory Types - Design Proposal

**Concept**: Memory types for tracking agent actions, events, and system history  
**Created**: 2026-02-11  
**Status**: Proposal

---

## Overview

Action, event-log, audit, and history memory types serve to track significant actions taken by the agent, creating a transparent record of agent behavior and decision-making. This addresses both functionality and trust/safety requirements.

---

## Memory Type Proposals

### 1. **`action` Memory Type**

**Purpose**: Track significant actions the agent took on behalf of the user

**Use Cases**:
- Agent sent an email
- Agent created a calendar event
- Agent made a purchase
- Agent modified user data
- Agent executed a command
- Agent made an API call

**Schema**:
```yaml
ActionMemory:
  # Core Identity
  id: uuid
  user_id: string
  type: "action"
  
  # Action Details
  action_type: enum  # email_sent, event_created, data_modified, command_executed, api_called
  action_name: string  # Human-readable action name
  action_description: text  # What the agent did
  
  # Context
  triggered_by: string  # User request, scheduled task, automated rule
  conversation_id: string  # Link to conversation
  user_intent: text  # What user asked for
  
  # Execution
  status: enum  # success, failed, partial, cancelled
  executed_at: datetime
  duration_ms: int
  
  # Details
  parameters: object  # Action parameters
  result: object  # Action result
  error: object  # Error details if failed
  
  # Impact
  resources_affected: array  # What was changed/accessed
  side_effects: array  # Other impacts
  reversible: boolean  # Can this be undone?
  undo_action_id: uuid  # Link to undo action if performed
  
  # Metadata
  weight: float  # Significance (0-1)
  trust: float  # Trust level required to view
  tags: array
```

**Example**:
```yaml
action:
  action_type: "email_sent"
  action_name: "Sent meeting invitation"
  action_description: "Sent calendar invitation for team sync to 5 recipients"
  triggered_by: "user_request"
  conversation_id: "conv_abc123"
  user_intent: "Schedule a team meeting for next week"
  status: "success"
  executed_at: "2026-02-11T15:30:00Z"
  parameters:
    recipients: ["alice@example.com", "bob@example.com"]
    subject: "Team Sync - Feb 18"
    date: "2026-02-18T14:00:00Z"
  result:
    event_id: "evt_xyz789"
    sent_count: 5
  resources_affected: ["calendar", "email"]
  reversible: true
  weight: 0.7
```

### 2. **`audit` Memory Type**

**Purpose**: Compliance and security audit trail

**Use Cases**:
- Authentication events
- Permission changes
- Data access logs
- Security-relevant actions
- Compliance-required tracking

**Schema**:
```yaml
AuditMemory:
  # Core Identity
  id: uuid
  user_id: string
  type: "audit"
  
  # Audit Details
  event_type: enum  # auth, permission, access, security, compliance
  event_category: string  # login, logout, data_access, permission_grant, etc.
  severity: enum  # info, warning, critical
  
  # Actor
  actor_id: string  # Who performed the action
  actor_type: enum  # user, agent, system, external
  actor_ip: string
  actor_location: object
  
  # Target
  target_resource: string  # What was accessed/modified
  target_type: string  # memory, template, relationship, system
  target_id: uuid
  
  # Action
  action: string  # read, write, delete, execute, grant, revoke
  action_result: enum  # success, denied, failed
  
  # Context
  timestamp: datetime
  session_id: string
  request_id: string
  
  # Security
  authentication_method: string
  authorization_level: string
  risk_score: float  # 0-1, how risky was this action
  
  # Compliance
  compliance_tags: array  # GDPR, HIPAA, SOC2, etc.
  retention_required_until: datetime
  
  # Metadata
  weight: 1.0  # Audit logs always high weight
  trust: 0.0  # ✅ Only owner can see their own audit logs (cross-user blocked)
  immutable: true  # Cannot be modified
```

**Example**:
```yaml
audit:
  event_type: "access"
  event_category: "sensitive_data_access"
  severity: "info"
  actor_id: "agent_assistant"
  actor_type: "agent"
  target_resource: "memory"
  target_id: "mem_sensitive_123"
  action: "read"
  action_result: "success"
  timestamp: "2026-02-11T15:30:00Z"
  authentication_method: "firebase_jwt"
  authorization_level: "user_authorized"
  risk_score: 0.2
  compliance_tags: ["GDPR"]
  immutable: true
```

### 3. **`event-log` Memory Type**

**Purpose**: General system events and state changes

**Use Cases**:
- System state changes
- Background processes
- Scheduled tasks
- Integration events
- Workflow milestones

**Schema**:
```yaml
EventLogMemory:
  # Core Identity
  id: uuid
  user_id: string
  type: "event-log"
  
  # Event Details
  event_name: string
  event_type: enum  # system, integration, workflow, scheduled, user_triggered
  event_category: string
  
  # Timing
  occurred_at: datetime
  detected_at: datetime
  processed_at: datetime
  
  # Source
  source_system: string
  source_component: string
  source_version: string
  
  # Event Data
  event_data: object
  previous_state: object  # State before event
  new_state: object  # State after event
  
  # Relationships
  parent_event_id: uuid  # For event chains
  related_events: array  # Related event IDs
  correlation_id: string  # For distributed tracing
  
  # Impact
  affected_resources: array
  downstream_events: array
  
  # Metadata
  weight: float
  trust: float
  tags: array
```

### 4. **`history` Memory Type**

**Purpose**: Track changes to memories and relationships over time

**Use Cases**:
- Memory edit history
- Relationship changes
- Template evolution
- User preference changes

**Schema**:
```yaml
HistoryMemory:
  # Core Identity
  id: uuid
  user_id: string
  type: "history"
  
  # Target
  target_type: enum  # memory, relationship, template, preference
  target_id: uuid
  
  # Change Details
  change_type: enum  # created, updated, deleted, restored
  changed_at: datetime
  changed_by: string  # user_id or agent_id
  
  # Changes
  fields_changed: array
  previous_values: object
  new_values: object
  diff: object  # Structured diff
  
  # Context
  change_reason: text
  conversation_id: string
  
  # Version
  version_number: int
  version_tag: string
  
  # Metadata
  weight: 0.3  # History typically lower weight
  trust: 0.0  # ✅ Only owner sees their own history (cross-user blocked)
  tags: array
```

---

## Cost & Storage Considerations

### Storage Cost Analysis

**Assumptions**:
- Average action memory: ~2KB
- Average audit memory: ~1KB
- Average event-log memory: ~1.5KB
- Average history memory: ~1KB

**Scenarios**:

#### Light User (100 actions/month)
```
Actions: 100 × 2KB = 200KB/month = 2.4MB/year
Audit: 200 × 1KB = 200KB/month = 2.4MB/year
Event-log: 50 × 1.5KB = 75KB/month = 900KB/year
History: 150 × 1KB = 150KB/month = 1.8MB/year
Total: ~7.5MB/year
Cost: ~$0.75/year (at $0.10/GB)
```

#### Active User (1000 actions/month)
```
Actions: 1000 × 2KB = 2MB/month = 24MB/year
Audit: 2000 × 1KB = 2MB/month = 24MB/year
Event-log: 500 × 1.5KB = 750KB/month = 9MB/year
History: 1500 × 1KB = 1.5MB/month = 18MB/year
Total: ~75MB/year
Cost: ~$7.50/year
```

#### Power User (10,000 actions/month)
```
Actions: 10,000 × 2KB = 20MB/month = 240MB/year
Audit: 20,000 × 1KB = 20MB/month = 240MB/year
Event-log: 5,000 × 1.5KB = 7.5MB/month = 90MB/year
History: 15,000 × 1KB = 15MB/month = 180MB/year
Total: ~750MB/year
Cost: ~$75/year
```

### Cost Mitigation Strategies

#### 1. **Retention Policies**
```yaml
RetentionPolicy:
  action:
    default_retention: 90_days
    important_retention: 1_year  # weight > 0.7
    archive_after: 1_year
    
  audit:
    default_retention: 1_year  # Compliance requirement
    compliance_retention: 7_years  # For specific compliance tags
    never_delete: true  # For critical security events
    
  event-log:
    default_retention: 30_days
    error_retention: 90_days
    archive_after: 90_days
    
  history:
    default_retention: 180_days
    keep_major_versions: true  # Keep v1.0, v2.0, etc.
    compress_after: 90_days
```

#### 2. **Selective Logging**
```yaml
LoggingPolicy:
  # Only log significant actions
  action:
    min_weight: 0.3  # Don't log trivial actions
    skip_types: ["read_only", "view"]
    
  # Audit everything security-related
  audit:
    always_log: ["auth", "permission", "security"]
    sample_rate: 0.1  # Sample 10% of routine events
    
  # Event-log sampling
  event-log:
    sample_rate: 0.2  # Log 20% of routine events
    always_log_errors: true
```

#### 3. **Compression & Archival**
```yaml
ArchivalStrategy:
  # Compress old memories
  compress_after_days: 90
  compression_ratio: 0.3  # 70% size reduction
  
  # Move to cold storage
  archive_after_days: 365
  cold_storage_cost: 0.01  # $0.01/GB vs $0.10/GB
  
  # Aggregate old data
  aggregate_after_days: 180
  aggregation_level: "daily"  # Daily summaries instead of individual events
```

#### 4. **Smart Summarization**
```yaml
SummarizationStrategy:
  # Summarize old action sequences
  summarize_after_days: 60
  summary_format: "daily_digest"
  
  # Example: Instead of 100 individual "email_sent" actions
  # Store: "Sent 100 emails in February 2026"
  
  keep_original: false  # Delete originals after summarization
  keep_important: true  # Keep high-weight originals
```

### Recommendation: **Hybrid Approach**

```yaml
RecommendedStrategy:
  # Critical for trust & transparency
  action:
    enabled: true
    retention: 90_days
    min_weight: 0.4
    archive: true
    
  # Required for compliance
  audit:
    enabled: true
    retention: 1_year
    compliance_retention: 7_years
    never_delete_critical: true
    
  # Optional, can be disabled
  event-log:
    enabled: false  # Disable by default
    enable_for_debugging: true
    sample_rate: 0.1
    
  # Useful but expensive
  history:
    enabled: true
    retention: 180_days
    keep_major_versions_only: true
    compress_after: 30_days
```

**Estimated Cost for Typical User**:
- Actions (filtered): ~5MB/year
- Audit (required): ~10MB/year
- Event-log (disabled): 0MB/year
- History (compressed): ~2MB/year
- **Total: ~17MB/year = ~$1.70/year**

---

## Access Count Weighting in Search

### Current Weight Formula Enhancement

**Original Weight Factors** (from requirements):
```
weight = user_specified_weight (0-1)
```

**Enhanced Weight Formula**:
```typescript
effective_weight = base_weight * access_multiplier * recency_multiplier * relationship_multiplier

where:
  base_weight = user_specified_weight (0-1)
  
  access_multiplier = 1 + (access_count / max_access_count) * 0.5
  // Frequently accessed memories get up to 50% boost
  
  recency_multiplier = 1 + (days_since_access < 7 ? 0.3 : 0)
  // Recently accessed memories get 30% boost
  
  relationship_multiplier = 1 + (relationship_count / 10) * 0.2
  // Well-connected memories get up to 20% boost
```

### Access Count Tracking

**Memory Schema Addition**:
```yaml
Memory:
  # ... existing fields ...
  
  # Access Tracking
  access_count: int              # Total times accessed
  last_accessed_at: datetime     # Most recent access
  access_frequency: float        # Accesses per day
  access_history: array          # Recent access timestamps (last 100)
  
  # Computed Weight
  base_weight: float             # User-specified (0-1)
  computed_weight: float         # Calculated effective weight
  weight_factors: object         # Breakdown of weight calculation
```

### Search Ranking Algorithm

```typescript
function rankSearchResults(results: Memory[], query: string): Memory[] {
  return results
    .map(memory => ({
      memory,
      score: calculateScore(memory, query)
    }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.memory);
}

function calculateScore(memory: Memory, query: string): number {
  // Base semantic similarity score (0-1)
  const semanticScore = memory.embedding_similarity;
  
  // Weight multiplier (0.5 - 2.0)
  const weightMultiplier = 0.5 + (memory.computed_weight * 1.5);
  
  // Access frequency boost (0-0.3)
  const accessBoost = Math.min(memory.access_frequency / 10, 0.3);
  
  // Recency boost (0-0.2)
  const daysSinceAccess = daysBetween(now(), memory.last_accessed_at);
  const recencyBoost = daysSinceAccess < 7 ? 0.2 : 
                       daysSinceAccess < 30 ? 0.1 : 0;
  
  // Relationship boost (0-0.2)
  const relationshipBoost = Math.min(memory.relationships.length / 20, 0.2);
  
  // Final score
  return semanticScore * weightMultiplier + accessBoost + recencyBoost + relationshipBoost;
}
```

### Access Count Update Strategy

**When to Increment Access Count**:
```typescript
AccessCountPolicy:
  increment_on:
    - remember_search_memory: true  # Found in search results
    - remember_find_similar: true   # Used as reference
    - remember_query_memory: true   # Returned in GraphQL query
    - remember_update_memory: false # Don't count updates
    - remember_delete_memory: false # Don't count deletes
    
  increment_rules:
    - only_if_in_top_results: true  # Only count if in top 10 results
    - only_if_user_viewed: true     # Only if user actually viewed it
    - debounce_seconds: 60          # Don't count multiple accesses within 60s
```

### Weight Decay Over Time

```typescript
WeightDecayPolicy:
  enabled: true
  decay_function: "exponential"
  half_life_days: 90  # Weight halves every 90 days without access
  
  // Example: Memory with base_weight=0.8, not accessed for 90 days
  // effective_weight = 0.8 * 0.5 = 0.4
  // After 180 days: 0.8 * 0.25 = 0.2
  
  prevent_decay_if:
    - has_relationships: true  # Connected memories don't decay
    - marked_permanent: true   # User can mark as permanent
    - access_count > 100       # Frequently accessed memories don't decay
```

### Example Search with Access Weighting

```typescript
// User searches for "camping"
remember_search_memory({
  query: "camping",
  limit: 10
})

// Results ranked by:
// 1. "Yosemite camping trip 2025" 
//    - semantic_score: 0.95
//    - base_weight: 0.7
//    - access_count: 45 (accessed many times)
//    - last_accessed: 2 days ago
//    - relationships: 8
//    - FINAL SCORE: 1.82

// 2. "Camping gear checklist"
//    - semantic_score: 0.90
//    - base_weight: 0.8
//    - access_count: 120 (template, heavily used)
//    - last_accessed: 1 day ago
//    - relationships: 3
//    - FINAL SCORE: 1.75

// 3. "Camping trip ideas 2024"
//    - semantic_score: 0.85
//    - base_weight: 0.5
//    - access_count: 2 (rarely accessed)
//    - last_accessed: 180 days ago
//    - relationships: 0
//    - FINAL SCORE: 0.92
```

---

## Implementation Recommendations

### Phase 1: Core Action Tracking
1. Implement `action` memory type
2. Add access count tracking to Memory schema
3. Implement basic weight calculation with access multiplier
4. Add retention policies

### Phase 2: Audit & Compliance
1. Implement `audit` memory type
2. Add compliance tagging
3. Implement retention policies for audit logs
4. Add immutability for audit records

### Phase 3: Advanced Features
1. Implement `history` memory type
2. Add weight decay algorithm
3. Implement compression and archival
4. Add smart summarization

### Phase 4: Optional Event Logging
1. Implement `event-log` memory type (opt-in)
2. Add sampling and filtering
3. Implement aggregation strategies

---

## Benefits

### For Users
- **Transparency**: See what the agent did
- **Trust**: Audit trail builds confidence
- **Learning**: Understand agent behavior patterns
- **Control**: Review and manage agent actions

### For System
- **Debugging**: Track down issues
- **Optimization**: Identify frequently accessed memories
- **Compliance**: Meet regulatory requirements
- **Security**: Detect anomalous behavior

### For Search
- **Relevance**: Frequently accessed memories rank higher
- **Personalization**: Learn user preferences from access patterns
- **Freshness**: Recently accessed memories stay relevant
- **Context**: Connected memories surface together

---

**Status**: Proposal for Review  
**Estimated Additional Cost**: $1-2/user/year with recommended strategy  
**Recommendation**: Implement action + audit types, make event-log optional
