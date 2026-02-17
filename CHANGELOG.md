# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.7.10] - 2026-02-17

### Added

- **Prevent Duplicate Publishing**
  - Added validation to prevent re-publishing already published memories
  - Checks for existing `space_memory_id` before allowing publish
  - Returns clear error message with existing space memory ID
  - Prevents data duplication and maintains data integrity

### Security

- Users cannot accidentally publish the same memory multiple times
- Prevents duplicate entries in Memory_public collection
- Clear error messaging guides users to existing published memory

### Technical Details

- Modified: `src/tools/confirm.ts` (lines 191-209)
- Added check for `originalMemory.properties.space_memory_id`
- Returns error with `space_memory_id` if already published
- Validation occurs before any database operations

---

## [2.7.9] - 2026-02-17

### Added

- **Bidirectional Linking for Published Memories**
  - Original memories now store `space_memory_id` after publishing
  - Enables correlation between source memory and published space memory
  - Added automatic update of original memory after successful publish
  - Non-critical update - publish still succeeds if update fails
  - Improves traceability and enables future features (unpublish, sync)

### Technical Details

- Modified: `src/tools/confirm.ts` (lines 277-296)
- Added `userCollection.data.update()` call after publish
- Updates original memory with `space_memory_id` field
- Includes error handling with warning log (non-blocking)
- Maintains backward compatibility

---

## [2.7.8] - 2026-02-17

### Fixed

- **CRITICAL: Fixed Shared Space Discovery Bug**
  - Search and query tools now correctly filter by `doc_type: 'memory'` instead of `'space_memory'`
  - The `space_memory` concept was removed from the architecture
  - Search tools were filtering for `doc_type: 'space_memory'` but published memories had `doc_type: 'memory'`
  - Now all users can discover memories published to shared spaces like The Void
  - Root cause: Lines 159 in `search-space.ts` and 147 in `query-space.ts` filtered for wrong doc_type
  - Fix: Changed filters from `'space_memory'` to `'memory'` to match actual data

### Technical Details

- Modified: `src/tools/search-space.ts` (line 159)
- Modified: `src/tools/query-space.ts` (line 147)
- Changed filter from `.equal('space_memory')` to `.equal('memory')`
- Published memories keep `doc_type: 'memory'` (as intended)

### Impact

- **Fixes**: Shared space discovery now works correctly
- **Unblocks**: Core shared spaces functionality (The Void)
- **Note**: No data migration needed - existing published memories are correct

---

## [2.7.7] - 2026-02-17

### Fixed

- **CRITICAL: Fixed Memory_public vectorizer missing**
  - `ensurePublicCollection()` now properly creates collection with vectorizer
  - Previously relied on auto-schema which doesn't include vectorizers
  - Now calls `createSpaceCollection(client, 'public')` to create with full schema
  - Fixes "vectorizer not configured" errors when searching The Void

### Root Cause

- Commit bcde314 changed to auto-schema approach for schema compatibility
- Auto-schema creates collections without vectorizers (vectorizer: "none")
- This broke semantic search in Memory_public (The Void)
- Manual creation with vectorizer config is required

### Technical Details

- Modified: `src/weaviate/space-schema.ts` (lines 382-398)
- Changed `ensurePublicCollection()` to check if collection exists
- If not exists, calls `createSpaceCollection(client, 'public')`
- Creates collection with vectorizer: `text2VecOpenAI`, model: `text-embedding-3-small`
- Vectorizes: `content`, `title`, `summary`, `observation`

---

## [2.7.6] - 2026-02-17

### Changed

- **Enhanced `remember_publish` Tool Description**: Added critical instruction to prevent token exposure
  - Agents now explicitly instructed NOT to mention tokens in responses
  - Agents instructed NOT to include token contents in user-facing messages
  - Improves security by preventing accidental token disclosure
  - Users simply informed that confirmation is pending without token details

### Security

- Prevents agents from accidentally exposing confirmation tokens to users
- Tokens remain internal implementation detail
- Better user experience with cleaner confirmation workflow

---

## [2.7.4] - 2026-02-17

### Changed

