# Library Services Pattern

## Overview

All data access operations (API calls, Firestore operations, external services) must go through dedicated service layer libraries. Direct calls from components, routes, or other non-service code are anti-patterns.

## Service Types

### 1. Database Services
**Purpose**: Direct Firestore/database operations
**Naming**: `{Domain}DatabaseService`
**File**: `{domain}-database.service.ts`
**Used By**: API routes, beforeLoad, server functions, cron jobs

**Characteristics**:
- Directly calls `getDocument`, `setDocument`, `queryDocuments`
- Server-side only (uses firebase-admin-sdk)
- Handles Zod validation
- Manages timestamps (created_at, updated_at)
- Returns typed data models

**Example**: `OAuthIntegrationDatabaseService`, `ConversationDatabaseService`

### 2. API Services (Client Wrappers)
**Purpose**: Wrap API endpoint calls for client-side use
**Naming**: `{Domain}Service`
**File**: `{domain}.service.ts`
**Used By**: Components, client-side hooks

**Characteristics**:
- Calls `fetch('/api/...')`
- Client-side safe
- Handles HTTP errors
- Returns typed data models

**Example**: `IntegrationsService`, `UserService`

## Naming Convention

**Key Insight**: Service class names indicate scope - no method suffixes needed!

### Database Services
- **File**: `oauth-integration-database.service.ts`
- **Class**: `OAuthIntegrationDatabaseService`
- **Methods**: `getIntegration()`, `saveIntegration()`, `getUserIntegrations()`

### API Services  
- **File**: `integrations.service.ts`
- **Class**: `IntegrationsService`
- **Methods**: `getUserIntegrations()` (same name as database service!)

### Benefits

✅ **No method suffixes** - class name indicates scope
✅ **Same method names** across services - consistent API
✅ **Clear separation** - `DatabaseService` vs `Service`
✅ **Import errors prevent misuse** - can't accidentally use database service in component
✅ **Self-documenting** - name tells you everything

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      Components                         │
│                  (Client-Side Only)                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ calls
                     ▼
┌─────────────────────────────────────────────────────────┐
│                 IntegrationsService                     │
│              (API Service - Client Layer)               │
│  - getUserIntegrations()                                │
│  - Calls fetch('/api/integrations')                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   API Routes                            │
│              (Server-Side Handlers)                     │
│  - /api/integrations/                                   │
│  - Validates session                                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ calls
                     ▼
┌─────────────────────────────────────────────────────────┐
│         OAuthIntegrationDatabaseService                 │
│          (Database Service - Data Layer)                │
│  - getUserIntegrations()                                │
│  - Calls getDocument(), setDocument()                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ queries
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    Firestore                            │
│              (Database Layer)                           │
└─────────────────────────────────────────────────────────┘
```

## When to Use Each Type

### Use Database Services When:
- ✅ In API route handlers (server-side)
- ✅ In beforeLoad (server-side rendering)
- ✅ In server functions
- ✅ In other services (service can call service)
- ✅ In cron jobs or background tasks

### Use API Services When:
- ✅ In React components (client-side)
- ✅ In `useEffect` hooks
- ✅ In event handlers (onClick, onSubmit)
- ✅ In custom hooks

## Example Implementation

### Database Service

**File**: `src/services/oauth-integration-database.service.ts`

```typescript
import { getDocument, setDocument } from '@prmichaelsen/firebase-admin-sdk-v8'
import { getUserOAuthIntegration } from '@/constant/collections'
import { OAuthIntegrationSchema, type OAuthIntegration } from '@/schemas/oauth-integration'

export class OAuthIntegrationDatabaseService {
  static async getIntegration(userId: string, provider: string): Promise<OAuthIntegration | null> {
    try {
      const path = getUserOAuthIntegration(userId, provider)
      const doc = await getDocument(path, 'current')
      
      if (!doc) return null
      
      const result = OAuthIntegrationSchema.safeParse(doc)
      if (!result.success) {
        console.error(`Invalid OAuth integration data for ${provider}:`, result.error)
        return null
      }
      
      return result.data
    } catch (error) {
      console.error(`Failed to get OAuth integration for ${provider}:`, error)
      return null
    }
  }

  static async saveIntegration(userId: string, provider: string, data: OAuthIntegrationInput): Promise<void> {
    try {
      const path = getUserOAuthIntegration(userId, provider)
      const now = new Date().toISOString()
      
      const integration: OAuthIntegration = {
        ...data,
        connected_at: now,
        created_at: now,
        updated_at: now,
      }
      
      await setDocument(path, 'current', integration)
      console.log(`[OAuthIntegrationDatabaseService] Saved ${provider} integration for user ${userId}`)
    } catch (error) {
      console.error(`[OAuthIntegrationDatabaseService] Failed to save ${provider} integration:`, error)
      throw error
    }
  }

  static async getUserIntegrations(userId: string, providers: string[]): Promise<Record<string, OAuthIntegration>> {
    const integrations: Record<string, OAuthIntegration> = {}
    
    await Promise.all(
      providers.map(async (provider) => {
        const integration = await this.getIntegration(userId, provider)
        if (integration && integration.connected) {
          integrations[provider] = integration
        }
      })
    )
    
    return integrations
  }
}
```

### API Service

**File**: `src/services/integrations.service.ts`

```typescript
import { OAuthIntegrationDatabaseService } from './oauth-integration-database.service'
import type { OAuthIntegration } from '@/schemas/oauth-integration'

