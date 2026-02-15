# Core Memory / User Profile

**Concept**: A special system memory that tracks metadata about a user's memories and inferred profile information to enable better discovery and context-aware operations.

**Created**: 2026-02-15
**Status**: Design Specification

---

## Overview

The Core Memory is a special system-type memory document that solves the "cold start" problem where users don't know what to query for. It provides:

1. **Memory Discovery**: Statistics and metadata about what memories exist
2. **User Context**: Inferred profile information about the user
3. **Query Suggestions**: Hints for effective memory searches
4. **Agent Context**: Quick overview for agents to understand the user

This document is automatically created and maintained by the system, requiring no user intervention.

**Key Design**: Uses simple ID `"core"` since collections are already scoped to user ID.

---

## Problem Statement

**Current Issues:**
1. Users don't know what memories they have stored
2. Agents lack context about the user when starting conversations
3. No way to discover what topics/types of memories exist
4. Cold start problem: "What should I search for?"
5. No persistent understanding of user identity across sessions

**User Stories:**
- "What memories do I have?" → Should show overview
- "Tell me about myself" → Should provide user profile
- "What can I search for?" → Should suggest topics
- Agent needs context about user's profession, location, interests

---

## Solution

### Core Memory Document

A special memory document with:
- **Type**: `system` (existing content type)
- **ID**: `"core"` (simple, well-known ID - collections are already scoped to user)
- **Auto-created**: On first memory operation if doesn't exist
- **Auto-updated**: Incrementally on memory/relationship operations
- **Searchable**: Like other memories, but marked as system type

### Why Option 1 (System Memory)?

✅ **Advantages:**
- Leverages existing memory infrastructure
- Searchable via vector embeddings
- No separate storage system needed
- Can be queried like any other memory
- Consistent with existing architecture
- Can use relationships to link to key memories

❌ **Disadvantages:**
- Slightly slower than Firestore lookup
- Counts toward memory storage
- Must be filtered out of normal searches (unless user wants it)

---

## Implementation

### 1. Core Memory Structure

```typescript
interface CoreMemory extends Memory {
  // Standard Memory fields
  id: 'core'; // Simple ID - collections are scoped to user
  user_id: string;
  doc_type: 'memory';
  type: 'system'; // Uses existing system content type
  
  // Content (human-readable summary)
  content: string; // Natural language summary for vector search
  title: 'User Profile & Memory Overview';
  
  // Structured metadata
  structured_content: {
    // Memory Statistics
    statistics: {
      total_memories: number;
      total_relationships: number;
      memory_by_type: Record<ContentType, number>;
      common_tags: Array<{ tag: string; count: number }>;
      date_range: {
        oldest: string; // ISO 8601
        newest: string; // ISO 8601
      };
      last_updated: string; // ISO 8601
    };
    
    // User Profile (inferred from memories)
    profile: {
      // Professional
      occupation?: string;
      company?: string;
      skills?: string[];
      
      // Personal
      location?: {
        city?: string;
        country?: string;
        timezone?: string;
      };
      interests?: string[];
      hobbies?: string[];
      
      // Relationships
      key_people?: Array<{
        name: string;
        relationship: string;
        memory_id?: string; // Link to person memory
      }>;
      
      // Important Dates
      important_dates?: Array<{
        date: string;
        description: string;
        type: 'birthday' | 'anniversary' | 'event';
      }>;
      
      // Personality & Communication Style (LLM-inferred)
      personality?: {
        traits?: string[]; // e.g., ["analytical", "creative", "detail-oriented"]
        communication_style?: string; // e.g., "Direct and concise" or "Warm and conversational"
        values?: string[]; // e.g., ["efficiency", "creativity", "collaboration"]
        working_style?: string; // e.g., "Prefers structured planning"
        tone_preferences?: string; // e.g., "Professional but friendly"
      };
      
      // Confidence scores for inferred data
      confidence: Record<string, number>; // 0-1 for each field
    };
    
    // Content Categories
    categories: {
      top_types: Array<{ type: ContentType; count: number }>;
      active_projects?: string[];
      recurring_themes?: string[];
      frequent_topics?: string[];
    };
    
    // Discovery Hints
    discovery: {
      sample_queries: string[]; // Suggested queries that would work well
      key_topics: string[]; // Main topics to explore
      memory_clusters?: Array<{
        topic: string;
        count: number;
        sample_ids: string[];
      }>;
    };
    
    // Representative Memory Snippets (for context)
    snippets?: {
      recent: Array<{
        memory_id: string;
        type: ContentType;
        excerpt: string; // First 200 chars
        date: string;
      }>;
      significant: Array<{
        memory_id: string;
        type: ContentType;
        excerpt: string;
        weight: number;
        why_significant: string; // LLM-generated explanation
      }>;
      personality_revealing: Array<{
        memory_id: string;
        excerpt: string;
        reveals: string; // What this reveals about the user
      }>;
    };
    
    // Natural Language Insights (LLM-generated)
    insights?: {
      summary: string; // 2-3 sentence overview of who the user is
      patterns: string[]; // Observed patterns (e.g., "Frequently saves technical documentation on weekends")
      focus_areas: string[]; // What the user focuses on (e.g., "Career development and outdoor activities")
      communication_notes: string; // How to best communicate with this user
      last_generated: string; // ISO 8601
    };
    
    // Metadata
    version: number; // Schema version
    last_full_rebuild?: string; // ISO 8601
    update_count: number; // Number of incremental updates
  };
  
  // Standard memory fields
  weight: 1.0; // Always high priority
  trust: 1.0; // System-generated, fully trusted
  tags: ['system', 'profile', 'core'];
  context: MemoryContext; // Standard context
}
```

