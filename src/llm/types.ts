/**
 * LLM Provider Types
 * Based on agent/design/llm-provider-abstraction.md
 */

/**
 * Message in an LLM conversation
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Options for LLM completion
 */
export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  topP?: number;
}

/**
 * Token usage statistics
 */
export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Result from LLM completion
 */
export interface LLMCompletionResult {
  content: string;
  model: string;
  usage: LLMUsage;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
}

/**
 * LLM Provider interface
 * All providers must implement this interface
 */
export interface LLMProvider {
  /**
   * Complete a conversation with the LLM
   */
  complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult>;
  
  /**
   * Validate that the provider is configured correctly
   * Throws an error if configuration is invalid
   */
  validateConfig(): void;
}
