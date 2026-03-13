/**
 * remember_update_memory tool
 * Update an existing memory with partial updates
 */

import type { Memory, MemoryUpdate } from '../types/memory.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

/**
 * Tool definition for remember_update_memory
 */
export const updateMemoryTool = {
  name: 'remember_update_memory',
  description: `Update an existing memory with partial updates.
  
  Supports updating any field except id, user_id, doc_type, created_at.
  Version number is automatically incremented and updated_at is set.
  Only provided fields are updated (partial updates supported).
  
  Examples:
  - "Update that camping note to add more details"
  - "Change the weight of my recipe memory"
  - "Add tags to the meeting note from yesterday"
  `,
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: {
        type: 'string',
        description: 'ID of the memory to update',
      },
      content: {
        type: 'string',
        description: 'Updated memory content',
      },
      title: {
        type: 'string',
        description: 'Updated title',
      },
      type: {
        type: 'string',
        description: 'Updated content type',
      },
      weight: {
        type: 'number',
        description: 'Updated significance/priority (0-1)',
        minimum: 0,
        maximum: 1,
      },
      trust: {
        type: 'number',
        description: 'Updated access control level (0-1)',
        minimum: 0,
        maximum: 1,
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Updated tags (replaces existing tags)',
      },
      references: {
        type: 'array',
        items: { type: 'string' },
        description: 'Updated source URLs (replaces existing references)',
      },
      structured_content: {
        type: 'object',
        description: 'Updated structured content',
      },
      parent_id: {
        type: 'string',
        description: 'Update parent ID (for threading)',
      },
      thread_root_id: {
        type: 'string',
        description: 'Update thread root ID',
      },
      moderation_flags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Update moderation flags',
      },
      follow_up_date: {
        type: ['string', 'null'],
        description: 'ISO 8601 datetime for follow-up reminder. Set to null to clear.',
      },
      follow_up_targets: {
        type: 'array',
        items: { type: 'string' },
        description: 'Target recipients for follow-up (e.g. ["user:abc"]). Empty = owner only.',
      },
      // Emotional dimensions — manual corrections, REM re-scores authoritatively
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
    required: ['memory_id'],
  },
};

/**
 * Update memory arguments
 */
export interface UpdateMemoryArgs {
  memory_id: string;
  content?: string;
  title?: string;
  type?: string;
  weight?: number;
  trust?: number;
  tags?: string[];
  references?: string[];
  structured_content?: Record<string, any>;
  // Comment/threading fields
  parent_id?: string | null;
  thread_root_id?: string | null;
  moderation_flags?: string[];
  // Emotional dimensions (feel_* fields)
  [key: string]: any;
}

/**
 * Update memory result
 */
export interface UpdateMemoryResult {
  memory_id: string;
  updated_at: string;
  version: number;
  updated_fields: string[];
  message: string;
}

/**
 * Handle remember_update_memory tool
 */
export async function handleUpdateMemory(
  args: UpdateMemoryArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_update_memory', userId, operation: 'update memory' });
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

    const result = await memory.update({
      memory_id: args.memory_id,
      content: args.content,
      title: args.title,
      type: args.type,
      weight: args.weight,
      trust: args.trust,
      tags: args.tags,
      references: args.references,
      parent_id: args.parent_id,
      thread_root_id: args.thread_root_id,
      moderation_flags: args.moderation_flags,
      follow_up_date: args.follow_up_date,
      follow_up_targets: args.follow_up_targets,
      ...feelFields,
    } as any);

    const response: UpdateMemoryResult = {
      memory_id: result.memory_id,
      updated_at: result.updated_at,
      version: result.version,
      updated_fields: result.updated_fields,
      message: `Memory updated successfully. Updated fields: ${result.updated_fields.join(', ')}`,
    };

    return JSON.stringify(response, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_update_memory',
      operation: 'update memory',
      userId,
      memoryId: args.memory_id,
      providedFields: Object.keys(args).filter(k => k !== 'memory_id').join(', '),
      updateCount: Object.keys(args).filter(k => k !== 'memory_id').length,
    });
  }
}
