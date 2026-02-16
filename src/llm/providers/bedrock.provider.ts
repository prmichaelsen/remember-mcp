/**
 * AWS Bedrock LLM Provider
 * Uses AWS Bedrock Runtime to invoke Claude models
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { LLMProvider, LLMMessage, LLMCompletionOptions, LLMCompletionResult } from '../types.js';
import { config } from '../../config.js';
import { logger } from '../../utils/logger.js';

export class BedrockLLMProvider implements LLMProvider {
  private client: BedrockRuntimeClient;

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: config.llm.bedrock.region,
      credentials: {
        accessKeyId: config.llm.bedrock.accessKeyId,
        secretAccessKey: config.llm.bedrock.secretAccessKey,
        sessionToken: config.llm.bedrock.sessionToken || undefined,
      },
    });
  }

  async complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const model = options?.model || config.llm.model;
    
    try {
      // Extract system message
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');
      
      // Build Anthropic request body for Bedrock
      const body = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature ?? 0.7,
        messages: conversationMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        ...(systemMessage && { system: systemMessage.content }),
        ...(options?.topP && { top_p: options.topP }),
        ...(options?.stopSequences && { stop_sequences: options.stopSequences }),
      };

      logger.debug('[Bedrock] Invoking model', { model, messageCount: messages.length });

      // Invoke Bedrock model
      const command = new InvokeModelCommand({
        modelId: model,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(body),
      });

      const response = await this.client.send(command);
      
      // Parse response
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      // Extract content
      const content = responseBody.content?.[0]?.text || '';
      
      const result: LLMCompletionResult = {
        content,
        model,
        usage: {
          inputTokens: responseBody.usage?.input_tokens || 0,
          outputTokens: responseBody.usage?.output_tokens || 0,
          totalTokens: (responseBody.usage?.input_tokens || 0) + (responseBody.usage?.output_tokens || 0),
        },
        finishReason: responseBody.stop_reason === 'end_turn' ? 'stop' : 
                      responseBody.stop_reason === 'max_tokens' ? 'length' :
                      responseBody.stop_reason || 'stop',
      };

      logger.debug('[Bedrock] Completion successful', { 
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      });

      return result;
    } catch (error) {
      logger.error('[Bedrock] Completion failed', { error, model });
      throw new Error(`Bedrock completion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  validateConfig(): void {
    if (!config.llm.bedrock.region) {
      throw new Error('AWS_REGION required for Bedrock provider');
    }
    if (!config.llm.bedrock.accessKeyId) {
      throw new Error('AWS_ACCESS_KEY_ID required for Bedrock provider');
    }
    if (!config.llm.bedrock.secretAccessKey) {
      throw new Error('AWS_SECRET_ACCESS_KEY required for Bedrock provider');
    }
    
    logger.info('[Bedrock] Configuration validated', { 
      region: config.llm.bedrock.region,
      model: config.llm.model,
    });
  }
}
