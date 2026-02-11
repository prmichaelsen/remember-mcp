# Testing Pattern - Colocated Tests

**Concept**: Tests live alongside the code they test  
**Created**: 2026-02-11  
**Status**: Project Standard

---

## Overview

Tests in remember-mcp are **colocated** with their source files, not in a separate `tests/` directory. This follows modern best practices for better discoverability and maintainability.

---

## File Naming Convention

### Unit Tests: `.spec.ts`
```
src/
├── weaviate/
│   ├── client.ts           # Source code
│   └── client.spec.ts      # Unit tests (colocated)
├── firestore/
│   ├── init.ts
│   ├── init.spec.ts        # Unit tests
│   ├── paths.ts
│   └── paths.spec.ts       # Unit tests
└── services/
    ├── user-preferences.service.ts
    └── user-preferences.service.spec.ts
```

### E2E/Integration Tests: `.e2e.ts`
```
src/
├── weaviate/
│   ├── client.ts
│   ├── client.spec.ts      # Unit tests
│   └── client.e2e.ts       # E2E tests (requires Weaviate instance)
└── firestore/
    ├── init.ts
    ├── init.spec.ts        # Unit tests
    └── init.e2e.ts         # E2E tests (requires Firebase)
```

---

## Jest Configuration

### jest.config.js (Unit Tests)
```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  roots: ['<rootDir>/src'],              // ✅ Tests in src/
  testMatch: ['**/*.spec.ts'],            // ✅ Only .spec.ts files
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',                  // ✅ Exclude test files
    '!src/**/*.e2e.ts',                   // ✅ Exclude e2e files
  ],
};
```

### jest.e2e.config.js (E2E Tests)
```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  roots: ['<rootDir>/src'],              // ✅ Tests in src/
  testMatch: ['**/*.e2e.ts'],            // ✅ Only .e2e.ts files
  testTimeout: 30000,                    // Longer timeout for real API calls
};
```

---

## Benefits of Colocated Tests

### 1. **Discoverability**
```
src/weaviate/
├── client.ts        # Implementation
└── client.spec.ts   # Tests right next to it
```
- Easy to find tests for any file
- Clear 1:1 relationship
- No hunting through directories

### 2. **Maintainability**
- When you modify `client.ts`, `client.spec.ts` is right there
- Easier to keep tests in sync with code
- Less likely to forget to update tests

### 3. **Refactoring**
- Move `client.ts` → tests move with it
- Rename file → tests rename with it
- Delete file → tests delete with it
- No orphaned test files

### 4. **Code Review**
- Tests appear in same PR as code changes
- Reviewers see implementation + tests together
- Clear what's being tested

### 5. **Import Simplicity**
```typescript
// Colocated (simple relative import)
import { sanitizeUserId } from './client.js';

// Separate directory (complex path)
import { sanitizeUserId } from '../../src/weaviate/client.js';
```

---

## Running Tests

### All Unit Tests
```bash
npm test
# Runs all .spec.ts files in src/
```

### All E2E Tests
```bash
npm run test:e2e
# Runs all .e2e.ts files in src/
```

### Specific Test File
```bash
npm test -- src/weaviate/client.spec.ts
npm run test:e2e -- src/weaviate/client.e2e.ts
```

### Watch Mode
```bash
npm run test:watch
npm run test:e2e:watch
```

---

## Test Organization

### Unit Tests (.spec.ts)
- **Purpose**: Test individual functions/classes in isolation
- **Mocking**: Mock external dependencies (databases, APIs)
- **Speed**: Fast (no external calls)
- **Location**: Colocated with source file

**Example**:
```typescript
// src/weaviate/client.spec.ts
import { sanitizeUserId, getMemoryCollectionName } from './client.js';

describe('Weaviate Client', () => {
  it('should sanitize user IDs', () => {
    expect(sanitizeUserId('user@test.com')).toBe('User_test_com');
  });
});
```

### E2E Tests (.e2e.ts)
- **Purpose**: Test integration with real external services
- **Mocking**: No mocking (real databases, real APIs)
- **Speed**: Slower (real network calls)
- **Location**: Colocated with source file
- **Requirements**: Requires actual services running

**Example**:
```typescript
// src/weaviate/client.e2e.ts
import { initWeaviateClient, testWeaviateConnection } from './client.js';

describe('Weaviate Client E2E', () => {
  beforeAll(async () => {
    await initWeaviateClient();
  });

  it('should connect to real Weaviate instance', async () => {
    const result = await testWeaviateConnection();
    expect(result).toBe(true);
  });
});
```

---

## Coverage

### Coverage Excludes Test Files
```javascript
collectCoverageFrom: [
  'src/**/*.ts',           // Include all TypeScript
  '!src/**/*.spec.ts',     // Exclude unit tests
  '!src/**/*.e2e.ts',      // Exclude e2e tests
  '!src/**/*.d.ts',        // Exclude type definitions
  '!src/types/**/*.ts',    // Exclude type-only files
]
```

---

## Migration from tests/ Directory

### Before (Separate Directory)
```
tests/
├── unit/
│   ├── weaviate-client.spec.ts
│   └── firestore-paths.spec.ts
└── integration/
    └── database.e2e.ts
```

### After (Colocated)
```
src/
├── weaviate/
│   ├── client.ts
│   ├── client.spec.ts
│   └── client.e2e.ts
└── firestore/
    ├── paths.ts
    ├── paths.spec.ts
    ├── init.ts
    └── init.e2e.ts
```

---

## Best Practices

### 1. **One Test File Per Source File**
```
client.ts → client.spec.ts (unit tests)
client.ts → client.e2e.ts (e2e tests, optional)
```

### 2. **Same Directory as Source**
```
src/weaviate/client.ts
src/weaviate/client.spec.ts  ✅ Same directory
```

### 3. **Import from Same Directory**
```typescript
// ✅ Simple relative import
import { function } from './module.js';

// ❌ Complex path
import { function } from '../../src/module.js';
```

### 4. **Organize Tests by Feature**
```typescript
describe('Weaviate Client', () => {
  describe('User ID Sanitization', () => {
    it('should sanitize email addresses', () => {});
  });
  
  describe('Collection Names', () => {
    it('should generate memory collection names', () => {});
  });
});
```

---

## Comparison with Other Patterns

### ❌ Separate tests/ Directory
```
tests/unit/weaviate-client.spec.ts
src/weaviate/client.ts
```
**Problems**:
- Hard to find tests
- Complex import paths
- Tests don't move with code
- Orphaned tests

### ✅ Colocated Tests
```
src/weaviate/client.ts
src/weaviate/client.spec.ts
```
**Benefits**:
- Easy to find
- Simple imports
- Tests move with code
- Clear relationship

---

## Summary

**remember-mcp uses colocated tests**:
- ✅ Tests live in `src/` alongside source code
- ✅ Unit tests: `.spec.ts` suffix
- ✅ E2E tests: `.e2e.ts` suffix
- ✅ Jest configured with `roots: ['<rootDir>/src']`
- ✅ Simple relative imports
- ✅ Better discoverability and maintainability

**Reference**: This pattern is documented in [`agent/patterns/bootstrap.md`](bootstrap.md) (lines 1140-1162) and now formalized in this document.

---

**Status**: Project Standard  
**Pattern**: Colocated tests with .spec.ts and .e2e.ts suffixes  
**Benefit**: Better discoverability, maintainability, and developer experience