export class IntegrationsService {
  /**
   * Get user's OAuth integrations (client-side)
   * Calls the API endpoint which validates session server-side
   */
  static async getUserIntegrations(): Promise<Record<string, OAuthIntegration>> {
    try {
      const response = await fetch('/api/integrations/')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch integrations: ${response.statusText}`)
      }
      
      const data: any = await response.json()
      return data.integrations || {}
    } catch (error) {
      console.error('[IntegrationsService] Failed to fetch integrations:', error)
      return {}
    }
  }
}
```

## Usage Examples

### In Component (Client-Side)

```typescript
import { IntegrationsService } from '@/services/integrations.service'

function MyComponent() {
  useEffect(() => {
    IntegrationsService.getUserIntegrations()  // Calls API
      .then(integrations => setUserIntegrations(integrations))
  }, [user])
}
```

### In API Route (Server-Side)

```typescript
import { OAuthIntegrationDatabaseService } from '@/services/oauth-integration-database.service'

export const APIRoute = createAPIFileRoute('/api/integrations')({
  GET: async ({ request }) => {
    const session = await getServerSession(request)
    
    const integrations = await OAuthIntegrationDatabaseService.getUserIntegrations(
      session.user.uid,
      ['instagram', 'eventbrite']
    )
    
    return Response.json({ integrations })
  }
})
```

### In beforeLoad (Server-Side)

```typescript
import { OAuthIntegrationDatabaseService } from '@/services/oauth-integration-database.service'

export const Route = createFileRoute('/integrations')({
  beforeLoad: async () => {
    const user = await getAuthSession()
    if (!user) return { initialIntegrations: {} }
    
    const initialIntegrations = await OAuthIntegrationDatabaseService.getUserIntegrations(
      user.uid,
      ['instagram', 'eventbrite']
    )
    
    return { initialIntegrations }
  },
})
```

## Core Principles

### 1. Service Layer Abstraction
- **All data operations** must be encapsulated in service classes
- Services provide a clean API for data access
- Services handle error logging and validation
- Services can be easily mocked for testing

### 2. No Direct Database Calls
```typescript
// ❌ ANTI-PATTERN: Direct Firestore call in component
import { setDocument } from '@prmichaelsen/firebase-admin-sdk-v8'

function MyComponent() {
  const handleSave = async () => {
    await setDocument('users', userId, data) // BAD!
  }
}

// ✅ CORRECT: Use service layer
import { UserDatabaseService } from '@/services/user-database.service'

function MyComponent() {
  const handleSave = async () => {
    await UserDatabaseService.updateUser(userId, data) // GOOD!
  }
}
```

### 3. No Direct API Calls
```typescript
// ❌ ANTI-PATTERN: Direct fetch in component
function MyComponent() {
  useEffect(() => {
    fetch('/api/integrations') // BAD!
      .then(res => res.json())
      .then(data => setData(data))
  }, [])
}

// ✅ CORRECT: Use service layer
import { IntegrationsService } from '@/services/integrations.service'

function MyComponent() {
  useEffect(() => {
    IntegrationsService.getUserIntegrations() // GOOD!
      .then(integrations => setData(integrations))
  }, [])
}
```

## Benefits

### 1. Testability
```typescript
// Easy to mock services in tests
jest.mock('@/services/integrations.service')

test('component loads integrations', async () => {
  IntegrationsService.getUserIntegrations.mockResolvedValue({ instagram: {...} })
  // Test component behavior
})
```

### 2. Consistency
- All Firestore operations follow same pattern
- Consistent error handling and logging
- Consistent Zod validation

### 3. Maintainability
- Change database structure in one place
- Update API endpoints in one place
- Easy to add caching, retry logic, etc.

### 4. Type Safety
- Services provide typed interfaces
- No `any` types leaking into components
- Zod validation at service boundary

## Anti-Patterns to Avoid

### ❌ Direct Firestore in Components
```typescript
// BAD
function MyComponent() {
  const handleSave = async () => {
    await setDocument('users', userId, data)
  }
}
```

### ❌ Direct Firestore in Routes
```typescript
// BAD
export const Route = createFileRoute('/users')({
  beforeLoad: async () => {
    const doc = await getDocument('users', userId)
    return { user: doc }
  },
})
```

### ❌ Direct fetch in Components
```typescript
// BAD
function MyComponent() {
  useEffect(() => {
    fetch('/api/data').then(...)
  }, [])
}
```

### ❌ Mixing Concerns
```typescript
// BAD: Service doing UI logic
static async saveUser(user: User): Promise<void> {
  await setDocument(...)
  toast.success('User saved!') // UI logic in service!
}
```

## Migration Guide

### Step 1: Identify Direct Calls
Search codebase for:
- `setDocument(`
- `getDocument(`
- `queryDocuments(`
- `fetch('/api/`

### Step 2: Create Services
```typescript
// src/services/domain-database.service.ts
export class DomainDatabaseService {
  static async operation(): Promise<Result> {
    // Move database logic here
  }
}

// src/services/domain.service.ts
export class DomainService {
  static async operation(): Promise<Result> {
    // Move API logic here
  }
}
```

### Step 3: Update Callers
```typescript
// Before
await setDocument(path, id, data)

// After (in API route)
await DomainDatabaseService.saveEntity(id, data)

// After (in component)
await DomainService.saveEntity(id, data)
```

### Step 4: Test
- Verify functionality unchanged
- Add unit tests for services
- Mock services in component tests

## Summary

✅ **DO**:
- Use `{Domain}DatabaseService` for database operations
- Use `{Domain}Service` for API wrappers
- Same method names across both service types
- Handle errors and validation in services
- Log operations in services
- Use Zod schemas for validation

❌ **DON'T**:
- Call `setDocument`, `getDocument`, etc. directly
- Call `fetch('/api/...` directly
- Mix UI logic with data logic
- Skip error handling
- Use `any` types
- Add method suffixes - let class name indicate scope

**Every data operation should go through a service layer.**
