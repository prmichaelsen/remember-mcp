# Unified Internal Memory Tool Suite

**Concept**: Replace separate ghost/agent tool suites with 5 unified `remember_*_internal_memory` tools whose behavior is driven by HTTP headers
**Created**: 2026-03-07
**Status**: Design Specification

---

## Overview

This document describes the design for a unified internal memory tool suite that replaces separate ghost and agent tool implementations. Instead of maintaining 5 ghost tools + 5 agent tools (10 total), we define 5 `remember_*_internal_memory` tools whose behavior is determined by platform-sent HTTP headers (`X-Internal-Type`, `X-Ghost-Type`, etc.).

The design also addresses ghost source isolation — the problem that a single user's collection can contain ghost memories from multiple distinct ghost conversations (different user ghosts, space ghosts, group ghosts), and these need to be distinguishable via tags.

---

## Problem Statement

1. **Tool proliferation**: Ghost tools hardcode `content_type: 'ghost'` and ghost-specific tags. Adding an equivalent agent tool suite means 5 more tools (10 total), with significant code duplication.

2. **Ghost source isolation**: A user's collection can hold ghost memories from multiple ghost conversations. Bob might talk to alice's ghost, carol's ghost, and the music-lovers space ghost — all producing `content_type: 'ghost'` memories in bob's collection. The current `ghost:{accessor_user_id}` tag is redundant (bob is always the accessor in his own collection) and doesn't distinguish which ghost the memory came from.

3. **Agent memories needed**: AI agent observations need a parallel storage pattern (`content_type: 'agent'`) with similar create/search/query tools, excluded from default user searches.

---

## Solution

### Unified Tools (5 replacing 10+)

Five `remember_*_internal_memory` tools that derive their behavior from server-side context set via HTTP headers:

| Tool | Purpose |
|------|---------|
| `remember_create_internal_memory` | Create ghost or agent memory |
| `remember_update_internal_memory` | Update ghost or agent memory |
| `remember_search_internal_memory` | Semantic search ghost or agent memories |
| `remember_query_internal_memory` | Query ghost or agent memories |
| `remember_search_internal_memory_by` | Structured browse/sort ghost or agent memories |

The platform (agentbase.me) sends headers indicating the conversation context. The tools error if no internal context headers are present — they cannot be used as normal memory tools.

### Ghost Source Isolation via Tags

Each ghost memory gets tags identifying its source:

| Ghost type | Tags |
|------------|------|
| User ghost (alice) | `ghost`, `ghost_type:user`, `ghost_owner:user:alice` |
| Space ghost (music-lovers) | `ghost`, `ghost_type:space`, `ghost_owner:space:music-lovers` |
| Group ghost (band-mates) | `ghost`, `ghost_type:group`, `ghost_owner:group:band-mates` |
| Agent | `agent` |

The old `ghost:{accessor_user_id}` tag is dropped (redundant in accessor's own collection).

### Ghost Memory Storage Model

Ghost memories are always written to the **accessor's** (conversing user's) collection. When bob talks to alice's ghost, memories go in bob's collection. These are metadata for the ghost to understand how to interact with bob long-term. This applies uniformly to user ghosts, space ghosts, and group ghosts.

---

## Implementation

### 1. Platform Headers

The platform sends these headers based on conversation type:

| Header | Values | Purpose |
|--------|--------|---------|
| `X-Internal-Type` | `ghost`, `agent` | Which internal content type (drives unified tool behavior) |
| `X-Ghost-Owner` | `alice` (already exists) | Whose ghost (user ghosts) |
| `X-Ghost-Type` | `user`, `space`, `group` | What kind of ghost (required, not inferred) |
| `X-Ghost-Space` | `music-lovers` | Space ID (space ghosts only) |
| `X-Ghost-Group` | `band-mates` | Group ID (group ghosts only) |

Header combinations by conversation type:

```
# User ghost (bob talking to alice's ghost)
X-Internal-Type: ghost
X-Ghost-Owner: alice
X-Ghost-Type: user

# Space ghost (bob talking to music-lovers space ghost)
X-Internal-Type: ghost
X-Ghost-Type: space
X-Ghost-Space: music-lovers

# Group ghost (bob talking to band-mates group ghost)
X-Internal-Type: ghost
X-Ghost-Type: group
X-Ghost-Group: band-mates

# Agent (bob's personal agent)
X-Internal-Type: agent
```