### 2. Content Generation

The `content` field should be a rich natural language summary for vector search, including personality insights and representative snippets.

**Simple Template-Based Generation** (for incremental updates):
```typescript
function generateCoreMemoryContentSimple(data: CoreMemory['structured_content']): string {
  const parts: string[] = [];
  
  // User profile summary
  if (data.profile.occupation) {
    parts.push(`User works as a ${data.profile.occupation}`);
  }
  if (data.profile.location?.city) {
    parts.push(`Lives in ${data.profile.location.city}`);
  }
  if (data.profile.interests?.length) {
    parts.push(`Interested in ${data.profile.interests.join(', ')}`);
  }
  
  // Personality (if available)
  if (data.profile.personality?.traits?.length) {
    parts.push(`Personality traits: ${data.profile.personality.traits.join(', ')}`);
  }
  
  // Memory statistics
  parts.push(`Has ${data.statistics.total_memories} memories stored`);
  
  // Top content types
  const topTypes = data.categories.top_types.slice(0, 3);
  if (topTypes.length) {
    const typeList = topTypes.map(t => `${t.count} ${t.type}`).join(', ');
    parts.push(`Most common memory types: ${typeList}`);
  }
  
  // Key topics
  if (data.discovery.key_topics.length) {
    parts.push(`Key topics: ${data.discovery.key_topics.join(', ')}`);
  }
  
  // Insights summary (if available)
  if (data.insights?.summary) {
    parts.push(data.insights.summary);
  }
  
  return parts.join('. ') + '.';
}
```

**LLM-Enhanced Generation** (for full rebuilds):
```typescript
import { completeLLM } from '../llm/factory.js';

async function generateCoreMemoryContentLLM(
  data: CoreMemory['structured_content'],
  recentMemories: Memory[]
): Promise<string> {
  // Sample diverse memories for personality analysis
  const memorySnippets = recentMemories.slice(0, 20).map(m => ({
    type: m.type,
    title: m.title,
    content: m.content.substring(0, 300),
    tags: m.tags,
    date: m.created_at,
  }));
  
  const context = {
    statistics: data.statistics,
    profile: data.profile,
    categories: data.categories,
    memory_snippets: memorySnippets,
  };
  
  const prompt = `Generate a comprehensive natural language summary of this user's profile, personality, and memory collection.
This summary will be used for semantic search and agent context, so make it rich and descriptive.

User Data:
${JSON.stringify(context, null, 2)}

Generate a 3-4 paragraph summary that captures:

1. **Who the user is**: Occupation, location, interests, key relationships
2. **Personality & Communication**: Communication style, values, working preferences, tone
3. **Memory patterns**: What types of content they save, recurring themes, focus areas
4. **Notable insights**: Patterns in their behavior, what matters to them, how they organize information

Include specific examples from their memories when relevant. Make it conversational, searchable, and insightful.
Focus on facts evident in the data, but infer personality traits from patterns.`;

  const result = await completeLLM([
    {
      role: 'system',
      content: 'You are a profile and personality analysis assistant. Generate rich, insightful summaries that capture both facts and personality.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ], {
    temperature: 0.7,
    maxTokens: 800,
  });
  
  return result.content;
}
```

