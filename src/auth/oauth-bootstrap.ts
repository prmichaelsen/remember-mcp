/**
 * OAuth Bootstrap
 *
 * Single entry point for the OAuth authentication flow.
 * Resolves config → exchanges API token → extracts userId.
 */

import { logger } from '../utils/logger.js';
import { resolveAuthConfig } from './config-resolver.js';
import { exchangeApiToken, extractUserId } from './oauth-exchange.js';

export interface OAuthBootstrapResult {
  accessToken: string;  // JWT
  userId: string;
}

/**
 * Bootstrap OAuth authentication.
 *
 * 1. Resolves config from .remember/config files and env vars
 * 2. Exchanges API token for JWT via OAuth endpoint
 * 3. Extracts userId from JWT claims
 *
 * @returns The JWT access token and userId
 * @throws Error with descriptive message at any step
 */
export async function bootstrapOAuth(): Promise<OAuthBootstrapResult> {
  logger.info('Bootstrapping OAuth authentication...');

  // Step 1: Resolve config
  const { oauthEndpoint, apiToken } = resolveAuthConfig();

  // Step 2: Exchange API token for JWT
  const tokenResponse = await exchangeApiToken(oauthEndpoint, apiToken);

  // Step 3: Extract userId from JWT
  const userId = extractUserId(tokenResponse.access_token);

  logger.info('OAuth bootstrap complete', { userId, oauthEndpoint });

  return {
    accessToken: tokenResponse.access_token,
    userId,
  };
}
