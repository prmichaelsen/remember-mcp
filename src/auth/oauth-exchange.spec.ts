import { exchangeApiToken, extractUserId } from './oauth-exchange.js';

// Helper to create a JWT with given payload
function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fakesig`;
}

describe('extractUserId', () => {
  it('extracts sub from valid JWT', () => {
    const jwt = makeJwt({ sub: 'user123', iss: 'agentbase.me' });
    expect(extractUserId(jwt)).toBe('user123');
  });

  it('throws on missing sub claim', () => {
    const jwt = makeJwt({ iss: 'agentbase.me' });
    expect(() => extractUserId(jwt)).toThrow('missing or empty "sub" claim');
  });

  it('throws on empty sub claim', () => {
    const jwt = makeJwt({ sub: '' });
    expect(() => extractUserId(jwt)).toThrow('missing or empty "sub" claim');
  });

  it('throws on malformed JWT (wrong part count)', () => {
    expect(() => extractUserId('onlyone')).toThrow('expected 3 parts');
  });

  it('throws on malformed JWT (bad base64)', () => {
    expect(() => extractUserId('a.!!!invalid!!!.c')).toThrow('unable to decode payload');
  });
});

describe('exchangeApiToken', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns token response on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        access_token: 'jwt123',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });

    const result = await exchangeApiToken('https://example.com/oauth', 'ab_live-sk_test');
    expect(result.access_token).toBe('jwt123');
    expect(result.token_type).toBe('Bearer');
    expect(result.expires_in).toBe(3600);

    expect(global.fetch).toHaveBeenCalledWith('https://example.com/oauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'api_token', api_token: 'ab_live-sk_test' }),
    });
  });

  it('throws descriptive error on 401', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('unauthorized'),
    });

    await expect(exchangeApiToken('https://x.com/oauth', 'bad'))
      .rejects.toThrow('invalid or expired API token');
  });

  it('throws descriptive error on 403', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('disabled'),
    });

    await expect(exchangeApiToken('https://x.com/oauth', 'disabled'))
      .rejects.toThrow('API token has been disabled');
  });

  it('throws descriptive error on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(exchangeApiToken('https://x.com/oauth', 'tok'))
      .rejects.toThrow('network error');
  });

  it('throws on invalid JSON response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('invalid json')),
    });

    await expect(exchangeApiToken('https://x.com/oauth', 'tok'))
      .rejects.toThrow('invalid JSON response');
  });

  it('throws on missing access_token in response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ token_type: 'Bearer' }),
    });

    await expect(exchangeApiToken('https://x.com/oauth', 'tok'))
      .rejects.toThrow('response missing access_token');
  });

  it('throws descriptive error on other HTTP errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('internal server error'),
    });

    await expect(exchangeApiToken('https://x.com/oauth', 'tok'))
      .rejects.toThrow('HTTP 500');
  });
});