### 3. Auto-Creation

```typescript
async function ensureCoreMemory(userId: string): Promise<CoreMemory> {
  const coreId = 'core'; // Simple ID - collections are scoped to user
  
  try {
    // Try to fetch existing core memory
    const existing = await getMemoryById(coreId, userId);
    return existing as CoreMemory;
  } catch (error) {
    // Doesn't exist, create it
    const coreMemory: CoreMemory = {
      id: coreId,
      user_id: userId,
      doc_type: 'memory',
      type: 'system',
      title: 'User Profile & Memory Overview',
      content: 'User profile and memory overview. No memories stored yet.',
      structured_content: {
        statistics: {
          total_memories: 0,
          total_relationships: 0,
          memory_by_type: {},
          common_tags: [],
          date_range: { oldest: '', newest: '' },
          last_updated: new Date().toISOString(),
        },
        profile: {
          confidence: {},
        },
        categories: {
          top_types: [],
        },
        discovery: {
          sample_queries: [
            'What memories do I have?',
            'Show me recent notes',
            'What projects am I working on?',
          ],
          key_topics: [],
        },
        version: 1,
        update_count: 0,
      },
      weight: 1.0,
      trust: 1.0,
      base_weight: 1.0,
      tags: ['system', 'profile', 'core'],
      relationships: [],
      access_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      location: {
        gps: null,
        address: null,
        source: 'unavailable',
        confidence: 0,
        is_approximate: false,
      },
      context: {
        timestamp: new Date().toISOString(),
        source: {
          type: 'system',
          platform: 'remember-mcp',
        },
        tags: ['system', 'auto-generated'],
      },
    };
    
    await createMemory(coreMemory, userId);
    return coreMemory;
  }
}
```

### 4. Incremental Updates

Update core memory on every memory/relationship operation. **This runs synchronously but is fast** (no LLM calls):

```typescript
async function updateCoreMemoryIncremental(
  userId: string,
  operation: 'create' | 'update' | 'delete',
  memory: Memory | Relationship
): Promise<void> {
  const coreMemory = await ensureCoreMemory(userId);
  const data = coreMemory.structured_content;
  
  // Update statistics
  if (operation === 'create') {
    if (memory.doc_type === 'memory') {
      data.statistics.total_memories++;
      const type = (memory as Memory).type;
      data.statistics.memory_by_type[type] =
        (data.statistics.memory_by_type[type] || 0) + 1;
    } else {
      data.statistics.total_relationships++;
    }
  } else if (operation === 'delete') {
    if (memory.doc_type === 'memory') {
      data.statistics.total_memories--;
      const type = (memory as Memory).type;
      data.statistics.memory_by_type[type]--;
    } else {
      data.statistics.total_relationships--;
    }
  }
  
  // Update tags
  if (memory.tags) {
    updateCommonTags(data.statistics.common_tags, memory.tags, operation);
  }
  
  // Update date range
  updateDateRange(data.statistics.date_range, memory.created_at);
  
  // Infer profile updates (if memory contains relevant info)
  if (memory.doc_type === 'memory') {
    inferProfileUpdates(data.profile, memory as Memory);
  }
  
  // Update metadata
  data.statistics.last_updated = new Date().toISOString();
  data.update_count++;
  
  // Regenerate content for vector search (simple template-based, fast)
  coreMemory.content = generateCoreMemoryContentSimple(data);
  coreMemory.updated_at = new Date().toISOString();
  coreMemory.version++;
  
  // Save
  await updateMemory(coreMemory.id, coreMemory, userId);
  
  // Schedule full rebuild if needed (every 100 updates)
  // This runs in the background and doesn't block the response
  if (data.update_count % 100 === 0) {
    scheduleFullRebuildBackground(userId).catch(error => {
      console.error('[Core Memory] Background rebuild failed:', error);
    });
  }
}
```

### 5. Profile Inference