- **Enhanced Vectorization**: Added `title` and `summary` to vectorized source properties
  - User memory schema: Now vectorizes `content`, `title`, `summary`, and `observation`
  - Space memory schema: Now vectorizes `content`, `title`, `summary`, and `observation`
  - Improves semantic search by including titles and summaries in vector embeddings
  - Note: `title` and `summary` are optional fields, handled gracefully by vectorizer

### Technical Details

- Modified: `src/weaviate/schema.ts` (line 49)
- Modified: `src/weaviate/space-schema.ts` (line 101)
- Changed `sourceProperties` from `['content', 'observation']` to `['content', 'title', 'summary', 'observation']`
- Applies to all new collections created after this version
- Existing collections retain their original vectorizer configuration

---

## [2.7.3] - 2026-02-17

### Fixed

- **CRITICAL: Fixed `remember_update_memory` "Memory not found" error**
  - Changed `handleUpdateMemory()` to use `fetchMemoryWithAllProperties()` wrapper
  - Previously used direct `collection.query.fetchObjectById()` call without fallback
  - Direct call failed when querying memories with certain property configurations (e.g., `parent_id: ""`)
  - Wrapper provides graceful fallback for schema evolution and property incompatibilities
  - Matches pattern used in other working tools like `handlePublish()`

### Root Cause

- `handleUpdateMemory()` bypassed the `fetchMemoryWithAllProperties()` abstraction layer
- Direct `fetchObjectById()` without property specification can fail on edge case property values
- Error was caught and converted to misleading "Memory not found" message
- Wrapper's try-catch with fallback handles these cases gracefully
- This fix ensures consistent behavior across all memory operations

### Technical Details

- Modified: `src/tools/update-memory.ts` (lines 8, 140)
- Added import: `fetchMemoryWithAllProperties` from `weaviate/client.js`
- Replaced: `collection.query.fetchObjectById(id)` → `fetchMemoryWithAllProperties(collection, id)`
- Verified working in local testing with memories containing `parent_id: ""`

---

## [2.7.2] - 2026-02-17

### Fixed

- **CRITICAL: Fixed Insert API Call Format**: Wrap properties in `{properties: ...}` object
  - Changed `publicCollection.data.insert(publishedMemory)` to `publicCollection.data.insert({properties: publishedMemory})`
  - Weaviate insert API expects `{properties: {...}}` format, not properties directly
  - This is why ALL inserts were creating documents with zero properties
  - The properties were being ignored because they weren't in the expected format

### Root Cause

- Weaviate client `insert()` API signature: `insert({properties: {...}, vectors?: ..., id?: ...})`
- We were passing properties directly: `insert(properties)`
- Weaviate accepted the call but ignored the properties (wrong format)
- Created documents with UUID but zero properties
- This explains ALL the empty document issues across all schema approaches

---

## [2.7.1] - 2026-02-17

### Fixed

- **CRITICAL: Memory_public Auto-Schema**: Let Weaviate auto-generate schema instead of manual definition
  - Removed manual schema creation for Memory_public collection
  - Weaviate will auto-generate schema from first insert
  - Ensures schema matches user memory collections EXACTLY
  - Includes nested objects (context, location) that were auto-generated in user collections
  - Fixes issue where nested objects were rejected due to schema expecting flattened properties
  - Spread operator now works perfectly since schemas are identical

### Root Cause

- User memory collections have auto-generated schemas with nested `context` and `location` objects
- Memory_public had manually defined schema with flattened properties
- When spreading `...originalMemory.properties`, nested objects didn't match flattened schema
- Weaviate rejected ALL properties due to nested object schema conflict
- Auto-schema approach ensures perfect compatibility

---

## [2.7.0] - 2026-02-17

### Fixed

- **CRITICAL: `remember_update_memory` Now Uses `replace()` Instead of `update()`**
  - Switched from `collection.data.update()` to `collection.data.replace()`
  - Fixes Weaviate bug where `update()` only persists if vectorized fields change
  - Now fetches full object and merges updates before replacing
  - Updates to non-vectorized fields (title, type, weight, tags, etc.) now persist correctly
  - Resolves issue where updates returned success but changes weren't saved
  - **Breaking Change**: This is a minor version bump due to behavior change (more reliable updates)

### Changed

- Fetch strategy: Now fetches all properties (not just 3) since we need full object for replace
- Update strategy: Merge updates with existing properties, then replace entire object
- Logging: Changed "Calling Weaviate update" to "Calling Weaviate replace"

