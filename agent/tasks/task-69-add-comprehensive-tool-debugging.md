# Task 69: Add Comprehensive Tool Debugging

**Milestone**: M8 (Testing & Quality)
**Estimated Time**: 4-6 hours
**Dependencies**: None
**Status**: Not Started

---

## Objective

Implement comprehensive debugging capabilities for all MCP tools that can be enabled via a `REMEMBER_MCP_DEBUG_LEVEL` environment variable, providing detailed insights into tool execution, parameter validation, database operations, and error conditions.

---

## Context

Currently, debugging tool issues in production requires analyzing Cloud Run logs with limited context. Adding configurable debug logging will:
- Enable detailed tracing of tool execution flow
- Show parameter validation and transformation
- Log database queries and responses
- Track timing and performance metrics
- Provide context for error conditions

This will significantly improve troubleshooting and development experience.

---

## Steps

### 1. Define Debug Levels

Create debug level constants and configuration.

**File**: [`src/config.ts`](../../src/config.ts)

**Add**:
```typescript
export enum DebugLevel {
  NONE = 0,      // No debug output (production default)
  ERROR = 1,     // Only errors
  WARN = 2,      // Warnings and errors
  INFO = 3,      // Info, warnings, and errors
  DEBUG = 4,     // Debug, info, warnings, and errors
  TRACE = 5,     // Everything including parameter dumps
}

export const debugConfig = {
  level: ((): DebugLevel => {
    const level = process.env.REMEMBER_MCP_DEBUG_LEVEL?.toUpperCase();
    switch (level) {
      case 'TRACE': return DebugLevel.TRACE;
      case 'DEBUG': return DebugLevel.DEBUG;
      case 'INFO': return DebugLevel.INFO;
      case 'WARN': return DebugLevel.WARN;
      case 'ERROR': return DebugLevel.ERROR;
      case 'NONE': return DebugLevel.NONE;
      default: return DebugLevel.NONE;
    }
  })(),
  enabled: (level: DebugLevel): boolean => {
    return debugConfig.level >= level;
  },
};
```

### 2. Create Debug Utility

Create centralized debug logging utility.

**File**: [`src/utils/debug.ts`](../../src/utils/debug.ts) (new file)

**Content**:
```typescript
import { debugConfig, DebugLevel } from '../config.js';
import { logger } from './logger.js';

export interface DebugContext {
  tool: string;
  userId?: string;
  operation?: string;
  [key: string]: any;
}

export class DebugLogger {
  private context: DebugContext;

  constructor(context: DebugContext) {
    this.context = context;
  }

  trace(message: string, data?: any): void {
    if (debugConfig.enabled(DebugLevel.TRACE)) {
      logger.debug(`[TRACE] ${message}`, {
        ...this.context,
        ...data,
        debugLevel: 'TRACE',
      });
    }
  }

  debug(message: string, data?: any): void {
    if (debugConfig.enabled(DebugLevel.DEBUG)) {
      logger.debug(`[DEBUG] ${message}`, {
        ...this.context,
        ...data,
        debugLevel: 'DEBUG',
      });
    }
  }

  info(message: string, data?: any): void {
    if (debugConfig.enabled(DebugLevel.INFO)) {
      logger.info(`[INFO] ${message}`, {
        ...this.context,
        ...data,
        debugLevel: 'INFO',
      });
    }
  }

  warn(message: string, data?: any): void {
    if (debugConfig.enabled(DebugLevel.WARN)) {
      logger.warn(`[WARN] ${message}`, {
        ...this.context,
        ...data,
        debugLevel: 'WARN',
      });
    }
  }

  error(message: string, data?: any): void {
    if (debugConfig.enabled(DebugLevel.ERROR)) {
      logger.error(`[ERROR] ${message}`, {
        ...this.context,
        ...data,
        debugLevel: 'ERROR',
      });
    }
  }

  // Dump full object (TRACE only)
  dump(label: string, obj: any): void {
    if (debugConfig.enabled(DebugLevel.TRACE)) {
      logger.debug(`[DUMP] ${label}`, {
        ...this.context,
        dump: JSON.stringify(obj, null, 2),
        debugLevel: 'TRACE',
      });
    }
  }

  // Time operation (DEBUG and above)
  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (!debugConfig.enabled(DebugLevel.DEBUG)) {
      return fn();
    }

    const start = Date.now();
    this.debug(`${label} - Starting`);
    
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.debug(`${label} - Completed`, { durationMs: duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`${label} - Failed`, { 
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export function createDebugLogger(context: DebugContext): DebugLogger {
  return new DebugLogger(context);
}
```

