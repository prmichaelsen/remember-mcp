# Task 60: Standardize Structured Logging

**Milestone**: [M8 - Testing and Quality](../milestones/milestone-8-testing-quality.md)
**Estimated Time**: 3 hours
**Dependencies**: None
**Status**: Not Started

---

## Objective

Replace all direct `console.log()` calls with the structured logger utility to ensure consistent, filterable, and searchable logging across the codebase, particularly in production Cloud Run environments.

---

## Context

The codebase has a structured logger utility at [`src/utils/logger.ts`](../../src/utils/logger.ts) that provides:
- Log level filtering based on `LOG_LEVEL` environment variable
- Structured JSON output for cloud environments
- Consistent formatting with proper severity levels (debug, info, warn, error)

However, many files are using `console.log()` directly, which bypasses this system and results in:
- **No log level filtering** - all logs appear regardless of LOG_LEVEL setting
- **Inconsistent formatting** - mix of structured and unstructured logs
- **Harder to search** - no consistent prefixes or structure in Cloud Run logs
- **Missing context** - logs don't include proper severity levels for cloud log aggregation

Files currently using direct console.log:
- `src/services/confirmation-token.service.ts` (lines 72-301)
- `src/tools/publish.ts` (lines 63-192)
- `src/tools/confirm.ts` (lines 44-200)
- `src/config.ts` (line 55)
- And potentially others

---

## Steps

### 1. Audit All Console.log Usage

Search the entire codebase for direct console usage:

```bash
cd /home/prmichaelsen/remember-mcp
grep -rn "console\." src/ --include="*.ts" | grep -v ".spec.ts" | grep -v "logger.ts"
```

Create a list of all files that need updating.

### 2. Update ConfirmationTokenService

Replace all console.log calls in `src/services/confirmation-token.service.ts`:

**Import the logger**:
```typescript
import { logger } from '../utils/logger.js';
```

**Replace console.log patterns**:

```typescript
// OLD:
console.log('[ConfirmationTokenService] Creating request:', {
  userId,
  action,
  targetCollection,
});

// NEW:
logger.info('Creating confirmation request', {
  service: 'ConfirmationTokenService',
  userId,
  action,
  targetCollection,
});
```

**Replace console.error patterns**:
```typescript
// OLD:
console.error('[ConfirmationTokenService] FAILED to create request:', {
  error: error instanceof Error ? error.message : String(error),
  userId,
});

// NEW:
logger.error('Failed to create confirmation request', {
  service: 'ConfirmationTokenService',
  error: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined,
  userId,
});
```

### 3. Update Publish Tool

Replace all console.log calls in `src/tools/publish.ts`:

```typescript
// Import logger
import { logger } from '../utils/logger.js';

// OLD:
console.log('[remember_publish] Starting publish request:', {
  userId,
  memoryId: args.memory_id,
});

// NEW:
logger.info('Starting publish request', {
  tool: 'remember_publish',
  userId,
  memoryId: args.memory_id,
  spaces: args.spaces,
  spaceCount: args.spaces.length,
});
```

### 4. Update Confirm Tool

Replace all console.log calls in `src/tools/confirm.ts`:

```typescript
// Import logger
import { logger } from '../utils/logger.js';

// OLD:
console.log('[remember_confirm] Starting confirmation:', {
  userId,
  token: args.token,
});

// NEW:
logger.info('Starting confirmation', {
  tool: 'remember_confirm',
  userId,
  token: args.token,
});

// OLD:
console.log('[executePublishMemory] Starting execution:', {
  userId,
  memoryId: request.payload.memory_id,
});

// NEW:
logger.info('Executing publish memory action', {
  function: 'executePublishMemory',
  userId,
  memoryId: request.payload.memory_id,
  spaces: request.payload.spaces,
});
```

### 5. Update Config Validation

Replace console.log in `src/config.ts`:

```typescript
// Import logger at top
import { logger } from './utils/logger.js';

// In validateConfig():
// OLD:
console.log('[Config] Configuration validated');

// NEW:
logger.info('Configuration validated', { module: 'config' });
```

### 6. Search for Other Console Usage

Check for any remaining console usage:

```bash
grep -rn "console\." src/ --include="*.ts" | grep -v ".spec.ts" | grep -v "logger.ts"
```

Update any remaining instances following the same pattern.

### 7. Update Tests if Needed

If any tests are checking for console.log output, update them to work with the logger:

```typescript
// Tests can still use console.log for test output
// But production code should use logger
```

### 8. Verify Log Level Filtering

Test that log level filtering works correctly:

```bash
# Set LOG_LEVEL to 'warn' and verify debug/info logs don't appear
LOG_LEVEL=warn npm start

# Set LOG_LEVEL to 'debug' and verify all logs appear
LOG_LEVEL=debug npm start
```

---

## Verification

- [ ] All `console.log()` calls in production code replaced with `logger.info()`
- [ ] All `console.error()` calls in production code replaced with `logger.error()`
- [ ] All `console.warn()` calls in production code replaced with `logger.warn()`
- [ ] All `console.debug()` calls in production code replaced with `logger.debug()`
- [ ] Logger imported in all modified files: `import { logger } from '../utils/logger.js';`
- [ ] All log messages include context object with relevant fields (userId, tool name, etc.)
- [ ] No console.* calls remain in src/ (except in logger.ts and *.spec.ts files)
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] Tests pass: `npm test`
- [ ] Log level filtering works: logs respect LOG_LEVEL environment variable
- [ ] Structured logs appear correctly in Cloud Run (JSON format with severity)

---

## Expected Output

**Before** (inconsistent logging):
```
[ConfirmationTokenService] Creating request: { userId: '123', action: 'publish' }
[remember_publish] Starting publish request: { userId: '123' }
[Config] Configuration validated
```

**After** (structured logging):
```json
{"level":"INFO","message":"Creating confirmation request","service":"ConfirmationTokenService","userId":"123","action":"publish"}
{"level":"INFO","message":"Starting publish request","tool":"remember_publish","userId":"123","memoryId":"abc","spaces":["the_void"]}
{"level":"INFO","message":"Configuration validated","module":"config"}
```

**Log Level Filtering**:
- `LOG_LEVEL=error`: Only error logs appear
- `LOG_LEVEL=warn`: Warn and error logs appear
- `LOG_LEVEL=info`: Info, warn, and error logs appear (default)
- `LOG_LEVEL=debug`: All logs appear including debug

**Cloud Run Benefits**:
- Logs have proper severity levels (INFO, WARN, ERROR, DEBUG)
- Structured JSON makes filtering easier in Cloud Console
- Consistent format across all services
- Better integration with Cloud Logging filters

---

## Common Issues and Solutions

### Issue 1: Logger not found error
**Symptom**: `Cannot find module '../utils/logger.js'`
**Solution**: Check the relative path from the file to logger.ts. Adjust `../` depth as needed.

### Issue 2: TypeScript errors about logger methods
**Symptom**: `Property 'info' does not exist on type...`
**Solution**: Ensure logger is imported correctly and TypeScript can resolve the module.

### Issue 3: Logs still appearing when LOG_LEVEL=error
**Symptom**: Info logs appear even with LOG_LEVEL=error
**Solution**: Verify the logger is being used, not console.log. Check that LOG_LEVEL environment variable is set correctly.

### Issue 4: Tests failing after logger changes
**Symptom**: Tests that checked console.log output now fail
**Solution**: Update tests to either:
- Mock the logger module
- Check for logger calls instead of console calls
- Or keep console.log in test files (tests are excluded from this change)

---

## Resources

- [Structured Logging Best Practices](https://cloud.google.com/logging/docs/structured-logging): Google Cloud structured logging guide
- [Logger Utility](../../src/utils/logger.ts): The existing logger implementation
- [Cloud Run Logging](https://cloud.google.com/run/docs/logging): How Cloud Run handles logs

---

## Notes

- **Test files (*.spec.ts) can continue using console.log** - this task only affects production code
- **The logger.ts file itself uses console.* internally** - this is correct and should not be changed
- **Structured logging improves observability** - makes debugging production issues much easier
- **Log level filtering reduces noise** - production can run at 'info' or 'warn' level
- **Context objects should include relevant identifiers** - userId, memoryId, tool name, etc.
- **Keep messages concise** - put details in the context object, not the message string
- **Use appropriate log levels**:
  - `debug`: Detailed diagnostic information (rarely needed in production)
  - `info`: General informational messages (normal operations)
  - `warn`: Warning messages (something unexpected but not an error)
  - `error`: Error messages (something failed)

---

**Next Task**: TBD
**Related Design Docs**: None
**Estimated Completion Date**: TBD