### Root Cause

- Weaviate has a known bug where `update()` only persists changes if at least one vectorized field is modified
- Our schema only vectorizes `content` and `observation`
- Updates to `title`, `type`, `weight`, `tags`, etc. were silently ignored
- `replace()` doesn't have this limitation and always persists changes

---

## [2.6.13] - 2026-02-17

### Changed

- **Enhanced Logging for `remember_update_memory`**: Added detailed Weaviate update logging
  - Logs update fields and values before calling Weaviate
  - Logs confirmation after Weaviate update completes
  - Helps diagnose if updates are being called but not persisting
  - Shows exact values being sent to Weaviate

---

## [2.6.12] - 2026-02-17

### Fixed

- **CRITICAL: Memory_public Schema Mismatch**: Fixed property names to match user memory schema
  - Changed `location_gps_latitude` → `location_gps_lat`
  - Changed `location_gps_longitude` → `location_gps_lng`
  - Changed `location_address_formatted` → `location_address`
  - Changed `location_address_city` → `location_city`
  - Changed `location_address_country` → `location_country`
  - Added missing `location_source` field
  - Changed `context_platform` → `context_summary` and `context_timestamp`
  - Added missing `locale_language` and `locale_timezone` fields
  - Changed `related_memory_ids` → `relationships`
  - Added missing fields: `references`, `template_id`, `access_count`, `last_accessed_at`
  - Added relationship fields: `memory_ids`, `relationship_type`, `observation`, `strength`
  - Added computed fields: `base_weight`, `computed_weight`
  - Added `user_id` field for backwards compatibility
  - Schema now matches user memory schema exactly, allowing spread operator to work
  - Fixes issue where Weaviate rejected all properties due to name mismatches
  - Published memories now store all content correctly

---

## [2.6.11] - 2026-02-17

### Changed

- **Enhanced Logging for `executePublishMemory()`**: Added detailed property logging
  - Logs all property keys fetched from original memory
  - Logs property keys being inserted into public collection
  - Logs content length, title, and other key fields
  - Changed fetch result log from debug to info level
  - Helps diagnose if memory content is being fetched and copied correctly

---

## [2.6.10] - 2026-02-17

### Fixed

- **CRITICAL: `fetchMemoryWithAllProperties()` Graceful Fallback**: Fixed memory content not being copied during publish
  - Added try-catch wrapper around property fetch with fallback
  - If fetching with ALL_MEMORY_PROPERTIES fails, falls back to fetching without property specification
  - Weaviate returns all properties that actually exist on the record when no returnProperties specified
  - Fixes issue where `remember_confirm` → `executePublishMemory()` only copied comment fields
  - Published memories now include all content (title, content, tags, etc.)
  - Prevents data loss during memory publication to shared spaces

---

## [2.6.9] - 2026-02-17

### Fixed

- **`remember_update_memory` Query Issue**: Fixed "Memory not found" error for existing memories
  - Reduced property query from 6 properties to only 3 essential properties (`user_id`, `doc_type`, `version`)
  - Removed queries for optional properties (`type`, `weight`, `base_weight`) that may not exist on all records
  - Weaviate gRPC fails when querying properties that exist in schema but not on specific records
  - Only fetch properties actually needed for validation (ownership, doc type, version)
  - Fixes issue where memories with missing optional properties were reported as "not found"

### Added

- **Task 67: Migrate Memory_public Schema**
  - Created migration plan documentation for updating production `Memory_public` collection
  - Addresses schema mismatch: only `moderation_flags` present, missing `parent_id` and `thread_root_id`
  - Documents safe migration approach using `Memory_public_v2` with zero data loss

---

## [2.6.8] - 2026-02-17

### 🐛 Fixed

- **Critical Build Error**: Added missing `poetry` content type metadata to `src/constants/content-types.ts`
  - Fixed TypeScript compilation error: "Property 'poetry' is missing in type Record<ContentType, ContentTypeMetadata>"
  - Added poetry definition with category, description, examples, and common fields
  - Updated `CONTENT_TYPE_CATEGORIES` to include poetry in creative category
  - Build now successful

### ✨ Added