### 3. Add Debug Logging to Tools

Update all 17 MCP tools with debug logging.

**Pattern for Each Tool**:

```typescript
import { createDebugLogger } from '../utils/debug.js';

export async function handleToolName(args: ToolArgs, userId: string): Promise<string> {
  const debug = createDebugLogger({
    tool: 'remember_tool_name',
    userId,
    operation: 'tool_operation',
  });

  try {
    debug.info('Tool invoked');
    debug.trace('Tool arguments', { args });

    // Parameter validation
    debug.debug('Validating parameters');
    // ... validation code ...
    debug.debug('Parameters validated');

    // Database operations
    const result = await debug.time('Fetch from database', async () => {
      debug.trace('Query parameters', { queryParams });
      const data = await collection.query.fetchObjectById(id);
      debug.trace('Query result', { resultCount: data.length });
      return data;
    });

    debug.info('Tool completed successfully');
    return JSON.stringify(result, null, 2);
  } catch (error) {
    debug.error('Tool failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
```

**Tools to Update** (17 total):
- Memory tools (6): create, search, delete, update, find-similar, query
- Relationship tools (4): create, update, search, delete
- Preference tools (2): set, get
- Space tools (5): publish, confirm, deny, search-space, query-space

### 4. Add Debug Logging to Database Clients

Add debug logging to Weaviate and Firestore clients.

**File**: [`src/weaviate/client.ts`](../../src/weaviate/client.ts)

**Add**:
```typescript
import { createDebugLogger } from '../utils/debug.js';

export async function fetchMemoryWithAllProperties(
  collection: any,
  memoryId: string
) {
  const debug = createDebugLogger({
    tool: 'weaviate-client',
    operation: 'fetchMemoryWithAllProperties',
  });

  debug.debug('Fetching memory', { memoryId, collectionName: collection.name });
  
  try {
    const result = await debug.time('Fetch with all properties', async () => {
      return await collection.query.fetchObjectById(memoryId, {
        returnProperties: ALL_MEMORY_PROPERTIES,
      });
    });
    
    debug.trace('Fetch result', {
      found: !!result,
      propertyCount: result?.properties ? Object.keys(result.properties).length : 0,
    });
    
    return result;
  } catch (error) {
    debug.warn('Fetch with all properties failed, falling back', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    return await debug.time('Fetch without property specification', async () => {
      return await collection.query.fetchObjectById(memoryId);
    });
  }
}
```

### 5. Update Configuration Documentation

Document the debug environment variable.

**File**: [`.env.example`](../../.env.example)

**Add**:
```bash
# Debug Configuration (optional)
# Controls debug logging verbosity
# Values: NONE (default), ERROR, WARN, INFO, DEBUG, TRACE
# TRACE includes full parameter dumps (use with caution in production)
REMEMBER_MCP_DEBUG_LEVEL=NONE
```

**File**: [`README.md`](../../README.md)

**Add section**:
```markdown
## Debugging

Enable detailed debug logging with the `REMEMBER_MCP_DEBUG_LEVEL` environment variable:

```bash
# No debug output (production default)
REMEMBER_MCP_DEBUG_LEVEL=NONE

# Only errors
REMEMBER_MCP_DEBUG_LEVEL=ERROR

# Warnings and errors
REMEMBER_MCP_DEBUG_LEVEL=WARN

# Info, warnings, and errors
REMEMBER_MCP_DEBUG_LEVEL=INFO

