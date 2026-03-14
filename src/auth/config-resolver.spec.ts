import { resolveAuthConfig } from './config-resolver.js';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('resolveAuthConfig', () => {
  const projectDir = join(process.cwd(), '.remember');
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save env vars
    savedEnv.REMEMBER_OAUTH_ENDPOINT = process.env.REMEMBER_OAUTH_ENDPOINT;
    savedEnv.REMEMBER_API_TOKEN = process.env.REMEMBER_API_TOKEN;
    // Clear env vars
    delete process.env.REMEMBER_OAUTH_ENDPOINT;
    delete process.env.REMEMBER_API_TOKEN;
  });

  afterEach(() => {
    // Restore env vars
    if (savedEnv.REMEMBER_OAUTH_ENDPOINT !== undefined) {
      process.env.REMEMBER_OAUTH_ENDPOINT = savedEnv.REMEMBER_OAUTH_ENDPOINT;
    } else {
      delete process.env.REMEMBER_OAUTH_ENDPOINT;
    }
    if (savedEnv.REMEMBER_API_TOKEN !== undefined) {
      process.env.REMEMBER_API_TOKEN = savedEnv.REMEMBER_API_TOKEN;
    } else {
      delete process.env.REMEMBER_API_TOKEN;
    }
    // Cleanup project config
    if (existsSync(projectDir)) {
      rmSync(projectDir, { recursive: true });
    }
  });

  it('resolves from project config file', () => {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'config'), 'oauth_endpoint: https://proj.example.com/oauth\napi_token: ab_live-sk_proj\n');

    const config = resolveAuthConfig();
    expect(config.oauthEndpoint).toBe('https://proj.example.com/oauth');
    expect(config.apiToken).toBe('ab_live-sk_proj');
  });

  it('env vars override file values', () => {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'config'), 'oauth_endpoint: https://file.com/oauth\napi_token: ab_live-sk_file\n');
    process.env.REMEMBER_API_TOKEN = 'ab_live-sk_env';

    const config = resolveAuthConfig();
    expect(config.oauthEndpoint).toBe('https://file.com/oauth');
    expect(config.apiToken).toBe('ab_live-sk_env');
  });

  it('works with env vars only (no config file)', () => {
    process.env.REMEMBER_OAUTH_ENDPOINT = 'https://env.com/oauth';
    process.env.REMEMBER_API_TOKEN = 'ab_live-sk_envonly';

    const config = resolveAuthConfig();
    expect(config.oauthEndpoint).toBe('https://env.com/oauth');
    expect(config.apiToken).toBe('ab_live-sk_envonly');
  });

  it('throws when oauth_endpoint is missing', () => {
    process.env.REMEMBER_API_TOKEN = 'ab_live-sk_tok';

    expect(() => resolveAuthConfig()).toThrow('Could not resolve OAuth endpoint');
  });

  it('throws when api_token is missing', () => {
    process.env.REMEMBER_OAUTH_ENDPOINT = 'https://x.com/oauth';

    expect(() => resolveAuthConfig()).toThrow('Could not resolve API token');
  });

  it('handles comments and empty lines in config file', () => {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'config'), [
      '# This is a comment',
      '',
      'oauth_endpoint: https://comments.com/oauth',
      '# Another comment',
      'api_token: ab_live-sk_comments',
      '',
    ].join('\n'));

    const config = resolveAuthConfig();
    expect(config.oauthEndpoint).toBe('https://comments.com/oauth');
    expect(config.apiToken).toBe('ab_live-sk_comments');
  });

  it('partial file + env var fills gaps', () => {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'config'), 'api_token: ab_live-sk_fromfile\n');
    process.env.REMEMBER_OAUTH_ENDPOINT = 'https://mixed.com/oauth';

    const config = resolveAuthConfig();
    expect(config.oauthEndpoint).toBe('https://mixed.com/oauth');
    expect(config.apiToken).toBe('ab_live-sk_fromfile');
  });
});