**Simple Rule-Based Inference** (for incremental updates):
```typescript
function inferProfileUpdates(profile: CoreMemory['structured_content']['profile'], memory: Memory): void {
  const content = memory.content.toLowerCase();
  const type = memory.type;
  
  // Infer occupation
  if (type === 'person' && memory.structured_content?.job_title) {
    profile.occupation = memory.structured_content.job_title;
    profile.confidence.occupation = 0.8;
  }
  
  // Infer location from memory location data
  if (memory.location?.address?.city) {
    profile.location = profile.location || {};
    profile.location.city = memory.location.address.city;
    profile.location.country = memory.location.address.country;
    profile.confidence.location = memory.location.confidence;
  }
  
  // Infer interests from tags and content
  if (memory.tags) {
    profile.interests = profile.interests || [];
    for (const tag of memory.tags) {
      if (!profile.interests.includes(tag) && isInterestTag(tag)) {
        profile.interests.push(tag);
      }
    }
  }
  
  // Infer key people from person memories
  if (type === 'person' && memory.structured_content?.name) {
    profile.key_people = profile.key_people || [];
    const person = {
      name: memory.structured_content.name,
      relationship: memory.structured_content.relationship || 'contact',
      memory_id: memory.id,
    };
    
    // Update or add
    const existing = profile.key_people.find(p => p.name === person.name);
    if (existing) {
      Object.assign(existing, person);
    } else {
      profile.key_people.push(person);
    }
  }
  
  // More inference rules...
}
```

**LLM-Enhanced Inference** (for full rebuilds):
```typescript
import { completeLLM } from '../llm/factory.js';

async function inferProfileFromMemoriesLLM(memories: Memory[]): Promise<CoreMemory['structured_content']['profile']> {
  // Sample memories for analysis (don't send all to LLM)
  const sampleMemories = memories
    .filter(m => m.type !== 'system')
    .slice(0, 50)
    .map(m => ({
      type: m.type,
      content: m.content.substring(0, 300),
      tags: m.tags,
      structured_content: m.structured_content,
      location: m.location?.address,
    }));
  
  const prompt = `Analyze these memories and infer information about the user. Be conservative - only infer what's clearly evident.

Memories:
${JSON.stringify(sampleMemories, null, 2)}

Infer and return JSON with:
{
  "occupation": "string or null",
  "company": "string or null",
  "skills": ["array of strings"],
  "location": {
    "city": "string or null",
    "country": "string or null"
  },
  "interests": ["array of strings"],
  "hobbies": ["array of strings"],
  "key_people": [
    {
      "name": "string",
      "relationship": "string"
    }
  ],
  "confidence": {
    "occupation": 0.0-1.0,
    "location": 0.0-1.0,
    "interests": 0.0-1.0
  }
}

Only include fields where you have evidence. Use confidence scores to indicate certainty.`;

  const result = await completeLLM([
    {
      role: 'system',
      content: 'You are a profile inference assistant. Analyze memories and extract factual information about the user. Be conservative and accurate.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ], {
    temperature: 0.3, // Low temperature for factual inference
    maxTokens: 1000,
  });
  
  try {
    const inferred = JSON.parse(result.content);
    return inferred;
  } catch (error) {
    console.error('[Core Memory] Failed to parse LLM inference result:', error);
    // Fall back to empty profile
    return { confidence: {} };
  }
}
```

### 6. Background Processing

**Critical**: Full rebuilds with LLM must run in the background to avoid blocking tool responses.

#### Background Job Queue

Use a simple in-memory queue with Firestore for persistence:

```typescript
// src/services/background-jobs.service.ts

interface BackgroundJob {
  id: string;
  type: 'core_memory_rebuild';
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

class BackgroundJobService {
  private runningJobs = new Map<string, Promise<void>>();
  
  async scheduleJob(type: string, userId: string): Promise<string> {
    const jobId = `${type}-${userId}-${Date.now()}`;
    
    const job: BackgroundJob = {
      id: jobId,
      type: type as any,
      userId,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    
    // Store in Firestore for persistence
    await saveJobToFirestore(job);
    
    // Start processing (don't await - fire and forget)
    this.processJob(job).catch(error => {
      console.error(`[Background Jobs] Job ${jobId} failed:`, error);
    });
    
    return jobId;
  }
  
  private async processJob(job: BackgroundJob): Promise<void> {
    // Prevent duplicate processing
    if (this.runningJobs.has(job.id)) {
      return;
    }
    
    const promise = this.executeJob(job);
    this.runningJobs.set(job.id, promise);
    
    try {
      await promise;
    } finally {
      this.runningJobs.delete(job.id);
    }
  }
  
  private async executeJob(job: BackgroundJob): Promise<void> {
    try {
      // Update status to running
      job.status = 'running';
      job.started_at = new Date().toISOString();
      await updateJobInFirestore(job);
      
      // Execute based on type
      switch (job.type) {
        case 'core_memory_rebuild':
          await rebuildCoreMemoryWithLLM(job.userId);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }
      
      // Mark as completed
      job.status = 'completed';
      job.completed_at = new Date().toISOString();
      await updateJobInFirestore(job);
      
      console.log(`[Background Jobs] Job ${job.id} completed`);
    } catch (error) {
      // Mark as failed
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.completed_at = new Date().toISOString();
      await updateJobInFirestore(job);
      
      throw error;
    }
  }
  
  async getJobStatus(jobId: string): Promise<BackgroundJob | null> {
    return await getJobFromFirestore(jobId);
  }
}

export const backgroundJobs = new BackgroundJobService();
```