# Debug, info, warnings, and errors (recommended for development)
REMEMBER_MCP_DEBUG_LEVEL=DEBUG

# Everything including parameter dumps (use with caution)
REMEMBER_MCP_DEBUG_LEVEL=TRACE
```

**Example**:
```bash
# Enable debug logging for development
REMEMBER_MCP_DEBUG_LEVEL=DEBUG npm run dev

# Enable trace logging for troubleshooting
REMEMBER_MCP_DEBUG_LEVEL=TRACE npm start
```

**Note**: TRACE level includes full parameter dumps and may expose sensitive data. Use only in development.
```

### 6. Add Unit Tests

Create tests for debug utility.

**File**: [`src/utils/debug.spec.ts`](../../src/utils/debug.spec.ts) (new file)

**Tests**:
- Debug level parsing from environment variable
- Debug level filtering (only logs at or above configured level)
- Context propagation
- Time measurement
- Parameter dumping (TRACE only)

### 7. Test Debug Levels

Verify debug logging works at each level.

**Test Cases**:
1. NONE: No debug output
2. ERROR: Only errors logged
3. WARN: Warnings and errors logged
4. INFO: Info, warnings, and errors logged
5. DEBUG: Debug, info, warnings, and errors logged
6. TRACE: Everything including parameter dumps

**Verification**:
```bash
# Test each level
REMEMBER_MCP_DEBUG_LEVEL=NONE npm run dev
REMEMBER_MCP_DEBUG_LEVEL=ERROR npm run dev
REMEMBER_MCP_DEBUG_LEVEL=DEBUG npm run dev
REMEMBER_MCP_DEBUG_LEVEL=TRACE npm run dev
```

---

## Verification

- [ ] Debug levels defined in config.ts
- [ ] Debug utility created (src/utils/debug.ts)
- [ ] All 17 tools updated with debug logging
- [ ] Database clients updated with debug logging
- [ ] .env.example updated with debug variable
- [ ] README.md updated with debug documentation
- [ ] Unit tests created for debug utility
- [ ] All debug levels tested and working
- [ ] TypeScript compiles without errors
- [ ] All tests passing
- [ ] No performance impact when debug disabled (NONE)

---

## Benefits

### Development
- Faster debugging with detailed execution traces
- Easy parameter inspection
- Performance profiling with timing
- Clear error context

### Production
- Configurable verbosity for troubleshooting
- No performance impact when disabled
- Structured logs for Cloud Run filtering
- Safe parameter dumping (TRACE only)

### Troubleshooting
- Reproduce issues with debug logs
- Understand tool execution flow
- Identify bottlenecks
- Diagnose database query issues

---

## Files to Create

- [`src/utils/debug.ts`](../../src/utils/debug.ts) - Debug utility
- [`src/utils/debug.spec.ts`](../../src/utils/debug.spec.ts) - Unit tests

---

## Files to Modify

- [`src/config.ts`](../../src/config.ts) - Add debug configuration
- [`.env.example`](../../.env.example) - Add debug variable
- [`README.md`](../../README.md) - Add debug documentation
- All 17 tool files - Add debug logging
- [`src/weaviate/client.ts`](../../src/weaviate/client.ts) - Add debug logging
- [`src/firestore/init.ts`](../../src/firestore/init.ts) - Add debug logging

---

## Performance Considerations

- Debug checks are fast (simple comparison)
- No overhead when debug disabled (NONE)
- Timing only adds ~1ms overhead (DEBUG+)
- Parameter dumps only at TRACE level
- Structured logging already in place

---

## Security Considerations

- TRACE level may expose sensitive data
- Document TRACE as development-only
- Never use TRACE in production
- Sanitize sensitive fields in dumps
- Use INFO/DEBUG for production troubleshooting

---

## Next Steps

After completing this task:
1. Test debug logging in development
2. Deploy with DEBUG level to staging
3. Monitor performance impact
4. Document common debug patterns
5. Create troubleshooting guide using debug logs
