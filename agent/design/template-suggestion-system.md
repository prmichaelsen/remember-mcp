# Template Suggestion System

**Concept**: Automatic template suggestion when creating memories  
**Created**: 2026-02-11  
**Status**: Design Specification

---

## Overview

When a user creates a new memory, the system can automatically suggest relevant templates based on conversation context, keywords, and patterns. This helps users create structured, consistent memories without manual template selection.

---

## Template Suggestion Flow

### 1. User Initiates Memory Creation

```typescript
// User says: "I just met Sarah at the conference. She's a product manager at Google."

// Agent recognizes this should be a memory
remember_create_memory({
  content: "Met Sarah at conference. Product manager at Google.",
  // No template specified yet
})
```

### 2. System Analyzes Context

```typescript
async function suggestTemplates(
  content: string,
  context: ConversationContext
): Promise<TemplateSuggestion[]> {
  // 1. Extract keywords and entities
  const analysis = await analyzeContent(content);
  // Result: {
  //   keywords: ["met", "conference", "product manager", "Google"],
  //   entities: ["Sarah", "Google"],
  //   intent: "recording_person_information",
  //   context_type: "professional_networking"
  // }
  
  // 2. Query templates with auto_apply enabled
  const templates = await getTemplatesWithAutoApply(context.user_id);
  
  // 3. Score each template
  const scored = templates.map(template => ({
    template,
    score: calculateTemplateScore(template, analysis, context)
  }));
  
  // 4. Return top suggestions
  return scored
    .filter(s => s.score > 0.5)  // Minimum confidence threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)  // Top 3 suggestions
    .map(s => ({
      template_id: s.template.id,
      template_name: s.template.template_name,
      confidence: s.score,
      reason: explainSuggestion(s.template, analysis)
    }));
}
```

### 3. Score Template Relevance

```typescript
function calculateTemplateScore(
  template: Template,
  analysis: ContentAnalysis,
  context: ConversationContext
): number {
  let score = 0;
  
  // Keyword matching (0-0.4)
  const keywordMatch = matchKeywords(
    template.trigger_keywords,
    analysis.keywords
  );
  score += keywordMatch * 0.4;
  
  // Context pattern matching (0-0.3)
  const contextMatch = matchContext(
    template.trigger_context,
    context
  );
  score += contextMatch * 0.3;
  
  // Usage history (0-0.2)
  const usageScore = Math.min(template.usage_count / 100, 1.0);
  score += usageScore * 0.2;
  
  // Recent usage (0-0.1)
  if (template.last_used) {
    const daysSince = daysBetween(now(), template.last_used);
    if (daysSince < 7) {
      score += 0.1;
    }
  }
  
  return Math.min(score, 1.0);
}
```

### 4. Present Suggestions to User

```typescript
// System suggests templates
const suggestions = await suggestTemplates(content, context);

// Present to user
if (suggestions.length > 0) {
  return {
    message: "I found some templates that might help structure this memory:",
    suggestions: [
      {
        template_name: "Person Profile",
        confidence: 0.85,
        reason: "Detected person information with professional context",
        preview_fields: ["name", "company", "job_title", "contact_info"]
      },
      {
        template_name: "Professional Contact",
        confidence: 0.72,
        reason: "Matches professional networking pattern",
        preview_fields: ["name", "company", "linkedin", "notes"]
      }
    ],
    actions: [
      "Use template",
      "Create without template",
      "View template details"
    ]
  };
}
```

### 5. User Selects Template (or Declines)

```typescript
// Option A: User accepts template
remember_create_memory({
  template_id: "template_person_profile_123",
  content: {
    name: "Sarah",
    company: "Google",
    job_title: "Product Manager",
    met_at: "Tech Conference 2026",
    notes: "Discussed product management best practices"
  }
})

// Option B: User declines template
remember_create_memory({
  content: "Met Sarah at conference. Product manager at Google.",
  // No template - free-form memory
})
```

---

## Template Matching Strategies

### 1. Keyword Matching

```typescript
function matchKeywords(
  template_keywords: string[],
  content_keywords: string[]
): number {
  const matches = template_keywords.filter(tk =>
    content_keywords.some(ck => 
      ck.toLowerCase().includes(tk.toLowerCase()) ||
      tk.toLowerCase().includes(ck.toLowerCase())
    )
  );
  
  return matches.length / template_keywords.length;
}

// Example
Template: "Person Profile"
trigger_keywords: ["met", "person", "contact", "introduced"]

Content: "Met Sarah at conference"
keywords: ["met", "sarah", "conference"]

Match: 1/4 = 0.25
```

### 2. Context Pattern Matching