#### Schedule Background Rebuild

```typescript
async function scheduleFullRebuildBackground(userId: string): Promise<void> {
  // Fire and forget - don't await
  backgroundJobs.scheduleJob('core_memory_rebuild', userId).catch(error => {
    console.error('[Core Memory] Failed to schedule rebuild:', error);
  });
  
  console.log(`[Core Memory] Scheduled background rebuild for user ${userId}`);
}
```

#### Full Rebuild with LLM

This runs in the background and can take several seconds:

```typescript
async function rebuildCoreMemoryWithLLM(userId: string): Promise<void> {
  console.log(`[Core Memory] Starting LLM-enhanced rebuild for user ${userId}`);
  
  // Fetch all memories and relationships
  const allMemories = await getAllMemories(userId);
  const allRelationships = await getAllRelationships(userId);
  
  // Build statistics from scratch (fast, no LLM)
  const statistics = buildStatistics(allMemories, allRelationships);
  
  // Infer profile using LLM (slow, 2-5 seconds)
  const profile = await inferProfileFromMemoriesLLM(allMemories);
  
  // Build categories (fast, no LLM)
  const categories = buildCategories(allMemories);
  
  // Generate discovery hints (fast, no LLM)
  const discovery = generateDiscoveryHints(allMemories, statistics);
  
  // Create new core memory
  const coreMemory = await ensureCoreMemory(userId);
  coreMemory.structured_content = {
    statistics,
    profile,
    categories,
    discovery,
    version: 1,
    last_full_rebuild: new Date().toISOString(),
    update_count: 0,
  };
  
  // Generate content using LLM (slow, 2-5 seconds)
  coreMemory.content = await generateCoreMemoryContentLLM(
    coreMemory.structured_content,
    allMemories.slice(0, 20) // Recent memories for context
  );
  
  coreMemory.updated_at = new Date().toISOString();
  coreMemory.version++;
  
  await updateMemory(coreMemory.id, coreMemory, userId);
  
  console.log(`[Core Memory] Completed LLM-enhanced rebuild for user ${userId}`);
}
```

#### Process Lifecycle Management

**Important**: Node.js will NOT terminate background promises if:
1. The event loop has pending work
2. The promise is properly tracked

**Our approach**:
- Store job status in Firestore (persists across restarts)
- Track running jobs in memory
- Log all job lifecycle events
- Handle errors gracefully
- Don't block tool responses

**If server restarts mid-job**:
- Job status in Firestore shows "running"
- On restart, can detect stale jobs and retry
- Core memory will have last successful state
- Next incremental update will continue normally

#### Firestore Job Storage

```typescript
// src/services/background-jobs-firestore.ts

async function saveJobToFirestore(job: BackgroundJob): Promise<void> {
  const db = getFirestore();
  await db.collection('background_jobs').doc(job.id).set(job);
}

async function updateJobInFirestore(job: BackgroundJob): Promise<void> {
  const db = getFirestore();
  await db.collection('background_jobs').doc(job.id).update(job);
}

async function getJobFromFirestore(jobId: string): Promise<BackgroundJob | null> {
  const db = getFirestore();
  const doc = await db.collection('background_jobs').doc(jobId).get();
  return doc.exists ? (doc.data() as BackgroundJob) : null;
}

// Clean up old completed jobs (run periodically)
async function cleanupOldJobs(): Promise<void> {
  const db = getFirestore();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7); // Keep 7 days
  
  const oldJobs = await db
    .collection('background_jobs')
    .where('completed_at', '<', cutoff.toISOString())
    .get();
  
  const batch = db.batch();
  oldJobs.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  
  console.log(`[Background Jobs] Cleaned up ${oldJobs.size} old jobs`);
}
```

---

## Tool Integration

