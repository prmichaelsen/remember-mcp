/**
 * remember_create_memory tool
 * Creates a new memory in the user's collection
 */

import type { Memory, ContentType, Location, MemoryContext } from '../types/memory.js';
import { handleToolError } from '../utils/error-handler.js';
import { DEFAULT_CONTENT_TYPE, getContentTypeDescription } from '@prmichaelsen/remember-core';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

/**
 * Tool definition for remember_create_memory
 */
export const createMemoryTool = {
  name: 'remember_create_memory',
  description: `Create a new memory with optional template.
  
  Memories can store any type of information: notes, events, people, recipes, etc.
  Each memory has a weight (significance 0-1) and trust level (access control 0-1).
  Location and context are automatically captured from the request.
  
  **IMPORTANT - Content vs Summary**:
  - **content**: MUST be EXACT user-provided text. DO NOT paraphrase or modify.
  - **summary**: Use for AI-generated summaries or interpretations.
  - Example: User says "Remember: Meeting at 3pm tomorrow"
    → content: "Meeting at 3pm tomorrow" (EXACT)
    → summary: "User has meeting on 2026-02-17 at 15:00" (AI interpretation)
  
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
        description: 'Access control level (0-1, default: 0.25)',
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
      parent_id: {
        type: 'string',
        description: 'ID of parent memory or comment (for threading). Leave null for top-level memories.',
      },
      thread_root_id: {
        type: 'string',
        description: 'Root memory ID for thread. Leave null for top-level memories.',
      },
      moderation_flags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Per-space moderation flags (format: "{space_id}:{flag_type}"). Usually empty.',
        default: [],
      },
      // Emotional dimensions — create-time hints, REM re-scores authoritatively
      // Layer 1: Discrete Emotions
      feel_emotional_significance: { type: 'number', minimum: 0, maximum: 1, description: 'Overall emotional weight (0-1). REM re-scores.' },
      feel_vulnerability: { type: 'number', minimum: 0, maximum: 1, description: 'Personal exposure/openness (0-1). REM re-scores.' },
      feel_trauma: { type: 'number', minimum: 0, maximum: 1, description: 'Negative formative experience intensity (0-1). REM re-scores.' },
      feel_humor: { type: 'number', minimum: 0, maximum: 1, description: 'Comedic/playful quality (0-1). REM re-scores.' },
      feel_happiness: { type: 'number', minimum: 0, maximum: 1, description: 'Positive affect / joy (0-1). REM re-scores.' },
      feel_sadness: { type: 'number', minimum: 0, maximum: 1, description: 'Negative affect / grief / loss (0-1). REM re-scores.' },
      feel_fear: { type: 'number', minimum: 0, maximum: 1, description: 'Threat perception / anxiety (0-1). REM re-scores.' },
      feel_anger: { type: 'number', minimum: 0, maximum: 1, description: 'Frustration / injustice (0-1). REM re-scores.' },
      feel_surprise: { type: 'number', minimum: 0, maximum: 1, description: 'Unexpectedness / novelty (0-1). REM re-scores.' },
      feel_disgust: { type: 'number', minimum: 0, maximum: 1, description: 'Aversion / rejection (0-1). REM re-scores.' },
      feel_contempt: { type: 'number', minimum: 0, maximum: 1, description: 'Superiority / dismissal (0-1). REM re-scores.' },
      feel_embarrassment: { type: 'number', minimum: 0, maximum: 1, description: 'Social discomfort (0-1). REM re-scores.' },
      feel_shame: { type: 'number', minimum: 0, maximum: 1, description: 'Deep self-judgment (0-1). REM re-scores.' },
      feel_guilt: { type: 'number', minimum: 0, maximum: 1, description: 'Responsibility for harm (0-1). REM re-scores.' },
      feel_excitement: { type: 'number', minimum: 0, maximum: 1, description: 'Anticipatory positive arousal (0-1). REM re-scores.' },
      feel_pride: { type: 'number', minimum: 0, maximum: 1, description: 'Accomplishment / self-evaluation (0-1). REM re-scores.' },
      feel_valence: { type: 'number', minimum: -1, maximum: 1, description: 'Positive-negative spectrum (-1 to 1). REM re-scores.' },
      feel_arousal: { type: 'number', minimum: 0, maximum: 1, description: 'Calm to excited (0-1). REM re-scores.' },
      feel_dominance: { type: 'number', minimum: 0, maximum: 1, description: 'Control vs submission (0-1). REM re-scores.' },
      feel_intensity: { type: 'number', minimum: 0, maximum: 1, description: 'Overall emotional magnitude (0-1). REM re-scores.' },
      feel_coherence_tension: { type: 'number', minimum: 0, maximum: 1, description: 'Conflict with existing beliefs (0-1). REM re-scores.' },
      // Layer 2: Functional Signals
      feel_salience: { type: 'number', minimum: 0, maximum: 1, description: 'How unexpected/novel — prediction error (0-1). REM re-scores.' },
      feel_urgency: { type: 'number', minimum: 0, maximum: 1, description: 'Time-sensitivity of relevance (0-1). REM re-scores.' },
      feel_social_weight: { type: 'number', minimum: 0, maximum: 1, description: 'Relationship/reputation impact (0-1). REM re-scores.' },
      feel_agency: { type: 'number', minimum: 0, maximum: 1, description: 'Caused by the bot\'s own actions? (0-1). REM re-scores.' },
      feel_novelty: { type: 'number', minimum: 0, maximum: 1, description: 'Uniqueness relative to collection (0-1). REM re-scores.' },
      feel_retrieval_utility: { type: 'number', minimum: 0, maximum: 1, description: 'Likelihood of future usefulness (0-1). REM re-scores.' },
      feel_narrative_importance: { type: 'number', minimum: 0, maximum: 1, description: 'Advances/anchors a personal story arc (0-1). REM re-scores.' },
      feel_aesthetic_quality: { type: 'number', minimum: 0, maximum: 1, description: 'Beauty, craft, artistry (0-1). REM re-scores.' },
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
  // Comment/threading fields
  parent_id?: string | null;
  thread_root_id?: string | null;
  moderation_flags?: string[];
  // Emotional dimensions (feel_* fields)
  [key: string]: any;
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
  authContext?: AuthContext,
  context?: Partial<MemoryContext>
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_create_memory', userId, operation: 'create memory' });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    const { memory } = createCoreServices(userId);

    // Extract feel_* fields from args
    const feelFields: Record<string, number> = {};
    for (const [key, value] of Object.entries(args)) {
      if (key.startsWith('feel_') && typeof value === 'number') {
        feelFields[key] = value;
      }
    }

    const result = await memory.create({
      content: args.content,
      title: args.title,
      type: args.type,
      weight: args.weight,
      trust: args.trust,
      tags: args.tags,
      references: args.references,
      template_id: args.template_id,
      parent_id: args.parent_id,
      thread_root_id: args.thread_root_id,
      moderation_flags: args.moderation_flags,
      context_summary: context?.summary || 'Memory created via MCP',
      context_conversation_id: context?.conversation_id,
      ...feelFields,
    } as any);

    const response: CreateMemoryResult = {
      memory_id: result.memory_id,
      created_at: result.created_at,
      message: `Memory created successfully with ID: ${result.memory_id}`,
    };

    return JSON.stringify(response, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_create_memory',
      operation: 'create memory',
      userId,
      contentType: args.type,
      hasContent: !!args.content,
    });
  }
}
