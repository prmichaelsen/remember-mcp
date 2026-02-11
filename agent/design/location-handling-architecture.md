# Location Handling Architecture

**Concept**: Location data provided by tenant platform via cookies/headers  
**Created**: 2026-02-11  
**Status**: Design Specification

---

## Overview

Location data (GPS coordinates and address) will be provided by the tenant platform (agentbase.me) and passed to the remember-mcp server with each request. The MCP server does not determine location itself.

---

## Architecture

### Request Flow

```
┌─────────────────────────────────────────────────────────────┐
│  User's Browser/Mobile App                                   │
│  - GPS coordinates from device                               │
│  - Address from geocoding service                            │
│  - Stored in cookies/local storage                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP Request with headers/cookies
                     │
┌────────────────────▼────────────────────────────────────────┐
│  agentbase.me Platform (Tenant Platform)                     │
│  - Reads location from cookies                               │
│  - Validates location data                                   │
│  - Includes in MCP request context                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ MCP Request with location context
                     │
┌────────────────────▼────────────────────────────────────────┐
│  remember-mcp Server                                         │
│  - Receives location in request context                      │
│  - Stores location with memory                               │
│  - Uses location for search/filtering                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Request Context Structure

### Location in Request Context

```typescript
RequestContext {
  // Authentication
  user_id: string;
  auth_token: string;
  
  // Location (provided by platform)
  location: {
    // GPS Coordinates
    gps: {
      latitude: float;      // e.g., 37.7749
      longitude: float;     // e.g., -122.4194
      accuracy: float;      // Accuracy in meters
      altitude?: float;     // Optional altitude
      timestamp: datetime;  // When location was captured
    };
    
    // Address (from geocoding)
    address: {
      formatted: string;    // "123 Main St, San Francisco, CA 94102"
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      postal_code?: string;
      timezone?: string;
    };
    
    // Metadata
    source: string;         // "gps", "ip", "manual", "cached"
    confidence: float;      // 0-1, how confident in location accuracy
    is_approximate: boolean; // True if using IP-based location
  };
  
  // Locale (provided by platform via cookie)
  locale: {
    language: string;       // e.g., "en", "es", "fr", "ja"
    country: string;        // e.g., "US", "GB", "FR", "JP"
    full_locale: string;    // e.g., "en-US", "es-MX", "fr-FR"
    timezone: string;       // e.g., "America/Los_Angeles"
    currency: string;       // e.g., "USD", "EUR", "JPY"
    date_format: string;    // e.g., "MM/DD/YYYY", "DD/MM/YYYY"
    time_format: string;    // e.g., "12h", "24h"
  };
  
  // Other context
  timestamp: datetime;
  device_info: object;
  session_id: string;
}
```

---

## Platform Responsibilities (agentbase.me)

### 1. **Location Capture**

```typescript
// Browser/Mobile App
class LocationService {
  async getCurrentLocation(): Promise<Location> {
    // Get GPS from device
    const position = await navigator.geolocation.getCurrentPosition();
    
    // Geocode to address
    const address = await geocodeCoordinates(
      position.coords.latitude,
      position.coords.longitude
    );
    
    return {
      gps: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date()
      },
      address: address,
      source: "gps",
      confidence: 1.0,
      is_approximate: false
    };
  }
  
  // Fallback to IP-based location
  async getApproximateLocation(): Promise<Location> {
    const ipLocation = await getLocationFromIP();
    return {
      gps: ipLocation.coordinates,
      address: ipLocation.address,
      source: "ip",
      confidence: 0.5,
      is_approximate: true
    };
  }
}
```

### 2. **Location Storage**

```typescript
// Store in cookies for persistence
setCookie('user_location', JSON.stringify(location), {
  maxAge: 3600, // 1 hour
  secure: true,
  sameSite: 'strict'
});