- **Task 66: Comment Field Initialization in Tools**
  - Updated `remember_create_memory` tool to initialize comment fields
    - Added `parent_id`, `thread_root_id`, `moderation_flags` to `CreateMemoryArgs` interface
    - New memories created with `parent_id: null`, `thread_root_id: null`, `moderation_flags: []`
  - Updated `remember_update_memory` tool to support comment field updates
    - Added comment fields to tool schema and `UpdateMemoryArgs` interface
    - Can now update `parent_id`, `thread_root_id`, and `moderation_flags`
  - Space memory tools automatically include comment fields via spread operator
  - Created task documentation: `agent/tasks/task-66-initialize-comment-fields-in-tools.md`

### 📝 Changed

- Updated `agent/progress.yaml` with Task 66 completion and build fix details
- All new memories now have consistent schema with comment fields initialized

### 🎯 Impact

- **Schema Consistency**: All new memories have comment fields, matching migrated old memories
- **Comment System Ready**: Can create comments, nested comments, and manage moderation flags
- **Build Stability**: TypeScript compiles without errors, all 81 tests passing

---

## [2.6.6] - 2026-02-16

### 🔧 Improved

- **Comprehensive Schema Property Alignment**
  - Updated `ALL_MEMORY_PROPERTIES` to match Weaviate schema exactly
  - Removed non-existent properties: `context`, `location`, `attribution`, `source_url`, `author`
  - Added all actual schema properties including flattened location/context fields
  - Added missing properties: `summary`, `computed_weight`, locale fields, access tracking fields
  - Now includes all 50+ actual schema properties
  - Organized with comments for clarity

### 📝 Changed

- Expanded `ALL_MEMORY_PROPERTIES` from 22 to 50+ properties
- Properties now match schema definition exactly
- Added proper documentation comments

### 🎯 Impact

- **Complete Data**: All memory properties now fetched correctly
- **No Mismatches**: Zero schema validation errors
- **Future-Proof**: New schema properties can be added to constant
- **Better Documentation**: Clear organization and comments

---

## [2.6.5] - 2026-02-16

### 🐛 Fixed

- **CRITICAL: Fixed Schema Property Mismatch in fetchMemoryWithAllProperties**
  - `ALL_MEMORY_PROPERTIES` constant had `trust_level` but schema has `trust`
  - Caused publish operations to fail with schema validation error
  - Fixed property name to match actual schema: `trust_level` → `trust`
  - Added missing `confidence` property to the list
  - Publish functionality now works correctly

### 🎯 Impact

- **Fixes**: Publishing memories to shared spaces now works
- **Unblocks**: Core publish/space functionality restored
- **Note**: This was introduced in v2.6.3 when creating the utility function

---

## [2.6.4] - 2026-02-16

### 🔧 Improved

- **Enhanced Tool Descriptions to Prevent Over-Filtering**
  - Added explicit warnings to all search/query tools about content type filtering
  - Agents now instructed to NOT add content_type filters unless explicitly requested by user
  - Prevents missed results from over-filtering by content type
  - Improves search quality and user experience

### 📝 Changed

- Updated `remember_search_memory` description with content type filtering guidance
- Updated `remember_query_memory` description with content type filtering guidance
- Updated `remember_search_space` description with content type filtering guidance
- Updated `remember_query_space` description with content type filtering guidance
- Added ✅ CORRECT and ❌ WRONG examples to clarify when to filter

### 🎯 Impact

- **Better Search Results**: No more over-filtering by content type
- **More Relevant Memories**: All types included unless user specifies
- **Clearer Agent Behavior**: Explicit guidance on when to use filters
- **Improved UX**: Users get comprehensive results by default

---

## [2.6.3] - 2026-02-16

### 🐛 Fixed

- **CRITICAL: Fixed Empty Published Memories Bug**
  - Published memories were empty shells with no content, title, or properties
  - Root cause: `fetchObjectById()` calls missing `returnProperties` parameter
  - Fixed in `remember_publish` and `remember_confirm` (executePublishMemory)
  - All published memories now include complete property data

### ✨ Added

- **New Utility Function**: `fetchMemoryWithAllProperties()`
  - Centralized helper in `src/weaviate/client.ts`
  - Ensures all memory properties are fetched consistently
  - Prevents future bugs from missing properties
  - Includes `ALL_MEMORY_PROPERTIES` constant (20+ properties)

