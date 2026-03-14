import { bootstrapOAuth } from './oauth-bootstrap.js';
import * as configResolver from './config-resolver.js';
import * as oauthExchange from './oauth-exchange.js';

jest.mock('./config-resolver.js');
jest.mock('./oauth-exchange.js');

const mockResolveAuthConfig = configResolver.resolveAuthConfig as jest.MockedFunction<typeof configResolver.resolveAuthConfig>;
const mockExchangeApiToken = oauthExchange.exchangeApiToken as jest.MockedFunction<typeof oauthExchange.exchangeApiToken>;
const mockExtractUserId = oauthExchange.extractUserId as jest.MockedFunction<typeof oauthExchange.extractUserId>;

describe('bootstrapOAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('completes full flow: resolve → exchange → extract', async () => {
    mockResolveAuthConfig.mockReturnValue({
      oauthEndpoint: 'https://example.com/oauth',
      apiToken: 'ab_live-sk_test',
    });
    mockExchangeApiToken.mockResolvedValue({
      access_token: 'jwt.payload.sig',
      token_type: 'Bearer',
      expires_in: 3600,
    });
    mockExtractUserId.mockReturnValue('user456');

    const result = await bootstrapOAuth();

    expect(result.accessToken).toBe('jwt.payload.sig');
    expect(result.userId).toBe('user456');
    expect(mockResolveAuthConfig).toHaveBeenCalledTimes(1);
    expect(mockExchangeApiToken).toHaveBeenCalledWith('https://example.com/oauth', 'ab_live-sk_test');
    expect(mockExtractUserId).toHaveBeenCalledWith('jwt.payload.sig');
  });

  it('propagates config resolution errors', async () => {
    mockResolveAuthConfig.mockImplementation(() => {
      throw new Error('Could not resolve API token');
    });

    await expect(bootstrapOAuth()).rejects.toThrow('Could not resolve API token');
  });

  it('propagates exchange errors', async () => {
    mockResolveAuthConfig.mockReturnValue({
      oauthEndpoint: 'https://x.com/oauth',
      apiToken: 'ab_live-sk_bad',
    });
    mockExchangeApiToken.mockRejectedValue(new Error('invalid or expired API token'));

    await expect(bootstrapOAuth()).rejects.toThrow('invalid or expired API token');
  });

  it('propagates userId extraction errors', async () => {
    mockResolveAuthConfig.mockReturnValue({
      oauthEndpoint: 'https://x.com/oauth',
      apiToken: 'ab_live-sk_ok',
    });
    mockExchangeApiToken.mockResolvedValue({
      access_token: 'bad.jwt',
      token_type: 'Bearer',
      expires_in: 3600,
    });
    mockExtractUserId.mockImplementation(() => {
      throw new Error('Invalid JWT: expected 3 parts');
    });

    await expect(bootstrapOAuth()).rejects.toThrow('expected 3 parts');
  });
});
