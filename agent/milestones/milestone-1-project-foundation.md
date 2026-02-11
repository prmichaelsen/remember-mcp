# Milestone 1: Project Foundation

**Goal**: Set up new remember-mcp project with basic infrastructure  
**Duration**: 1 week  
**Dependencies**: None  
**Status**: Not Started

---

## Overview

Initialize the remember-mcp project from scratch with all necessary infrastructure, build tools, and database connections.

---

## Deliverables

### 1. Project Structure
- New `remember-mcp/` directory (separate from index)
- package.json with project metadata
- TypeScript configuration (tsconfig.json)
- Build system using esbuild
- Directory structure: src/, tests/, agent/
- .gitignore file
- README.md with project overview

### 2. Dependencies
- @modelcontextprotocol/sdk - MCP protocol
- weaviate-client - Vector database
- firebase-admin - Firestore access
- firebase-auth-cloudflare-workers - JWT validation
- dotenv - Environment variables
- Dev dependencies: typescript, tsx, vitest, eslint

### 3. Database Connections
- Weaviate client wrapper
- Firestore client wrapper
- Connection testing utilities
- Environment variable configuration

### 4. Basic MCP Server
- Server initialization
- Stdio transport (for testing)
- Health check endpoint
- Basic error handling

---

## Success Criteria

- [ ] Project builds successfully (`npm run build`)
- [ ] Can connect to Weaviate instance
- [ ] Can connect to Firestore
- [ ] Basic MCP server responds to requests
- [ ] TypeScript compiles without errors
- [ ] All dependencies installed correctly

---

## Key Files to Create

```
remember-mcp/
├── package.json
├── tsconfig.json
├── esbuild.build.js
├── .gitignore
├── .env.example
├── README.md
├── src/
│   ├── server.ts
│   ├── weaviate/
│   │   └── client.ts
│   ├── firestore/
│   │   └── client.ts
│   ├── types/
│   │   ├── memory.ts
│   │   ├── context.ts
│   │   └── config.ts
│   └── utils/
│       └── logger.ts
└── tests/
    └── setup.test.ts
```

---

## Environment Variables

```env
# Weaviate
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=

# OpenAI
OPENAI_APIKEY=sk-...

# Firebase
FIREBASE_PROJECT_ID=remember-mcp-dev
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json

# Server
PORT=3000
NODE_ENV=development
```

---

## Testing

- [ ] Weaviate connection test
- [ ] Firestore connection test
- [ ] MCP server initialization test
- [ ] Environment variable loading test

---

**Next Milestone**: M2 - Core Memory System  
**Blockers**: None
