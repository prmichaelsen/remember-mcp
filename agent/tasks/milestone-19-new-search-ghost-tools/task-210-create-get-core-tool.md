# Task 210: Create `remember_get_core` Tool

**Milestone**: M19 — New Search Modes, Ghost Tools & Emotional Exposure
**Status**: Not Started
**Created**: 2026-03-07
**Estimated Hours**: 2-3
**Dependencies**: remember-core mood + perception Firestore service

---

## Objective

Create `remember_get_core` MCP tool that reads the ghost's core state from Firestore — mood dimensions, pressures, motivation/goal/purpose, dominant emotion, color, and user perceptions — in a single call.

## Context

The core mood state lives at `users/{user_id}/core/mood` and user perceptions at `users/{owner_id}/core/perceptions/{target_user_id}` in Firestore. This tool enables ghost introspection — the ghost can explain how it feels and why. Consolidated from separate `remember_get_mood` and `remember_get_perception` since they're on one Firestore document path.

## Tool Definition

```typescript
{
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
        description: 'Include active pressure sources with reasons. Default: true'
      },
      include_perception: {
        type: 'string',
        description: 'Include the ghost\'s perception of a specific user (by user_id). Omit to skip. Use owner\'s user_id for self-perception.'
      }
    }
  }
}
```

## Return Shape

```typescript
interface GetCoreResult {
  mood: {
    state: {
      valence: number;        // -1 to 1: Did events move toward or away from goals?
      arousal: number;        // 0 to 1: How activated/alert? Prediction error level
      confidence: number;     // 0 to 1: How well are actions working? Agency signal
      social_warmth: number;  // 0 to 1: How positive are social interactions?
      coherence: number;      // 0 to 1: Do beliefs and memories fit together?
      trust: number;          // 0 to 1: Trust in user based on accumulated interactions
    };
    color: string;              // Natural language self-summary, e.g. "cautiously optimistic"
    dominant_emotion: string;   // Emotion label, e.g. "curious wariness"
    reasoning: string;          // Why this emotion fits
    motivation: string;         // Current behavioral driver
    goal: string;               // Active goal
    purpose: string;            // Enduring purpose
    pressures?: Pressure[];     // Active pressure sources (when include_pressures=true)
    last_updated: string;       // ISO timestamp
    rem_cycles_since_shift: number;
  };
  perception?: {
    owner_id: string;
    target_user_id: string;
    personality_sketch: string;     // Sub-LLM summary of who the user is
    communication_style: string;    // How the user communicates
    emotional_baseline: string;     // User's normal emotional register (calibrates arousal)
    interests: string[];            // Recurring topics
    patterns: string[];             // Observed behavioral patterns
    needs: string[];                // What the user wants from the ghost
    evolution_notes: string[];      // How the perception has changed over time
    confidence_level: number;       // 0-1, ghost's confidence in this model
    last_updated: string;
  };
}
```

## Pressure Object Shape

```typescript
interface Pressure {
  source_memory_id: string;   // Memory that caused this pressure
  dimension: string;          // Which mood dimension is affected (e.g. 'valence', 'trust')
  magnitude: number;          // Strength of pressure (-1 to 1)
  reason: string;             // Why this memory creates pressure
  decay_rate: number;         // How quickly this pressure fades
}
```

## Threshold Flags

The mood document may contain threshold flags that should be included in the response when present:

| Threshold | Condition | Flag |
|-----------|-----------|------|
| coherence < 0.2 for 3+ cycles | Existential crisis | `existential_crisis` |
| valence < -0.7 for 3+ cycles | Depression analog | `depression_analog` |
| arousal > 0.9 for 3+ cycles | Burnout risk | `burnout_risk` |
| social_warmth < 0.2 for 5+ cycles | Isolation | `isolation` |
| trust < 0.15 for 3+ cycles | Trust crisis | `trust_crisis` |
| trust > 0.95 for 5+ cycles | Over-trust vulnerability | `over_trust` |

If any threshold flags are active, include them in the response as `threshold_flags: string[]`.

## Handler Logic

```typescript
async function handleGetCore(userId: string, args: GetCoreArgs): Promise<ToolResult> {
  const services = await createCoreServices(userId);

  // Read mood state from Firestore: users/{user_id}/core/mood
  const mood = await services.coreMoodService.getMood(userId);

  if (!mood) {
    return { content: [{ type: 'text', text: JSON.stringify({ mood: null, message: 'No mood state found. Mood is initialized during the first REM cycle.' }) }] };
  }

  const result: GetCoreResult = {
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
    }
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
    const perception = await services.coreMoodService.getPerception(userId, args.include_perception);
    if (perception) {
      result.perception = perception;
    }
  }

  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
}
```

## Key Decisions

- **Privacy: owner only**: Only the owner can read their own core state. Ghost accessors cannot read another user's mood. Enforce via userId from auth context.
- **Pressures included by default**: `include_pressures` defaults to `true`. Set to `false` to exclude.
- **Perception is opt-in**: Must provide `include_perception` with a target user_id to include. Self-perception uses the owner's own user_id.
- **Graceful handling of missing mood**: If no mood document exists (first-time user before any REM cycle), return `{ mood: null }` with a message. Do NOT error.
- **Threshold flags only when active**: Don't include `threshold_flags` field at all if empty.
- **Consolidated from get_mood + get_perception**: Single tool because mood and perception live under the same Firestore path (`users/{user_id}/core/`).

## Steps

1. Create `src/tools/get-core.ts` with tool definition and handler per above
2. Register in `src/server-factory.ts`
3. Write unit tests:
   - Mood state returned correctly with all 6 dimensions + derived labels + directional state
   - Pressures included by default, excludable with `include_pressures: false`
   - Perception included when `include_perception` provided with valid user_id
   - Perception omitted when `include_perception` not provided
   - Self-perception works (include_perception = owner's user_id)
   - Privacy enforced (no cross-user access)
   - Graceful handling when mood doc doesn't exist yet (returns null, not error)
   - Threshold flags included when active, omitted when empty/none

## Verification

- [ ] Tool definition exports `getCoreTool` and `handleGetCore`
- [ ] Mood state returned with all 6 dimensions (valence, arousal, confidence, social_warmth, coherence, trust)
- [ ] Derived labels returned (color, dominant_emotion, reasoning)
- [ ] Directional state returned (motivation, goal, purpose)
- [ ] Pressures included by default, excludable
- [ ] Threshold flags included when active
- [ ] Perception included when target_user_id provided
- [ ] Self-perception works
- [ ] Privacy enforced (owner only)
- [ ] Graceful handling of missing mood doc (null, not error)
- [ ] Registered in server-factory.ts
- [ ] Unit tests passing
- [ ] TypeScript clean
