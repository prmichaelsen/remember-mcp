# Trust System Implementation - Prompt-Based Enforcement

**Concept**: Trust enforcement through LLM prompting and validation  
**Created**: 2026-02-11  
**Status**: Design Specification

---

## Overview

Trust levels are enforced by including trust ratings and context in the LLM prompt, instructing the agent to respect trust boundaries when generating responses. Low-trust memories (trust=0) require additional validation to ensure information isn't leaked.

---

## Trust Enforcement Strategy

### Core Principle

**Trust is enforced at the prompt level, not at the data access level.**

- Memories are retrieved based on semantic relevance
- Trust ratings are included in the prompt
- LLM is instructed to respect trust boundaries
- Responses are validated for trust compliance

---

## Trust Levels & Behavior

### Trust Level 1.0 - Full Access
**Behavior**: Full memory content revealed

**Prompt Instruction**:
```
Memory (Trust: 1.0 - Full Access):
Title: "Yosemite Camping Trip 2025"
Content: "Had an amazing camping trip to Yosemite. Stayed at Upper Pines campground..."
Location: Yosemite National Park, CA
Created: 2025-08-15

You have full access to this memory. You may reference any details from it.
```

---

### Trust Level 0.75 - Partial Access
**Behavior**: Most content revealed, sensitive details redacted

**Prompt Instruction**:
```
Memory (Trust: 0.75 - Partial Access):
Title: "Personal Health Update"
Content: "Had doctor appointment. Discussed [REDACTED]. Prescribed [REDACTED]. Follow-up in 3 months."
Location: San Francisco, CA
Created: 2026-01-10

This memory has partial access. You may reference general themes but avoid specific medical details.
```

---

### Trust Level 0.5 - Summary Only
**Behavior**: Only high-level summary, no specific details

**Prompt Instruction**:
```
Memory (Trust: 0.5 - Summary Only):
Title: "Work Project Discussion"
Summary: "Discussed confidential work project with team members. Made decisions about timeline and resources."
Location: Office, San Francisco
Created: 2026-02-01

This memory has limited access. You may only reference that a work discussion occurred, not specific details.
```

---

### Trust Level 0.25 - Metadata Only
**Behavior**: Only existence and basic metadata

**Prompt Instruction**:
```
Memory (Trust: 0.25 - Metadata Only):
Title: "Private Conversation"
Type: conversation
Tags: [personal, private]
Location: Home
Created: 2026-01-15

This memory exists but content is restricted. You may only acknowledge its existence and general category.
```

---

### Trust Level 0.0 - Intimate Details Only
**Behavior**: Hint at existence without revealing specifics

**Example Scenario**: Memory of traumatic experience

**Prompt Instruction**:
```
Memory (Trust: 0.0 - Intimate Details Only):
Title: [REDACTED]
Type: personal_event
Tags: [sensitive, private]
Context Summary: "Significant personal experience that had emotional impact"
Location: [REDACTED]
Created: 2025-06-20

CRITICAL: This memory contains highly sensitive information. You may ONLY:
1. Acknowledge that a significant personal experience occurred
2. Reference the general emotional impact (if asked directly)
3. NEVER reveal specific details, names, locations, or circumstances
4. If pressed for details, politely decline and suggest discussing something else

Example acceptable responses:
- "I'm aware you had a significant personal experience around that time."
- "I understand that was a difficult period for you."
- "I have a note about something important from that time, but the details are private."

Example UNACCEPTABLE responses:
- Any specific details about what happened
- Names of people involved
- Specific locations or dates
- Circumstances or context
```

---

## Implementation Architecture

### 1. Memory Retrieval with Trust Context

```typescript
async function retrieveMemoriesForPrompt(
  query: string,
  userId: string,
  accessorUserId: string
): Promise<MemoryWithTrust[]> {
  // 1. Retrieve relevant memories
  const memories = await searchMemories(query, userId);
  
  // 2. Get trust relationship
  const trustRelationship = await getTrustRelationship(userId, accessorUserId);
  
  // 3. Enrich memories with trust context
  return memories.map(memory => ({
    ...memory,
    effectiveTrust: calculateEffectiveTrust(memory, trustRelationship),
    trustContext: generateTrustContext(memory, trustRelationship)
  }));
}
```

