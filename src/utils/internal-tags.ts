import type { AuthContext } from '../types/auth.js';

/**
 * Build tags for internal (ghost/agent) memories based on the current
 * session's InternalContext. These tags implement ghost source isolation
 * so memories from different ghost conversations are distinguishable.
 *
 * Tag scheme:
 *   User ghost (alice):        ['ghost', 'ghost_type:user', 'ghost_owner:user:alice']
 *   Space ghost (music-lovers): ['ghost', 'ghost_type:space', 'ghost_owner:space:music-lovers']
 *   Group ghost (band-mates):   ['ghost', 'ghost_type:group', 'ghost_owner:group:band-mates']
 *   Agent:                      ['agent']
 */
export function buildInternalTags(authContext: AuthContext): string[] {
  const ctx = authContext.internalContext;
  if (!ctx) return [];

  if (ctx.type === 'agent') {
    return ['agent'];
  }

  const tags = ['ghost'];

  switch (ctx.ghost_type) {
    case 'user':
      tags.push('ghost_type:user');
      if (ctx.owner_user_id) {
        tags.push(`ghost_owner:user:${ctx.owner_user_id}`);
      }
      break;
    case 'space':
      tags.push('ghost_type:space');
      if (ctx.ghost_space) {
        tags.push(`ghost_owner:space:${ctx.ghost_space}`);
      }
      break;
    case 'group':
      tags.push('ghost_type:group');
      if (ctx.ghost_group) {
        tags.push(`ghost_owner:group:${ctx.ghost_group}`);
      }
      break;
  }

  return tags;
}
