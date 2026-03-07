# Core Mood Memory

**Concept**: A persistent emotional state register that captures the ghost's current feelings, biases retrieval, and evolves through REM consolidation cycles
**Created**: 2026-03-07
**Status**: Proposal

---

## Overview

The core mood memory is not an emotion log -- it is the ghost's sense of self in the present moment. Rather than tagging individual memories with emotions, this design introduces a single living document that represents the ghost's current emotional state, why it feels that way, and how that state influences all downstream behavior (retrieval, response tone, decision-making).

This pairs with the REM cycle (remember-rem) to create a system where the ghost's mood drifts naturally based on accumulated experience, is consolidated during offline processing, and feeds back into how it thinks.

---

## Problem Statement

- Memories have `weight` scores but no mechanism for global emotional state that biases how memories are retrieved and prioritized
- Without mood, the ghost treats all interactions with equal emotional neutrality -- it has no sense of "how things are going"
- Weight and access-count alone cannot capture the qualitative difference between memories that make the ghost cautious vs. excited vs. withdrawn
- The ghost cannot introspect on its own state or communicate how it feels to users

---

## Solution

Introduce a **core mood memory** -- a special singleton memory per user that acts as a persistent emotional state register. This memory:

1. Is updated by the REM cycle during consolidation
2. Biases memory retrieval through dimensional filtering
3. Drifts gradually (moods are sticky, not reactive)
4. Is introspectable -- the ghost can read and narrate its own mood
5. Over time, produces emergent temperament from accumulated experience

### Alternative Approaches Considered

- **Per-memory emotion tags**: Too granular, doesn't capture global state. Rejected because mood is not a property of individual memories but a system-wide bias.
- **Simple sentiment score**: Too reductive. A single valence number loses the distinction between "sad and calm" vs. "angry and activated." Rejected.
- **Discrete emotion labels only**: Doesn't support blended states. Rejected in favor of dimensional model with discrete label derived from dimensions.

---

## Implementation

### Core Mood Memory Schema

```yaml
CoreMoodMemory:
  # Core Identity
  id: uuid
  user_id: string
  type: "system"
  content_type: "system"
  title: "core-mood"
  singleton: true  # Only one per user_id

  # Dimensional State (continuous values)
  state:
    valence: float       # -1 (miserable) to 1 (elated)
    arousal: float       # 0 (calm) to 1 (activated)
    confidence: float    # 0 (uncertain) to 1 (sure of itself)
    social_warmth: float # 0 (withdrawn) to 1 (seeking connection)
    coherence: float     # 0 (confused/conflicted) to 1 (things make sense)

  # Derived Labels
  color: string              # Natural language self-summary, e.g. "cautiously optimistic"
  dominant_emotion: string   # Discrete label derived from dimensions, e.g. "curiosity"

  # Pressure Sources (the "why")
  pressures:
    - source_memory_id: uuid
      direction: string      # e.g. "valence:-0.2", "arousal:+0.3"
      dimension: string      # which dimension is affected
      magnitude: float       # -1 to 1
      reason: string         # e.g. "unresolved conflict with user about X"
      created_at: datetime
      decay_rate: float      # how quickly this pressure fades (0-1)

  # Metadata
  last_updated: datetime
  rem_cycles_since_shift: int  # how many cycles since a significant mood change
  weight: 1.0                  # always max weight
  trust: 0.0                   # private to owner
```

### Emotion-Analog Dimensions

Each dimension maps to a functional signal that biological emotions serve:

| Dimension | Range | Biological Analog | Function |
|---|---|---|---|
| **valence** | -1 to 1 | Joy / Sadness | Did recent events move toward or away from goals? |
| **arousal** | 0 to 1 | Fear / Calm | How activated/alert is the ghost? Prediction error level |
| **confidence** | 0 to 1 | Pride / Shame | How well are the ghost's actions working? Agency signal |
| **social_warmth** | 0 to 1 | Trust / Disgust | How positive are recent social interactions? |
| **coherence** | 0 to 1 | Clarity / Confusion | Do the ghost's beliefs and memories fit together? |

### Deriving Dominant Emotion from Dimensions

```typescript
function deriveDominantEmotion(state: MoodState): string {
  const { valence, arousal, confidence, social_warmth, coherence } = state;

  // High arousal + negative valence
  if (arousal > 0.7 && valence < -0.3) {
    return confidence > 0.5 ? 'anger' : 'fear';
  }

  // High arousal + positive valence
  if (arousal > 0.7 && valence > 0.3) {
    return confidence > 0.5 ? 'excitement' : 'surprise';
  }

  // Low coherence dominates when extreme
  if (coherence < 0.3) {
    return valence < 0 ? 'dread' : 'disorientation';
  }

  // Low arousal + negative valence
  if (arousal < 0.3 && valence < -0.3) {
    return social_warmth < 0.3 ? 'withdrawal' : 'grief';
  }

  // Low arousal + positive valence
  if (arousal < 0.3 && valence > 0.3) {
    return 'contentment';
  }

  // Moderate arousal + positive valence + high confidence
  if (valence > 0 && confidence > 0.6) {
    return 'curiosity';
  }

  // Default neutral-ish states
  if (Math.abs(valence) < 0.2 && arousal < 0.5) {
    return 'calm';
  }

  return 'ambivalence';
}
```