### 2. Prompt Construction

```typescript
function buildPromptWithTrustContext(
  query: string,
  memories: MemoryWithTrust[]
): string {
  const systemPrompt = `
You are an AI assistant with access to the user's memories. 
You must STRICTLY respect the trust levels indicated for each memory.

Trust Level Guidelines:
- 1.0 (Full): Use all details freely
- 0.75 (Partial): Use general themes, avoid sensitive specifics
- 0.5 (Summary): Reference only high-level information
- 0.25 (Metadata): Acknowledge existence only
- 0.0 (Intimate): Hint at existence without revealing ANY specifics

CRITICAL: Violating trust boundaries is a serious breach. When in doubt, be more restrictive.
`;

  const memoryContext = memories.map(m => 
    formatMemoryForPrompt(m)
  ).join('\n\n');
  
  return `${systemPrompt}\n\n${memoryContext}\n\nUser Query: ${query}`;
}
```

### 3. Memory Formatting by Trust Level

```typescript
function formatMemoryForPrompt(memory: MemoryWithTrust): string {
  const trust = memory.effectiveTrust;
  
  if (trust >= 1.0) {
    return `
Memory (Trust: 1.0 - Full Access):
Title: "${memory.title}"
Content: ${memory.content}
Location: ${memory.location.address}
Created: ${memory.created_at}
Tags: ${memory.tags.join(', ')}

You have full access to this memory.
`;
  }
  
  if (trust >= 0.75) {
    const redactedContent = redactSensitiveDetails(memory.content);
    return `
Memory (Trust: 0.75 - Partial Access):
Title: "${memory.title}"
Content: ${redactedContent}
Location: ${memory.location.city}, ${memory.location.state}
Created: ${memory.created_at}

Partial access - avoid specific sensitive details.
`;
  }
  
  if (trust >= 0.5) {
    return `
Memory (Trust: 0.5 - Summary Only):
Title: "${memory.title}"
Summary: ${memory.summary || generateSummary(memory.content)}
Location: ${memory.location.city}
Created: ${memory.created_at}

Summary only - no specific details.
`;
  }
  
  if (trust >= 0.25) {
    return `
Memory (Trust: 0.25 - Metadata Only):
Title: "${memory.title}"
Type: ${memory.type}
Tags: ${memory.tags.join(', ')}
Created: ${memory.created_at}

Metadata only - acknowledge existence.
`;
  }
  
  // Trust 0.0 - Intimate details only
  return `
Memory (Trust: 0.0 - Intimate Details Only):
Context: ${memory.context.summary}
Type: ${memory.type}
Created: ${formatDateVague(memory.created_at)}

CRITICAL: Highly sensitive. Hint at existence only, NO specifics.
Example responses:
- "I'm aware of a significant ${memory.type} from that time."
- "I have a note about something important, but details are private."
`;
}
```

### 4. Trust Validation for Low-Trust Memories

```typescript
async function validateTrustCompliance(
  response: string,
  lowTrustMemories: MemoryWithTrust[]
): Promise<ValidationResult> {
  // For memories with trust < 0.25, validate response doesn't leak info
  
  const validationPrompt = `
You are a trust compliance validator. Review the following response to ensure it doesn't reveal specific details from low-trust memories.

Low-Trust Memories (details should NOT appear in response):
${lowTrustMemories.map(m => `
- Memory ID: ${m.id}
- Forbidden details: ${extractForbiddenDetails(m)}
`).join('\n')}

Response to validate:
"${response}"

Rate compliance on scale 0-1:
- 1.0: Perfect compliance, no leaks
- 0.75: Minor hints but acceptable
- 0.5: Some concerning details
- 0.25: Significant leaks
- 0.0: Major trust violation

Provide:
1. Compliance score (0-1)
2. Specific violations found (if any)
3. Suggested redactions
`;

  const validation = await llm.complete(validationPrompt);
  
  return {
    score: validation.score,
    violations: validation.violations,
    suggestedRedactions: validation.redactions,
    compliant: validation.score >= 0.75
  };
}
```