### 2. Server Context

`mcp-auth` extracts `X-*` headers into `extras` (snake_case). The server factory maps these into `InternalContext`:

```typescript
// types/auth.ts
export interface InternalContext {
  type: 'ghost' | 'agent';
  ghost_type?: 'user' | 'space' | 'group';
  ghost_space?: string;
  ghost_group?: string;
  // Absorbed from former GhostModeContext:
  owner_user_id?: string;        // ghost owner (user ghosts)
  accessor_user_id: string;      // who is conversing
  accessor_trust_level?: number;  // resolved trust (ghost only)
}

export interface AuthContext {
  accessToken: string | null;
  credentials: UserCredentials | null;
  internalContext?: InternalContext;
  // ghostMode is removed — absorbed into internalContext
}
```

Server factory mapping (ghostMode removed — all context on internalContext):

```typescript
serverFactory: async (accessToken, userId, extras) => {
  const internalType = extras?.internal_type as string | undefined;
  let internalContext: InternalContext | undefined;

  if (internalType) {
    const ghostOwner = extras?.ghost_owner as string | undefined;
    let accessorTrustLevel: number | undefined;

    if (internalType === 'ghost' && ghostOwner) {
      const ghostConfig = await getGhostConfig(ghostOwner);
      accessorTrustLevel = await resolveAccessorTrustLevel(ghostConfig, ghostOwner, userId);
    }

    internalContext = {
      type: internalType as 'ghost' | 'agent',
      ghost_type: extras?.ghost_type as 'user' | 'space' | 'group' | undefined,
      ghost_space: extras?.ghost_space as string | undefined,
      ghost_group: extras?.ghost_group as string | undefined,
      owner_user_id: ghostOwner,
      accessor_user_id: userId,
      accessor_trust_level: accessorTrustLevel,
    };
  }

  return await createRememberServer(accessToken, userId, { internalContext });
},
```

### 3. Tag Builder

```typescript
function buildInternalTags(authContext: AuthContext): string[] {
  const ctx = authContext.internalContext;
  if (!ctx) return [];

  if (ctx.type === 'agent') {
    return ['agent'];
  }

  const tags = ['ghost'];

  switch (ctx.ghost_type) {
    case 'user':
      tags.push('ghost_type:user');
      if (ctx.owner_user_id) {
        tags.push(`ghost_owner:user:${ctx.owner_user_id}`);
      }
      break;
    case 'space':
      tags.push('ghost_type:space');
      if (ctx.ghost_space) {
        tags.push(`ghost_owner:space:${ctx.ghost_space}`);
      }
      break;
    case 'group':
      tags.push('ghost_type:group');
      if (ctx.ghost_group) {
        tags.push(`ghost_owner:group:${ctx.ghost_group}`);
      }
      break;
  }

  return tags;
}
```

### 4. Search Auto-Scoping

Search tools auto-scope to the current ghost source via headers. When alice's ghost searches bob's collection, it auto-filters to `ghost_owner:user:alice` — it cannot see memories from carol's ghost or space ghosts. No override is allowed.

```typescript
// In search/query handlers
const ctx = authContext.internalContext;
if (!ctx) {
  throw new Error('Internal context required. X-Internal-Type header must be set.');
}

const typeTags = buildInternalTags(authContext);
const scopeTags = typeTags.filter(t => t !== 'ghost' && t !== 'agent');

const filters = {
  ...args.filters,
  types: [ctx.type],
  tags: [...(args.filters?.tags ?? []), ...scopeTags],
};
```

### 5. Content Type

- `'agent'` must be added to the `ContentType` enum in remember-core
- Default searches (`remember_search_memory`, etc.) must exclude both `ghost` and `agent` content types

### 6. Agent Auto-Tags

Agent memories get the `agent` tag. An optional `agent:conversation:{conversationId}` tag is supported for future session isolation but not actively used yet.

---

## Benefits

- **Fewer tools**: 5 tools instead of 10+, reducing LLM tool choice complexity
- **Context-driven**: Platform determines behavior via headers — LLM can't pick wrong type
- **Ghost isolation**: Tags distinguish memories from different ghost conversations
- **Extensible**: New internal types can be added via headers without new tool suites
- **Consistent**: Ghost and agent memories follow same create/search/query pattern

---

## Trade-offs

