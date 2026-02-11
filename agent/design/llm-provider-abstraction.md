# LLM Provider Abstraction Strategy

**Concept**: Provider-agnostic LLM configuration supporting multiple providers  
**Created**: 2026-02-11  
**Status**: Design Specification

---

## Overview

The remember-mcp system needs LLM capabilities for:
1. **Trust validation** - Validating responses don't leak low-trust memory details
2. **Query interpretation** - `remember_query_memory` tool (RAG)
3. **Template suggestions** - Suggesting appropriate templates
4. **Relationship discovery** - Identifying connections between memories

**Requirement**: Support multiple LLM providers (OpenAI, Anthropic/Bedrock, Cohere, etc.) with easy swapping.

---

## Current State

**Weaviate Embeddings**: Currently assumes OpenAI
```typescript
// Weaviate uses OpenAI for embeddings
headers: { 'X-OpenAI-Api-Key': config.openai.apiKey }
```

**LLM Calls**: Not yet implemented (will be in M2-M3)

---

## Proposed Environment Variables

### Provider-Agnostic Configuration

```env
# LLM Provider Configuration
LLM_PROVIDER=bedrock                    # bedrock | openai | anthropic | cohere | custom
LLM_MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0

# AWS Bedrock Configuration (when LLM_PROVIDER=bedrock)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SESSION_TOKEN=                      # Optional, for temporary credentials

# OpenAI Configuration (when LLM_PROVIDER=openai)
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=                          # Optional

# Anthropic Direct Configuration (when LLM_PROVIDER=anthropic)
ANTHROPIC_API_KEY=sk-ant-...

# Cohere Configuration (when LLM_PROVIDER=cohere)
COHERE_API_KEY=

# Embeddings Provider (separate from LLM)
EMBEDDINGS_PROVIDER=openai              # openai | cohere | huggingface | custom
EMBEDDINGS_MODEL=text-embedding-3-small

# OpenAI Embeddings (when EMBEDDINGS_PROVIDER=openai)
OPENAI_EMBEDDINGS_API_KEY=sk-...        # Can be different from LLM key

# Cohere Embeddings (when EMBEDDINGS_PROVIDER=cohere)
COHERE_EMBEDDINGS_API_KEY=
```

---

## Configuration Structure

### config.ts Enhancement

```typescript
export const config = {
  // ... existing config ...
  
  // LLM Configuration
  llm: {
    provider: (process.env.LLM_PROVIDER || 'openai') as LLMProvider,
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
    
    // Provider-specific configs
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      orgId: process.env.OPENAI_ORG_ID || '',
    },
    
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    },
    
    bedrock: {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      sessionToken: process.env.AWS_SESSION_TOKEN || '',
    },
    
    cohere: {
      apiKey: process.env.COHERE_API_KEY || '',
    },
  },
  
  // Embeddings Configuration (separate from LLM)
  embeddings: {
    provider: (process.env.EMBEDDINGS_PROVIDER || 'openai') as EmbeddingsProvider,
    model: process.env.EMBEDDINGS_MODEL || 'text-embedding-3-small',
    
    openai: {
      apiKey: process.env.OPENAI_EMBEDDINGS_API_KEY || process.env.OPENAI_API_KEY || '',
    },
    
    cohere: {
      apiKey: process.env.COHERE_EMBEDDINGS_API_KEY || process.env.COHERE_API_KEY || '',
    },
  },
} as const;

export type LLMProvider = 'openai' | 'anthropic' | 'bedrock' | 'cohere' | 'custom';
export type EmbeddingsProvider = 'openai' | 'cohere' | 'huggingface' | 'custom';
```

---

## LLM Abstraction Layer

### Interface Definition

```typescript
// src/llm/types.ts

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  topP?: number;
}

export interface LLMCompletionResult {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
}

export interface LLMProvider {
  complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult>;
  validateConfig(): void;
}
```

### Provider Implementations