```typescript
function matchContext(
  template_context: TriggerContext,
  actual_context: ConversationContext
): number {
  let score = 0;
  let checks = 0;
  
  // Check location presence
  if (template_context.location_present !== undefined) {
    checks++;
    if ((template_context.location_present && actual_context.location) ||
        (!template_context.location_present && !actual_context.location)) {
      score++;
    }
  }
  
  // Check time of day
  if (template_context.time_of_day) {
    checks++;
    const hour = actual_context.timestamp.getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    if (template_context.time_of_day.includes(timeOfDay)) {
      score++;
    }
  }
  
  // Check conversation type
  if (template_context.conversation_type) {
    checks++;
    if (template_context.conversation_type === actual_context.type) {
      score++;
    }
  }
  
  return checks > 0 ? score / checks : 0;
}
```

### 3. Semantic Similarity

```typescript
async function matchSemanticSimilarity(
  template: Template,
  content: string
): Promise<number> {
  // Get embedding for content
  const contentEmbedding = await getEmbedding(content);
  
  // Get embedding for template description
  const templateEmbedding = await getEmbedding(template.template_description);
  
  // Calculate cosine similarity
  return cosineSimilarity(contentEmbedding, templateEmbedding);
}
```

### 4. Usage Pattern Learning

```typescript
async function learnFromUsage(
  user_id: string,
  content: string,
  selected_template_id: string | null
): Promise<void> {
  // Track what templates user selects for what content
  await recordTemplateSelection({
    user_id,
    content_summary: content.substring(0, 200),
    content_keywords: extractKeywords(content),
    selected_template_id,
    timestamp: new Date()
  });
  
  // Over time, learn user preferences
  // If user always selects "Person Profile" for networking contexts,
  // boost that template's score in similar contexts
}
```

---

## Template Storage & Retrieval

### Template Collection in Weaviate

```yaml
# Collection: Template_{user_id}
Template:
  id: uuid
  user_id: string
  template_name: string
  template_description: string
  
  # Fields definition
  fields: array
  
  # Auto-suggestion config
  auto_apply: boolean
  trigger_keywords: array
  trigger_context: object
  
  # Usage tracking
  usage_count: int
  last_used: datetime
  success_rate: float  # How often user accepts suggestion
  
  # Metadata
  created_at: datetime
  updated_at: datetime
  
  # Vector embedding (for semantic matching)
  embedding: vector
```

### Query Templates

```typescript
async function getRelevantTemplates(
  user_id: string,
  content: string,
  context: ConversationContext
): Promise<Template[]> {
  // 1. Get user's templates with auto_apply enabled
  const userTemplates = await weaviateClient.searchDocuments(
    content,  // Semantic search based on content
    {
      user_id,
      auto_apply: true
    },
    10  // Top 10 templates
  );
  
  // 2. Also check global/shared templates (if any)
  const globalTemplates = await weaviateClient.searchDocuments(
    content,
    {
      user_id: 'global',
      auto_apply: true,
      is_public: true
    },
    5  // Top 5 global templates
  );
  
  return [...userTemplates, ...globalTemplates];
}
```

---

## Example Scenarios

### Scenario 1: Meeting Notes

```typescript
// User says: "Had a great meeting with the design team today"

// System analyzes
analysis = {
  keywords: ["meeting", "design team", "today"],
  intent: "recording_meeting",
  context_type: "work"
}

// Templates queried
templates = [
  {
    name: "Meeting Notes",
    trigger_keywords: ["meeting", "discussed", "team"],
    score: 0.92
  },
  {
    name: "Work Event",
    trigger_keywords: ["work", "team", "project"],
    score: 0.68
  }
]

// Suggestion presented
"Would you like to use the 'Meeting Notes' template? It includes fields for:
- Attendees
- Agenda items
- Decisions made
- Action items"
```

### Scenario 2: Restaurant Visit

```typescript
// User says: "Had amazing sushi at Nobu last night"

// System analyzes
analysis = {
  keywords: ["sushi", "Nobu", "last night"],
  entities: ["Nobu"],
  intent: "recording_experience",
  context_type: "dining",
  location_present: true
}

// Template matched
template = {
  name: "Restaurant Review",
  trigger_keywords: ["restaurant", "ate at", "dinner", "lunch"],
  trigger_context: {
    location_present: true,
    time_of_day: ["lunch", "dinner"]
  },
  score: 0.88
}

// Suggestion
"Would you like to use the 'Restaurant Review' template? It includes:
- Restaurant name
- Cuisine type
- Rating (1-5)
- Favorite dishes
- Would return?"
```

### Scenario 3: Book Finished

```typescript
// User says: "Just finished reading 'The Pragmatic Programmer'"

// System analyzes
analysis = {
  keywords: ["finished reading", "book"],
  entities: ["The Pragmatic Programmer"],
  intent: "recording_completion",
  context_type: "learning"
}

// Template matched
template = {
  name: "Book Review",
  trigger_keywords: ["finished reading", "just read", "book"],
  score: 0.95
}

// Suggestion
"Would you like to use the 'Book Review' template? It includes:
- Title
- Author
- Rating
- Summary
- Favorite quotes
- Would recommend?"
```

