# Task 1: Initialize Project Structure

**Milestone**: M1 - Project Foundation  
**Estimated Time**: 2 hours  
**Dependencies**: None  
**Status**: Not Started

---

## Objective

Create the basic project structure for remember-mcp with all necessary configuration files and directory organization.

---

## Steps

### 1. Create Project Directory
```bash
mkdir -p remember-mcp
cd remember-mcp
```

### 2. Initialize npm Project
```bash
npm init -y
```

### 3. Update package.json
```json
{
  "name": "remember-mcp",
  "version": "0.1.0",
  "description": "Multi-tenant memory system MCP server with vector search and relationships",
  "main": "dist/server.js",
  "type": "module",
  "scripts": {
    "build": "node esbuild.build.js",
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "lint": "eslint src/**/*.ts",
    "typecheck": "tsc --noEmit"
  },
  "keywords": ["mcp", "memory", "vector-search", "weaviate", "firebase"],
  "author": "",
  "license": "MIT"
}
```

### 4. Create Directory Structure
```bash
mkdir -p src/{weaviate,firestore,types,tools,services,utils,auth,transport,middleware}
mkdir -p tests/{unit,integration,security,performance}
mkdir -p agent/{design,milestones,patterns,tasks}
```

### 5. Create Configuration Files

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**esbuild.build.js**:
```javascript
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/server.js',
  sourcemap: true,
  external: [
    'weaviate-client',
    'firebase-admin',
    '@modelcontextprotocol/sdk'
  ],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
  }
});

console.log('✓ Build complete');
```

**.gitignore**:
```
# Dependencies
node_modules/
package-lock.json

# Build output
dist/
*.js.map

# Environment
.env
.env.local
serviceAccount.json
firebase-key.json

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*

# Testing
coverage/
.nyc_output/

# Misc
.cache/
temp/
tmp/
```

**.env.example**:
```env
# Weaviate Configuration
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=

# OpenAI Configuration
OPENAI_APIKEY=sk-...

# Firebase Configuration
FIREBASE_PROJECT_ID=remember-mcp-dev
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json

# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# MCP Configuration
MCP_TRANSPORT=sse
```

**README.md**:
```markdown
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

\`\`\`bash
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
\`\`\`

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
```

---

## Verification

- [ ] Project directory created
- [ ] package.json configured correctly
- [ ] Directory structure matches specification
- [ ] tsconfig.json created
- [ ] esbuild.build.js created
- [ ] .gitignore created
- [ ] .env.example created
- [ ] README.md created
- [ ] All directories exist

---

## Next Task

Task 2: Install Dependencies
