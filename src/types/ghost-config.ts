/**
 * Ghost/persona configuration types.
 * See agent/design/local.ghost-persona-system.md
 *
 * GhostConfig is stored in Firestore at users/{ownerUserId}/ghost_config.
 * Trust is owned by remember-mcp (not passed per-request) to prevent
 * prompt injection tampering.
 */

/** Trust enforcement mode — how memories are filtered for cross-user access */
export type TrustEnforcementMode = 'query' | 'prompt' | 'hybrid';

/**
 * Per-user ghost configuration stored in Firestore.
 *
 * - query mode (default): memories above threshold never returned from Weaviate
 * - prompt mode: all memories returned, formatted/redacted by trust level
 * - hybrid mode: query filter for trust 0.0, prompt filter for rest
 */
export interface GhostConfig {
  /** Whether ghost conversations are enabled for this user (default: false) */
  enabled: boolean;
  /** Allow non-friends (strangers) to initiate ghost conversations (default: false) */
  public_ghost_enabled: boolean;
  /** Default trust level for friends (default: 0.25 — metadata only) */
  default_friend_trust: number;
  /** Default trust level for strangers (default: 0 — existence only) */
  default_public_trust: number;
  /** Per-user trust level overrides: userId → trust level (0-1) */
  per_user_trust: Record<string, number>;
  /** Users blocked from ghost access entirely */
  blocked_users: string[];
  /** How trust is enforced when filtering memories (default: 'query') */
  enforcement_mode: TrustEnforcementMode;
}

/** Default GhostConfig values for a new user */
export const DEFAULT_GHOST_CONFIG: GhostConfig = {
  enabled: false,
  public_ghost_enabled: false,
  default_friend_trust: 0.25,
  default_public_trust: 0,
  per_user_trust: {},
  blocked_users: [],
  enforcement_mode: 'query',
};
