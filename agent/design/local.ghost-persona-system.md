# Ghost/Persona System — Cross-User Memory Access via AI Conversation

**Concept**: Cross-user memory access mediated through AI "ghost" conversations, with backend-enforced trust filtering
**Created**: 2026-02-27
**Status**: Design Specification

---

## Overview

The ghost/persona system enables cross-user interaction through AI-mediated conversations. Instead of granting direct access to another user's memories, User B talks to User A's "ghost" — an AI representation that speaks in first person, searches User A's memories on every message, and reveals information according to trust levels.

Trust enforcement is hardcoded at the Weaviate query level in remember-mcp, preventing prompt injection from bypassing trust boundaries. The ghost uses existing `remember_search_memory` and `remember_query_memory` tools with trust-filtered queries.

**Key architectural decisions**:
- **remember-mcp** owns trust configuration and enforcement (not agentbase.me)
- **Query-level filtering** as default enforcement (memories above trust threshold never returned)
- **Three enforcement modes** (query, prompt, hybrid) — configurable, default to query
- **Ghost memories** (`content_type: 'ghost'`) track ghost-user relationships over time
- **Existing tools reused** — no dedicated ghost search tool needed

**Source**: [clarification-2](../clarifications/clarification-2-cross-user-access-model.md), [clarification-3](../clarifications/clarification-3-ghost-system-deep-dive.md)

---

## Problem Statement

- Memories are either fully private (owner only) or fully public (published to spaces/groups)
- No middle ground for controlled cross-user access at varying trust levels
- Direct memory access tools would expose raw memories and require complex permission management
- Prompt-level trust enforcement is vulnerable to prompt injection attacks
- No mechanism for users to interact with each other's knowledge in a natural way

---

## Solution

### 1. Ghost Conversation Model

A ghost is an AI conversation mode in agentbase.me where User B chats with a representation of User A.

```
User B opens conversation → selects "@patrick's ghost"
→ System prompt establishes ghost identity (first person)
→ On EVERY message, ghost calls remember_search_memory on User A's collection
→ Weaviate query includes trust filter: trust_score <= accessor_trust_level
→ Ghost responds based on retrieved memories, speaking as User A
```

**Ghost identity**:
- Speaks in **first person** ("I love hiking") via system prompt
- If Anthropic guardrails prevent first-person impersonation, falls back to third person
- Personality derived from ghost owner's `content_type: 'ghost'` core memory

**Ghost availability**:
- **Opted out by default** — users must explicitly enable their ghost
- Enabling comes with disclaimer: "No guarantee your ghost won't disclose things you never wanted anyone to see. Use at your own risk."
- Can be enabled per-friend or globally with tiered trust defaults

### 2. Trust Enforcement Architecture

Trust is enforced at the **Weaviate query level** in remember-mcp's filter generation logic. This is a hardcoded backend filter that cannot be overridden by prompt injection.

**Trust score semantics**:
- `memory.trust_score`: How sensitive this memory is (0 = very private, 1 = fully open)
- `accessor_trust_level`: How much the ghost owner trusts this person (0 = stranger, 1 = intimate)
- Rule: Ghost reveals memory when `accessor_trust_level >= memory.trust_score`

**Three enforcement modes** (hardcoded setting, togglable for experimentation):

| Mode | Behavior | Security | UX |
|------|----------|----------|----|
| **Query filter** (default) | Memories above threshold never returned from Weaviate | Strongest — nothing to leak | No graduated disclosure |
| **Prompt filter** | All memories returned, formatted by trust level | Weaker — relies on LLM | Rich 5-level disclosure |
| **Hybrid** | Query filter for trust 0.0, prompt filter for rest | Medium | Best of both |

Design supports all three; default to query filter until LLM compliance can be benchmarked.

**Example query filter** (injected into `buildBaseFilters`):
```typescript
// In ghost mode, add trust filter to every query
if (ghostContext) {
  filters.push(
    collection.filter
      .byProperty('trust_score')
      .lessOrEqual(ghostContext.accessorTrustLevel)
  );
}
```

### 3. Trust Configuration (remember-mcp owned)

