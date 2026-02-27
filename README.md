# remember-mcp

Multi-tenant memory system MCP server with vector search, relationships, and trust-based access control.

## Value Proposition

**remember-mcp** gives AI assistants a persistent, searchable memory system that enables them to:

- **Remember Everything**: Store and recall information across conversations
- **Find Connections**: Discover relationships between memories using semantic search
- **Learn Over Time**: Build a knowledge graph that grows with each interaction
- **Personalize Responses**: Access user preferences and context for tailored interactions
- **Search Intelligently**: Use hybrid semantic + keyword search to find relevant memories
- **Organize Knowledge**: Categorize memories with 45+ content types (people, events, recipes, notes, etc.)

### Why Use remember-mcp?

**For AI Assistants**:
- Persistent memory across sessions (no more forgetting previous conversations)
- Semantic search finds relevant context even with different wording
- Relationship tracking reveals connections between memories
- RAG-optimized queries for natural language understanding
- Trust-based access control for privacy-sensitive information

**For Developers**:
- Multi-tenant architecture with per-user isolation
- Production-ready with comprehensive error handling
- Compatible with Claude Desktop, mcp-auth, and custom integrations
- Vector embeddings via OpenAI for semantic understanding
- Firestore for metadata and preferences

**For Users**:
- Their AI assistant remembers important information
- Discovers connections between different topics
- Provides personalized responses based on preferences
- Respects privacy with trust-based access control

## Use Cases

### Personal Assistant
- "Remember that Sarah's birthday is June 15th"
- "What did I learn about React hooks last week?"
- "Find all my camping trip memories"
- "What recipes have I saved that use chicken?"

### Knowledge Management
- Store research notes with semantic search
- Track relationships between concepts
- Build a personal knowledge graph
- Query with natural language

### Project Tracking
- Remember project decisions and context
- Link related tasks and ideas
- Search across all project memories
- Track what inspired each decision

### Relationship Management
- Remember details about people you meet
- Track connections between contacts
- Recall conversation context
- Find related interactions

## Features

- **18 MCP Tools**: Complete CRUD for memories, relationships, preferences, shared spaces, and content sync
- **Soft Delete with Recovery**: Safe deletion with confirmation flow and recovery capability
- **Multi-Tenant**: Per-user isolation with secure data boundaries
- **Shared Spaces**: Publish memories to shared discovery spaces like "The Void"
- **Token-Based Confirmation**: Secure two-phase workflow for sensitive operations (publish, delete)
- **Vector Search**: Semantic + keyword hybrid search with Weaviate
- **Knowledge Graph**: N-way relationships with bidirectional tracking
- **RAG Queries**: Natural language queries with context-aware responses
- **45 Content Types**: Notes, events, people, recipes, goals, tasks, and more
- **User Preferences**: Customizable search, location, privacy, and display settings
- **Trust-Based Access**: Fine-grained access control (0-1 trust levels)
- **Production-Ready**: Comprehensive error handling and logging

## Quick Start

### Option 1: Use with Claude Desktop (Recommended)

Add to your Claude Desktop MCP configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "remember": {
      "command": "npx",
      "args": ["-y", "@prmichaelsen/remember-mcp"],
      "env": {
        "WEAVIATE_REST_URL": "https://your-instance.weaviate.cloud",
        "WEAVIATE_API_KEY": "your-weaviate-api-key",
        "OPENAI_EMBEDDINGS_API_KEY": "sk-...",
        "FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY": "{\"type\":\"service_account\",\"project_id\":\"your-project\",\"private_key\":\"-----BEGIN PRIVATE KEY-----\\nYOUR_KEY\\n-----END PRIVATE KEY-----\\n\",\"client_email\":\"firebase-adminsdk@your-project.iam.gserviceaccount.com\"}",
        "FIREBASE_PROJECT_ID": "your-project-id"
      }
    }
  }
}
```

**Important**:
- Use `\\n` (double backslash) for newlines in private_key
- Escape all quotes with `\"`
- Get Weaviate Cloud at https://console.weaviate.cloud
- Get Firebase service account from Firebase Console → Project Settings → Service Accounts