---

## Template Suggestion API

### New Tool: `remember_suggest_templates`

```typescript
remember_suggest_templates({
  content: string,              // Memory content to analyze
  context: ConversationContext, // Current conversation context
  limit: number                 // Max suggestions (default: 3)
}): TemplateSuggestion[]

interface TemplateSuggestion {
  template_id: string;
  template_name: string;
  template_description: string;
  confidence: number;           // 0-1, how confident in suggestion
  reason: string;               // Why this template was suggested
  preview_fields: string[];     // Key fields in template
  usage_count: number;          // How many times user has used this
  last_used: Date | null;       // When user last used this
}
```

### Integration with `remember_create_memory`

```typescript
// Option 1: Explicit template selection
remember_create_memory({
  template_id: "template_person_profile_123",
  content: { /* structured data */ }
})

// Option 2: Auto-suggest (system suggests, user confirms)
remember_create_memory({
  content: "Met Sarah at conference...",
  auto_suggest_template: true  // System will suggest templates
})

// Option 3: No template
remember_create_memory({
  content: "Random thought about camping",
  use_template: false  // Skip template suggestion
})
```

---

## Template Learning & Improvement

### 1. Track Suggestion Acceptance

```typescript
interface TemplateSuggestionLog {
  user_id: string;
  content_summary: string;
  suggested_templates: array;
  selected_template_id: string | null;
  accepted: boolean;
  timestamp: datetime;
}

// When user accepts/declines
await logSuggestion({
  user_id,
  content_summary: content.substring(0, 200),
  suggested_templates: suggestions.map(s => s.template_id),
  selected_template_id: user_selected_id,
  accepted: user_selected_id !== null,
  timestamp: new Date()
});
```

### 2. Improve Suggestions Over Time

```typescript
async function improveTemplateSuggestions(user_id: string): Promise<void> {
  // Analyze user's template selection history
  const history = await getTemplateSuggestionHistory(user_id);
  
  // Calculate acceptance rate per template
  const stats = history.reduce((acc, log) => {
    log.suggested_templates.forEach(tid => {
      if (!acc[tid]) {
        acc[tid] = { suggested: 0, accepted: 0 };
      }
      acc[tid].suggested++;
      if (log.selected_template_id === tid) {
        acc[tid].accepted++;
      }
    });
    return acc;
  }, {});
  
  // Update template success_rate
  for (const [template_id, stat] of Object.entries(stats)) {
    const success_rate = stat.accepted / stat.suggested;
    await updateTemplate(template_id, {
      success_rate,
      user_preference_score: success_rate  // Boost for this user
    });
  }
}
```

### 3. Personalized Template Ranking

```typescript
function calculatePersonalizedScore(
  template: Template,
  base_score: number,
  user_id: string
): number {
  // Get user's history with this template
  const userStats = template.user_stats?.[user_id];
  
  if (!userStats) {
    return base_score;  // No history, use base score
  }
  
  // Boost based on user's acceptance rate
  const personalBoost = userStats.success_rate * 0.3;
  
  // Boost based on recent usage
  const daysSinceUse = daysBetween(now(), userStats.last_used);
  const recencyBoost = daysSinceUse < 7 ? 0.2 : daysSinceUse < 30 ? 0.1 : 0;
  
  return Math.min(base_score + personalBoost + recencyBoost, 1.0);
}
```

---

## Template Trigger Configuration

### Keyword Triggers

```yaml
Template: "Restaurant Review"
trigger_keywords:
  - "restaurant"
  - "ate at"
  - "dinner at"
  - "lunch at"
  - "food at"
  - "tried"
  - "cuisine"
```

### Context Triggers

```yaml
Template: "Restaurant Review"
trigger_context:
  location_present: true
  time_of_day: ["lunch", "dinner"]
  keywords_required: 1  # At least 1 trigger keyword must match
  
Template: "Meeting Notes"
trigger_context:
  time_of_day: ["morning", "afternoon"]
  day_of_week: ["monday", "tuesday", "wednesday", "thursday", "friday"]
  keywords_required: 1
  location_type: "office"  # If location matches office
```

### Entity Triggers

```yaml
Template: "Book Review"
trigger_entities:
  - type: "book_title"
    confidence: 0.7
  - type: "author_name"
    confidence: 0.5
    
Template: "Person Profile"
trigger_entities:
  - type: "person_name"
    confidence: 0.8
  - type: "company_name"
    confidence: 0.6
```

---

## Advanced Features

### 1. Multi-Template Suggestions