### 🔧 Improved

- Enhanced debug logging in publish flow
  - Added property count verification
  - Added hasTitle and hasContent checks
  - Better diagnostics for troubleshooting

### 🎯 Impact

- **Fixes**: All published memories since v2.4.0 were empty
- **Search**: Published memories now searchable (have content)
- **Discovery**: Space functionality now works as designed
- **Note**: Existing empty memories need to be re-published

---

## [2.6.2] - 2026-02-16

### 🔒 Security

- **Enhanced Confirmation Tool Safety Guidelines**
  - Added critical safety requirements to `remember_confirm` tool description
  - Added critical safety requirements to `remember_deny` tool description
  - Added JSDoc comments emphasizing proper confirmation workflow
  - Prevents agents from bypassing user consent by chaining confirmations

### 📝 Changed

- Updated `remember_confirm` description with 5 critical safety requirements
- Updated `remember_deny` description with 5 critical safety requirements
- Added ⚠️ visual indicators for safety requirements
- Added detailed JSDoc comments explaining proper workflow

### 🎯 Safety Requirements

Both confirmation tools now explicitly require:
1. Token received in PREVIOUS tool response
2. Details presented to user for review
3. EXPLICIT user confirmation/denial in SEPARATE message
4. NEVER chain with other tool calls
5. ALWAYS treat as standalone, deliberate actions

---

## [2.6.1] - 2026-02-16

### 🔧 Improved

- **Standardized Structured Logging**: Replaced all direct console calls with structured logger
  - Replaced 54 console.log/error/warn calls across 8 files
  - All logs now use structured JSON format with proper severity levels
  - Logs respect LOG_LEVEL environment variable for filtering
  - Better Cloud Run log aggregation and filtering
  - Consistent context objects with relevant identifiers

### 📝 Changed

- Updated files with structured logging:
  - `src/services/confirmation-token.service.ts` - 11 console calls replaced
  - `src/tools/publish.ts` - 7 console calls replaced
  - `src/tools/confirm.ts` - 11 console calls replaced
  - `src/weaviate/client.ts` - 7 console calls replaced
  - `src/weaviate/schema.ts` - 4 console calls replaced
  - `src/weaviate/space-schema.ts` - 2 console calls replaced
  - `src/firestore/init.ts` - 6 console calls replaced
  - `src/config.ts` - 1 console call replaced

### 🎯 Benefits

- Log level filtering now works correctly (debug/info/warn/error)
- Structured JSON logs for cloud environments
- Consistent formatting across all services
- Better integration with Cloud Logging filters
- Easier to search and filter logs in production

---

## [2.6.0] - 2026-02-16

### ✨ Added

- **Comment System (Phase 1)**: Threaded discussions in shared spaces
  - Added 3 schema fields: `parent_id`, `thread_root_id`, `moderation_flags`
  - Comments support infinite nesting (no depth limit)
  - Per-space moderation flags (format: `"{space_id}:{flag_type}"`)
  - Zero new tools required - reuses existing `remember_create_memory`

- **Comment Filtering**: Clean discovery experience
  - Added `include_comments` parameter to `remember_search_space` (default: false)
  - Added `include_comments` parameter to `remember_query_space` (default: false)
  - Comments excluded from search by default for cleaner results
  - Opt-in via `include_comments: true` to include discussions

### 🔧 Changed

- **Search behavior**: `remember_search_space` now excludes comments by default
- **Query behavior**: `remember_query_space` now excludes comments by default
- Tool descriptions updated to mention comment filtering

### 📚 Documentation

- Created Milestone 12: Comment System (Phase 1)
- Created Tasks 55-59 for comment implementation
- Updated design document with comment system architecture

### 🎯 Usage

```typescript
// Create a comment
remember_create_memory({
  type: "comment",
  content: "Great post!",
  parent_id: "memory123",
  thread_root_id: "memory123",
  spaces: ["the_void"]
})

// Search without comments (default)
remember_search_space({
  spaces: ["the_void"],
  query: "hiking"
})

// Search with comments (opt-in)
remember_search_space({
  spaces: ["the_void"],
  query: "hiking",
  include_comments: true
})
```

### ⚠️ Notes

