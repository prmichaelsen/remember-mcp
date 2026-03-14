import { isAdmin, adminPermissionError } from './admin.js';

describe('isAdmin', () => {
  const originalEnv = process.env.ADMIN_USER_IDS;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_USER_IDS = originalEnv;
    } else {
      delete process.env.ADMIN_USER_IDS;
    }
  });

  it('returns true when userId matches a single admin ID', () => {
    process.env.ADMIN_USER_IDS = 'user123';
    expect(isAdmin('user123')).toBe(true);
  });

  it('returns false when userId does not match', () => {
    process.env.ADMIN_USER_IDS = 'user123';
    expect(isAdmin('other_user')).toBe(false);
  });

  it('returns true when userId matches one of multiple admin IDs', () => {
    process.env.ADMIN_USER_IDS = 'user1,user2,user3';
    expect(isAdmin('user2')).toBe(true);
  });

  it('returns false when ADMIN_USER_IDS is empty string', () => {
    process.env.ADMIN_USER_IDS = '';
    expect(isAdmin('user123')).toBe(false);
  });

  it('returns false when ADMIN_USER_IDS is undefined', () => {
    delete process.env.ADMIN_USER_IDS;
    expect(isAdmin('user123')).toBe(false);
  });

  it('trims whitespace around IDs', () => {
    process.env.ADMIN_USER_IDS = '  user1 , user2 , user3  ';
    expect(isAdmin('user2')).toBe(true);
  });

  it('filters out empty entries from trailing commas', () => {
    process.env.ADMIN_USER_IDS = 'user1,,user2,';
    expect(isAdmin('user1')).toBe(true);
    expect(isAdmin('user2')).toBe(true);
    expect(isAdmin('')).toBe(false);
  });

  it('re-reads env var on each call (not cached)', () => {
    process.env.ADMIN_USER_IDS = 'user1';
    expect(isAdmin('user1')).toBe(true);
    expect(isAdmin('user2')).toBe(false);

    process.env.ADMIN_USER_IDS = 'user2';
    expect(isAdmin('user1')).toBe(false);
    expect(isAdmin('user2')).toBe(true);
  });
});

describe('adminPermissionError', () => {
  it('returns correct error structure', () => {
    const result = adminPermissionError();
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Permission denied: admin access required' }],
      isError: true,
    });
  });
});
