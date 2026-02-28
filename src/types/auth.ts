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

/** Ghost conversation context — resolved server-side, never from tool args */
export interface GhostModeContext {
  /** The ghost owner's user ID (whose memories are being searched) */
  owner_user_id: string;
  /** The accessor's user ID (who is chatting with the ghost) */
  accessor_user_id: string;
  /** Resolved trust level (looked up from GhostConfig, not user-supplied) */
  accessor_trust_level: number;
}

export interface AuthContext {
  accessToken: string | null;
  credentials: UserCredentials | null;
  /** Present when the server is running in ghost conversation mode */
  ghostMode?: GhostModeContext;
}

export type WriteMode = 'owner_only' | 'group_editors' | 'anyone';

export interface CredentialsProvider {
  getCredentials(accessToken: string, userId: string): Promise<UserCredentials>;
}
