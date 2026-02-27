import { StubCredentialsProvider, createCredentialsProvider } from './credentials-provider.js';

describe('StubCredentialsProvider', () => {
  it('returns the correct userId', async () => {
    const provider = new StubCredentialsProvider();
    const creds = await provider.getCredentials('token-123', 'user-abc');
    expect(creds.user_id).toBe('user-abc');
  });

  it('returns empty group_memberships', async () => {
    const provider = new StubCredentialsProvider();
    const creds = await provider.getCredentials('token-123', 'user-abc');
    expect(creds.group_memberships).toEqual([]);
  });
});

describe('createCredentialsProvider', () => {
  it('returns a StubCredentialsProvider instance', () => {
    const provider = createCredentialsProvider();
    expect(provider).toBeInstanceOf(StubCredentialsProvider);
  });
});
