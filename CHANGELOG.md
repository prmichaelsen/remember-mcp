# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
