# Task 8: Setup Utility Scripts Directory

**Milestone**: M1 - Project Foundation (Additional Task)  
**Estimated Time**: 1 hour  
**Dependencies**: Task 2 (Dependencies installed)  
**Status**: Not Started

---

## Objective

Create a `./scripts` directory with TypeScript configuration that allows running utility scripts with `npx tsx ./scripts/script-name.ts`, with full access to src files and all installed dependencies.

---

## Use Cases

**Utility scripts for**:
- Database initialization and seeding
- Data migration and cleanup
- Testing database connections
- Creating default templates
- User management operations
- Development and debugging tasks

---

## Steps

### 1. Create Scripts Directory Structure

```bash
mkdir -p scripts
```

### 2. Create Scripts TypeScript Configuration

**scripts/tsconfig.json**:
```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "types": ["node"],
    
    "outDir": "../dist/scripts",
    "rootDir": ".",
    
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    
    "baseUrl": "..",
    "paths": {
      "@/*": ["src/*"],
      "@scripts/*": ["scripts/*"]
    }
  },
  "include": ["./**/*", "../src/**/*"],
  "exclude": ["node_modules"]
}
```

**Key Features**:
- Extends main tsconfig.json for consistency
- `baseUrl: ".."` allows importing from parent directory
- `paths` includes both `@/*` (src) and `@scripts/*` (scripts)
- `include` covers both scripts and src directories
- `moduleResolution: "bundler"` works with tsx

### 3. Create Example Scripts

**scripts/test-weaviate.ts**:
```typescript
#!/usr/bin/env tsx

/**
 * Test Weaviate connection
 * Usage: npx tsx scripts/test-weaviate.ts
 */

import { initWeaviateClient, testWeaviateConnection } from '@/weaviate/client.js';
import { config } from '@/config.js';

async function main() {
  console.log('Testing Weaviate connection...');
  console.log('URL:', config.weaviate.url);
  
  try {
    await initWeaviateClient();
    const isConnected = await testWeaviateConnection();
    
    if (isConnected) {
      console.log('✅ Weaviate connection successful!');
      process.exit(0);
    } else {
      console.error('❌ Weaviate connection failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
```

**scripts/test-firestore.ts**:
```typescript
#!/usr/bin/env tsx

/**
 * Test Firestore connection
 * Usage: npx tsx scripts/test-firestore.ts
 */

import { initFirestore } from '@/firestore/init.js';
import { getDocument } from '@prmichaelsen/firebase-admin-sdk-v8';

async function main() {
  console.log('Testing Firestore connection...');
  
  try {
    initFirestore();
    console.log('✅ Firestore initialized');
    
    // Try to read a test document
    const testDoc = await getDocument('_test', 'connection');
    console.log('✅ Firestore connection successful!');
    console.log('Test document:', testDoc || 'null (document does not exist)');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Firestore connection failed:', error);
    process.exit(1);
  }
}

main();
```

**scripts/init-default-templates.ts**:
```typescript
#!/usr/bin/env tsx

/**
 * Initialize default templates in Firestore
 * Usage: npx tsx scripts/init-default-templates.ts
 */

import { initFirestore } from '@/firestore/init.js';
import { setDocument } from '@prmichaelsen/firebase-admin-sdk-v8';
import { DEFAULT_TEMPLATES } from '@/constants/templates.js';

async function main() {
  console.log('Initializing default templates...');
  
  initFirestore();
  
  for (const template of DEFAULT_TEMPLATES) {
    console.log(`Creating template: ${template.template_name}`);
    
    await setDocument('templates/default', template.id, {
      ...template,
      created_at: new Date().toISOString(),
      is_default: true,
      is_immutable: true
    });
    
    console.log(`✅ Created: ${template.template_name}`);
  }
  
  console.log(`\n✅ Initialized ${DEFAULT_TEMPLATES.length} default templates`);
}

main();
```