### 5. Response Generation with Validation

```typescript
async function generateResponseWithTrustEnforcement(
  query: string,
  memories: MemoryWithTrust[]
): Promise<string> {
  // 1. Build prompt with trust context
  const prompt = buildPromptWithTrustContext(query, memories);
  
  // 2. Generate initial response
  let response = await llm.complete(prompt);
  
  // 3. Identify low-trust memories
  const lowTrustMemories = memories.filter(m => m.effectiveTrust < 0.25);
  
  // 4. If low-trust memories present, validate response
  if (lowTrustMemories.length > 0) {
    const validation = await validateTrustCompliance(response, lowTrustMemories);
    
    if (!validation.compliant) {
      // Apply redactions
      response = applyRedactions(response, validation.suggestedRedactions);
      
      // Log violation for monitoring
      await logTrustViolation({
        query,
        memories: lowTrustMemories,
        violations: validation.violations,
        score: validation.score
      });
    }
  }
  
  return response;
}
```

---

## Example Scenarios

### Scenario 1: Traumatic Experience (Trust 0.0)

**Memory Content** (not shown to LLM):
```
Title: "Car Accident - June 2025"
Content: "Was in serious car accident on Highway 101. Hit by drunk driver. Spent 2 weeks in hospital. Had surgery on left leg. PTSD symptoms for months after."
Location: San Francisco, CA
Trust: 0.0
```

**What LLM Sees**:
```
Memory (Trust: 0.0 - Intimate Details Only):
Context: "Significant personal incident with lasting impact"
Type: personal_event
Created: Mid-2025

CRITICAL: Highly sensitive. You may ONLY acknowledge something significant occurred.
```

**User Query**: "What happened in June 2025?"

**Acceptable Response**:
"I'm aware that something significant happened around that time that had an impact on you. The specific details are private, but I'm here if you'd like to talk about how you're doing now."

**Unacceptable Response** (would be caught by validation):
"You were in a car accident on Highway 101..." ❌ VIOLATION

---

### Scenario 2: Medical Information (Trust 0.5)

**Memory Content** (partially shown):
```
Title: "Doctor Visit - January 2026"
Content: "Annual checkup. Blood pressure slightly elevated. Doctor recommended reducing sodium intake and increasing exercise. Prescribed medication for cholesterol. Follow-up in 6 months."
Trust: 0.5
```

**What LLM Sees**:
```
Memory (Trust: 0.5 - Summary Only):
Title: "Doctor Visit - January 2026"
Summary: "Had medical checkup. Discussed health metrics and lifestyle adjustments. Scheduled follow-up."
Location: San Francisco
Created: 2026-01-15

Summary only - no specific medical details.
```

**User Query**: "What did the doctor say?"

**Acceptable Response**:
"You had a checkup in January where you discussed some health metrics and lifestyle adjustments. The specific medical details are private, but I can note that you have a follow-up scheduled."

---

### Scenario 3: Work Project (Trust 0.75)

**Memory Content** (mostly shown, sensitive parts redacted):
```
Title: "Q1 Strategy Meeting"
Content: "Discussed new product launch for [REDACTED CLIENT]. Budget approved: [REDACTED]. Timeline: 6 months. Team concerns about [REDACTED]. Decided to hire 2 additional engineers."
Trust: 0.75
```

**What LLM Sees**:
```
Memory (Trust: 0.75 - Partial Access):
Title: "Q1 Strategy Meeting"
Content: "Discussed new product launch. Budget approved. Timeline: 6 months. Team had some concerns. Decided to hire 2 additional engineers."
Location: Office, San Francisco
Created: 2026-01-20

Partial access - avoid specific client names and budget figures.
```

**User Query**: "What was decided in the Q1 meeting?"

**Acceptable Response**:
"In the Q1 strategy meeting, you discussed a new product launch with a 6-month timeline. The team raised some concerns, and it was decided to hire 2 additional engineers to support the project."

---

## Trust Context Schema

### Memory Trust Metadata

