import { buildInternalTags } from './internal-tags.js';
import type { AuthContext } from '../types/auth.js';

describe('buildInternalTags', () => {
  const baseAuth: AuthContext = { accessToken: null, credentials: null };

  it('returns empty array when no internalContext', () => {
    expect(buildInternalTags(baseAuth)).toEqual([]);
  });

  it('returns ["agent"] for agent context', () => {
    const auth: AuthContext = {
      ...baseAuth,
      internalContext: { type: 'agent', accessor_user_id: 'bob' },
    };
    expect(buildInternalTags(auth)).toEqual(['agent']);
  });

  it('returns correct tags for user ghost', () => {
    const auth: AuthContext = {
      ...baseAuth,
      internalContext: {
        type: 'ghost',
        ghost_type: 'user',
        owner_user_id: 'alice',
        accessor_user_id: 'bob',
      },
    };
    expect(buildInternalTags(auth)).toEqual([
      'ghost',
      'ghost_type:user',
      'ghost_owner:user:alice',
    ]);
  });

  it('returns correct tags for space ghost', () => {
    const auth: AuthContext = {
      ...baseAuth,
      internalContext: {
        type: 'ghost',
        ghost_type: 'space',
        ghost_space: 'music-lovers',
        accessor_user_id: 'bob',
      },
    };
    expect(buildInternalTags(auth)).toEqual([
      'ghost',
      'ghost_type:space',
      'ghost_owner:space:music-lovers',
    ]);
  });

  it('returns correct tags for group ghost', () => {
    const auth: AuthContext = {
      ...baseAuth,
      internalContext: {
        type: 'ghost',
        ghost_type: 'group',
        ghost_group: 'band-mates',
        accessor_user_id: 'bob',
      },
    };
    expect(buildInternalTags(auth)).toEqual([
      'ghost',
      'ghost_type:group',
      'ghost_owner:group:band-mates',
    ]);
  });

  it('returns ["ghost"] only when ghost_type is missing', () => {
    const auth: AuthContext = {
      ...baseAuth,
      internalContext: {
        type: 'ghost',
        accessor_user_id: 'bob',
      },
    };
    expect(buildInternalTags(auth)).toEqual(['ghost']);
  });

  it('returns user ghost tags without owner when owner_user_id is missing', () => {
    const auth: AuthContext = {
      ...baseAuth,
      internalContext: {
        type: 'ghost',
        ghost_type: 'user',
        accessor_user_id: 'bob',
      },
    };
    expect(buildInternalTags(auth)).toEqual(['ghost', 'ghost_type:user']);
  });

  it('returns space ghost tags without owner when ghost_space is missing', () => {
    const auth: AuthContext = {
      ...baseAuth,
      internalContext: {
        type: 'ghost',
        ghost_type: 'space',
        accessor_user_id: 'bob',
      },
    };
    expect(buildInternalTags(auth)).toEqual(['ghost', 'ghost_type:space']);
  });
});
