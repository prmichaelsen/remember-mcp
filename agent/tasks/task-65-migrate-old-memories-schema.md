# Task 65: Migrate Old Memories to Include New Schema Fields

**Milestone**: M12 (Schema Migration)
**Estimated Time**: 3 hours
**Dependencies**: Task 63 (fetchMemoryWithAllProperties utility)
**Status**: Not Started
**Priority**: CRITICAL 🚨

---

## Objective

Migrate all existing memories in user collections to include new schema fields added in v2.6.0 (comment fields) and ensure schema uniformity. This prevents fetch failures when requesting properties that don't exist on old memory objects.

---

## Context

**Problem**: 
Old memories created before v2.6.0 don't have the new comment fields:
- `parent_id` (added in v2.6.0)
- `thread_root_id` (added in v2.6.0)
- `moderation_flags` (added in v2.6.0)

When `fetchMemoryWithAllProperties()` tries to fetch these properties from old memories, Weaviate fails because the properties don't exist on those objects.

**Impact**:
- ❌ Cannot publish old memories (fetch fails)
- ❌ Cannot update old memories
- ❌ Cannot search old memories with new property filters
- ❌ Schema inconsistency across memory objects

**Root Cause**:
Weaviate doesn't automatically backfill new schema properties on existing objects. When you add a new property to the schema, existing objects don't get that property until they're updated.

---

## Steps

### 1. Create Migration Script

Create a migration script in `/home/prmichaelsen/scripts/`:

```bash
#!/bin/bash
# migrate-memory-schema.sh
# Migrates old memories to include new schema fields

set -e

echo "🔄 Starting memory schema migration..."
echo "This will add missing fields to all memories in all user collections"
echo ""

# Run the TypeScript migration script
cd /home/prmichaelsen/remember-mcp
npx tsx scripts/migrate-schema.ts

echo ""
echo "✅ Migration complete!"
```

### 2. Create TypeScript Migration Script

Create `scripts/migrate-schema.ts`:

```typescript
/**
 * Schema Migration Script
 * 
 * Adds missing fields to all existing memories:
 * - parent_id: null (for non-comment memories)
 * - thread_root_id: null (for non-comment memories)
 * - moderation_flags: [] (empty array)
 */

import { initWeaviateClient, getWeaviateClient } from '../src/weaviate/client.js';
import { config } from '../src/config.js';

interface MigrationStats {
  collectionsProcessed: number;
  memoriesUpdated: number;
  memoriesSkipped: number;
  errors: number;
}

async function migrateCollection(collectionName: string): Promise<{ updated: number; skipped: number; errors: number }> {
  console.log(`\n📦 Processing collection: ${collectionName}`);
  
  const client = getWeaviateClient();
  const collection = client.collections.get(collectionName);
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  try {
    // Fetch all objects in batches
    let offset = 0;
    const batchSize = 100;
    let hasMore = true;
    
    while (hasMore) {
      console.log(`  Fetching batch at offset ${offset}...`);
      
      const results = await collection.query.fetchObjects({
        limit: batchSize,
        offset,
      });
      
      if (!results.objects || results.objects.length === 0) {
        hasMore = false;
        break;
      }
      
      console.log(`  Processing ${results.objects.length} memories...`);
      
      for (const obj of results.objects) {
        try {
          const props = obj.properties;
          
          // Check if migration needed
          const needsMigration = 
            props.parent_id === undefined ||
            props.thread_root_id === undefined ||
            props.moderation_flags === undefined;
          
          if (!needsMigration) {
            skipped++;
            continue;
          }
          
          // Update with missing fields
          await collection.data.update({
            id: obj.uuid,
            properties: {
              parent_id: props.parent_id ?? null,
              thread_root_id: props.thread_root_id ?? null,
              moderation_flags: props.moderation_flags ?? [],
            },
          });
          
          updated++;
          
          if (updated % 10 === 0) {
            console.log(`    ✅ Updated ${updated} memories...`);
          }
        } catch (error) {
          errors++;
          console.error(`    ❌ Error updating ${obj.uuid}:`, error);
        }
      }
      
      offset += batchSize;
    }
  } catch (error) {
    console.error(`  ❌ Error processing collection:`, error);
    errors++;
  }
  
  return { updated, skipped, errors };
}

async function main() {
  console.log('🚀 Memory Schema Migration');
  console.log('==========================\n');
  
  // Initialize Weaviate
  await initWeaviateClient();
  const client = getWeaviateClient();
  
  // Get all collections
  const collections = await client.collections.listAll();
  
  // Filter to Memory_ collections only
  const memoryCollections = collections
    .map(c => c.name)
    .filter(name => name.startsWith('Memory_') && name !== 'Memory_public');
  
  console.log(`Found ${memoryCollections.length} user memory collections\n`);
  
  const stats: MigrationStats = {
    collectionsProcessed: 0,
    memoriesUpdated: 0,
    memoriesSkipped: 0,
    errors: 0,
  };
  
  // Migrate each collection
  for (const collectionName of memoryCollections) {
    const result = await migrateCollection(collectionName);
    stats.collectionsProcessed++;
    stats.memoriesUpdated += result.updated;
    stats.memoriesSkipped += result.skipped;
    stats.errors += result.errors;
  }
  
  // Also migrate Memory_public if it exists
  const publicExists = await client.collections.exists('Memory_public');
  if (publicExists) {
    console.log('\n📦 Processing Memory_public collection...');
    const result = await migrateCollection('Memory_public');
    stats.collectionsProcessed++;
    stats.memoriesUpdated += result.updated;
    stats.memoriesSkipped += result.skipped;
    stats.errors += result.errors;
  }
  
  // Print summary
  console.log('\n\n📊 Migration Summary');
  console.log('===================');
  console.log(`Collections processed: ${stats.collectionsProcessed}`);
  console.log(`Memories updated: ${stats.memoriesUpdated}`);
  console.log(`Memories skipped (already migrated): ${stats.memoriesSkipped}`);
  console.log(`Errors: ${stats.errors}`);
  
  if (stats.errors > 0) {
    console.log('\n⚠️  Some errors occurred. Check logs above.');
    process.exit(1);
  } else {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('💥 Migration failed:', error);
  process.exit(1);
});
```