### New Tool: `remember_get_profile`

```typescript
export const getProfileTool = {
  name: 'remember_get_profile',
  description: `Get user profile and memory overview.
  
  Returns a comprehensive overview of:
  - User profile (occupation, location, interests)
  - Memory statistics (counts by type, common tags)
  - Discovery hints (suggested queries, key topics)
  - Content categories (top types, active projects)
  
  Use this when:
  - User asks "What memories do I have?"
  - User asks "Tell me about myself"
  - You need context about the user
  - User doesn't know what to search for
  
  This is automatically maintained and requires no user input.
  `,
  inputSchema: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['detailed', 'summary'],
        default: 'detailed',
        description: 'Return full profile or just summary',
      },
    },
  },
};

export async function handleGetProfile(
  args: { format?: 'detailed' | 'summary' },
  userId: string
): Promise<string> {
  const coreMemory = await ensureCoreMemory(userId);
  
  if (args.format === 'summary') {
    // Return just the content (natural language summary)
    return JSON.stringify({
      summary: coreMemory.content,
      total_memories: coreMemory.structured_content.statistics.total_memories,
      key_topics: coreMemory.structured_content.discovery.key_topics,
    }, null, 2);
  }
  
  // Return full structured data
  return JSON.stringify(coreMemory.structured_content, null, 2);
}
```

### Update Existing Tools

All memory/relationship tools should call `updateCoreMemoryIncremental`:

```typescript
// In create-memory.ts
export async function handleCreateMemory(args: any, userId: string): Promise<string> {
  // ... existing create logic ...
  const memory = await createMemory(memoryData, userId);
  
  // Update core memory
  await updateCoreMemoryIncremental(userId, 'create', memory);
  
  return JSON.stringify(memory, null, 2);
}

// Similar for update-memory, delete-memory, create-relationship, etc.
```

---

## Benefits

### For Users
1. **Discovery**: "What memories do I have?" → Get overview
2. **Context**: "Tell me about myself" → Get profile
3. **Suggestions**: "What can I search for?" → Get hints
4. **Understanding**: See what the system knows about them

### For Agents
1. **Context**: Understand user before responding
2. **Better queries**: Know what topics exist
3. **Personalization**: Tailor responses to user profile
4. **Efficiency**: Quick overview without scanning all memories

### For System
1. **Analytics**: Track usage patterns
2. **Quality**: Identify gaps in memory coverage
3. **Optimization**: Suggest memory organization improvements
4. **Trust**: Transparent about what's stored

---

## Privacy & Security

### Inference Opt-Out

Users should be able to disable profile inference:

```typescript
// In user preferences
interface UserPreferences {
  // ... existing preferences ...
  core_memory: {
    enable_profile_inference: boolean; // Default: true
    enable_discovery_hints: boolean; // Default: true
    visible_to_user: boolean; // Default: true
  };
}
```

### Accuracy Concerns

- All inferred data includes confidence scores
- Users can view and correct inferred profile data
- System should indicate "inferred" vs "explicit" data
- Provide tool to manually update profile fields

### Data Minimization

- Only infer data that's useful for discovery
- Don't store sensitive inferred data
- Respect user's trust levels on source memories
- Allow users to delete profile data

---

## Trade-offs

### Advantages
✅ Solves cold start problem  
✅ Provides agent context  
✅ Enables discovery  
✅ Leverages existing infrastructure  
✅ Searchable via vector embeddings  
✅ Automatically maintained  

### Disadvantages
❌ Additional storage overhead  
❌ Update latency on every operation  
❌ Inference may be inaccurate  
❌ Privacy concerns with automatic inference  
❌ Complexity in maintaining consistency  

### Mitigations
- Incremental updates keep latency low
- Full rebuilds ensure accuracy
- Confidence scores indicate uncertainty
- User preferences control inference
- Clear documentation about what's tracked

---

## Implementation Plan

### Phase 0: Prerequisites (MUST DO FIRST)
**Implement LLM Provider Abstraction** - See [`llm-provider-abstraction.md`](llm-provider-abstraction.md)

This is a **hard dependency** for core memory. The core memory feature relies heavily on LLM calls for:
- Profile inference (personality, communication style)
- Content generation (natural language summaries)
- Insight generation (patterns, focus areas)
- Snippet analysis (why memories are significant)