// Or in localStorage
localStorage.setItem('user_location', JSON.stringify(location));
```

### 3. **Location Injection**

```typescript
// When making MCP request
async function callMCPServer(tool: string, args: object) {
  // Read location from cookies/storage
  const location = getStoredLocation();
  
  // Include in request context
  const context = {
    user_id: getCurrentUserId(),
    auth_token: getAuthToken(),
    location: location,
    timestamp: new Date(),
    device_info: getDeviceInfo(),
    session_id: getSessionId()
  };
  
  // Send to MCP server
  return await mcpClient.callTool(tool, args, context);
}
```

---

## MCP Server Responsibilities (remember-mcp)

### 1. **Location Extraction**

```typescript
// In mcp-auth wrapper or server factory
function extractLocation(context: RequestContext): Location | null {
  if (!context.location) {
    return null;
  }
  
  // Validate location data
  if (!isValidLocation(context.location)) {
    logger.warn('Invalid location data received', { context });
    return null;
  }
  
  return context.location;
}
```

### 2. **Memory Creation with Location**

```typescript
// remember_create_memory tool
async function createMemory(args: CreateMemoryArgs, context: RequestContext) {
  const location = extractLocation(context);
  
  const memory = {
    user_id: context.user_id,
    content: args.content,
    
    // Location from context
    location: location || {
      gps: null,
      address: null,
      source: "unavailable"
    },
    
    // Other fields...
    created_at: new Date(),
    context: {
      conversation_id: args.conversation_id,
      timestamp: context.timestamp,
      // Location context
      location_at_creation: location
    }
  };
  
  return await weaviateClient.addDocument(memory);
}
```

### 3. **Location-Based Search**

```typescript
// remember_search_memory with location filter
async function searchMemory(args: SearchMemoryArgs, context: RequestContext) {
  const currentLocation = extractLocation(context);
  
  if (args.filters?.near_current_location && currentLocation) {
    // Search memories near current location
    args.filters.location = {
      near: currentLocation.gps,
      radius_meters: args.filters.radius || 1000
    };
  }
  
  return await weaviateClient.searchDocuments(args);
}
```

---

## Location Privacy & Security

### 1. **User Consent**

```typescript
// Platform must get user consent
interface LocationPermissions {
  enabled: boolean;
  precision: 'exact' | 'approximate' | 'city' | 'none';
  share_with_memories: boolean;
  auto_update: boolean;
}

// User can control location sharing
const permissions = await getUserLocationPermissions(user_id);

