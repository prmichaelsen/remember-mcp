/**
 * LLM Provider Factory
 * Creates and manages LLM provider instances
 */

import type { LLMProvider, LLMMessage, LLMCompletionOptions, LLMCompletionResult } from './types.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

let providerInstance: LLMProvider | null = null;

/**
 * Get the configured LLM provider instance (singleton)
 */
export function getLLMProvider(): LLMProvider {
  if (providerInstance) {
    return providerInstance;
  }

  switch (config.llm.provider) {
    case 'bedrock': {
      // Dynamic import to avoid loading if not needed
      const { BedrockLLMProvider } = require('./providers/bedrock.provider.js');
      providerInstance = new BedrockLLMProvider();
      break;
    }
    
    case 'openai': {
      throw new Error('OpenAI provider not yet implemented. Use bedrock provider.');
    }
    
    case 'anthropic': {
      throw new Error('Anthropic direct provider not yet implemented. Use bedrock provider.');
    }
    
    default:
      throw new Error(`Unsupported LLM provider: ${config.llm.provider}. Supported: bedrock`);
  }

  // Validate configuration
  if (!providerInstance) {
    throw new Error('Failed to instantiate LLM provider');
  }
  
  providerInstance.validateConfig();
  
  logger.info(`[LLM] Using provider: ${config.llm.provider} with model: ${config.llm.model}`);
  
  return providerInstance;
}

/**
 * Convenience function to complete an LLM request
 * Uses the configured provider
 */
export async function completeLLM(
  messages: LLMMessage[],
  options?: LLMCompletionOptions
): Promise<LLMCompletionResult> {
  const provider = getLLMProvider();
  return await provider.complete(messages, options);
}

/**
 * Reset the provider instance (useful for testing)
 */
export function resetProvider(): void {
  providerInstance = null;
}
