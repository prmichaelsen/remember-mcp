# Task 26: Migrate PARM Schema to Remember Schema

**Milestone**: M8 - Testing & Quality  
**Estimated Time**: 4 hours  
**Dependencies**: None  
**Status**: Not Started  
**Priority**: Medium

---

## Objective

Migrate existing PARM (Personal Agent Relationship Manager) memories from the old schema to the new remember-mcp schema. This involves mapping old fields to new fields, handling missing fields, and ensuring data integrity.

## Problem Statement

Existing memories in Weaviate were created with the PARM schema which has different field names and structure than the current remember-mcp schema:

### Old PARM Schema (Observed)
```yaml
author: string (UUID)
content: string (long text)
contentType: string (e.g., "note")
createdAt: datetime
description: string
filePath: string (firestore:// URL)
project: string (e.g., "parm-migration")
status: string (e.g., "migrated")
tags: string[] (e.g., ["love", "relationships", "poetry"])
title: string
updatedAt: datetime
```

### New Remember-MCP Schema (Current)
```yaml
# Core Identity
user_id: string
doc_type: string ("memory" or "relationship")

# Content
content: string
title: string
summary: string
type: string (ContentType - 45 types)

# Scoring
weight: number (0-1)
trust: number (0-1)
confidence: number (0-1)

# Location
location_gps_lat: number
location_gps_lng: number
location_address: string
location_city: string
location_country: string

# Locale
locale_language: string
locale_timezone: string

# Context
context_conversation_id: string
context_summary: string
context_timestamp: date

# Relationships
relationships: string[] (relationship IDs)

# Access Tracking
access_count: number
last_accessed_at: date

# Metadata
tags: string[]
references: string[] (URLs)
created_at: date
updated_at: date
version: number

# Template
template_id: string
```

## Field Mapping

### Direct Mappings
| PARM Field | Remember Field | Notes |
|------------|----------------|-------|
| `content` | `content` | Direct copy |
| `title` | `title` | Direct copy |
| `tags` | `tags` | Direct copy |
| `createdAt` | `created_at` | Rename |
| `updatedAt` | `updated_at` | Rename |
| `contentType` | `type` | Map to valid ContentType |

### Derived Mappings
| PARM Field | Remember Field | Transformation |
|------------|----------------|----------------|
| `author` | `user_id` | Extract user ID from author UUID |
| `description` | `summary` | Use as summary |
| `title` | `summary` | If no description, use title |
| N/A | `doc_type` | Set to "memory" |
| N/A | `version` | Set to 1 |
| N/A | `weight` | Default to 0.5 |
| N/A | `trust` | Default to 0.5 |
| N/A | `confidence` | Default to 1.0 |

### Fields to Drop
- `filePath` - Firestore reference, not needed in Weaviate
- `project` - Migration metadata, not needed
- `status` - Migration metadata, not needed

### New Fields (Defaults)
- `relationships: []` - Empty array
- `references: []` - Empty array
- `access_count: 0` - Default 0
- `last_accessed_at: <created_at>` - Set to creation time
- `access_frequency: 0` - Default 0
- `base_weight: 0.5` - Same as weight
- `computed_weight: 0.5` - Same as weight
- `location: { gps: null, address: null, source: 'unavailable', confidence: 0, is_approximate: true }`
- `context: { timestamp: <created_at>, source: { type: 'migration', platform: 'parm' }, summary: 'Migrated from PARM' }`
- `template_id: null` - No template
- `structured_content: null` - No structured content

## ContentType Mapping

Map old `contentType` values to new `type` values:

| Old contentType | New type | Reasoning |
|-----------------|----------|-----------|
| `note` | `note` | Direct match |
| `person` | `person` | Direct match |
| `event` | `event` | Direct match |
| `bookmark` | `bookmark` | Direct match |
| `recipe` | `recipe` | Direct match |
| `meeting` | `meeting` | Direct match |
| `project` | `project` | Direct match |
| (unknown) | `note` | Default fallback |

**Special Case**: If `tags` contains "poetry", consider setting `type: "note"` but keep the poetry tag.

## Steps

### 1. Analyze Existing Data
- [ ] Query Weaviate for all memories in user's collection
- [ ] Count total memories to migrate
- [ ] Identify unique `contentType` values
- [ ] Identify unique `author` values (should be one user)
- [ ] Check for any unexpected fields

