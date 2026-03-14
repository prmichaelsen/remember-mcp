/**
 * Local Config Resolution
 *
 * Resolves API token and OAuth endpoint from .remember/config files.
 *
 * Resolution order (first wins per field):
 *   1. ./.remember/config  (project-level)
 *   2. ~/.remember/config  (global)
 *   3. REMEMBER_API_TOKEN / REMEMBER_OAUTH_ENDPOINT env vars
 *
 * Env vars override file values when both are present.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';

export interface ResolvedAuthConfig {
  oauthEndpoint: string;
  apiToken: string;
}

interface ConfigFileValues {
  oauth_endpoint?: string;
  api_token?: string;
}

/**
 * Parse a .remember/config file.
 * Format: simple key: value pairs, one per line. Lines starting with # are comments.
 */
function parseConfigFile(filePath: string): ConfigFileValues {
  const content = readFileSync(filePath, 'utf-8');
  const result: ConfigFileValues = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();

    if (key === 'oauth_endpoint' && value) {
      result.oauth_endpoint = value;
    } else if (key === 'api_token' && value) {
      result.api_token = value;
    }
  }

  return result;
}

/**
 * Try to read a config file, returning null if it doesn't exist.
 */
function tryReadConfigFile(filePath: string): ConfigFileValues | null {
  if (!existsSync(filePath)) return null;

  try {
    const values = parseConfigFile(filePath);
    logger.debug('Read config file', { filePath, keys: Object.keys(values) });
    return values;
  } catch (error) {
    logger.warn('Failed to parse config file', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Resolve auth config from .remember/config files and env vars.
 *
 * Merge strategy:
 *   - Project config fills in values
 *   - Global config fills in remaining gaps
 *   - Env vars override any file values
 *
 * @throws Error if required values are missing after resolution
 */
export function resolveAuthConfig(): ResolvedAuthConfig {
  const projectConfigPath = join(process.cwd(), '.remember', 'config');
  const globalConfigPath = join(homedir(), '.remember', 'config');

  // Read config files (project takes precedence)
  const projectConfig = tryReadConfigFile(projectConfigPath);
  const globalConfig = tryReadConfigFile(globalConfigPath);

  // Start with file values (project > global)
  let oauthEndpoint = projectConfig?.oauth_endpoint ?? globalConfig?.oauth_endpoint ?? '';
  let apiToken = projectConfig?.api_token ?? globalConfig?.api_token ?? '';

  // Env vars override file values
  if (process.env.REMEMBER_OAUTH_ENDPOINT) {
    oauthEndpoint = process.env.REMEMBER_OAUTH_ENDPOINT;
  }
  if (process.env.REMEMBER_API_TOKEN) {
    apiToken = process.env.REMEMBER_API_TOKEN;
  }

  // Validate
  const searched = [projectConfigPath, globalConfigPath, 'env vars'].join(', ');

  if (!oauthEndpoint) {
    throw new Error(
      `Could not resolve OAuth endpoint. Set REMEMBER_OAUTH_ENDPOINT env var or add oauth_endpoint to .remember/config. Searched: ${searched}`
    );
  }

  if (!apiToken) {
    throw new Error(
      `Could not resolve API token. Set REMEMBER_API_TOKEN env var or add api_token to .remember/config. Searched: ${searched}`
    );
  }

  logger.info('Auth config resolved', {
    oauthEndpoint,
    tokenSource: process.env.REMEMBER_API_TOKEN ? 'env' : projectConfig?.api_token ? 'project' : 'global',
  });

  return { oauthEndpoint, apiToken };
}
