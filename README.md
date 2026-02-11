# remember-mcp

Multi-tenant memory system MCP server with vector search, relationships, and trust-based access control.

## Features

- 10 MCP tools for memory and relationship management
- Multi-tenant with per-user isolation
- Vector search with Weaviate (semantic + keyword hybrid search)
- Knowledge graph with relationship tracking
- RAG queries with natural language
- 45 content types (notes, events, people, recipes, etc.)
- Trust-based access control (planned for M7)

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

- **Weaviate**: Vector storage for memories, relationships, templates
- **Firestore**: Permissions, preferences, metadata
- **Firebase Auth**: User authentication

## Documentation

See `agent/` directory for:
- Design documents (`agent/design/`)
- Milestones (`agent/milestones/`)
- Implementation tasks (`agent/tasks/`)

## License

MIT
