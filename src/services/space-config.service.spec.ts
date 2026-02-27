import { getSpaceConfig, setSpaceConfig, DEFAULT_SPACE_CONFIG } from './space-config.service.js';
import * as firestoreInit from '../firestore/init';

jest.mock('../firestore/init', () => ({
  getDocument: jest.fn(),
  setDocument: jest.fn(),
}));

const mockGetDocument = firestoreInit.getDocument as jest.MockedFunction<typeof firestoreInit.getDocument>;
const mockSetDocument = firestoreInit.setDocument as jest.MockedFunction<typeof firestoreInit.setDocument>;

describe('SpaceConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSpaceConfig', () => {
    it('returns defaults when no Firestore doc exists', async () => {
      mockGetDocument.mockResolvedValue(null);

      const config = await getSpaceConfig('public', 'space');

      expect(config).toEqual(DEFAULT_SPACE_CONFIG);
      expect(config.require_moderation).toBe(false);
      expect(config.default_write_mode).toBe('owner_only');
    });

    it('merges stored config with defaults', async () => {
      mockGetDocument.mockResolvedValue({ require_moderation: true });

      const config = await getSpaceConfig('moderated-group', 'group');

      expect(config.require_moderation).toBe(true);
      expect(config.default_write_mode).toBe('owner_only');
    });

    it('uses correct Firestore path for spaces', async () => {
      mockGetDocument.mockResolvedValue(null);

      await getSpaceConfig('public', 'space');

      expect(mockGetDocument).toHaveBeenCalledWith('spaces/public/config', 'settings');
    });

    it('uses correct Firestore path for groups', async () => {
      mockGetDocument.mockResolvedValue(null);

      await getSpaceConfig('team-alpha', 'group');

      expect(mockGetDocument).toHaveBeenCalledWith('groups/team-alpha/config', 'settings');
    });

    it('returns defaults on Firestore error', async () => {
      mockGetDocument.mockRejectedValue(new Error('Firestore unavailable'));

      const config = await getSpaceConfig('public', 'space');

      expect(config).toEqual(DEFAULT_SPACE_CONFIG);
    });
  });

  describe('setSpaceConfig', () => {
    it('writes to correct Firestore path for spaces', async () => {
      mockSetDocument.mockResolvedValue(undefined);

      await setSpaceConfig('public', 'space', { require_moderation: true });

      expect(mockSetDocument).toHaveBeenCalledWith(
        'spaces/public/config',
        'settings',
        { require_moderation: true },
        { merge: true }
      );
    });

    it('writes to correct Firestore path for groups', async () => {
      mockSetDocument.mockResolvedValue(undefined);

      await setSpaceConfig('team-alpha', 'group', { default_write_mode: 'group_editors' });

      expect(mockSetDocument).toHaveBeenCalledWith(
        'groups/team-alpha/config',
        'settings',
        { default_write_mode: 'group_editors' },
        { merge: true }
      );
    });

    it('supports partial config updates', async () => {
      mockSetDocument.mockResolvedValue(undefined);

      await setSpaceConfig('public', 'space', { require_moderation: true });

      expect(mockSetDocument).toHaveBeenCalledWith(
        'spaces/public/config',
        'settings',
        { require_moderation: true },
        { merge: true }
      );
    });
  });
});