**src/llm/providers/bedrock.provider.ts**:
```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { LLMProvider, LLMMessage, LLMCompletionOptions, LLMCompletionResult } from '../types.js';
import { config } from '../../config.js';

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
    
    // Anthropic format for Bedrock
    const body = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.7,
      messages: messages.filter(m => m.role !== 'system'),
      system: messages.find(m => m.role === 'system')?.content,
    };

    const command = new InvokeModelCommand({
      modelId: model,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(body),
    });

    const response = await this.client.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));

    return {
      content: result.content[0].text,
      model: model,
      usage: {
        inputTokens: result.usage.input_tokens,
        outputTokens: result.usage.output_tokens,
        totalTokens: result.usage.input_tokens + result.usage.output_tokens,
      },
      finishReason: result.stop_reason === 'end_turn' ? 'stop' : result.stop_reason,
    };
  }

  validateConfig(): void {
    if (!config.llm.bedrock.region) throw new Error('AWS_REGION required');
    if (!config.llm.bedrock.accessKeyId) throw new Error('AWS_ACCESS_KEY_ID required');
    if (!config.llm.bedrock.secretAccessKey) throw new Error('AWS_SECRET_ACCESS_KEY required');
  }
}
```

**src/llm/providers/openai.provider.ts**:
```typescript
import type { LLMProvider, LLMMessage, LLMCompletionOptions, LLMCompletionResult } from '../types.js';
import { config } from '../../config.js';

export class OpenAILLMProvider implements LLMProvider {
  async complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const model = options?.model || config.llm.model;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.llm.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 4096,
        stop: options?.stopSequences,
        top_p: options?.topP,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const result = await response.json();
    const choice = result.choices[0];

    return {
      content: choice.message.content,
      model: result.model,
      usage: {
        inputTokens: result.usage.prompt_tokens,
        outputTokens: result.usage.completion_tokens,
        totalTokens: result.usage.total_tokens,
      },
      finishReason: choice.finish_reason,
    };
  }

  validateConfig(): void {
    if (!config.llm.openai.apiKey) throw new Error('OPENAI_API_KEY required');
  }
}
```

**src/llm/providers/anthropic.provider.ts**:
```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMMessage, LLMCompletionOptions, LLMCompletionResult } from '../types.js';
import { config } from '../../config.js';

export class AnthropicLLMProvider implements LLMProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.llm.anthropic.apiKey,
    });
  }

  async complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const model = options?.model || config.llm.model;
    
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const response = await this.client.messages.create({
      model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.7,
      system: systemMessage?.content,
      messages: conversationMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    return {
      content: response.content[0].type === 'text' ? response.content[0].text : '',
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: response.stop_reason === 'end_turn' ? 'stop' : response.stop_reason,
    };
  }

  validateConfig(): void {
    if (!config.llm.anthropic.apiKey) throw new Error('ANTHROPIC_API_KEY required');
  }
}
```

### Provider Factory

**src/llm/factory.ts**:
```typescript
import type { LLMProvider } from './types.js';
import { BedrockLLMProvider } from './providers/bedrock.provider.js';
import { OpenAILLMProvider } from './providers/openai.provider.js';
import { AnthropicLLMProvider } from './providers/anthropic.provider.js';
import { config } from '../config.js';

let providerInstance: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (providerInstance) {
    return providerInstance;
  }

  switch (config.llm.provider) {
    case 'bedrock':
      providerInstance = new BedrockLLMProvider();
      break;
    
    case 'openai':
      providerInstance = new OpenAILLMProvider();
      break;
    
    case 'anthropic':
      providerInstance = new AnthropicLLMProvider();
      break;
    
    default:
      throw new Error(`Unsupported LLM provider: ${config.llm.provider}`);
  }

  providerInstance.validateConfig();
  console.log(`[LLM] Using provider: ${config.llm.provider}`);
  
  return providerInstance;
}

// Convenience function
export async function completeLLM(
  messages: LLMMessage[],
  options?: LLMCompletionOptions
): Promise<LLMCompletionResult> {
  const provider = getLLMProvider();
  return await provider.complete(messages, options);
}
```