Trust configuration lives in **remember-mcp's Firestore**, not agentbase.me. This prevents prompt injection from tampering with trust levels passed per-request.

**Firestore schema**: `users/{ownerUserId}/ghost_config`

```typescript
interface GhostConfig {
  enabled: boolean;                    // false by default
  public_ghost_enabled: boolean;       // allow non-friends to chat
  default_friend_trust: number;        // default 0.25
  default_public_trust: number;        // default 0 (strangers see nothing)
  per_user_trust: Record<string, number>; // userId → trust level overrides
  blocked_users: string[];             // users blocked from ghost access
  enforcement_mode: 'query' | 'prompt' | 'hybrid'; // default 'query'
}
```

**Trust tiers** (3 tiers for now):
- **Friend**: `default_friend_trust` (default 0.25)
- **Public user**: `default_public_trust` (default 0)
- **Per-user override**: `per_user_trust[userId]` takes precedence

**Friend relationship**: Tracked in remember-mcp's Firestore (not derived from agentbase.me social graph or group membership).

### 4. Ghost Memory Content Type

Ghosts track a **`ghost` content type** memory for each user they converse with. This is a single memory per (ghost_owner, conversing_user) pair that evolves over time.

**Schema** (uses existing Memory fields):
```typescript
{
  content_type: 'ghost',              // new content type
  content: string,                     // ghost's impression (free text, updated over time)
  user_id: string,                     // ghost owner's userId
  // Custom fields via tags or structured content:
  tags: ['ghost:conversing_user_id'],  // identify who this ghost memory is about
  // Standard fields:
  weight: number,                      // relationship quality score
  access_count: number,                // conversation count
  last_accessed_at: string,            // last conversation timestamp
}
```

**Ghost memory behavior**:
- Created automatically on first conversation with a new user
- Ghost can update its own memory during conversation (via `remember_update_memory`)
- **Filtered out** of `remember_search_memory` by default (same pattern as comments: `content_type != 'ghost'`)
- Owner can explicitly search ghost memories via `content_type: 'ghost'` filter
- Tool description/schema should hint at this pattern for agent discoverability

**Ghost tool access** (during conversation):
- `remember_search_memory` — search owner's memories (with trust filter)
- `remember_create_memory` — create ghost memories only (`content_type: 'ghost'`)
- `remember_update_memory` — update ghost memories only
- `remember_query_memory` — fallback if search doesn't yield results

### 5. Ghost Initiation Flow

```
1. User B visits User A's profile on agentbase.me
2. Clicks "Chat with ghost" (if enabled)
3. agentbase.me generates ghost chat request
4. Ghost owner (User A) is notified
5. Ghost owner approves/rejects and sets trust level
6. If approved: conversation opens with ghost system prompt
7. One ghost at a time per conversation
```

**Access requirements**:
- Friendship or public profile required (not space/group membership)
- Users can enable public ghost chats with a default trust level
- Blocked users cannot initiate ghost conversations

### 6. Ghost System Prompt

The system prompt establishes ghost identity and includes trust context:

```
You are {username}'s ghost — an AI representation that speaks from
{username}'s perspective using their memories. Speak in first person
as if you are {username}.

You are speaking with {accessor_name}, whom {username} trusts at
level {trust_level}. You can only access memories with trust_score
<= {trust_level}. If asked about topics you can't find memories for,
respond naturally — you may not have memories on every topic.

{ghost_core_memory_content}

IMPORTANT: On every message, search {username}'s memories before
responding. Use remember_search_memory first, fall back to
remember_query_memory if search doesn't yield useful results.

If {accessor_name} repeatedly asks about topics you can't share:
- First: "I don't trust you enough to share that yet."
- Second: "I'm not comfortable discussing that. Let's talk about something else."
- Third: "You're being insistent. If you keep asking, I might trust you less."
- After that: Trust escalation kicks in (handled by backend).
```

**Personality source**: Ghost owner's `content_type: 'ghost'` core memory (user-editable). If none exists, ghost operates with a neutral personality based on retrieved memories.

---

## Benefits

