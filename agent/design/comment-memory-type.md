# Comment Content Type - Threaded Discussions in Shared Spaces

**Concept**: Use existing `comment` content type for replies, enabling infinitely nested threaded discussions
**Created**: 2026-02-16
**Updated**: 2026-02-27
**Status**: Implemented — Phase 1 Complete

---

## Overview

Use the existing `comment` content type for replies to memories in shared spaces. Comments enable infinitely nested threaded discussions while maintaining the ability to filter them out during space searches, keeping the main discovery experience clean.

**Phase 1 Scope**: Zero new tools required! Use existing `remember_create_memory` with `type: "comment"` and additional fields (`parent_id`, `thread_id`). Thread viewing uses existing `remember_search_space` with filters. Advanced features (dedicated thread tool, voting, moderation) deferred to future versions.

---

## Problem Statement

### Current Limitations

1. **No Discussion Mechanism**: Users can't reply to memories in shared spaces
2. **No Threading**: Can't build conversations around interesting memories
3. **No Filtering**: If we add replies as regular memories, they clutter search results
4. **No Context**: Replies don't reference what they're replying to

### Use Cases

**Scenario 1**: User finds interesting memory in "The Void"
```
Memory: "I just discovered a great hiking trail in Colorado"
User wants to: "Which trail? I'm planning a trip there!"
```

**Scenario 2**: Discussion thread
```
Memory: "Best practices for TypeScript generics"
Comment 1: "Great point about constraint inference!"
Comment 2: "Have you tried conditional types?"
Comment 3: "This helped me solve my problem, thanks!"
```

**Scenario 3**: Clean discovery
```
Search "hiking trails" in The Void
→ Show only original memories (not 100 comments)
→ User can choose to view comments on interesting memories
```

---

## Solution: Use Existing Content Type

### Architecture

**Use Existing `comment` Content Type**: Already in the 45 content types!

```typescript
// Create comment using existing remember_create_memory
remember_create_memory({
  type: "comment",             // ✅ Existing content type!
  content: "Great post!",
  parent_id: "memory123",      // ✅ New field
  parent_type: "memory",       // ✅ New field
  thread_id: "memory123",      // ✅ New field
  spaces: ["the_void"]         // ✅ New field (for unified collection)
})
```

### Key Design Decisions

1. **Reuse Content Type**: `type: "comment"` already exists
   - No new doc_type needed
   - Filter by content type: `type == "comment"`
   - Consistent with existing architecture

2. **Add Thread Fields**: Extend Memory schema
   - `parent_id`: Direct parent (memory or comment)
   - `parent_type`: 'memory' | 'comment'
   - `thread_id`: Root memory (for fetching entire thread)
   - **No depth limit**: Comments can nest infinitely

3. **Space Inheritance**: Comments inherit parent's spaces
   - Simplifies publishing
   - Ensures comments stay with memory
   - Automatic multi-space support

4. **Zero New Tools**: Reuse existing infrastructure
   - `remember_create_memory` for creating comments
   - `remember_search_space` for viewing comments
   - `remember_update_memory` for editing comments
   - `remember_delete_memory` for deleting comments

---

## Benefits

### 1. Clean Discovery Experience

**Search without comments** (default):
```typescript
remember_search_space({
  spaces: ["the_void"],
  query: "hiking trails"
  // Filters out type: "comment" by default
})
// Returns only original memories, not replies
```

**Search with comments** (if needed):
```typescript
remember_search_space({
  spaces: ["the_void"],
  query: "hiking trails",
  content_type: null  // ✅ Don't filter by type = include comments
})
```

**Or filter to comments only**:
```typescript
remember_search_space({
  spaces: ["the_void"],
  query: "hiking trails",
  content_type: "comment"  // ✅ Only comments
})
```

### 2. Threaded Discussions

**Create comment** (use existing tool):
```typescript
remember_create_memory({
  type: "comment",
  content: "Which trail?",
  parent_id: "memory123",
  parent_type: "memory",
  thread_id: "memory123",
  spaces: ["the_void"]  // Inherited from parent
})
```

**Fetch thread** (use existing search):
```typescript
remember_search_space({
  spaces: ["the_void"],
  query: "",  // Empty = get all
  content_type: "comment",
  filters: {
    thread_id: "memory123"  // Get all comments in this thread
  },
  limit: 100
})
```

**Response**: Flat list of comments, UI builds tree from `parent_id` relationships

### 3. Notification System

**Notify parent author**:
```
User A publishes memory to The Void
User B comments on it
→ User A gets notification: "Someone commented on your memory"
```

---

## Implementation

### New Tools

#### Phase 1: remember_create_comment (v2.5.0)

