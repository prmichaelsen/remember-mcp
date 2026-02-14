/**
 * remember_create_memory tool
 * Creates a new memory in the user's collection
 */

import type { Memory, ContentType, Location, MemoryContext } from '../types/memory.js';
import { ensureMemoryCollection, getMemoryCollection } from '../weaviate/schema.js';
import { logger } from '../utils/logger.js';
import { handleToolError } from '../utils/error-handler.js';
import { DEFAULT_CONTENT_TYPE, getContentTypeDescription, isValidContentType } from '../constants/content-types.js';

/**
 * Tool definition for remember_create_memory
 */
export const createMemoryTool = {
  name: 'remember_create_memory',
  description: `Create a new memory with optional template.
  
  Memories can store any type of information: notes, events, people, recipes, etc.
  Each memory has a weight (significance 0-1) and trust level (access control 0-1).
  Location and context are automatically captured from the request.
  
  Examples:
  - "Remember that I met Sarah at the conference"
  - "Save this recipe for chocolate chip cookies"
  - "Note that my tent is stored in garage bin A4"
  `,
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Memory content (main text)',
      },
      title: {
        type: 'string',
        description: 'Optional short title',
      },
      type: {
        type: 'string',
        description: getContentTypeDescription(),
        
        default: DEFAULT_CONTENT_TYPE,
      },
      weight: {
        type: 'number',
        description: 'Significance/priority (0-1, default: 0.5)',
        minimum: 0,
        maximum: 1,
      },
      trust: {
        type: 'number',
        description: 'Access control level (0-1, default: 0.5)',
        minimum: 0,
        maximum: 1,
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for organization',
      },
      references: {
        type: 'array',
        items: { type: 'string' },
        description: 'Source URLs',
      },
      template_id: {
        type: 'string',
        description: 'Template ID to use (optional)',
      },
      skip_template_suggestion: {
        type: 'boolean',
        description: 'Skip automatic template suggestion',
        default: false,
      },
    },
    required: ['content'],
  },
};

/**
 * Create memory arguments
 */
export interface CreateMemoryArgs {
  content: string;
  title?: string;
  type?: ContentType;
  weight?: number;
  trust?: number;
  tags?: string[];
  references?: string[];
  template_id?: string;
  skip_template_suggestion?: boolean;
  structured_content?: Record<string, any>;
}

/**
 * Create memory result
 */
export interface CreateMemoryResult {
  memory_id: string;
  created_at: string;
  message: string;
}

/**
 * Handle remember_create_memory tool
 */
export async function handleCreateMemory(
  args: CreateMemoryArgs,
  userId: string,
  context?: Partial<MemoryContext>
): Promise<string> {
  try {
    logger.info('Creating memory', { userId, type: args.type });

    // Ensure collection exists
    await ensureMemoryCollection(userId);
    const collection = getMemoryCollection(userId);

    // Build memory object
    const now = new Date().toISOString();
    const memory: Omit<Memory, 'id'> = {
      // Core identity
      user_id: userId,
      doc_type: 'memory',

      // Content
      content: args.content,
      title: args.title,
      summary: args.title, // Use title as summary for now
      type: (args.type && isValidContentType(args.type) ? args.type : DEFAULT_CONTENT_TYPE) as ContentType,

      // Scoring
      weight: args.weight ?? 0.5,
      trust: args.trust ?? 0.5,
      confidence: 1.0,

      // Location (from context or default)
      location: {
        gps: null,
        address: null,
        source: 'unavailable',
        confidence: 0,
        is_approximate: true,
      },

      // Context
      context: {
        timestamp: now,
        source: {
          type: 'api',
          platform: 'mcp',
        },
        summary: context?.summary || 'Memory created via MCP',
        conversation_id: context?.conversation_id,
        ...context,
      },

      // Relationships
      relationships: [],

      // Access tracking
      access_count: 0,
      last_accessed_at: now,
      access_frequency: 0,

      // Metadata
      created_at: now,
      updated_at: now,
      version: 1,
      tags: args.tags || [],
      references: args.references || [],

      // Template
      template_id: args.template_id,
      structured_content: args.structured_content,

      // Computed weight
      base_weight: args.weight ?? 0.5,
      computed_weight: args.weight ?? 0.5,
    };

    // Insert into Weaviate v3 API
    // v3 expects: { properties: {...} }
    const result = await collection.data.insert({
      properties: memory as any,
    });

    logger.info('Memory created successfully', { memoryId: result, userId });

    const response: CreateMemoryResult = {
      memory_id: result,
      created_at: now,
      message: `Memory created successfully with ID: ${result}`,
    };

    return JSON.stringify(response, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'remember_create_memory',
      operation: 'create memory',
      userId,
      contentType: args.type,
      hasContent: !!args.content,
    });
  }
}
