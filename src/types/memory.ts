/**
 * Memory type definitions for remember-mcp
 */

/**
 * Content types for memories
 * Based on agent/design/content-types-expansion.md
 */
export type ContentType =
  // Core types
  | 'code'
  | 'note'
  | 'documentation'
  | 'reference'
  // Task & Planning
  | 'todo'
  | 'checklist'
  | 'project'
  | 'goal'
  | 'habit'
  // Communication
  | 'email'
  | 'conversation'
  | 'meeting'
  | 'person'
  // Content & Media
  | 'article'
  | 'webpage'
  | 'social'
  | 'image'
  | 'video'
  | 'audio'
  | 'song'
  | 'transcript'
  | 'presentation'
  | 'spreadsheet'
  | 'pdf'
  // Creative
  | 'screenplay'
  | 'recipe'
  | 'idea'
  | 'quote'
  | 'poetry'
  // Personal
  | 'journal'
  | 'memory'
  | 'event'
  // Organizational
  | 'bookmark'
  | 'form'
  | 'location'
  // Business
  | 'invoice'
  | 'contract'
  // System
  | 'system'
  | 'action'
  | 'audit'
  | 'history';

/**
 * GPS coordinates
 */
export interface GPSCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number; // Accuracy in meters
  altitude?: number;
  timestamp: string; // ISO 8601 datetime
}

/**
 * Address information
 */
export interface Address {
  formatted: string; // Full formatted address
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  timezone?: string;
}

/**
 * Location information (from platform cookies)
 */
export interface Location {
  gps: GPSCoordinates | null;
  address: Address | null;
  source: 'gps' | 'ip' | 'manual' | 'cached' | 'unavailable';
  confidence: number; // 0-1
  is_approximate: boolean;
}

/**
 * Conversation participant
 */
export interface Participant {
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  name?: string;
}

/**
 * Source information
 */
export interface Source {
  type: 'conversation' | 'import' | 'inference' | 'manual' | 'api';
  platform?: string; // web, mobile, api
  client?: string;
  version?: string;
}

/**
 * Environment information
 */
export interface Environment {
  location?: Location;
  device?: string;
  user_agent?: string;
}

/**
 * Context information about how/when memory was created
 */
export interface MemoryContext {
  conversation_id?: string;
  conversation_title?: string;
  turn_number?: number;
  summary?: string; // Brief summary for quick retrieval
  participants?: Participant[];
  timestamp: string; // ISO 8601 datetime
  timezone?: string;
  source: Source;
  environment?: Environment;
  tags?: string[];
  notes?: string;
}

/**
 * Core Memory interface
 * Based on agent/design/requirements-enhancements.md
 */
export interface Memory {
  // Core Identity
  id: string; // UUID from Weaviate
  user_id: string;
  doc_type: 'memory'; // Discriminator for unified collection

  // Content
  content: string; // Main memory content (vectorized)
  title?: string;
  summary?: string;
  type: ContentType;

  // Significance & Trust
  weight: number; // 0-1, significance/priority
  trust: number; // 0-1, access control level
  confidence?: number; // 0-1, system confidence in accuracy

  // Location (from platform)
  location: Location;

  // Context
  context: MemoryContext;

  // Relationships
  relationships: string[]; // IDs of relationship documents

  // Access Tracking (for weight calculation)
  access_count: number;
  last_accessed_at?: string; // ISO 8601 datetime
  access_frequency?: number; // Accesses per day

  // Metadata
  created_at: string; // ISO 8601 datetime
  updated_at: string; // ISO 8601 datetime
  version: number;

  // Organization
  tags: string[];
  category?: string;
  references?: string[]; // Source URLs

  // Template Integration (optional)
  template_id?: string;
  template_version?: string;
  structured_content?: Record<string, any>;

  // Computed Weight (for search ranking)
  base_weight: number; // User-specified
  computed_weight?: number; // Calculated with access multipliers

  // Comment/Threading Fields (for threaded discussions in shared spaces)
  parent_id?: string | null; // ID of parent memory or comment (null for top-level)
  thread_root_id?: string | null; // Root memory ID for fetching entire thread (null for top-level)
  moderation_flags?: string[]; // Per-space moderation flags (format: "{space_id}:{flag_type}")

  // Soft Delete Fields
  deleted_at?: Date | null; // Timestamp when memory was soft-deleted (null = not deleted)
  deleted_by?: string; // User ID who deleted the memory
  deletion_reason?: string; // Optional reason for deletion
}

/**
 * Relationship interface
 * Stored in same collection as memories with doc_type: "relationship"
 */
export interface Relationship {
  // Core Identity
  id: string;
  user_id: string;
  doc_type: 'relationship'; // Discriminator

  // Connection
  memory_ids: string[]; // 2...N memory IDs
  relationship_type: string; // Free-form: "causes", "contradicts", "inspired_by", etc.

  // Observation
  observation: string; // Description of the connection (vectorized)
  strength: number; // 0-1
  confidence: number; // 0-1

  // Context
  context: MemoryContext;

  // Metadata
  created_at: string;
  updated_at: string;
  version: number;
  tags: string[];
}

/**
 * Union type for documents in Memory collection
 */
export type MemoryDocument = Memory | Relationship;

/**
 * Partial memory for updates
 */
export type MemoryUpdate = Partial<Omit<Memory, 'id' | 'user_id' | 'doc_type' | 'created_at' | 'version'>>;

/**
 * Partial relationship for updates
 */
export type RelationshipUpdate = Partial<Omit<Relationship, 'id' | 'user_id' | 'doc_type' | 'created_at' | 'version'>>;

/**
 * Search filters
 */
export interface SearchFilters {
  types?: ContentType[];
  tags?: string[];
  weight_min?: number;
  weight_max?: number;
  trust_min?: number;
  trust_max?: number;
  date_from?: string;
  date_to?: string;
  location_near?: GPSCoordinates;
  location_radius_meters?: number;
  has_relationships?: boolean;
}

/**
 * Deleted filter type
 */
export type DeletedFilter = 'exclude' | 'include' | 'only';

/**
 * Search options
 */
export interface SearchOptions {
  query: string;
  alpha?: number; // 0-1, balance between semantic (1.0) and keyword (0.0)
  filters?: SearchFilters;
  include_relationships?: boolean;
  deleted_filter?: DeletedFilter;
  limit?: number;
  offset?: number;
}

/**
 * Search result
 */
export interface SearchResult {
  memories: Memory[];
  relationships?: Relationship[];
  total: number;
  offset: number;
  limit: number;
}