```typescript
{
  name: 'remember_create_comment',
  description: 'Create a comment (reply) to a memory or another comment in a shared space',
  inputSchema: {
    type: 'object',
    properties: {
      parent_id: {
        type: 'string',
        description: 'ID of memory or comment being replied to'
      },
      content: {
        type: 'string',
        description: 'Comment text'
      },
      parent_type: {
        type: 'string',
        enum: ['memory', 'comment'],
        default: 'memory'
      }
    },
    required: ['parent_id', 'content']
  }
}
```

#### 2. remember_get_thread

```typescript
{
  name: 'remember_get_thread',
  description: 'Get a memory and all its comments (threaded discussion)',
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: {
        type: 'string',
        description: 'ID of the root memory'
      },
      sort: {
        type: 'string',
        enum: ['recent', 'oldest'],  // 'popular' requires voting
        default: 'recent'
      },
      limit: {
        type: 'number',
        description: 'Max comments to return',
        default: 100
      }
    },
    required: ['memory_id']
  }
}
```

#### 3. remember_vote_comment

```typescript
{
  name: 'remember_vote_comment',
  description: 'Upvote or downvote a comment',
  inputSchema: {
    type: 'object',
    properties: {
      comment_id: {
        type: 'string',
        description: 'ID of comment to vote on'
      },
      vote: {
        type: 'string',
        enum: ['up', 'down', 'remove'],
        description: 'Vote type (remove = remove your vote)'
      }
    },
    required: ['comment_id', 'vote']
  }
}
```

#### 4. remember_flag_comment

```typescript
{
  name: 'remember_flag_comment',
  description: 'Flag a comment as inappropriate',
  inputSchema: {
    type: 'object',
    properties: {
      comment_id: {
        type: 'string',
        description: 'ID of comment to flag'
      },
      reason: {
        type: 'string',
        enum: ['spam', 'harassment', 'inappropriate', 'other'],
        description: 'Reason for flagging'
      }
    },
    required: ['comment_id', 'reason']
  }
}
```

### Schema Changes

**Add to Weaviate schema**:
```typescript
// New properties for comments
{
  name: 'parent_id',
  dataType: 'text' as any,
  description: 'ID of parent memory or comment'
},
{
  name: 'parent_type',
  dataType: 'text' as any,
  description: 'Type of parent: memory or comment'
},
{
  name: 'thread_id',
  dataType: 'text' as any,
  description: 'Root memory ID for thread queries'
},
{
  name: 'upvotes',
  dataType: 'number' as any,
  description: 'Number of upvotes'
},
{
  name: 'downvotes',
  dataType: 'number' as any,
  description: 'Number of downvotes'
},
{
  name: 'flagged',
  dataType: 'boolean' as any,
  description: 'Whether comment has been flagged'
},
{
  name: 'hidden',
  dataType: 'boolean' as any,
  description: 'Whether comment is hidden by moderators'
}
```

### Firestore Changes (Phase 1 - Basic Only)

**No additional Firestore collections needed for Phase 1**

Comments stored in Weaviate with basic fields only.

**Future Firestore Collections** (when ACL system ready):
- `users/{user_id}/votes/{comment_id}` - Vote tracking
- `comments/{comment_id}/moderation/{space_id}` - Per-space moderation
- `spaces/{space_id}/moderators/{user_id}` - Moderator permissions

---

## User Experience

### Scenario 1: Discovering and Commenting

```
1. User searches The Void: "best hiking trails"
   → Results show only memories (no comments)
   
2. User finds interesting memory: "Bear Lake Trail is amazing"
   → Clicks to view details
   
3. User sees comment count: "15 comments"
   → Clicks to view thread
   
4. User reads deeply nested discussion (10+ levels)
   → UI renders tree structure from flat comment list
   
5. User replies to a deeply nested comment
   → Creates comment with parent_id pointing to that comment
   
6. Original author gets notification
   → Can reply at any depth in the thread
```

### Scenario 2: Filtering Comments

```typescript
// Default: Comments not included
remember_search_space({
  spaces: ["the_void"],
  query: "hiking"
  // include_comments: false (default)
})
// Returns: 10 memories

// Include comments
remember_search_space({
  spaces: ["the_void"],
  query: "hiking",
  include_comments: true  // ✅ Positive flag
})
// Returns: 10 memories + 50 comments = 60 results
```

---

## Trade-offs

### Pros

✅ **Clean Discovery**: Comments don't clutter search results
✅ **Threaded Discussions**: Enable conversations around memories
✅ **Community Engagement**: Upvotes, flags, moderation
✅ **Flexible**: Can include/exclude comments as needed
✅ **Scalable**: Separate doc_type enables efficient filtering
✅ **Notifications**: Authors know when someone engages