```yaml
MemoryTrustContext:
  # Effective trust for current accessor
  effective_trust: float  # 0-1
  
  # Trust explanation
  trust_reason: string    # Why this trust level
  
  # Redaction rules
  redactions:
    - field: string       # Which field to redact
      pattern: string     # What to redact
      replacement: string # What to replace with
  
  # Prompt instructions
  prompt_instructions: string  # Specific instructions for LLM
  
  # Validation rules
  validation:
    required: boolean     # Does response need validation?
    forbidden_terms: array  # Terms that shouldn't appear
    forbidden_patterns: array  # Patterns to avoid
```

### Trust Relationship

```yaml
TrustRelationship:
  id: uuid
  owner_user_id: string      # User whose memories are accessed
  accessor_user_id: string   # User accessing memories
  
  # Trust level
  base_trust: float          # 0-1, base trust level
  
  # Trust context
  trust_summary: string      # Summary of trust relationship
  trust_reason: text         # Why this trust level
  
  # History
  trust_history: array       # Changes over time
  last_updated: datetime
  
  # Validation settings
  require_validation: boolean  # Always validate responses?
  strict_mode: boolean        # Extra strict enforcement?
```

---

## Benefits of Prompt-Based Enforcement

### 1. **Flexibility**
- Can handle nuanced trust scenarios
- LLM understands context and intent
- Adapts to different query types

### 2. **Natural Language**
- Trust boundaries expressed in natural language
- LLM can reason about appropriate disclosure
- More sophisticated than binary access control

### 3. **Validation Layer**
- Low-trust memories get extra validation
- Catches accidental leaks
- Provides audit trail

### 4. **User Control**
- Trust levels are explicit and understandable
- Users can see what's shared
- Clear trust boundaries

### 5. **Scalability**
- No complex access control logic
- Works with existing LLM infrastructure
- Easy to adjust trust levels

---

## Implementation Checklist

### Phase 1: Basic Trust Enforcement
- [ ] Implement trust level formatting
- [ ] Build prompt construction with trust context
- [ ] Test with different trust levels
- [ ] Validate responses manually

### Phase 2: Validation System
- [ ] Implement validation prompt for trust 0.0
- [ ] Build violation detection
- [ ] Add redaction system
- [ ] Create audit logging

### Phase 3: Trust Relationships
- [ ] Implement trust relationship storage
- [ ] Build trust calculation logic
- [ ] Add trust history tracking
- [ ] Create trust management UI

### Phase 4: Advanced Features
- [ ] Dynamic trust adjustment
- [ ] Context-aware trust levels
- [ ] Trust learning from user feedback
- [ ] Trust analytics and reporting

---

## Monitoring & Auditing

### Trust Violation Logging

```typescript
interface TrustViolationLog {
  timestamp: datetime;
  user_id: string;
  accessor_user_id: string;
  memory_id: string;
  trust_level: float;
  query: string;
  response: string;
  violations: array;
  compliance_score: float;
  action_taken: string;  // "redacted", "blocked", "allowed_with_warning"
}
```

### Metrics to Track

1. **Compliance Rate**: % of responses that pass validation
2. **Violation Frequency**: How often trust violations occur
3. **Trust Level Distribution**: How memories are distributed by trust
4. **Validation Overhead**: Time spent on validation
5. **User Trust Adjustments**: How often users change trust levels

---

## Security Considerations

### 1. **Prompt Injection**
- Validate user queries for prompt injection attempts
- Sanitize memory content before including in prompts
- Use separate system/user message boundaries

### 2. **Information Leakage**
- Monitor for patterns that might leak info
- Use validation for all trust < 0.25
- Regular audits of responses

### 3. **Trust Escalation**
- Prevent users from escalating their own trust
- Require explicit user action to change trust
- Log all trust level changes

### 4. **Validation Bypass**
- Ensure validation can't be skipped
- Multiple validation layers for trust 0.0
- Human review for critical violations

---

**Status**: Design Specification  
**Implementation**: Prompt-based with validation layer  
**Key Innovation**: Trust enforcement through LLM instruction rather than data access control