### Option 2: Standalone (stdio transport)

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Run in development
npm run dev

# Build for production
npm run build
npm start
```

### Option 3: With mcp-auth (multi-tenant production)

```typescript
import { wrapServer, JWTAuthProvider } from '@prmichaelsen/mcp-auth';
import { createServer } from '@prmichaelsen/remember-mcp/factory';

const wrapped = wrapServer({
  serverFactory: createServer,
  authProvider: new JWTAuthProvider({
    jwtSecret: process.env.JWT_SECRET
  }),
  // tokenResolver not needed - remember-mcp is self-managed
  resourceType: 'remember',
  transport: { type: 'sse', port: 3000 }
});

await wrapped.start();
```

## Architecture

- **Weaviate**: Vector storage for memories, relationships, and shared spaces
  - Personal collections: `Memory_users_{userId}` (per-user isolation)
  - Public space collection: `Memory_spaces_public` (all shared spaces)
  - Group collections: `Memory_groups_{groupId}` (private groups)
  - Composite IDs: `{userId}.{memoryId}` for published memories
  - Tracking arrays: `space_ids[]` and `group_ids[]` track publication locations
- **Firestore**: Permissions, preferences, confirmation tokens
  - User data: `users/{user_id}/preferences`, `users/{user_id}/requests`
- **Firebase Auth**: User authentication

### Memory Collection Pattern v2 (v3.1.0+)

Three-tier collection architecture with composite IDs and tracking arrays.

**Collections**:
- `Memory_users_{userId}` — Private memories with simple IDs
- `Memory_spaces_public` — All public space memories with composite IDs
- `Memory_groups_{groupId}` — Group memories with composite IDs

**Key Features**:
- Publish to multiple spaces and groups simultaneously
- Composite IDs (`{userId}.{memoryId}`) preserve source reference
- `remember_revise` syncs content changes to all published copies
- Orphan strategy keeps retracted memories for historical reference
- Revision history (max 10 entries) tracks content changes

**Example**:
```typescript
// Publish to spaces + groups
remember_publish({
  memory_id: "my-recipe",
  spaces: ["cooking", "recipes"],
  groups: ["foodie-club"]
})

// Search across spaces
remember_search_space({
  query: "pasta recipe",
  spaces: ["cooking"],
  search_type: "hybrid"
})
```

## Shared Spaces

Publish memories to shared discovery spaces where other users can find them.

### The Void

"The Void" is a shared space for discovering thoughts and ideas from other users.

### Publishing Workflow

1. **Publish**: Generate confirmation token
```typescript
// Publish to spaces + groups
remember_publish({
  memory_id: "abc123",
  spaces: ["the_void", "cooking"],
  groups: ["foodie-club"]
})
// Returns: { success: true, token: "xyz789" }
```

2. **Confirm**: Execute the publication
```typescript
remember_confirm({ token: "xyz789" })
// Creates composite ID copies in Memory_spaces_public and Memory_groups_{groupId}
```

3. **Revise**: Sync content changes (confirmation required)
```typescript
// After updating source memory, request revision
remember_revise({ memory_id: "abc123" })
// Returns: { success: true, token: "xyz789" }

remember_confirm({ token: "xyz789" })
// Updates all copies, preserves old content in revision_history
```

4. **Retract**: Remove from specific destinations
```typescript
remember_retract({ memory_id: "abc123", spaces: ["cooking"] })
// Orphan strategy: memory remains in collection for historical reference
```

5. **Search**: Discover shared memories
```typescript
remember_search_space({
  query: "pasta recipe",
  spaces: ["cooking"],
  search_type: "hybrid"  // hybrid | bm25 | semantic
})
```

### Space & Group Tools

- `remember_publish` - Publish to spaces and/or groups (confirmation required)
- `remember_retract` - Retract from spaces and/or groups (confirmation required)
- `remember_revise` - Sync content to all published copies (confirmation required)
- `remember_confirm` - Confirm any pending action
- `remember_deny` - Cancel any pending action
- `remember_search_space` - Search shared spaces and groups
- `remember_query_space` - Ask questions about shared memories

## Safe Deletion with Confirmation

**v3.0.0+**: Deletion now requires confirmation to prevent accidental data loss.

### Deletion Workflow

1. **Request Deletion**: Generate confirmation token
```typescript
remember_delete_memory({
  memory_id: "abc123",
  reason: "No longer needed"
})

