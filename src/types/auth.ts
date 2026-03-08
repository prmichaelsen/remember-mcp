/**
 * Auth types for group membership validation and access control.
 *
 * These types define the contract for credentials providers and
 * the AuthContext threaded through tool handlers.
 */

export interface GroupPermissions {
  can_read: boolean;
  can_publish: boolean;
  can_revise: boolean;
  can_propose: boolean;
  can_overwrite: boolean;
  can_comment: boolean;
  can_retract_own: boolean;
  can_retract_any: boolean;
  can_manage_members: boolean;
  can_moderate: boolean;
}

export interface GroupMembership {
  group_id: string;
  permissions: GroupPermissions;
}

export interface UserCredentials {
  user_id: string;
  group_memberships: GroupMembership[];
}

/**
 * Internal context for ghost/agent sessions — resolved server-side from
 * platform HTTP headers, never from tool args.
 *
 * Replaces the former GhostModeContext. All ghost identity, trust, and
 * agent context is unified here.
 */
export interface InternalContext {
  /** Whether this is a ghost or agent session */
  type: 'ghost' | 'agent';
  /** Ghost sub-type (required when type is 'ghost') */
  ghost_type?: 'user' | 'space' | 'group';
  /** Space ID (space ghosts only) */
  ghost_space?: string;
  /** Group ID (group ghosts only) */
  ghost_group?: string;
  /** The ghost owner's user ID (user ghosts — whose memories are searched) */
  owner_user_id?: string;
  /** The accessor's user ID (who is conversing) */
  accessor_user_id: string;
  /** Resolved trust level (looked up from GhostConfig, not user-supplied) */
  accessor_trust_level?: number;
}

export interface AuthContext {
  accessToken: string | null;
  credentials: UserCredentials | null;
  /** Present when the server is running in ghost or agent mode */
  internalContext?: InternalContext;
}

export type WriteMode = 'owner_only' | 'group_editors' | 'anyone';

export interface CredentialsProvider {
  getCredentials(accessToken: string, userId: string): Promise<UserCredentials>;
}