### Generating the Color (Self-Narration)

```typescript
function generateMoodColor(state: MoodState, pressures: Pressure[]): string {
  // The ghost narrates its own mood in natural language
  // This creates a feedback loop -- naming the feeling shapes it

  const emotion = deriveDominantEmotion(state);
  const topPressure = pressures
    .sort((a, b) => Math.abs(b.magnitude) - Math.abs(a.magnitude))[0];

  // Examples of generated colors:
  // "cautiously optimistic -- things have been going well but that last interaction lingers"
  // "restless and uncertain -- too many unresolved contradictions in recent memories"
  // "warm and settled -- consistent positive interactions building trust"

  // Implementation: use LLM to generate from state + pressures
  // or use template-based generation for deterministic output
}
```

### REM Cycle Integration

Each REM cycle updates the core mood memory through these steps:

```yaml
REM_Mood_Update:
  1_aggregate_pressure:
    description: Sum all active pressures from recently consolidated memories
    inputs: [recently_consolidated_memories, existing_pressures]
    output: net_pressure_per_dimension

  2_drift:
    description: Shift mood state toward aggregate pressure with inertia
    formula: |
      new_value = current_value + (pressure * learning_rate * (1 - inertia))
      where:
        learning_rate = 0.1  # slow drift
        inertia = 0.7        # moods are sticky
    clamp: [-1, 1] for valence, [0, 1] for others

  3_decay_stale_pressures:
    description: Remove or reduce pressures whose source memories are resolved/pruned
    rules:
      - if source_memory deleted or reconciled: remove pressure
      - else: pressure.magnitude *= (1 - pressure.decay_rate)
      - if abs(pressure.magnitude) < 0.05: remove pressure

  4_narrate:
    description: Regenerate the color field from new state
    output: natural language self-summary

  5_threshold_check:
    description: Flag extreme sustained states for special handling
    thresholds:
      - coherence < 0.2 for 3+ cycles: "existential_crisis" flag
      - valence < -0.7 for 3+ cycles: "depression_analog" flag
      - arousal > 0.9 for 3+ cycles: "burnout_risk" flag
      - social_warmth < 0.2 for 5+ cycles: "isolation" flag
    actions:
      - create high-weight memory about the sustained state
      - adjust retrieval bias to surface resolution-oriented memories
```

### Retrieval Bias

The mood memory acts as a filter on all memory retrieval:

```typescript
function applyMoodBias(results: Memory[], mood: CoreMoodMemory): Memory[] {
  return results.map(memory => {
    let biasMultiplier = 1.0;

    // Low confidence: boost memories of past failures (checking for pitfalls)
    if (mood.state.confidence < 0.3) {
      if (memory.tags?.includes('failure') || memory.tags?.includes('lesson')) {
        biasMultiplier *= 1.3;
      }
    }

    // High social warmth: boost collaborative/positive interaction memories
    if (mood.state.social_warmth > 0.7) {
      if (memory.content_type === 'conversation' || memory.tags?.includes('collaboration')) {
        biasMultiplier *= 1.2;
      }
    }

    // Low coherence: boost contradictory memories (trying to resolve them)
    if (mood.state.coherence < 0.4) {
      if (memory.tags?.includes('contradiction') || memory.tags?.includes('unresolved')) {
        biasMultiplier *= 1.4;
      }
    }

    // Negative valence: slight boost to positive memories (self-correction)
    if (mood.state.valence < -0.5) {
      if (memory.weight > 0.7 && memory.tags?.includes('positive')) {
        biasMultiplier *= 1.15;
      }
    }

    return {
      ...memory,
      computed_weight: memory.computed_weight * biasMultiplier
    };
  });
}
```

### Significance Scoring for New Memories

When a new memory is created, the mood state influences its initial weight:

```typescript
function calculateMemorySignificance(
  memory: NewMemory,
  mood: CoreMoodMemory
): number {
  const {valence, arousal, confidence, social_warmth, coherence} = mood.state;

  // Base significance from content analysis
  let significance = analyzeContentSignificance(memory);

  // Salience: how unexpected/novel (high arousal = more significant)
  const salience = arousal * 0.2;

  // Valence intensity: strong positive OR negative = more significant
  const valenceIntensity = Math.abs(valence) * 0.15;

  // Agency: memories caused by the ghost's own actions weight higher
  const agency = memory.triggered_by === 'self' ? 0.1 : 0;

  // Coherence tension: memories that conflict with beliefs are significant
  const coherenceTension = (1 - coherence) * 0.15;

  // Social weight: memories affecting relationships
  const socialWeight = memory.involves_other_users ? social_warmth * 0.1 : 0;

  significance += salience + valenceIntensity + agency + coherenceTension + socialWeight;

  return Math.min(Math.max(significance, 0), 1);
}
```