**scripts/create-user-collection.ts**:
```typescript
#!/usr/bin/env tsx

/**
 * Create Weaviate collection for a user
 * Usage: npx tsx scripts/create-user-collection.ts <user_id>
 */

import { initWeaviateClient, getMemoryCollectionName, collectionExists } from '@/weaviate/client.js';
import { createMemoryCollection } from '@/weaviate/schema.js';

async function main() {
  const userId = process.argv[2];
  
  if (!userId) {
    console.error('Usage: npx tsx scripts/create-user-collection.ts <user_id>');
    process.exit(1);
  }
  
  console.log(`Creating collection for user: ${userId}`);
  
  await initWeaviateClient();
  
  const collectionName = getMemoryCollectionName(userId);
  console.log(`Collection name: ${collectionName}`);
  
  const exists = await collectionExists(collectionName);
  
  if (exists) {
    console.log('⚠️  Collection already exists');
    process.exit(0);
  }
  
  await createMemoryCollection(userId);
  console.log('✅ Collection created successfully');
}

main();
```

### 4. Add Scripts to package.json

**package.json scripts section**:
```json
{
  "scripts": {
    "build": "node esbuild.build.js",
    "build:watch": "node esbuild.watch.js",
    "clean": "rm -rf dist",
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:e2e": "jest --config jest.e2e.config.js",
    "test:e2e:watch": "jest --config jest.e2e.config.js --watch",
    "test:all": "npm test && npm run test:e2e",
    "lint": "eslint src/**/*.ts",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run clean && npm run build",
    
    "script": "tsx",
    "script:test-weaviate": "tsx scripts/test-weaviate.ts",
    "script:test-firestore": "tsx scripts/test-firestore.ts",
    "script:init-templates": "tsx scripts/init-default-templates.ts",
    "script:create-collection": "tsx scripts/create-user-collection.ts"
  }
}
```

### 5. Create Scripts README

**scripts/README.md**:
```markdown
# Utility Scripts

This directory contains utility scripts for development, testing, and database management.

## Running Scripts

### Direct Execution
\`\`\`bash
npx tsx scripts/script-name.ts [args]
\`\`\`

### Via npm Scripts
\`\`\`bash
npm run script:test-weaviate
npm run script:test-firestore
npm run script:init-templates
npm run script:create-collection user123
\`\`\`

## Available Scripts

### Database Testing
- **test-weaviate.ts** - Test Weaviate connection
- **test-firestore.ts** - Test Firestore connection

### Database Setup
- **init-default-templates.ts** - Initialize default template library
- **create-user-collection.ts** - Create Weaviate collection for a user

### Development
- **seed-data.ts** - Seed test data for development
- **clean-test-data.ts** - Clean up test data

## TypeScript Configuration

Scripts use \`scripts/tsconfig.json\` which:
- Extends main tsconfig.json
- Allows importing from src/ using @/ alias
- Includes both scripts/ and src/ directories
- Works with tsx for direct execution

## Accessing Project Code

Scripts can import from src:
\`\`\`typescript
import { initWeaviateClient } from '@/weaviate/client.js';
import { config } from '@/config.js';
import { UserPreferencesService } from '@/services/user-preferences.service.js';
\`\`\`

## Environment Variables

Scripts automatically load from .env file via dotenv in config.ts.

## Best Practices

1. **Add shebang**: \`#!/usr/bin/env tsx\` at top of script
2. **Handle errors**: Use try/catch and exit codes
3. **Add usage info**: Show usage if args missing
4. **Log progress**: Console.log for visibility
5. **Exit cleanly**: Use process.exit(0) for success, process.exit(1) for errors
\`\`\`
```

---

## Verification

- [ ] scripts/ directory created
- [ ] scripts/tsconfig.json created
- [ ] scripts/README.md created
- [ ] Example scripts created (test-weaviate.ts, test-firestore.ts)
- [ ] Can run: `npx tsx scripts/test-weaviate.ts`
- [ ] Can import from src/ using @/ alias
- [ ] TypeScript compilation works
- [ ] Scripts have access to all dependencies

---

## Testing

```bash
# Test Weaviate connection
npx tsx scripts/test-weaviate.ts

# Test Firestore connection  
npx tsx scripts/test-firestore.ts

# Create user collection
npx tsx scripts/create-user-collection.ts user123

# Initialize templates
npx tsx scripts/init-default-templates.ts
```

---

## Benefits

1. **Development Efficiency**
   - Quick database testing
   - Easy data seeding
   - Rapid prototyping

2. **Code Reuse**
   - Access all src/ code
   - Use existing services and utilities
   - Share types and constants

3. **Type Safety**
   - Full TypeScript support
   - Same strict settings as main code
   - Catch errors before runtime

4. **Maintainability**
   - Scripts live with project
   - Version controlled
   - Documented and organized

---

## Next Task

Task 4: Set Up Firestore (using service layer pattern)