### 3. Make Script Executable

```bash
chmod +x /home/prmichaelsen/scripts/migrate-memory-schema.sh
```

### 4. Run Migration

```bash
# Dry run first (optional - add --dry-run flag to script)
/home/prmichaelsen/scripts/migrate-memory-schema.sh

# Or run directly with tsx
cd /home/prmichaelsen/remember-mcp
npx tsx scripts/migrate-schema.ts
```

### 5. Verify Migration

Check that old memories now have the new fields:

```typescript
// Test with an old memory ID
remember_search_memory({
  query: "",
  limit: 1
})

// Verify returned memory has:
// - parent_id: null
// - thread_root_id: null
// - moderation_flags: []
```

### 6. Test Publish After Migration

```bash
# Try publishing an old memory
remember_publish({
  memory_id: "84edf86d-579d-4cb3-8b5f-2e19462d8c68",
  spaces: ["the_void"]
})

# Should succeed now
```

---

## Verification

- [ ] Migration script created in `/home/prmichaelsen/scripts/`
- [ ] TypeScript migration script created in `scripts/migrate-schema.ts`
- [ ] Script is executable
- [ ] Dry run completed successfully (optional)
- [ ] Migration executed on all user collections
- [ ] Migration executed on Memory_public collection
- [ ] All old memories have `parent_id: null`
- [ ] All old memories have `thread_root_id: null`
- [ ] All old memories have `moderation_flags: []`
- [ ] Can fetch old memories with `fetchMemoryWithAllProperties()`
- [ ] Can publish old memories successfully
- [ ] No errors in migration logs

---

## Expected Output

**Before Migration**:
```json
{
  "id": "84edf86d-579d-4cb3-8b5f-2e19462d8c68",
  "properties": {
    "title": "Cat grad school",
    "content": "...",
    "type": "note",
    // ❌ No parent_id
    // ❌ No thread_root_id
    // ❌ No moderation_flags
  }
}
```

**After Migration**:
```json
{
  "id": "84edf86d-579d-4cb3-8b5f-2e19462d8c68",
  "properties": {
    "title": "Cat grad school",
    "content": "...",
    "type": "note",
    "parent_id": null,  // ✅ Added
    "thread_root_id": null,  // ✅ Added
    "moderation_flags": []  // ✅ Added
  }
}
```

---

## Migration Statistics Example

```
📊 Migration Summary
===================
Collections processed: 5
Memories updated: 247
Memories skipped (already migrated): 0
Errors: 0

✅ Migration completed successfully!
```

---

## Common Issues and Solutions

### Issue 1: Permission denied

**Cause**: Script not executable
**Solution**: `chmod +x /home/prmichaelsen/scripts/migrate-memory-schema.sh`

### Issue 2: Weaviate connection failed

**Cause**: Environment variables not set
**Solution**: Ensure `.env` file has WEAVIATE_URL and WEAVIATE_API_KEY

### Issue 3: Some memories fail to update

**Cause**: Individual object update errors
**Solution**: Check error logs, may need to manually fix specific memories

### Issue 4: Migration takes too long

**Cause**: Large number of memories
**Solution**: Run in batches, add progress indicators

---

## Safety Considerations

**Backup**: 
- Weaviate doesn't have built-in backup for individual collections
- Consider exporting memories before migration
- Migration is additive (only adds fields, doesn't remove)

**Rollback**:
- If migration fails, new fields will be null/empty
- Can re-run migration safely (idempotent)
- No data loss risk (only adding fields)

**Testing**:
- Test on a single collection first
- Verify results before migrating all collections
- Check Memory_public separately

---

## Resources

- [Weaviate Update Objects](https://weaviate.io/developers/weaviate/manage-data/update)
- [Weaviate Batch Operations](https://weaviate.io/developers/weaviate/manage-data/import)
- [Schema Evolution Best Practices](https://weaviate.io/developers/weaviate/config-refs/schema)

---

## Notes

- This migration is **required** for v2.6.3+ to work with old memories
- Migration is idempotent (safe to run multiple times)
- Only updates memories that need migration (checks first)
- Processes in batches to avoid memory issues
- Logs progress for monitoring
- Can be run on production without downtime
- Consider scheduling during low-traffic period
- Estimated time: ~1-5 minutes per 1000 memories

---

## Alternative Approaches

### Option 1: Lazy Migration (NOT RECOMMENDED)
- Update memories on-demand when accessed
- Pros: No bulk migration needed
- Cons: Unpredictable failures, poor UX

### Option 2: Schema-Optional Fetch (NOT RECOMMENDED)
- Make fetchMemoryWithAllProperties handle missing properties
- Pros: No migration needed
- Cons: Inconsistent data, complex error handling

### Option 3: Bulk Migration (RECOMMENDED)
- Run migration script once to update all memories
- Pros: Clean, predictable, one-time operation
- Cons: Requires downtime or careful execution

---

**Status**: Not Started
**Recommendation**: Run migration immediately to unblock publish functionality
**Priority**: CRITICAL - Blocks core functionality for users with old memories