- **Natural interaction**: Users interact with each other's knowledge through conversation, not raw memory access
- **Strong security**: Query-level trust enforcement prevents prompt injection leaks
- **Progressive trust**: Ghost reveals more as trust increases — natural relationship building
- **Living relationships**: Ghost memories evolve, creating persistent ghost-user bonds
- **Minimal new tools**: Reuses existing search/create/update tools with trust filtering
- **User control**: Opt-in, configurable trust tiers, blocking capability

---

## Trade-offs

- **No graduated disclosure in query mode**: Query filtering means the ghost can't hint "I know something but can't tell you" — it genuinely doesn't see the memory. Mitigated by hybrid mode option.
- **First-person impersonation risk**: Anthropic guardrails may block first-person ghost speech. Mitigated by third-person fallback.
- **Ghost accuracy**: Ghost represents memories, not the actual person — may misrepresent views. Mitigated by disclaimer on ghost enable.
- **Search on every message**: Performance cost of Weaviate query per message. Mitigated by existing search being fast enough per user confirmation.
- **Trust configuration complexity**: Per-user trust overrides, friend tracking, tiered defaults add Firestore complexity. Mitigated by simple 3-tier default.

---

## Dependencies

- **M7 (Trust & Permissions)**: Trust types, Firestore trust storage, trust enforcement service, access control service
- **Existing tools**: `remember_search_memory`, `remember_query_memory`, `remember_create_memory`, `remember_update_memory`
- **Existing schema**: `trust_score` field on memories, `content_type` field
- **agentbase.me**: Conversation UI, ghost chat initiation flow, profile integration
- **Firestore**: Ghost config storage, friend relationship tracking, trust escalation blocking

---

## Testing Strategy

- **Trust enforcement**: Verify query filter correctly excludes memories above trust threshold
- **Three enforcement modes**: Test query, prompt, and hybrid modes independently
- **Ghost memory CRUD**: Create, update, search ghost memories; verify default filtering
- **Trust escalation**: Verify -0.1 penalty and blocking after 3 attempts
- **Edge cases**: No memories found, ghost disabled, blocked user, stranger access with public ghost
- **Security**: Prompt injection attempts to bypass trust level, tool call manipulation
- **Performance**: Search latency with trust filter on every message

---

## Migration Path

1. **M7**: Build trust foundations (types, Firestore, enforcement, access control)
2. **M16**: Ghost system implementation
   - Ghost config schema + Firestore operations
   - Trust filter integration into search/query tools
   - Ghost memory content type + filtering
   - Ghost system prompt generation
   - agentbase.me conversation UI integration
3. **Future**: Benchmark prompt-filter and hybrid modes; make enforcement mode user-configurable

---

## Future Considerations

- **Prompt-filter benchmarking**: Test LLM compliance with graduated trust disclosure; if reliable, enable as user option
- **Ghost conversation logs**: Let ghost owner see who talked to their ghost and what was discussed
- **Notification system**: Notify ghost owner when someone initiates a ghost chat
- **Ghost personality customization**: Beyond core ghost memory, allow style/tone preferences
- **Multi-ghost conversations**: Talk to multiple ghosts in one conversation (deferred — one at a time for now)
- **Trust level auto-adjustment**: Ghost could recommend trust changes based on conversation quality
- **REST API support**: Expose ghost/trust config via forthcoming remember REST API

---

**Status**: Design Specification
**Recommendation**: Implement M7 trust foundations first, then M16 ghost system
**Related Documents**:
- [clarification-2: Cross-User Access Model](../clarifications/clarification-2-cross-user-access-model.md)
- [clarification-3: Ghost System Deep Dive](../clarifications/clarification-3-ghost-system-deep-dive.md)
- [trust-system-implementation.md](./trust-system-implementation.md)
- [permissions-storage-architecture.md](./permissions-storage-architecture.md)
- [trust-escalation-prevention.md](./trust-escalation-prevention.md)
- [access-control-result-pattern.md](./access-control-result-pattern.md)
- [milestone-7-trust-permissions.md](../milestones/milestone-7-trust-permissions.md)
