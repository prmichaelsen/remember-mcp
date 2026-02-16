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

- **17 MCP Tools**: Complete CRUD for memories, relationships, preferences, and shared spaces
- **Multi-Tenant**: Per-user isolation with secure data boundaries
- **Shared Spaces**: Publish memories to shared discovery spaces like "The Void"
- **Token-Based Confirmation**: Secure two-phase workflow for sensitive operations
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
  - Personal collections: `Memory_{user_id}` (per-user isolation)
  - Unified public collection: `Memory_public` (all public spaces)
  - Multi-space support: Memories can belong to multiple spaces via `spaces` array
- **Firestore**: Permissions, preferences, confirmation tokens
  - User data: `users/{user_id}/preferences`, `users/{user_id}/requests`
- **Firebase Auth**: User authentication

### Multi-Space Architecture (v2.4.0+)

**Unified Collection**: All public memories stored in single `Memory_public` collection

**Benefits**:
- ✅ Search multiple spaces in one query
- ✅ Publish to multiple spaces in one operation
- ✅ No memory duplication
- ✅ Efficient storage (N× reduction)

**Example**:
```typescript
// One memory, three spaces
{
  "id": "abc123",
  "spaces": ["the_void", "dogs", "cats"],
  "content": "My dog is adorable!",
  "author_id": "user123"
}

// Search across spaces
remember_search_space({
  spaces: ["the_void", "dogs"],
  query: "adorable pets"
})
// Finds memories published to ANY of the requested spaces
```

## Shared Spaces

Publish memories to shared discovery spaces where other users can find them.

### The Void

"The Void" is a shared space for discovering thoughts and ideas from other users.

### Publishing Workflow

1. **Request Publication**: Generate confirmation token
```typescript
// Publish to single space
remember_publish({ memory_id: "abc123", spaces: ["the_void"] })

// Publish to multiple spaces at once!
remember_publish({ memory_id: "abc123", spaces: ["the_void", "dogs", "cats"] })

// Returns: { success: true, token: "xyz789" }
```

2. **User Confirms**: Execute the publication
```typescript
remember_confirm({ token: "xyz789" })
// Returns: {
//   success: true,
//   space_memory_id: "new-id",
//   spaces: ["the_void", "dogs", "cats"]
// }
```

3. **Discover**: Search shared spaces
```typescript
// Search single space
remember_search_space({ query: "interesting ideas", spaces: ["the_void"] })

// Search multiple spaces at once!
remember_search_space({
  query: "cute dog pictures",
  spaces: ["the_void", "dogs"]
})
```

### Space Tools (5 new)

- `remember_publish` - Request to publish memory (generates token)
- `remember_confirm` - Confirm any pending action
- `remember_deny` - Cancel any pending action
- `remember_search_space` - Search shared spaces
- `remember_query_space` - Ask questions about shared memories

## Documentation

See `agent/` directory for:
- Design documents (`agent/design/`)
- Milestones (`agent/milestones/`)
- Implementation tasks (`agent/tasks/`)

## License

MIT