---

## Usage Examples

### Trust Validation (Phase 2)

```typescript
import { completeLLM } from '@/llm/factory.js';

async function validateTrustCompliance(
  response: string,
  lowTrustMemories: Memory[]
): Promise<ValidationResult> {
  const validationPrompt = `
You are a trust compliance validator...
Response to validate: "${response}"
  `;

  const result = await completeLLM([
    { role: 'system', content: 'You are a trust compliance validator.' },
    { role: 'user', content: validationPrompt }
  ], {
    temperature: 0.3,  // Low temperature for consistent validation
    maxTokens: 1000
  });

  return parseValidationResult(result.content);
}
```

### Query Interpretation (Phase 2)

```typescript
import { completeLLM } from '@/llm/factory.js';

async function interpretQuery(
  question: string,
  memories: Memory[]
): Promise<string> {
  const context = memories.map(m => m.content).join('\n\n');
  
  const result = await completeLLM([
    { role: 'system', content: 'You are a helpful assistant with access to user memories.' },
    { role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` }
  ], {
    temperature: 0.7,
    maxTokens: 2000
  });

  return result.content;
}
```

---

## Embeddings Abstraction

### Weaviate Vectorizer Configuration

Weaviate supports multiple vectorizers. We should configure based on EMBEDDINGS_PROVIDER:

```typescript
// src/weaviate/schema.ts

import weaviate from 'weaviate-client';
import { config } from '../config.js';

export function getVectorizerConfig() {
  switch (config.embeddings.provider) {
    case 'openai':
      return weaviate.configure.vectorizer.text2VecOpenAI({
        model: config.embeddings.model,
        // Weaviate will use X-OpenAI-Api-Key header
      });
    
    case 'cohere':
      return weaviate.configure.vectorizer.text2VecCohere({
        model: config.embeddings.model,
        // Weaviate will use X-Cohere-Api-Key header
      });
    
    case 'huggingface':
      return weaviate.configure.vectorizer.text2VecHuggingFace({
        model: config.embeddings.model,
      });
    
    default:
      throw new Error(`Unsupported embeddings provider: ${config.embeddings.provider}`);
  }
}

export function getEmbeddingsHeaders(): Record<string, string> {
  switch (config.embeddings.provider) {
    case 'openai':
      return { 'X-OpenAI-Api-Key': config.embeddings.openai.apiKey };
    
    case 'cohere':
      return { 'X-Cohere-Api-Key': config.embeddings.cohere.apiKey };
    
    default:
      return {};
  }
}
```

### Update Weaviate Client

```typescript
// src/weaviate/client.ts

import { getEmbeddingsHeaders } from './schema.js';

export async function initWeaviateClient(): Promise<WeaviateClient> {
  if (client) {
    return client;
  }

  client = await weaviate.connectToWeaviateCloud(config.weaviate.url, {
    authCredentials: config.weaviate.apiKey
      ? new weaviate.ApiKey(config.weaviate.apiKey)
      : undefined,
    headers: getEmbeddingsHeaders(),  // ✅ Provider-agnostic headers
  });

  console.log('[Weaviate] Client initialized');
  return client;
}
```

---

## Recommended .env.example

```env
# Weaviate Configuration
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=

# LLM Provider Configuration
# Options: bedrock | openai | anthropic | cohere
LLM_PROVIDER=bedrock
LLM_MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0

# AWS Bedrock Configuration (when LLM_PROVIDER=bedrock)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SESSION_TOKEN=

# OpenAI Configuration (when LLM_PROVIDER=openai)
# OPENAI_API_KEY=sk-...
# OPENAI_ORG_ID=

# Anthropic Direct Configuration (when LLM_PROVIDER=anthropic)
# ANTHROPIC_API_KEY=sk-ant-...

# Cohere Configuration (when LLM_PROVIDER=cohere)
# COHERE_API_KEY=

# Embeddings Provider Configuration (for Weaviate)
# Options: openai | cohere | huggingface
EMBEDDINGS_PROVIDER=openai
EMBEDDINGS_MODEL=text-embedding-3-small

