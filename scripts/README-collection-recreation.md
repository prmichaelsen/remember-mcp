# Collection Recreation Migration

This script recreates Weaviate collections with updated schema configuration to fix the `indexNullState` bug introduced in v3.0.0.

## Why This is Needed

Version 3.0.0 added the soft delete system with a `deleted_at` field. The default filter uses `deleted_at IS NULL` to exclude deleted memories. However, the schema was missing `indexNullState: true` configuration, causing all searches to fail with:

```
WeaviateQueryError: Nullstate must be indexed to be filterable! 
Add `indexNullState: true` to the invertedIndexConfig
```

**Version 3.0.1** fixes the schema, but existing collections must be recreated to apply the fix.

## What This Script Does

1. **Backs up** all documents from each collection (with vectors)
2. **Deletes** the old collection
3. **Recreates** the collection with `indexNullState: true`
4. **Restores** all documents with original IDs and vectors
5. **Verifies** document counts match

## Prerequisites

- remember-mcp v3.0.1 or later (with fixed schema)
- Weaviate instance access
- Sufficient disk space for backups

## Quick Start

### 1. Update to v3.0.1

```bash
npm install @prmichaelsen/remember-mcp@3.0.1
```

### 2. Run Migration

```bash
# Dry run first (test without changes)
npx tsx scripts/migrate-recreate-collections.ts --dry-run

# Run actual migration
npx tsx scripts/migrate-recreate-collections.ts
```

## Usage Examples

### Migrate All Collections

```bash
npx tsx scripts/migrate-recreate-collections.ts
```

### Migrate Specific Collections

```bash
npx tsx scripts/migrate-recreate-collections.ts \
  --collections "Memory_user123,Memory_public"
```

### Dry Run (Test Mode)

```bash
npx tsx scripts/migrate-recreate-collections.ts --dry-run
```

### Custom Batch Size

```bash
npx tsx scripts/migrate-recreate-collections.ts --batch-size 500
```

## Configuration

### Environment Variables

Create `.env` file or set environment variables:

```bash
WEAVIATE_REST_URL=https://your-instance.weaviate.cloud
WEAVIATE_API_KEY=your-api-key
OPENAI_EMBEDDINGS_API_KEY=sk-...
BATCH_SIZE=100
```

### CLI Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--weaviate-url` | Weaviate instance URL | `WEAVIATE_REST_URL` |
| `--weaviate-key` | Weaviate API key | `WEAVIATE_API_KEY` |
| `--openai-key` | OpenAI API key | `OPENAI_EMBEDDINGS_API_KEY` |
| `--batch-size` | Documents per batch | 100 |
| `--dry-run` | Test without changes | false |
| `--collections` | Specific collections (comma-separated) | All Memory_* collections |
| `--state-file` | State file path | `.collection-recreation-state.yaml` |

## Safety Features

- ✅ **Backups**: All data backed up before deletion
- ✅ **State Management**: Progress tracked in YAML file
- ✅ **Verification**: Document counts verified after restoration
- ✅ **Dry Run**: Test mode to preview changes
- ✅ **ID Preservation**: Original document IDs maintained
- ✅ **Vector Preservation**: Original vectors maintained

## Output Example

```
🚀 Collection Recreation Migration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Configuration:
  Weaviate URL: https://your-instance.weaviate.cloud
  Batch Size: 100
  Dry Run: false
  Backup Directory: ./migration-backups

🔍 Discovering collections...
  Found 2 collections: Memory_user123, Memory_public

📦 Migrating: Memory_user123
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📥 Backing up Memory_user123...
    Total documents: 1,234
    Progress: 100.0% (1,234/1,234)
    ✓ Backup complete
    ✓ Saved backup: ./migration-backups/Memory_user123-2026-02-25-203000.json
  🗑️  Deleting Memory_user123...
    ✓ Deleted
  🔨 Recreating Memory_user123 with updated schema...
    ✓ Recreated with indexNullState: true
  📤 Restoring 1,234 documents...
    Progress: 100.0% (1,234/1,234)
    ✓ Restore complete
  ✓ Verified: 1,234 documents restored
  ✅ Migration complete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Migration Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total Collections: 2
  Successful: 2
  Failed: 0
  Dry Run: false

✨ Migration completed successfully!
```

## Troubleshooting

### "Cannot connect to Weaviate"

**Solution**: Verify `WEAVIATE_REST_URL` and `WEAVIATE_API_KEY` are correct.

### "Document count mismatch"

**Solution**: Check the state file for errors. The backup file is preserved in `./migration-backups/` for manual recovery.

### Migration interrupted

**Solution**: The script automatically resumes from the last successful step. Just run it again.

### Out of disk space

**Solution**: Backups are saved to `./migration-backups/`. Ensure sufficient disk space or use a smaller batch size.

## Backup Files

Backups are saved to `./migration-backups/` with format:
```
{collection_name}-{timestamp}.json
```

**Example**:
```
./migration-backups/Memory_user123-2026-02-25-203000.json
```

These files contain:
- Collection schema
- All documents with properties
- All vectors
- Document IDs

**Keep these files** until you verify the migration succeeded.

## State File

Progress is tracked in `.collection-recreation-state.yaml`:

```yaml
migration:
  id: recreate-collections-2026-02-25-203000
  started_at: 2026-02-25T20:30:00Z
  status: in_progress

collections:
  - name: Memory_user123
    status: completed
    total_documents: 1234
    backed_up_documents: 1234
    restored_documents: 1234
    backup_file: ./migration-backups/Memory_user123-2026-02-25-203000.json

progress:
  total_collections: 2
  completed_collections: 1
  percentage: 50.0
```

## Security

- Never commit backup files to version control
- Never commit state files to version control
- Backup files may contain sensitive user data
- Delete backups after successful migration

## Related Documentation

- [Task 76: Fix indexNullState Schema Bug](../agent/tasks/task-76-fix-indexnullstate-schema-bug.md)
- [CHANGELOG v3.0.1](../CHANGELOG.md)
