# Ghost Profiles - Pseudonymous Identity System

**Concept**: Users can publish under pseudonymous "ghost" profiles while maintaining accountability  
**Created**: 2026-02-16  
**Status**: Concept / Future Design

---

## Overview

A "ghost" is a pseudonymous profile that users can create to publish memories under different identities. Users can have N ghost profiles, each with a unique name.

### Key Concept

- **User-Chosen Names**: Users choose their own ghost names (subject to uniqueness)
- **Public Attribution**: Memories show ghost name (e.g., "ShadowThought")
- **Private Accountability**: System knows actual `user_id` for permissions
- **Multiple Personas**: Users can create multiple ghosts
- **Unique Names**: Ghost names are globally unique (first-come, first-served)

---

## Use Cases

1. **Privacy**: Share thoughts without revealing real identity
2. **Multiple Personas**: Different ghosts for different topics/communities
3. **Reputation Building**: Build reputation under a consistent pseudonym
4. **Experimentation**: Try different voices/perspectives

---

## Core Questions to Explore

### Identity Management
- How are ghost profiles created?
- How many ghosts can a user have?
- Can ghost names be changed?
- How to ensure ghost name uniqueness?

### Attribution
- ✅ Memories show ghost name (not user_id)
- Can users switch between ghosts?
- Can users publish as themselves vs. a ghost?

### Permissions & Trust
- Does trust apply to user_id or ghost?
- Can ghosts have different trust levels?
- How to prevent abuse (creating many ghosts)?

### Discovery
- Can users discover other ghosts by the same author?
- Should there be a way to "verify" a ghost belongs to someone?
- Can ghosts follow each other?

### Storage
- Where are ghost profiles stored? (Firestore)
- What metadata does a ghost have?
- How to link ghost to user_id securely?

---

## Potential Schema

```typescript
interface Ghost {
  ghost_id: string;           // Firestore document ID (unique internal ID)
  ghost_name: string;         // User-chosen display name (unique globally)
  user_id: string;            // Actual owner (private, for permissions)
  created_at: string;
  bio?: string;               // Optional ghost bio
  avatar?: string;            // Optional avatar
  stats: {
    memories_published: number;
    discovery_count: number;
  };
}

// Firestore path: ghosts/{ghost_id}
// Index on: ghost_name (for uniqueness check)

interface VoidMemory {
  // ... existing fields
  author_id: string;          // user_id (private, for permissions only)
  ghost_id?: string;          // Optional: Firestore ID of ghost (reference only)
  attribution: 'user' | 'ghost';
}
```

**Storage**:
- **Firestore**: `ghosts/{ghost_id}` - Ghost profile data
- **Firestore Index**: On `ghost_id` (document ID, automatic)
- **Uniqueness**: Validated manually by querying all ghosts before creation
- **Weaviate**: Void memories store ONLY `ghost_id` (not ghost_name)

**Uniqueness Validation**:
```typescript
// Before creating ghost
const existingGhosts = await db.collection('ghosts')
  .where('ghost_name', '==', requestedName)
  .limit(1)
  .get();

if (!existingGhosts.empty) {
  throw new Error('Ghost name already taken');
}
```

**Display Logic**:
- When displaying memories, fetch `ghost_name` from Firestore via `ghost_id`
- This ensures name changes propagate automatically
- If `attribution === 'ghost'`: Fetch and show `ghost_name` from `ghosts/{ghost_id}`
- If `attribution === 'user'`: Show user's real name/ID
- `author_id` (user_id) is NEVER shown publicly, only used for permissions

**Trade-off**:
- ✅ Ghost name changes propagate automatically
- ✅ No stale data in Weaviate
- ✅ Manual uniqueness validation (full control)
- ❌ Requires Firestore lookup for each memory display (can be cached)
- ❌ Uniqueness check requires full collection scan (can optimize with index)

---

## Integration with Publishing

### Modified Flow

```
Agent: remember_publish(memory_id, target="void", ghost_id="ghost_123")
  ↓
System: Validates ghost belongs to user, generates token
  ↓
Response: { status: "pending", token: "...", payload: {...} }
  ↓
Agent: "Publish as ghost 'ShadowThought'?"
  ↓
User: "Yes" → remember_confirm(token)
```

---

## Future Tools

- `remember_create_ghost(ghost_name, bio)` - Create new ghost profile
- `remember_list_ghosts()` - List user's ghost profiles
- `remember_update_ghost(ghost_id, updates)` - Update ghost profile
- `remember_delete_ghost(ghost_id)` - Delete ghost (requires confirmation)
- `remember_search_space(query, ghost_name)` - Filter by ghost

---

## Benefits

✅ **Privacy**: Pseudonymous publishing
✅ **Accountability**: System knows real user_id
✅ **Flexibility**: Multiple personas
✅ **Reputation**: Build consistent identity
✅ **Safety**: Can't fully hide (user_id tracked)

---

## Challenges

❌ **Complexity**: Additional layer of identity
❌ **Abuse Prevention**: Users creating many ghosts
❌ **Name Squatting**: Popular ghost names taken
❌ **Trust Model**: How does trust work with ghosts?
❌ **Discovery**: Finding ghosts vs. users

---

## Design Decisions Needed

1. **Ghost Limits**: How many ghosts per user?
2. **Name Policy**: Length, characters, uniqueness
3. **Trust Model**: Per-user or per-ghost?
4. **Verification**: Can users prove ghost ownership?
5. **Deletion**: What happens to memories when ghost deleted?
6. **Migration**: Can memories move between ghosts?

---

## Next Steps

1. Explore trust model implications
2. Design ghost creation/management tools
3. Consider abuse prevention mechanisms
4. Design ghost discovery features
5. Plan migration path from current attribution

---

**Status**: Concept - Requires intensive design work  
**Recommendation**: Implement basic publishing first, add ghosts in future milestone