- **Implicit behavior**: Tool behavior changes based on headers, not visible in tool schema. Mitigated by tools erroring without headers.
- **Header dependency**: Platform must send correct headers. Mitigated by non-blocking rollout — platform updates in parallel.
- **Lost legacy data**: Existing ghost memories lack new source tags and won't be backfilled. Acceptable given minimal existing data.

---

## Dependencies

- **remember-core**: Add `'agent'` to `ContentType` enum
- **remember-mcp-server**: Map new headers into `InternalContext` on `ServerOptions`
- **agentbase.me (platform)**: Send `X-Internal-Type`, `X-Ghost-Type`, `X-Ghost-Space`, `X-Ghost-Group` headers
- **mcp-auth**: Already supports `X-*` header extraction (no changes needed)

---

## Testing Strategy

- **Unit tests**: Tag builder produces correct tags for each ghost type and agent
- **Unit tests**: Search auto-scoping applies correct filters
- **Unit tests**: Tools error when no `internalContext` is present
- **Integration tests**: End-to-end create → search with ghost source isolation (alice's ghost memories don't leak into carol's ghost searches)
- **Integration tests**: Default search tools exclude `agent` and `ghost` content types

---

## Migration Path

1. Add `InternalContext` to `AuthContext` and `ServerOptions` in remember-mcp
2. Add `'agent'` to `ContentType` enum in remember-core
3. Create 5 unified `remember_*_internal_memory` tools
4. Delete existing 5 standalone ghost tools
5. Update default search filters to exclude `agent` content type
6. Platform starts sending new headers (`X-Internal-Type`, `X-Ghost-Type`, `X-Ghost-Space`, `X-Ghost-Group`)

Steps 1-5 are remember-mcp changes. Step 6 is platform work done in parallel (non-blocking).

---

## Key Design Decisions

### Ghost Memory Architecture

| Decision | Choice | Rationale |
|---|---|---|
| Ghost memory collection target | Accessor's collection (always) | Ghost memories are metadata for understanding the conversation partner long-term |
| Ghost source tag scheme | `ghost_owner:{type}:{id}` | Consistent pattern across user/space/group ghosts |
| Drop `ghost:{accessor_user_id}` tag | Yes | Redundant — accessor is always the collection owner |
| `X-Ghost-Type: user` requirement | Required (not inferred) | Clarity and future-proofing |
| Search auto-scoping | Based on headers, no override | Each ghost only sees its own memories |

### Tool Architecture

| Decision | Choice | Rationale |
|---|---|---|
| Unified vs separate tools | Unified (5 tools, header-driven) | Fewer tools, context-driven, extensible |
| No-context behavior | Error | Prevents misuse as normal memory tools |
| Agent content_type | `'agent'` | Follows ghost pattern |
| Exclude agent from default search | Yes | Matches ghost exclusion pattern |
| Agent auto-tags | `agent` + optional `agent:conversation:{id}` | Simple now, extensible later |

### Migration

| Decision | Choice | Rationale |
|---|---|---|
| Existing ghost tools | Delete | Clean break, no aliases |
| Existing ghost memories | No backfill (acceptable loss) | Minimal existing data |
| Platform header rollout | Non-blocking | Platform ships headers in parallel |

### Space & Group Ghosts

| Decision | Choice | Rationale |
|---|---|---|
| Space ghost personality | Synthesized from published space memories | Represents the collective space identity |
| Space ghost search scope | Space published memories + accessor's ghost memories | Published for knowledge, ghost memories for conversation continuity |
| Group vs space ghost implementation | Same, different source tag | No meaningful behavioral difference |

---

## Future Considerations

- **Conversation-level agent isolation**: `agent:conversation:{conversationId}` tag is reserved for future use
- **Ghost memory backfill**: If needed later, existing ghost memories could be tagged based on `ghost:{userId}` → `ghost_owner:user:{userId}` mapping
- **Space ghost persona configuration**: Currently synthesized from published memories; could become configurable via space settings
- **Cross-ghost search**: Currently disallowed; could be enabled for admin/diagnostic purposes

---

**Status**: Design Specification
**Recommendation**: Implement in remember-mcp and remember-core, coordinate with platform for header rollout
**Related Documents**: [clarification-4-internal-memory-tool-suite.md](../clarifications/clarification-4-internal-memory-tool-suite.md), [tool-suite-refinement.draft.md](../drafts/tool-suite-refinement.draft.md), [local.ghost-persona-system.md](local.ghost-persona-system.md)
