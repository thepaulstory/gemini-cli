/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type ModelProvider,
  type ModelRequest,
  type ModelResponse,
  type ProviderCapabilities,
  type NormalizedToolCall,
} from '../model-provider.js';
import { type GenerateContentResponse } from '@google/genai';

/**
 * OpenAI Compatible Model Provider (Stub/Skeleton).
 */
export class OpenAICompatibleProvider implements ModelProvider {
  readonly name = 'openai-compatible';
  readonly capabilities: ProviderCapabilities = {
    supportsNativeToolCalling: true,
    supportsStreaming: true,
    supportsSystemInstruction: true,
    supportsJsonSchemaTools: true,
    supportsToolChoice: true,
    supportsUsageMetadata: true,
  };

  constructor(
    private readonly config: {
      baseUrl?: string;
      apiKey?: string;
      model?: string;
    },
  ) {}

  async generateContent(request: ModelRequest): Promise<ModelResponse> {
    // Stub implementation
    console.warn('OpenAICompatibleProvider.generateContent is not fully implemented.');
    return {
      text: 'OpenAI provider stub response',
    };
  }

  async *generateContentStream(
    request: ModelRequest,
  ): Promise<AsyncGenerator<ModelResponse & { chunk?: GenerateContentResponse }>> {
    // Stub implementation
    console.warn('OpenAICompatibleProvider.generateContentStream is not fully implemented.');
    yield {
      text: 'OpenAI provider stub streaming response',
    };
  }

  /**
   * Placeholder for future OpenAI-style tool call normalization.
   */
  private normalizeToolCall(openAiToolCall: any): NormalizedToolCall {
    return {
      id: openAiToolCall.id,
      name: openAiToolCall.function.name,
      argumentsJson: JSON.parse(openAiToolCall.function.arguments),
      providerName: this.name,
    };
  }
}
