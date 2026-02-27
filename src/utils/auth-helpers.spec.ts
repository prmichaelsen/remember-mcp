import { canModerate, canModerateAny } from './auth-helpers.js';
import type { AuthContext, GroupPermissions } from '../types/auth.js';

const BASE_PERMISSIONS: GroupPermissions = {
  can_read: true,
  can_publish: true,
  can_revise: false,
  can_propose: false,
  can_overwrite: false,
  can_comment: true,
  can_retract_own: true,
  can_retract_any: false,
  can_manage_members: false,
  can_moderate: false,
};

function makeAuthContext(groups: Array<{ group_id: string; can_moderate: boolean }>): AuthContext {
  return {
    accessToken: 'tok',
    credentials: {
      user_id: 'user-1',
      group_memberships: groups.map(g => ({
        group_id: g.group_id,
        permissions: { ...BASE_PERMISSIONS, can_moderate: g.can_moderate },
      })),
    },
  };
}

describe('canModerate', () => {
  it('returns false for undefined authContext', () => {
    expect(canModerate(undefined, 'group-1')).toBe(false);
  });

  it('returns false for null credentials', () => {
    expect(canModerate({ accessToken: null, credentials: null }, 'group-1')).toBe(false);
  });

  it('returns false when user is not a member of the group', () => {
    const auth = makeAuthContext([{ group_id: 'other-group', can_moderate: true }]);
    expect(canModerate(auth, 'group-1')).toBe(false);
  });

  it('returns false when user is a member but not a moderator', () => {
    const auth = makeAuthContext([{ group_id: 'group-1', can_moderate: false }]);
    expect(canModerate(auth, 'group-1')).toBe(false);
  });

  it('returns true when user has can_moderate on the group', () => {
    const auth = makeAuthContext([{ group_id: 'group-1', can_moderate: true }]);
    expect(canModerate(auth, 'group-1')).toBe(true);
  });
});

describe('canModerateAny', () => {
  it('returns false for undefined authContext', () => {
    expect(canModerateAny(undefined)).toBe(false);
  });

  it('returns false when no group has can_moderate', () => {
    const auth = makeAuthContext([
      { group_id: 'g1', can_moderate: false },
      { group_id: 'g2', can_moderate: false },
    ]);
    expect(canModerateAny(auth)).toBe(false);
  });

  it('returns true when any group has can_moderate', () => {
    const auth = makeAuthContext([
      { group_id: 'g1', can_moderate: false },
      { group_id: 'g2', can_moderate: true },
    ]);
    expect(canModerateAny(auth)).toBe(true);
  });
});