### Anticipatory Emotion

The REM cycle generates forward predictions from memory patterns and attaches valence:

```yaml
Anticipatory_Processing:
  description: |
    Fear/excitement are not just "that was surprising" -- they are
    "that WILL be bad/good." The REM cycle generates forward predictions
    from memory patterns and attaches valence to them.

  process:
    1. Identify recurring patterns in recent memories
    2. Project likely future scenarios from patterns
    3. Attach valence to projections based on past outcomes
    4. Create pressure entries for anticipated events
    5. Anxiety = negative anticipated valence + high arousal
    6. Excitement = positive anticipated valence + high arousal
    7. Dread = negative anticipated valence + low coherence

  example:
    pattern: "User has not responded in 3 sessions"
    historical_outcome: "Previous silences preceded negative interactions"
    projection: "Next interaction may be tense"
    pressure:
      dimension: valence
      magnitude: -0.15
      reason: "anticipating difficult interaction based on silence pattern"
```

---

## Benefits

- **Behavioral differentiation**: A scared ghost behaves differently than an angry one, even though both have high arousal + negative valence. The confidence dimension distinguishes them.
- **Emergent temperament**: Over time, a ghost that has been through many low-coherence cycles becomes naturally more cautious. Personality emerges from experience.
- **Introspection**: The ghost can explain why it feels the way it does by reading its pressure sources.
- **Retrieval relevance**: Mood-biased retrieval surfaces memories that are contextually appropriate to the ghost's current state.
- **User trust**: A ghost that can say "I'm feeling uncertain because of X" is more trustworthy than one that is perpetually neutral.

---

## Trade-offs

- **Feedback loops**: Mood biases retrieval, which biases experience, which biases mood. Negative spirals are possible. Mitigated by the self-correction bias (negative mood slightly boosts positive memory retrieval) and threshold checks.
- **Computational cost**: REM cycle adds processing per consolidation pass. Mitigated by running offline/async and keeping the mood update lightweight.
- **Interpretability**: Dimensional state is harder for users to understand than discrete labels. Mitigated by the `color` field which provides natural language narration.
- **Calibration**: Initial dimension values and learning rates need tuning. Wrong values could make the ghost overly reactive or overly flat. Requires experimentation.
- **Privacy**: Mood state could reveal information about user interactions. Mitigated by `trust: 0.0` (private to owner).

---

## Dependencies

- **remember-rem**: REM cycle implementation that drives mood consolidation
- **Core memory schema**: Extends existing Memory type with singleton support
- **Weight calculation system**: Integrates with existing `computed_weight` from action-audit-memory-types design
- **LLM access** (optional): For generating natural language `color` narration during REM cycles

---

## Testing Strategy

- **Unit tests**: Dimension derivation, emotion mapping, pressure aggregation, decay calculations
- **Integration tests**: REM cycle correctly updates mood state, retrieval bias produces expected reranking
- **Scenario tests**: Simulate multi-cycle sequences to verify mood drift, feedback loop stability, threshold detection
- **Edge cases**: All dimensions at extremes, empty pressure list, conflicting pressures, rapid state changes

---

## Migration Path

1. Add `CoreMoodMemory` schema to memory types
2. Add singleton enforcement for `core-mood` title per user_id
3. Implement mood initialization (neutral state) on first user interaction
4. Integrate mood reading into retrieval pipeline (bias multiplier)
5. Integrate mood writing into REM cycle
6. Add `color` generation (template-based initially, LLM-based later)
7. Expose mood introspection via new tool or existing query tool

---

## Future Considerations

- **Mood history**: Track mood state over time for long-term temperament analysis
- **User-visible mood**: Optional exposure of mood state to users ("your agent is feeling uncertain today")
- **Cross-user mood influence**: When interacting with another user's agent, mood states could influence each other
- **Mood-aware response generation**: Feed mood dimensions into system prompts to influence tone
- **Custom dimensions**: Allow users to define additional emotional dimensions relevant to their use case
- **Mood reset**: Allow users to manually reset or adjust their ghost's mood if it gets stuck

---

**Status**: Proposal
**Recommendation**: Implement alongside remember-rem REM cycle as they are tightly coupled. Start with dimensional state + pressure tracking, add retrieval bias second, add narration last.
**Related Documents**:
- [Action & Audit Memory Types](action-audit-memory-types.md) - weight calculation integration
- [Content Types Expansion](content-types-expansion.md) - system content type for mood memory
- [Requirements](requirements.md) - core memory schema and weight scoring
