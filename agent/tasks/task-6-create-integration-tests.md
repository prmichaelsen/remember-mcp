# Task 6: Create Integration Tests

**Milestone**: M1 - Project Foundation  
**Estimated Time**: 2 hours  
**Dependencies**: Tasks 1-5  
**Status**: Not Started

---

## Objective

Create integration tests to verify the complete setup works end-to-end.

---

## Steps

### 1. Create Test Setup

**tests/setup.ts**:
```typescript
import { beforeAll, afterAll } from 'vitest';
import { initWeaviateClient, closeWeaviateClient } from '../src/weaviate/client.js';
import { initFirestore } from '../src/firestore/client.js';

beforeAll(async () => {
  // Initialize databases for testing
  await initWeaviateClient();
  await initFirestore();
});

afterAll(async () => {
  // Cleanup
  await closeWeaviateClient();
});
```

### 2. Create Integration Test

**tests/integration/foundation.test.ts**:
```typescript
import { describe, it, expect } from 'vitest';
import { testWeaviateConnection } from '../../src/weaviate/client.js';
import { testFirestoreConnection } from '../../src/firestore/client.js';
import { config } from '../../src/config.js';

describe('Foundation Integration Tests', () => {
  it('should have valid configuration', () => {
    expect(config.weaviate.url).toBeTruthy();
    expect(config.firebase.projectId).toBeTruthy();
    expect(config.openai.apiKey).toBeTruthy();
  });

  it('should connect to Weaviate', async () => {
    const result = await testWeaviateConnection();
    expect(result).toBe(true);
  });

  it('should connect to Firestore', async () => {
    const result = await testFirestoreConnection();
    expect(result).toBe(true);
  });

  it('should handle Firestore CRUD operations', async () => {
    const { setDocument, getDocument, deleteDocument } = await import(
      '../../src/firestore/client.js'
    );

    const testData = {
      test: 'integration-test',
      timestamp: new Date().toISOString(),
    };

    // Create
    await setDocument('_test_integration', 'test-doc', testData);

    // Read
    const retrieved = await getDocument('_test_integration', 'test-doc');
    expect(retrieved).toEqual(testData);

    // Delete
    await deleteDocument('_test_integration', 'test-doc');

    // Verify deleted
    const afterDelete = await getDocument('_test_integration', 'test-doc');
    expect(afterDelete).toBeNull();
  });
});
```

### 3. Create Vitest Configuration

**vitest.config.ts**:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.config.ts',
      ],
    },
    testTimeout: 30000, // 30 seconds for integration tests
  },
});
```

### 4. Create Test Documentation

**tests/README.md**:
```markdown
# remember-mcp Tests

## Test Structure

- `unit/` - Unit tests for individual modules
- `integration/` - Integration tests for end-to-end flows
- `security/` - Security and isolation tests
- `performance/` - Performance and load tests

## Running Tests

\`\`\`bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test tests/unit/weaviate-client.test.ts

# Run with coverage
npm test -- --coverage
\`\`\`

## Test Requirements

- Weaviate must be running (localhost:8080 or configured URL)
- Firebase credentials must be configured
- .env file must be set up

## Writing Tests

- Use descriptive test names
- Test both success and failure cases
- Clean up test data after tests
- Use `_test_` prefix for test collections/documents
```

---

## Verification

- [ ] tests/setup.ts created
- [ ] tests/integration/foundation.test.ts created
- [ ] vitest.config.ts created
- [ ] tests/README.md created
- [ ] All tests pass
- [ ] Configuration validation works
- [ ] Database connections verified
- [ ] CRUD operations work

---

## Testing

```bash
# Run all tests
npm test

# Expected output:
# ✓ tests/unit/weaviate-client.test.ts (3)
# ✓ tests/unit/firestore-client.test.ts (3)
# ✓ tests/integration/foundation.test.ts (4)
# 
# Test Files  3 passed (3)
# Tests  10 passed (10)
```

---

## Next Task

Task 7: Create Documentation and Finalize M1