### 2. Create Migration Script
- [ ] Create `scripts/migrate-parm-to-remember.ts`
- [ ] Implement field mapping logic
- [ ] Implement contentType to type conversion
- [ ] Add validation for required fields
- [ ] Add dry-run mode (preview without writing)

### 3. Implement Migration Logic
```typescript
interface PARMMemory {
  author: string;
  content: string;
  contentType: string;
  createdAt: string;
  description?: string;
  filePath?: string;
  project?: string;
  status?: string;
  tags: string[];
  title: string;
  updatedAt: string;
}

interface RememberMemory {
  // All remember-mcp fields
}

function migratePARMToRemember(
  parmMemory: PARMMemory,
  userId: string
): RememberMemory {
  return {
    // Core identity
    user_id: userId,
    doc_type: 'memory',
    
    // Content
    content: parmMemory.content,
    title: parmMemory.title,
    summary: parmMemory.description || parmMemory.title,
    type: mapContentType(parmMemory.contentType),
    
    // Scoring (defaults)
    weight: 0.5,
    trust: 0.5,
    confidence: 1.0,
    
    // Location (null)
    location: {
      gps: null,
      address: null,
      source: 'unavailable',
      confidence: 0,
      is_approximate: true,
    },
    
    // Context
    context: {
      timestamp: parmMemory.createdAt,
      source: { type: 'migration', platform: 'parm' },
      summary: 'Migrated from PARM',
    },
    
    // Relationships
    relationships: [],
    
    // Access tracking
    access_count: 0,
    last_accessed_at: parmMemory.createdAt,
    access_frequency: 0,
    
    // Metadata
    tags: parmMemory.tags,
    references: [],
    created_at: parmMemory.createdAt,
    updated_at: parmMemory.updatedAt,
    version: 1,
    
    // Template
    template_id: null,
    structured_content: null,
    
    // Computed weight
    base_weight: 0.5,
    computed_weight: 0.5,
  };
}

function mapContentType(oldType: string): string {
  const mapping: Record<string, string> = {
    'note': 'note',
    'person': 'person',
    'event': 'event',
    'bookmark': 'bookmark',
    'recipe': 'recipe',
    'meeting': 'meeting',
    'project': 'project',
  };
  
  return mapping[oldType] || 'note';
}
```

### 4. Add Safety Checks
- [ ] Verify user_id matches expected user
- [ ] Validate all required fields are present
- [ ] Check for duplicate IDs
- [ ] Verify contentType mapping is valid
- [ ] Ensure no data loss (all old fields accounted for)

### 5. Create Backup Strategy
- [ ] Export all existing memories to JSON file
- [ ] Store backup with timestamp
- [ ] Document rollback procedure

### 6. Test Migration
- [ ] Test with 1 memory (dry-run)
- [ ] Test with 10 memories (dry-run)
- [ ] Verify migrated data structure
- [ ] Test search on migrated memories
- [ ] Verify tags are preserved

### 7. Execute Migration
- [ ] Run full migration (dry-run first)
- [ ] Review migration report
- [ ] Execute actual migration
- [ ] Verify all memories migrated
- [ ] Test search functionality
- [ ] Verify no data loss

### 8. Post-Migration Validation
- [ ] Count memories before and after
- [ ] Spot-check 10 random memories
- [ ] Search for poems by poetry tag
- [ ] Verify all contentTypes mapped correctly
- [ ] Check that old fields are gone
- [ ] Verify new fields have correct defaults

## Verification

- [ ] All PARM memories successfully migrated
- [ ] No data loss (content, title, tags preserved)
- [ ] All memories have valid remember-mcp schema
- [ ] Search works correctly on migrated memories
- [ ] Poems findable via poetry tag
- [ ] No old PARM fields remain
- [ ] Backup created and verified
- [ ] Migration report generated

## Files to Create

- `scripts/migrate-parm-to-remember.ts` - Migration script
- `scripts/backup-memories.ts` - Backup utility
- `scripts/validate-migration.ts` - Validation script
- `agent/design/parm-migration-report.md` - Migration report template

## Expected Outcome

- All existing PARM memories converted to remember-mcp schema
- No data loss
- Improved searchability with proper schema
- Poems findable via tags
- Clean, consistent data structure
- Documented migration process for future reference

## Rollback Plan

If migration fails:
1. Stop migration immediately
2. Restore from backup JSON file
3. Re-import using Weaviate batch import
4. Verify restoration
5. Debug migration script
6. Retry with fixes

---

**Next Task**: Task 27 - Add Poetry Content Type  
**Blockers**: Need user confirmation before executing migration