# OpenAI Embeddings (when EMBEDDINGS_PROVIDER=openai)
OPENAI_EMBEDDINGS_API_KEY=sk-...

# Cohere Embeddings (when EMBEDDINGS_PROVIDER=cohere)
# COHERE_EMBEDDINGS_API_KEY=

# Firebase Admin Configuration (using firebase-admin-sdk-v8)
FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
FIREBASE_PROJECT_ID=remember-mcp-dev

# Firebase Client Configuration (for utility scripts)
FIREBASE_CLIENT_API_KEY=
FIREBASE_CLIENT_AUTH_DOMAIN=
FIREBASE_CLIENT_PROJECT_ID=
FIREBASE_CLIENT_STORAGE_BUCKET=
FIREBASE_CLIENT_MESSAGING_SENDER_ID=
FIREBASE_CLIENT_APP_ID=
FIREBASE_CLIENT_MEASUREMENT_ID=

# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# MCP Configuration
MCP_TRANSPORT=sse
```

---

## Benefits

### 1. **Provider Flexibility**
- Switch providers by changing one env var
- Support multiple providers simultaneously
- Easy to add new providers

### 2. **Cost Optimization**
- Use cheaper providers for embeddings
- Use powerful providers for complex tasks
- Mix and match based on needs

### 3. **Vendor Independence**
- Not locked into one provider
- Can migrate if pricing changes
- Can use different providers per environment

### 4. **Development Flexibility**
- Use OpenAI in development (simple)
- Use Bedrock in production (cost-effective)
- Test with multiple providers

---

## Implementation Phases

### Phase 1: Configuration (M1 - Now)
- ✅ Add LLM and embeddings config to .env.example
- ✅ Update config.ts with provider configs
- ✅ Document in design doc

### Phase 2: Embeddings (M2 - Core Memory System)
- Implement embeddings provider abstraction
- Update Weaviate client to use provider-agnostic headers
- Support OpenAI, Cohere, HuggingFace

### Phase 3: LLM Providers (M3-M5 - Advanced Features)
- Implement LLM provider interface
- Create provider implementations (Bedrock, OpenAI, Anthropic)
- Use for trust validation, query interpretation, template suggestions

---

## Dependencies

### Required Packages

```json
{
  "dependencies": {
    // For Bedrock
    "@aws-sdk/client-bedrock-runtime": "^3.x.x",
    
    // For Anthropic Direct
    "@anthropic-ai/sdk": "^0.x.x",
    
    // For Cohere
    "cohere-ai": "^7.x.x"
  }
}
```

**Note**: Install only the providers you plan to use. Not all are required.

---

## Testing

### Mock Provider for Tests

```typescript
// tests/mocks/llm.mock.ts

export class MockLLMProvider implements LLMProvider {
  async complete(messages: LLMMessage[]): Promise<LLMCompletionResult> {
    return {
      content: 'Mock response',
      model: 'mock-model',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    };
  }

  validateConfig(): void {
    // No-op for tests
  }
}
```

---

## Recommendation

### For remember-mcp

**Phase 1 (M1 - Now)**:
- ✅ Add provider-agnostic config to .env.example
- ✅ Update config.ts structure
- ✅ Document strategy in this design doc
- ⏳ Don't implement providers yet (not needed until M2-M3)

**Phase 2 (M2 - When needed)**:
- Implement embeddings abstraction for Weaviate
- Support OpenAI embeddings (primary)
- Optional: Add Cohere support

**Phase 3 (M3-M5 - When needed)**:
- Implement LLM provider interface
- Add Bedrock provider (your preference)
- Optional: Add OpenAI, Anthropic providers

### Immediate Action

Update .env.example to include LLM provider configuration, but don't implement providers until they're actually needed.

---

**Status**: Design Specification  
**Implementation**: Phase 1 (config only) for M1, full implementation in M2-M5  
**Recommendation**: Configure now, implement later when LLM features are needed
