/**
 * OAuth Token Exchange Client
 *
 * Exchanges an API token for a JWT by calling the configured OAuth endpoint.
 * Uses native fetch (Node 18+) — no new dependencies.
 */

import { logger } from '../utils/logger.js';

export interface OAuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

/**
 * Exchange an API token for a JWT via the OAuth endpoint.
 *
 * @param oauthEndpoint - The OAuth token exchange URL
 * @param apiToken - The opaque API token to exchange
 * @returns The OAuth token response containing the JWT
 * @throws Error with descriptive message on failure
 */
export async function exchangeApiToken(
  oauthEndpoint: string,
  apiToken: string
): Promise<OAuthTokenResponse> {
  logger.info('Exchanging API token for JWT', { oauthEndpoint });

  let response: Response;
  try {
    response = await fetch(oauthEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'api_token',
        api_token: apiToken,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `OAuth token exchange failed: network error connecting to ${oauthEndpoint} — ${message}`
    );
  }

  if (response.status === 401) {
    throw new Error(
      'OAuth token exchange failed: invalid or expired API token'
    );
  }

  if (response.status === 403) {
    throw new Error(
      'OAuth token exchange failed: API token has been disabled'
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `OAuth token exchange failed: HTTP ${response.status} from ${oauthEndpoint}${body ? ` — ${body}` : ''}`
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      'OAuth token exchange failed: invalid JSON response from endpoint'
    );
  }

  if (
    typeof data !== 'object' ||
    data === null ||
    !('access_token' in data) ||
    typeof (data as any).access_token !== 'string'
  ) {
    throw new Error(
      'OAuth token exchange failed: response missing access_token field'
    );
  }

  const result: OAuthTokenResponse = {
    access_token: (data as any).access_token,
    token_type: (data as any).token_type ?? 'Bearer',
    expires_in: (data as any).expires_in ?? 3600,
  };

  logger.info('API token exchanged successfully', {
    expiresIn: result.expires_in,
  });

  return result;
}

/**
 * Extract userId from a JWT access token.
 *
 * Decodes the JWT payload without verification — the OAuth endpoint
 * already validated the token, so we just need the claims.
 *
 * @param jwt - The JWT access token
 * @returns The userId from the `sub` claim
 * @throws Error if JWT is malformed or missing `sub`
 */
export function extractUserId(jwt: string): string {
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT: expected 3 parts (header.payload.signature)');
  }

  let payload: Record<string, unknown>;
  try {
    const decoded = Buffer.from(parts[1], 'base64url').toString('utf-8');
    payload = JSON.parse(decoded);
  } catch {
    throw new Error('Invalid JWT: unable to decode payload');
  }

  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new Error('Invalid JWT: missing or empty "sub" claim');
  }

  return payload.sub;
}