- Backward compatible - no breaking changes
- Comments are opt-in for search/query
- Future phases will add voting, moderation tools, and notifications

---

## [2.4.1] - 2026-02-16

### 🐛 Fixed

- **Critical: Enhanced error handling in confirmation token service**
  - Added try-catch around Firestore operations in `createRequest`
  - Added validation that `addDocument` returns valid docRef with ID
  - Added comprehensive error logging with full context
  - Errors now properly propagate to tool handlers
  - Prevents silent failures when Firestore operations fail

### 🔧 Improved

- **Diagnostic Logging**: Enhanced logging in token service
  - Logs before/after Firestore operations
  - Validates docRef and docRef.id
  - Logs full error details including stack traces
  - Helps diagnose production Firestore issues

---

## [2.4.0] - 2026-02-16

### ✨ Added

- **Multi-Space Support**: Publish and search across multiple spaces simultaneously
  - `spaces` array parameter in `remember_publish` (replaces `target`)
  - `spaces` array parameter in `remember_search_space` (replaces `space`)
  - `spaces` array parameter in `remember_query_space` (replaces `space`)
  - Single memory can belong to multiple spaces
  - No duplication - one memory, multiple spaces
  - Search multiple spaces in one query

- **Unified Public Collection**: `Memory_public` replaces per-space collections
  - All public memories in single collection
  - Efficient storage (N× reduction in documents)
  - Simpler architecture
  - Uses `containsAny` filter for multi-space queries

### 🔧 Changed

- **SpaceMemory type**: `space_id: string` → `spaces: string[]`
- **remember_publish**: `target` parameter → `spaces` array
- **remember_search_space**: `space` parameter → `spaces` array
- **remember_query_space**: `space` parameter → `spaces` array
- **Collection strategy**: Per-space collections → Unified `Memory_public`
- **Search results**: Include `spaces_searched` or `spaces_queried` in response

### 📚 Documentation

- Created Milestone 11: Unified Public Collection
- Created Tasks 46-54 for implementation
- Created design document: `agent/design/unified-public-collection.md`
- Created design document: `agent/design/comment-memory-type.md`

### ⚠️ Deprecation

- `ensureSpaceCollection()` deprecated (use `ensurePublicCollection()`)
- `getSpaceCollectionName()` deprecated (use `PUBLIC_COLLECTION_NAME`)
- Per-space collections (`Memory_the_void`, etc.) will be removed in v3.0.0

---

## [2.3.3] - 2026-02-16

### 🐛 Fixed

- **Critical: remember_publish Weaviate API usage**
  - Fixed incorrect Weaviate v3 API usage (removed double-wrapping of properties)
  - Properties are now inserted directly without extra wrapper
  - Collection routing is explicit via `ensureSpaceCollection()`, not via document fields
  - Memories correctly stored in `Memory_the_void` collection
  - Preserved `user_id` field for attribution tracking (alongside `author_id` and `space_id`)

### 🔧 Changed

- Enhanced logging in `executePublishMemory` to track field presence during publish
- Added verification logging for `user_id`, `author_id`, and `space_id` fields

---

## [2.3.2] - 2026-02-16

### ⚠️ Reverted

- **Incorrect fix**: Removed `user_id` field (this was wrong - user_id needed for attribution)
- This version should not be used - upgrade to 2.3.3

---

## [2.3.0] - 2026-02-16

### ✨ Added

- **Shared Spaces**: Publish memories to shared discovery spaces
  - "The Void" - First shared space for discovering thoughts and ideas
  - Space collections: `Memory_the_void` with snake_case naming
  - Multi-user discovery with attribution tracking

- **Token-Based Confirmation**: Secure two-phase workflow for sensitive operations
  - One-time use tokens with 5-minute expiry
  - Firestore storage: `users/{user_id}/requests`
  - Generic pattern extensible to other confirmable actions

- **5 New MCP Tools**:
  - `remember_publish` - Request to publish memory to shared space (generates token)
  - `remember_confirm` - Confirm and execute pending actions
  - `remember_deny` - Cancel pending actions
  - `remember_search_space` - Search shared spaces with hybrid search
  - `remember_query_space` - Query shared spaces with natural language

- **Confirmation Token Service**: Manages tokens with automatic expiry
  - UUID v4 tokens
  - Status tracking (pending, confirmed, denied, expired, retracted)
  - Firestore TTL integration for automatic cleanup

