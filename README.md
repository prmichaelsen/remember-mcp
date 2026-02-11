# remember-mcp

Multi-tenant memory system MCP server with vector search, relationships, and trust-based access control.

## Features

- 24 MCP tools for memory management
- Multi-tenant with per-user isolation
- Vector search with Weaviate
- Relationship graph between memories
- Template system with auto-suggestion
- Trust-based cross-user access control
- User preferences via conversation

## Quick Start

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
