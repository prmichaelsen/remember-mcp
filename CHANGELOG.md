# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.8.0] - 2026-02-25

### Added

- **Comprehensive Tool Debugging System**
  - Added `REMEMBER_MCP_DEBUG_LEVEL` environment variable for configurable debug logging
  - 6 debug levels: NONE (default), ERROR, WARN, INFO, DEBUG, TRACE
  - DebugLogger class with context propagation and performance timing
  - Parameter dumping at TRACE level for deep troubleshooting
  - Zero performance overhead when disabled (NONE level)
  - 12 unit tests with 100% coverage on debug utility

- **Debug Integration for Space Tools**
  - Integrated debug logging into `remember_publish` tool
  - Integrated debug logging into `remember_confirm` tool
  - Integrated debug logging into `remember_search_space` tool
  - Integrated debug logging into `remember_query_space` tool
  - Integrated debug logging into Weaviate client `fetchMemoryWithAllProperties()`

- **Debug Documentation**
  - Added debugging section to README.md with usage examples
  - Added `REMEMBER_MCP_DEBUG_LEVEL` to .env.example
  - Security warnings for TRACE level (may expose sensitive data)

### Fixed

- **CRITICAL: Fixed Published Memories Not Appearing in Search Results**
  - Added 8 missing space-related properties to `ALL_MEMORY_PROPERTIES` constant
  - Properties: `spaces`, `space_id`, `author_id`, `ghost_id`, `attribution`, `published_at`, `discovery_count`, `space_memory_id`
  - Root cause: Properties added to schema (v2.4.0) but not to fetch constant (v2.6.3)
  - Published memories now properly include all space fields
  - Search filtering by `spaces` array now works correctly
  - Memories now discoverable in The Void and other shared spaces

### Technical Details

**Debug System**:
- Created: `src/utils/debug.ts` (147 lines)
- Created: `src/utils/debug.spec.ts` (12 tests)
- Modified: `src/config.ts` (added DebugLevel enum and debugConfig)
- Modified: 5 tool files with debug logging integration

**Bug Fix**:
- Modified: `src/weaviate/client.ts` (lines 200-217)
- Added 8 properties to `ALL_MEMORY_PROPERTIES` constant
- Ensures complete property fetching during publish workflow

### Impact

**Debug System**:
- Developers can now enable detailed tracing for troubleshooting
- Performance profiling available via timing measurements
- Production-safe with configurable verbosity
- Helps diagnose database operation issues

**Bug Fix**:
- All published memories since v2.4.0 now discoverable
- Space functionality fully operational
- User-reported issue resolved

---

## [2.7.10] - 2026-02-17