// Returns:
{
  "success": true,
  "token": "xyz789",
  "expires_at": "2026-02-25T17:30:00Z",
  "preview": {
    "memory_id": "abc123",
    "content": "My camping trip to Yosemite...",
    "type": "note",
    "relationships_count": 3,
    "will_orphan": ["rel1", "rel2", "rel3"]
  },
  "message": "Deletion requested. Use remember_confirm with token..."
}
```

2. **User Confirms**: Execute the deletion
```typescript
remember_confirm({ token: "xyz789" })

// Returns:
{
  "success": true,
  "memory_id": "abc123",
  "message": "Memory deleted successfully"
}
```

3. **Memory is Soft-Deleted**: Marked as deleted, not removed
- Memory remains in database with `deleted_at` timestamp
- Excluded from searches by default
- Can be searched with `deleted_filter: "include"` or `"only"`
- Future: restoration tool (not in v3.0.0)

### Searching Deleted Memories

**Default behavior** (exclude deleted):
```typescript
remember_search_memory({ query: "camping" })
// Returns only active memories
```

**Include deleted memories**:
```typescript
remember_search_memory({
  query: "camping",
  deleted_filter: "include"
})
// Returns both active and deleted memories
```

**Only deleted memories**:
```typescript
remember_search_memory({
  query: "camping",
  deleted_filter: "only"
})
// Returns only deleted memories
```

**Applies to all search tools**:
- `remember_search_memory`
- `remember_query_memory`
- `remember_find_similar`
- `remember_search_relationship`

### Important Notes

**⚠️ Breaking Change (v3.0.0)**:
- Deletion now requires confirmation (two-step process)
- Deleted memories excluded from searches by default
- Cannot create relationships with deleted memories
- Cannot update deleted memories

**Data Safety**:
- Deleted memories remain in database (soft delete)
- No permanent deletion feature
- Deletion timestamp and reason tracked
- Future restoration capability planned

## Debugging

Enable detailed debug logging with the `REMEMBER_MCP_DEBUG_LEVEL` environment variable:

```bash
# No debug output (production default)
REMEMBER_MCP_DEBUG_LEVEL=NONE

# Only errors
REMEMBER_MCP_DEBUG_LEVEL=ERROR

# Warnings and errors
REMEMBER_MCP_DEBUG_LEVEL=WARN

# Info, warnings, and errors
REMEMBER_MCP_DEBUG_LEVEL=INFO

# Debug, info, warnings, and errors (recommended for development)
REMEMBER_MCP_DEBUG_LEVEL=DEBUG

# Everything including parameter dumps (use with caution)
REMEMBER_MCP_DEBUG_LEVEL=TRACE
```

**Example**:
```bash
# Enable debug logging for development
REMEMBER_MCP_DEBUG_LEVEL=DEBUG npm run dev

# Enable trace logging for troubleshooting
REMEMBER_MCP_DEBUG_LEVEL=TRACE npm start
```

**⚠️ Security Note**: TRACE level includes full parameter dumps and may expose sensitive data. Use only in development environments.

## Documentation

See `agent/design/` for detailed documentation:
- [Memory Collection Pattern v2](agent/design/local.memory-collection-pattern-v2.md) — Architecture and design rationale
- [v2 API Reference](agent/design/local.v2-api-reference.md) — Complete tool schemas and parameters
- [v2 Migration Guide](agent/design/local.v2-migration-guide.md) — Migrating from v1 to v2
- [v2 Usage Examples](agent/design/local.v2-usage-examples.md) — Real-world usage patterns

Additional project docs:
- Milestones (`agent/milestones/`)
- Implementation tasks (`agent/tasks/`)

## License

MIT