if (!permissions.share_with_memories) {
  // Don't include location in MCP requests
  context.location = null;
}
```

### 2. **Location Obfuscation**

```typescript
// For privacy, user can choose to obfuscate location
function obfuscateLocation(location: Location, precision: string): Location {
  switch (precision) {
    case 'exact':
      return location; // Full precision
      
    case 'approximate':
      // Round to ~100m precision
      return {
        ...location,
        gps: {
          latitude: Math.round(location.gps.latitude * 1000) / 1000,
          longitude: Math.round(location.gps.longitude * 1000) / 1000,
          accuracy: 100
        }
      };
      
    case 'city':
      // Only city-level
      return {
        gps: null,
        address: {
          city: location.address.city,
          state: location.address.state,
          country: location.address.country
        },
        is_approximate: true
      };
      
    case 'none':
      return null;
  }
}
```

### 3. **Location Validation**

```typescript
// MCP server validates location data
function isValidLocation(location: Location): boolean {
  // Check GPS coordinates are valid
  if (location.gps) {
    if (location.gps.latitude < -90 || location.gps.latitude > 90) {
      return false;
    }
    if (location.gps.longitude < -180 || location.gps.longitude > 180) {
      return false;
    }
  }
  
  // Check timestamp is recent (within 1 hour)
  if (location.gps?.timestamp) {
    const age = Date.now() - new Date(location.gps.timestamp).getTime();
    if (age > 3600000) { // 1 hour
      logger.warn('Location data is stale', { age });
      return false;
    }
  }
  
  return true;
}
```

---

## Location Update Strategies

### 1. **Real-Time Updates**

```typescript
// Platform continuously updates location
setInterval(async () => {
  const location = await locationService.getCurrentLocation();
  updateStoredLocation(location);
}, 60000); // Every minute
```

### 2. **On-Demand Updates**

```typescript
// Update location only when creating memory
async function createMemoryWithFreshLocation(args: CreateMemoryArgs) {
  // Get fresh location
  const location = await locationService.getCurrentLocation();
  
  // Update stored location
  updateStoredLocation(location);
  
  // Create memory with fresh location
  return await mcpClient.callTool('remember_create_memory', args, {
    ...context,
    location
  });
}
```

### 3. **Cached with Expiry**

```typescript
// Use cached location if recent enough
function getLocationForRequest(): Location | null {
  const cached = getStoredLocation();
  
  if (!cached) return null;
  
  const age = Date.now() - new Date(cached.gps.timestamp).getTime();
  
  // Use cached if < 5 minutes old
  if (age < 300000) {
    return cached;
  }
  
  // Otherwise fetch fresh
  return await locationService.getCurrentLocation();
}
```

---

## Benefits of Platform-Provided Location

### 1. **Separation of Concerns**
- MCP server focuses on memory management
- Platform handles location capture and privacy
- Clear responsibility boundaries

### 2. **Consistency**
- Same location data across all platform features
- Single source of truth for user location
- Consistent privacy controls

### 3. **Flexibility**
- Platform can use different location sources (GPS, WiFi, IP)
- Can implement platform-specific privacy rules
- Can cache and optimize location requests

### 4. **Security**
- Location permissions managed by platform
- No direct device access from MCP server
- Platform validates and sanitizes location data

---

## Implementation Checklist

### Platform (agentbase.me)
- [ ] Implement location capture service
- [ ] Store location in cookies/localStorage
- [ ] Add location to MCP request context
- [ ] Implement location privacy controls
- [ ] Add location obfuscation options
- [ ] Handle location permission denials

### MCP Server (remember-mcp)
- [ ] Extract location from request context
- [ ] Validate location data
- [ ] Store location with memories
- [ ] Implement location-based search
- [ ] Add location to context schema
- [ ] Handle missing location gracefully

### Testing
- [ ] Test with GPS location
- [ ] Test with IP-based location
- [ ] Test with no location
- [ ] Test location privacy levels
- [ ] Test stale location handling
- [ ] Test invalid location data

---

## Example: Complete Flow

```typescript
// 1. User creates memory in browser
async function createMemoryInBrowser(content: string) {
  // Platform gets current location
  const location = await locationService.getCurrentLocation();
  // Result: { gps: { lat: 37.7749, lng: -122.4194 }, address: "San Francisco, CA" }
  
  // Platform stores in cookie
  setCookie('user_location', JSON.stringify(location));
  
  // Platform calls MCP server
  const result = await mcpClient.callTool('remember_create_memory', {
    content: content,
    type: "note"
  }, {
    user_id: "user_123",
    auth_token: "firebase_jwt_token",
    location: location,  // <-- Location included here
    timestamp: new Date()
  });
  
  return result;
}

// 2. MCP server receives and processes
async function handleCreateMemory(args: any, context: RequestContext) {
  // Extract location from context
  const location = context.location;
  // Result: { gps: { lat: 37.7749, lng: -122.4194 }, address: "San Francisco, CA" }
  
  // Create memory with location
  const memory = {
    user_id: context.user_id,
    content: args.content,
    location: location,  // <-- Stored with memory
    created_at: new Date()
  };
  
  await weaviateClient.addDocument(memory);
}

// 3. Later: Search memories near current location
async function searchNearby() {
  const currentLocation = getStoredLocation();
  
  const results = await mcpClient.callTool('remember_search_memory', {
    query: "restaurants",
    filters: {
      near_location: currentLocation.gps,
      radius_meters: 5000  // 5km radius
    }
  });
  
  // Returns memories created near current location
}
```

---

**Status**: Design Specification  
**Implementation**: Platform provides location, MCP server consumes it  
**Privacy**: User controls location precision and sharing