- **Space Memory Types**: SpaceMemory interface with attribution fields
  - `space_id`, `author_id`, `ghost_id`, `published_at`, `discovery_count`
  - Support for pseudonymous publishing (ghost profiles)

### 🔧 Changed

- Tool count increased from 12 to 17
- Firestore structure: Added `users/{user_id}/requests` for confirmation tokens
- Collection naming: snake_case for spaces ("The Void" → `the_void` → `Memory_the_void`)

### 🔒 Security

- One-time use tokens prevent replay attacks
- User ownership verification before publishing
- Fresh data fetch during confirmation (not from stored payload)
- 5-minute token expiry prevents stale requests

---

## [2.0.2] - 2026-02-14

### ✨ Added

- **Comprehensive Error Handling**: Applied centralized error handler to all 12 MCP tools
  - All tools now use `handleToolError()` from `src/utils/error-handler.ts`
  - Consistent error logging with full context across all operations
  - Stack traces included in all error messages
  - Tool-specific context (userId, IDs, operation details) in every error

### 🔧 Improved

- **Error Diagnostics**: Production debugging significantly enhanced
  - Memory tools: create, update, delete, search, find-similar, query
  - Relationship tools: create, update, delete, search
  - Preference tools: set, get
  - All errors now include operation context and user information

---

## [2.0.1] - 2026-02-14

### 🐛 Fixed

- **Error Reporting**: Improved error logging in `remember_update_memory` for better debugging
  - Added detailed error context including userId, memoryId, and provided fields
  - Added stack traces to error messages for easier troubleshooting
  - Added specific error handling for fetch and update operations
  - Errors now include collection name and operation details
  - Helps diagnose production issues in Cloud Run logs

### 📝 Changes

- Error messages now include full context for debugging
- Separate try-catch blocks for fetch and update operations
- Better structured logging with error details

---

## [2.0.0] - 2026-02-12

### 🚨 BREAKING CHANGES

- **`createServer` is now async**: The factory function now returns `Promise<Server>` instead of `Server`
- Same breaking change as v1.0.0, but bumped to v2.0.0 for clarity

---

## [1.0.2] - 2026-02-12

### 🐛 Fixed

- **Weaviate v3 Filter API**: Now uses actual `Filters.and()` and `Filters.or()` from weaviate-client package
  - Replaced object format `{ operator: 'Or', operands: [...] }` with `Filters.or(...filters)`
  - Replaced object format `{ operator: 'And', operands: [...] }` with `Filters.and(...filters)`
  - This is the correct v3 API per Weaviate documentation
  - Fixes "no children for operator Or" error in production

- **Unit Tests**: Updated tests to work with Weaviate's internal filter structures
  - Tests now verify filters are created (not exact internal structure)
  - More resilient to Weaviate API changes
  - All 53 tests passing

### 🔍 Added

- **Debug Logging**: Added query logging to search-memory.ts
  - Logs query string, searchOptions, and filter presence
  - Helps troubleshoot query construction issues

---

## [1.0.1] - 2026-02-12

### 🐛 Fixed

- **Empty Or/And Operator Bug**: Fixed "no children for operator Or" error
  - Added validation to filter out undefined/null values before combining filters
  - `combineFiltersWithOr` now validates operands array is not empty
  - `combineFiltersWithAnd` now validates operands array is not empty
  - `buildCombinedSearchFilters` filters out invalid filters before OR combination
  - Prevents creation of operators with empty children arrays

### ✨ Added

- **Edge Case Tests**: Added 3 new test cases for undefined/null filter handling
  - Test for empty Or operator prevention
  - Test for empty And operator prevention
  - Test for mixed valid and undefined filters

### 📊 Test Results

- **57 tests passing** (up from 54)
- **4 test suites passing** (all green)
- **Code coverage: 90.56%** on weaviate-filters.ts (up from 83.67%)

---

## [1.0.0] - 2026-02-12

### 🚨 BREAKING CHANGES

- **`createServer` is now async**: The factory function now returns `Promise<Server>` instead of `Server`. Consumers must use `await` when calling `createServer()`.

  ```typescript
  // Before (0.2.x)
  const server = createServer(token, userId);
  
  // After (1.0.0+)
  const server = await createServer(token, userId);
  ```

  **Impact**: Only affects direct factory users. The mcp-auth wrapper handles async factories automatically, so no changes needed for mcp-auth users.