### Cons

❌ **Complexity**: New document type, new tools, new UI
❌ **Moderation**: Need to handle spam, harassment
❌ **Storage**: Comments add to storage costs
❌ **Performance**: Thread queries could be expensive
❌ **Notifications**: Need notification system

---

## Alternatives Considered

### Alternative 1: Comments as Regular Memories

**Approach**: Use existing `memory` type with `reply_to` field

**Pros**: Simpler, reuses existing infrastructure
**Cons**: Can't filter out replies, clutters search results
**Verdict**: ❌ Poor UX for discovery

### Alternative 2: Comments as Relationships

**Approach**: Use `relationship` type with `observation` as comment

**Pros**: Reuses existing type
**Cons**: Relationships are for connecting memories, not discussions
**Verdict**: ❌ Wrong semantic model

### Alternative 3: Separate Comments Collection

**Approach**: `Memory_public_comments` collection

**Pros**: Complete isolation
**Cons**: Can't search comments with memories, complex queries
**Verdict**: ❌ Too isolated

### Alternative 4: Comments in Firestore Only

**Approach**: Store comments in Firestore, not Weaviate

**Pros**: Simpler Weaviate schema
**Cons**: Can't search comment content, no vector similarity
**Verdict**: ❌ Loses search capability

---

## Security Considerations

### Comment Moderation

**Auto-hide spam**:
```typescript
if (comment.flagged_count > 3) {
  comment.hidden = true;
  notifyModerators(comment);
}
```

**Rate limiting**:
```typescript
// Max 10 comments per user per hour
const recentComments = await getRecentComments(userId, '1h');
if (recentComments.length >= 10) {
  throw new Error('Rate limit exceeded');
}
```

### Vote Manipulation

**One vote per user per comment**:
```typescript
// Store in Firestore: users/{user_id}/votes/{comment_id}
const existingVote = await getVote(userId, commentId);
if (existingVote) {
  // Update or remove vote
} else {
  // Create new vote
}
```

**Prevent self-voting**:
```typescript
if (comment.user_id === userId) {
  throw new Error('Cannot vote on your own comment');
}
```

---

## Open Questions

1. **Edit/delete comments?**
   - Recommendation: Yes, with edit history
   - Show "[edited]" indicator

2. **Anonymous comments?**
   - Recommendation: No, require attribution
   - Reduces spam and abuse

3. **Comment length limit?**
   - Recommendation: 1000 characters
   - Shorter than memories (10,000)

4. **Notification system?**
   - Recommendation: Firestore + Cloud Functions
   - Real-time notifications

---

## Implementation Roadmap

### Phase 1: Basic Comments (v2.5.0)

- [ ] Add `comment` doc_type to schema
- [ ] Implement `remember_create_comment`
- [ ] Implement `remember_get_thread`
- [ ] Update search to exclude comments by default
- [ ] Add `include_comments` parameter (default: false)

### Phase 2: Engagement (v2.6.0)

- [ ] Implement `remember_vote_comment`
- [ ] Add upvote/downvote tracking in Firestore
- [ ] Sort comments by popularity
- [ ] Show vote counts in UI

### Phase 3: Moderation (v2.7.0)

- [ ] Implement `remember_flag_comment` (with space_id)
- [ ] Add per-space moderation tracking in Firestore
- [ ] Implement `remember_hide_comment` (moderator tool)
- [ ] Auto-hide heavily flagged comments per space
- [ ] Filter hidden comments when fetching threads
- [ ] Moderator dashboard per space

### Phase 4: Notifications (v2.8.0)

- [ ] Notify authors of new comments
- [ ] Notify users of replies to their comments
- [ ] Email/push notification integration
- [ ] Notification preferences

---

## Success Criteria

- [ ] Users can comment on memories in shared spaces
- [ ] Comments don't clutter search results by default
- [ ] Thread view shows infinitely nested comments correctly
- [ ] UI efficiently builds tree from flat comment list
- [ ] Upvotes/downvotes work and affect sorting
- [ ] Flagging system prevents spam per space
- [ ] Comments can be hidden in one space but visible in others
- [ ] Moderators can manage comments in their spaces
- [ ] Authors receive notifications
- [ ] Performance acceptable with 1000+ comments per memory
- [ ] All tests passing

---

**Status**: Design Proposal - Awaiting Approval
**Recommendation**: Implement in v2.5.0 after unified public collection (v2.4.0)

**Next Steps**:
1. Review and approve design
2. Decide on open questions
3. Create implementation tasks
4. Begin Phase 1 development