**Tasks:**
1. Implement LLM provider interface (`src/llm/types.ts`)
2. Implement provider factory (`src/llm/factory.ts`)
3. Implement at least one provider (Bedrock, OpenAI, or Anthropic)
4. Add LLM configuration to `config.ts`
5. Test LLM provider with simple completion
6. Add background job service for async LLM calls

**Estimated Time**: 1-2 days

---

### Phase 1: Core Infrastructure (Without LLM)
**Goal**: Get basic core memory working with template-based generation

1. Define CoreMemory type in `src/types/memory.ts`
2. Implement `ensureCoreMemory()` - auto-create if doesn't exist
3. Implement `updateCoreMemoryIncremental()` with **simple template-based** content generation
4. Add core memory updates to all memory/relationship operations
5. Implement basic rule-based profile inference (no LLM)
6. Test with real memory operations

**Estimated Time**: 2-3 days

**Note**: This phase uses NO LLM calls - everything is template-based and rule-based. Fast but basic.

---

### Phase 2: LLM Integration
**Goal**: Add LLM-enhanced generation for better quality

**Prerequisites**: Phase 0 complete (LLM provider working)

1. Implement `generateCoreMemoryContentLLM()` - rich natural language summaries
2. Implement `inferProfileFromMemoriesLLM()` - personality and communication style
3. Implement `generateSnippetsAndInsights()` - memory analysis
4. Implement background job service for async LLM processing
5. Add `rebuildCoreMemoryWithLLM()` for full rebuilds
6. Test LLM-enhanced vs template-based quality

**Estimated Time**: 2-3 days

---

### Phase 3: Background Processing
**Goal**: Make LLM calls non-blocking

1. Implement `BackgroundJobService` with Firestore persistence
2. Implement `scheduleFullRebuildBackground()` - fire and forget
3. Add job status tracking
4. Add job cleanup (remove old completed jobs)
5. Test that tool responses remain fast
6. Test job recovery after server restart

**Estimated Time**: 1-2 days

---

### Phase 4: Discovery Features
**Goal**: Help users discover what memories they have

1. Generate sample queries based on memory content
2. Identify key topics (can use LLM for clustering)
3. Cluster memories by theme
4. Build discovery hints
5. Add to core memory content

**Estimated Time**: 1-2 days

---

### Phase 5: Tool Integration
**Goal**: Make core memory accessible to agents

1. Create `remember_get_profile` tool
2. Update search/query tool descriptions to mention profile
3. Add profile context to agent system prompts (optional)
4. Test user experience with real queries
5. Document tool usage

**Estimated Time**: 1 day

---

### Phase 6: Optimization & Polish
**Goal**: Improve performance and quality

1. Add caching for frequent core memory access
2. Optimize update performance
3. Monitor storage impact
4. A/B test LLM vs template-based content generation
5. Tune LLM prompts for better inference
6. Add user preferences for opt-out

**Estimated Time**: 2-3 days

---

## Total Estimated Time

- **Phase 0 (LLM Provider)**: 1-2 days
- **Phase 1 (Core Infrastructure)**: 2-3 days
- **Phase 2 (LLM Integration)**: 2-3 days
- **Phase 3 (Background Processing)**: 1-2 days
- **Phase 4 (Discovery)**: 1-2 days
- **Phase 5 (Tool Integration)**: 1 day
- **Phase 6 (Optimization)**: 2-3 days

**Total**: 10-16 days (2-3 weeks)

---

## Recommended Approach

**Option 1: Full Implementation** (Recommended)
- Implement all phases in order
- Get LLM provider working first
- Full-featured core memory with personality insights

**Option 2: MVP First**
- Implement Phase 1 only (no LLM)
- Basic core memory with template-based generation
- Add LLM later when provider is ready
- Faster to market but less powerful

**Option 3: Parallel Development**
- One developer on LLM provider (Phase 0)
- Another on core infrastructure (Phase 1)
- Merge when both complete
- Fastest but requires coordination

---

## LLM Integration Benefits

### Why Use LLM for Core Memory?

**1. Better Content Generation**
- Template-based: "User works as a developer. Lives in Seattle. Interested in hiking, coding."
- LLM-based: "This user is a software developer based in Seattle who actively tracks their professional projects and personal interests. They frequently save memories about hiking trips in the Pacific Northwest and technical documentation about web development. Their memory collection shows a balance between work-related notes and outdoor activities."

**2. More Accurate Inference**
- Rule-based: Can only detect explicit patterns
- LLM-based: Can understand context, implicit information, and relationships