```typescript
// User says: "Met Sarah at Nobu for dinner to discuss the project"

// Multiple templates could apply
suggestions = [
  {
    template: "Person Profile",
    confidence: 0.85,
    reason: "Detected person information (Sarah)"
  },
  {
    template: "Restaurant Review",
    confidence: 0.78,
    reason: "Detected dining experience (Nobu, dinner)"
  },
  {
    template: "Meeting Notes",
    confidence: 0.72,
    reason: "Detected discussion context (discuss project)"
  }
]

// System can suggest creating multiple memories
"This could be recorded as multiple memories:
1. Person Profile for Sarah
2. Restaurant Review for Nobu
3. Meeting Notes for project discussion

Would you like to create all three, or just one?"
```

### 2. Template Chaining

```typescript
// Some templates can trigger related templates
Template: "Meeting Notes"
related_templates: [
  {
    template_id: "action_items",
    auto_create: true,  // Auto-create if meeting has action items
    condition: "has_action_items"
  },
  {
    template_id: "person_profile",
    suggest: true,  // Suggest for new attendees
    condition: "has_new_attendees"
  }
]
```

### 3. Template Composition

```typescript
// Combine multiple templates
Template: "Business Contact"
composed_from: [
  "Person Profile",  // Base template
  "Professional Info"  // Additional fields
]

// Inherits fields from both templates
fields: [
  ...PersonProfile.fields,
  ...ProfessionalInfo.fields
]
```

---

## User Experience

### Suggestion Modes

#### 1. **Automatic (Default)**
```
User: "Met Sarah at conference"
System: "💡 Suggestion: Use 'Person Profile' template?
        [Yes] [No] [View Template]"
```

#### 2. **Manual**
```
User: "Create memory with template"
System: "Which template would you like to use?
        - Person Profile
        - Meeting Notes
        - Restaurant Review
        [Or create without template]"
```

#### 3. **Silent**
```
User preference: auto_suggest_templates = false
System: Creates memory without suggesting templates
```

### Template Preview

```typescript
// User clicks "View Template"
{
  template_name: "Person Profile",
  description: "Track information about people you meet",
  fields: [
    { name: "name", type: "string", required: true },
    { name: "company", type: "string", required: false },
    { name: "job_title", type: "string", required: false },
    { name: "contact_info", type: "object", required: false },
    { name: "met_at", type: "string", required: false },
    { name: "notes", type: "text", required: false }
  ],
  usage_count: 42,
  last_used: "2026-02-10",
  example: {
    name: "John Doe",
    company: "Acme Corp",
    job_title: "Software Engineer",
    met_at: "Tech Conference 2026"
  }
}
```

---

## Performance Optimization

### 1. Template Caching

```typescript
// Cache user's templates in memory
const templateCache = new Map<string, Template[]>();

async function getUserTemplates(user_id: string): Promise<Template[]> {
  // Check cache
  if (templateCache.has(user_id)) {
    return templateCache.get(user_id)!;
  }
  
  // Fetch from database
  const templates = await weaviateClient.getTemplates(user_id);
  
  // Cache for 5 minutes
  templateCache.set(user_id, templates);
  setTimeout(() => templateCache.delete(user_id), 300000);
  
  return templates;
}
```

### 2. Precompute Template Embeddings

```typescript
// When template created, compute embedding once
async function createTemplate(template: Template): Promise<string> {
  // Compute embedding for template description
  const embedding = await getEmbedding(template.template_description);
  
  template.embedding = embedding;
  
  return await weaviateClient.addDocument(template);
}

// During suggestion, use precomputed embeddings
// Much faster than computing on every suggestion
```

### 3. Batch Template Scoring

```typescript
// Score all templates in parallel
async function scoreTemplates(
  templates: Template[],
  analysis: ContentAnalysis,
  context: ConversationContext
): Promise<ScoredTemplate[]> {
  return await Promise.all(
    templates.map(async template => ({
      template,
      score: await calculateTemplateScore(template, analysis, context)
    }))
  );
}
```

---

## Implementation Checklist

### Phase 1: Basic Suggestion
- [ ] Implement keyword matching
- [ ] Implement template query
- [ ] Implement suggestion API
- [ ] Add to `remember_create_memory` flow

### Phase 2: Smart Matching
- [ ] Add context pattern matching
- [ ] Add semantic similarity
- [ ] Implement scoring algorithm
- [ ] Add confidence thresholds

### Phase 3: Learning
- [ ] Track suggestion acceptance
- [ ] Implement usage pattern learning
- [ ] Personalized template ranking
- [ ] Success rate tracking

### Phase 4: Advanced
- [ ] Multi-template suggestions
- [ ] Template chaining
- [ ] Template composition
- [ ] Auto-fill from context

---

**Status**: Design Specification  
**Key Innovation**: Automatic template suggestion based on content analysis and user patterns  
**User Experience**: Seamless - system suggests, user confirms or declines
