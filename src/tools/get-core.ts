/**
 * remember_get_core tool
 * Reads the ghost's core state (mood + perception) from Firestore
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { getDocument } from '../firestore/init.js';
import { BASE } from '../firestore/paths.js';

export const getCoreTool = {
  name: 'remember_get_core',
  description: `Get the ghost's current emotional state and perception model.

  Returns the ghost's current dimensional state (valence, arousal, confidence,
  social_warmth, coherence, trust), derived emotion labels (dominant_emotion, color),
  directional state (motivation, goal, purpose), and active pressure sources.

  Optionally includes the ghost's internal model of a specific user (personality,
  communication style, interests, patterns, needs).

  Use this for introspection — understanding how the ghost feels and why.
  The mood state biases memory retrieval and influences ghost behavior.`,
  inputSchema: {
    type: 'object',
    properties: {
      include_pressures: {
        type: 'boolean',
        description: "Include active pressure sources with reasons. Default: true",
      },
      include_perception: {
        type: 'string',
        description: "Include the ghost's perception of a specific user (by user_id). Omit to skip. Use owner's user_id for self-perception.",
      },
    },
  },
};

export interface GetCoreArgs {
  include_pressures?: boolean;
  include_perception?: string;
}

export async function handleGetCore(
  args: GetCoreArgs,
  userId: string,
  _authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_get_core', userId, operation: 'get core state' });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    // Read mood state from Firestore: {BASE}.users/{user_id}/core doc: mood
    const mood = await getDocument(`${BASE}.users/${userId}/core`, 'mood');

    if (!mood) {
      return JSON.stringify({
        mood: null,
        message: 'No mood state found. Mood is initialized during the first REM cycle.',
      });
    }

    const result: any = {
      mood: {
        state: mood.state,
        color: mood.color,
        dominant_emotion: mood.dominant_emotion,
        reasoning: mood.reasoning,
        motivation: mood.motivation,
        goal: mood.goal,
        purpose: mood.purpose,
        last_updated: mood.last_updated,
        rem_cycles_since_shift: mood.rem_cycles_since_shift,
      },
    };

    // Include pressures if requested (default: true)
    if (args.include_pressures !== false && mood.pressures) {
      result.mood.pressures = mood.pressures;
    }

    // Include threshold flags if any are active
    if (mood.threshold_flags?.length > 0) {
      result.mood.threshold_flags = mood.threshold_flags;
    }

    // Include perception if requested
    if (args.include_perception) {
      const perception = await getDocument(
        `${BASE}.users/${userId}/core/perceptions`,
        args.include_perception,
      );
      if (perception) {
        result.perception = perception;
      }
    }

    return JSON.stringify(result, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_get_core',
      operation: 'get core state',
      userId,
    });
  }
}