**3. Semantic Search Quality**
- Better content → better vector embeddings → better search results
- Natural language summaries are more searchable than structured lists

**4. Adaptive Learning**
- LLM can identify emerging patterns that rules might miss
- Can adjust inference based on memory content evolution

### Trade-offs

**Advantages:**
- ✅ Higher quality content and inference
- ✅ Better semantic search results
- ✅ More natural language summaries
- ✅ Can understand context and nuance

**Disadvantages:**
- ❌ Slower (LLM API calls)
- ❌ More expensive (LLM costs)
- ❌ Requires LLM provider setup
- ❌ Potential for hallucination (mitigated by low temperature)

### Hybrid Approach (Recommended)

**Incremental Updates**: Use simple template-based generation
- Fast, cheap, deterministic
- Good enough for real-time updates
- No LLM dependency

**Full Rebuilds**: Use LLM-enhanced generation
- High quality, comprehensive
- Run periodically (every 100 updates or weekly)
- Worth the cost for better search quality

This gives us the best of both worlds: fast incremental updates with periodic high-quality LLM enhancement.

---

## What Core Memory Stores

The core memory is much more than just statistics. It captures:

### 1. **Factual Profile Data**
- Occupation, company, skills
- Location, timezone
- Interests, hobbies
- Key relationships

### 2. **Personality Insights** (LLM-inferred)
- Personality traits (analytical, creative, detail-oriented, etc.)
- Communication style (direct, warm, formal, casual)
- Values (efficiency, creativity, collaboration)
- Working preferences (structured vs flexible)
- Tone preferences (professional, friendly, technical)

### 3. **Memory Snippets**
- **Recent memories**: Last 5 memories with excerpts
- **Significant memories**: High-weight memories with explanations of why they're significant
- **Personality-revealing memories**: Memories that reveal aspects of the user's character

### 4. **Natural Language Insights** (LLM-generated)
- **Summary**: 2-3 sentence overview of who the user is
- **Patterns**: Observed behavioral patterns (e.g., "Frequently saves technical docs on weekends")
- **Focus areas**: What the user concentrates on (e.g., "Career development and outdoor activities")
- **Communication notes**: How to best communicate with this user

### 5. **Discovery Metadata**
- Sample queries that would work well
- Key topics to explore
- Memory clusters by theme

### Example Core Memory Content

```
This user is a software engineer based in Seattle who actively tracks both professional
projects and personal interests. They demonstrate strong analytical thinking in their
technical documentation while showing creativity in their project planning. Their
communication style is direct and concise, preferring structured information with clear
action items.

The user maintains a balanced memory collection between work-related notes (45%) and
personal interests (35%), with particular focus on web development, hiking in the Pacific
Northwest, and productivity systems. They value efficiency and organization, as evidenced
by their systematic approach to documenting learnings and maintaining detailed project notes.

Notable patterns include weekend activity in outdoor recreation memories and weekday focus
on technical problem-solving. The user shows consistent interest in continuous learning,
frequently saving articles and tutorials about new technologies.
```

This rich content enables:
- **Better semantic search**: Natural language queries match personality and context
- **Agent personalization**: Agents can adapt tone and style to user preferences
- **Discovery**: Users can explore "What kind of person am I based on my memories?"
- **Context-aware responses**: Agents understand user's background and preferences

---

## Future Enhancements

1. **Smart Suggestions**: "You might want to remember..." based on patterns (LLM-powered)
2. **Memory Health**: "You haven't recorded any goals lately" (LLM analysis)
3. **Relationship Insights**: "You mention Alice in 15 memories" (LLM relationship extraction)
4. **Temporal Patterns**: "You're most active on weekends" (statistical analysis)
5. **Cross-User Insights**: Anonymized patterns across users (opt-in, LLM clustering)
6. **Export**: Download profile as JSON/PDF
7. **Visualization**: Graph of memory types, topics over time
8. **Conversational Profile**: "Tell me about my work projects" → LLM queries core memory
9. **Personality Evolution**: Track how personality traits change over time
10. **Memory Recommendations**: "Based on your interests, you might like..."

---

## Status

**Current**: Design Specification  
**Next Steps**: 
1. Review design with stakeholders
2. Create implementation tasks
3. Build Phase 1 (Core Infrastructure)
4. Test with real user data

**Recommendation**: Implement this feature. It significantly improves user experience and agent effectiveness while leveraging existing infrastructure.
