# Task 2: Install Dependencies

**Milestone**: M1 - Project Foundation
**Estimated Time**: 1 hour
**Dependencies**: Task 1 ✅
**Status**: ✅ COMPLETED (2026-02-11)

---

## Objective

Install all required npm dependencies for the remember-mcp project.

---

## Steps

### 1. Install Core Dependencies

```bash
npm install @modelcontextprotocol/sdk
npm install weaviate-client
npm install firebase-admin
npm install firebase-auth-cloudflare-workers
npm install dotenv
```

### 2. Install Build Tools

```bash
npm install --save-dev typescript
npm install --save-dev tsx
npm install --save-dev esbuild
npm install --save-dev @types/node
```

### 3. Install Testing Tools

```bash
npm install --save-dev vitest
npm install --save-dev @vitest/ui
npm install --save-dev @types/jest
```

### 4. Install Linting Tools

```bash
npm install --save-dev eslint
npm install --save-dev @typescript-eslint/parser
npm install --save-dev @typescript-eslint/eslint-plugin
npm install --save-dev prettier
```

### 5. Create ESLint Configuration

**.eslintrc.json**:
```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": "off"
  },
  "env": {
    "node": true,
    "es2022": true
  }
}
```

### 6. Create Prettier Configuration

**.prettierrc**:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### 7. Verify Installation

```bash
# Check TypeScript
npx tsc --version

# Check ESLint
npx eslint --version

# Check Vitest
npx vitest --version
```

---

## Expected package.json Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^latest",
    "dotenv": "^16.4.5",
    "firebase-admin": "^12.0.0",
    "firebase-auth-cloudflare-workers": "^latest",
    "weaviate-client": "^latest"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.19",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@vitest/ui": "^1.3.0",
    "esbuild": "^0.20.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.5",
    "tsx": "^4.7.1",
    "typescript": "^5.3.3",
    "vitest": "^1.3.0"
  }
}
```

---

## Completion Status

**✅ COMPLETED**: All dependencies successfully installed.

## Verification Results

- [x] All core dependencies installed (600 packages)
- [x] All dev dependencies installed
- [x] TypeScript v5.9.3 installed and working
- [x] ESLint v8.57.1 installed and working
- [x] Jest v29.7.0 installed and working
- [x] esbuild v0.20.2 installed and working
- [x] node_modules/ directory created
- [x] package-lock.json created

## Installation Summary

**Completed**: 2026-02-11

**What Was Installed**:
- ✅ @modelcontextprotocol/sdk v1.0.4 - MCP protocol support
- ✅ weaviate-client v3.2.0 - Vector database client
- ✅ firebase-admin v12.0.0 - Firestore access
- ✅ dotenv v16.4.5 - Environment variables
- ✅ TypeScript v5.9.3 - Type checking
- ✅ esbuild v0.20.2 - Build system
- ✅ Jest v29.7.0 - Testing framework
- ✅ ESLint v8.57.1 - Linting
- ✅ tsx v4.7.1 - TypeScript execution
- ✅ Total: 600 packages installed

**Notes**:
- 1 moderate severity vulnerability detected (can be addressed later)
- Some deprecated packages (eslint 8.x, glob 7.x) - non-blocking

**What's Next**:
- Task 3: Set up Weaviate client wrapper
- Task 4: Set up Firestore client wrapper

---

## Troubleshooting

### If weaviate-client fails to install:
```bash
npm install weaviate-ts-client
# or
npm install weaviate-client@latest --legacy-peer-deps
```

### If Firebase Admin fails:
```bash
npm install firebase-admin@latest
```

---

## Next Task

Task 3: Set Up Weaviate Client