### ✨ Added

- **Weaviate v3 Filter API**: Implemented proper Weaviate v3 filter builders using fluent API
  - Created `src/utils/weaviate-filters.ts` with filter builder utilities
  - Supports AND/OR logic for complex filter combinations
  - Comprehensive filter support: type, weight, trust, date range, tags

- **Combined Memory + Relationship Search**: `remember_search_memory` now searches BOTH memories and relationships by default
  - Uses OR logic to search both doc types
  - Results separated into `memories` and `relationships` arrays
  - Backward compatible: set `include_relationships: false` to search only memories
  - Relationship observations are now searchable

- **Comprehensive Unit Tests**: Added 29 test cases for filter builders
  - Tests for `buildMemoryOnlyFilters`, `buildRelationshipOnlyFilters`, `buildCombinedSearchFilters`
  - Tests for edge cases and complex filter scenarios
  - 83.67% code coverage on weaviate-filters.ts

- **Jest Type Support**: Added "jest" to tsconfig types array for proper TypeScript support in test files

### 🐛 Fixed

- **gRPC Filter Error**: Fixed "paths needs to have an uneven number of components" error
  - Replaced old Weaviate v2 filter format (path/operator/valueText) with v3 fluent API
  - Affected tools: `remember_search_memory`, `remember_query_memory`

- **Database Initialization**: Changed from fire-and-forget to await pattern
  - Server now waits for database initialization before accepting requests
  - Prevents server from starting in broken state
  - Errors propagate clearly to caller

- **Test Failures**: Fixed server-factory tests to handle async createServer
  - Updated all tests to use async/await
  - Changed synchronous expect() calls to async expect().resolves/rejects

### 📊 Test Results

- **54 tests passing** (up from 25)
- **4 test suites passing** (all green)
- **Overall coverage: 26.54%** (up from 22.53%)
- **1 skipped** (integration test requiring live Weaviate)

### 📝 Documentation

- Updated `agent/progress.yaml` with Task 20 completion
- Updated `agent/tasks/task-20-fix-weaviate-v3-filters.md` with implementation details
- All changes documented in agent directory

---

## [0.2.8] - 2026-02-11

### ✨ Added

- Complete memory CRUD operations (create, read, update, delete)
- Complete relationship CRUD operations (create, read, update, delete)
- User preferences system with 6 categories
- 12 MCP tools fully implemented
- Hybrid search (semantic + keyword)
- Vector similarity search
- RAG-optimized queries
- 45 content types

### 📊 Milestones Completed

- M1: Project Foundation (100%)
- M2: Core Memory System (100%)
- M3: Relationships & Graph (100%)
- M4: User Preferences (100%)

---

## [0.1.0] - 2026-02-11

### ✨ Initial Release

- Project structure and configuration
- Weaviate client with multi-tenant support
- Firestore integration
- Basic MCP server with stdio transport
- Server factory for mcp-auth compatibility
- 25 unit tests
- Dual build: standalone server + library factory

---

## Migration Guides

### Migrating from 0.2.x to 1.0.0

**If you're using the factory export:**

```typescript
// OLD (0.2.x)
import { createServer } from '@prmichaelsen/remember-mcp/factory';
const server = createServer(accessToken, userId);

// NEW (1.0.0+)
import { createServer } from '@prmichaelsen/remember-mcp/factory';
const server = await createServer(accessToken, userId);
```

**If you're using mcp-auth wrapper:**
- No changes needed! mcp-auth handles async factories automatically.

**If you're using standalone server:**
- No changes needed! You don't call createServer directly.

**If you're using Claude Desktop:**
- No changes needed! You use the built server via npx.

---

## Versioning Policy

This project follows [Semantic Versioning](https://semver.org/):

- **Major** (X.0.0): Breaking changes
- **Minor** (0.X.0): New features, backward compatible
- **Patch** (0.0.X): Bug fixes, backward compatible

**Note**: Version 1.0.0 indicates the first stable release with a breaking change from 0.2.x. Future breaking changes will increment the major version (2.0.0, 3.0.0, etc.).
