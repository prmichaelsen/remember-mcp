/**
 * E2E: Preferences — get/set preferences
 *
 * Run with:
 *   DOTENV_CONFIG_PATH=.env.e1.local npm run test:e2e -- --testPathPattern=preferences
 */

import {
  e2eInit, e2eUserId, e2eAuthContext, e2eCleanup, parseResult,
} from './e2e-helpers.js';
import { handleSetPreference } from './tools/set-preference.js';
import { handleGetPreferences } from './tools/get-preferences.js';

const userId = e2eUserId('pref');
const auth = e2eAuthContext();

// BUG: remember-core getUserPreferencesPath returns 3-segment Firestore path
// ({BASE}.users/{userId}/preferences) which fails validation in firebase-admin-sdk-v8.
// Fix requires remember-core path update to use 4-segment subcollection paths.
// These tests WILL FAIL until the core bug is fixed.
describe('E2E: Preferences', () => {
  beforeAll(async () => {
    await e2eInit();
  }, 30_000);

  afterAll(async () => {
    await e2eCleanup(userId);
  }, 30_000);

  it('gets default preferences', async () => {
    const res = parseResult(await handleGetPreferences(
      {},
      userId, auth,
    ));

    expect(res.preferences).toBeDefined();
    expect(res.is_default).toBe(true);
    console.log('  got default preferences');
  });

  it('sets a search preference', async () => {
    const res = parseResult(await handleSetPreference(
      { preferences: { search: { default_limit: 25 } } } as any,
      userId, auth,
    ));

    expect(res.success).toBe(true);
    console.log('  set search.default_limit = 25');
  });

  it('gets search preferences and sees updated value', async () => {
    const res = parseResult(await handleGetPreferences(
      { category: 'search' },
      userId, auth,
    ));

    expect(res.preferences).toBeDefined();
    expect(res.preferences.search.default_limit).toBe(25);
  });

  it('updates a preference to a new value', async () => {
    const res = parseResult(await handleSetPreference(
      { preferences: { search: { default_limit: 50 } } } as any,
      userId, auth,
    ));
    expect(res.success).toBe(true);

    const getRes = parseResult(await handleGetPreferences(
      { category: 'search' },
      userId, auth,
    ));
    expect(getRes.preferences.search.default_limit).toBe(50);
  });

  it('sets a display preference', async () => {
    const res = parseResult(await handleSetPreference(
      { preferences: { privacy: { default_trust_level: 0.5 } } } as any,
      userId, auth,
    ));
    expect(res.success).toBe(true);

    const getRes = parseResult(await handleGetPreferences(
      { category: 'privacy' },
      userId, auth,
    ));
    expect(getRes.preferences.privacy.default_trust_level).toBe(0.5);
  });
});
