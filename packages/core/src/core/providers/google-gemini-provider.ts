/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type ContentGenerator,
  type ContentGeneratorConfig,
} from '../contentGenerator.js';
import {
  type ModelProvider,
  type ModelRequest,
  type ModelResponse,
  type ProviderCapabilities,
  type NormalizedToolCall,
} from '../model-provider.js';
import { type GenerateContentResponse, type FunctionCall } from '@google/genai';

/**
 * Google Gemini Model Provider.
 */
export class GoogleGeminiProvider implements ModelProvider {
  readonly name = 'google';
  readonly capabilities: ProviderCapabilities = {
    supportsNativeToolCalling: true,
    supportsStreaming: true,
    supportsSystemInstruction: true,
    supportsJsonSchemaTools: true,
    supportsToolChoice: true,
    supportsUsageMetadata: true,
    supportsThoughts: true,
  };

  constructor(
    private readonly contentGenerator: ContentGenerator,
    _config: ContentGeneratorConfig,
  ) {}

  async generateContent(request: ModelRequest): Promise<ModelResponse> {
    const response = await this.contentGenerator.generateContent(
      {
        model: request.model,
        contents: request.contents,
        config: {
          ...request.generationConfig,
          systemInstruction: request.systemInstruction,
          tools: request.tools,
          abortSignal: request.abortSignal,
        },
      },
      request.promptId,
      request.role,
    );

    return this.normalizeResponse(response);
  }

  async generateContentStream(
    request: ModelRequest,
  ): Promise<AsyncGenerator<ModelResponse>> {
    const stream = await this.contentGenerator.generateContentStream(
      {
        model: request.model,
        contents: request.contents,
        config: {
          ...request.generationConfig,
          systemInstruction: request.systemInstruction,
          tools: request.tools,
          abortSignal: request.abortSignal,
        },
      },
      request.promptId,
      request.role,
    );

    return this.normalizeStream(stream);
  }

  private async *normalizeStream(
    stream: AsyncGenerator<GenerateContentResponse>,
  ): AsyncGenerator<ModelResponse> {
    for await (const chunk of stream) {
      yield this.normalizeResponse(chunk);
    }
  }

  private normalizeResponse(response: GenerateContentResponse): ModelResponse {
    const candidate = response.candidates?.[0];
    const content = candidate?.content;
    const parts = content?.parts || [];

    const text = parts
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join('');

    const toolCalls: NormalizedToolCall[] = [];
    if (response.functionCalls) {
      for (const fc of response.functionCalls) {
        toolCalls.push(this.normalizeToolCall(fc));
      }
    } else {
      // Fallback to parts if functionCalls not present on response object
      for (const part of parts) {
        if (part.functionCall) {
          toolCalls.push(this.normalizeToolCall(part.functionCall));
        }
      }
    }

    return {
      text: text || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: candidate?.finishReason,
      usageMetadata: response.usageMetadata
        ? {
            promptTokenCount: response.usageMetadata.promptTokenCount,
            candidatesTokenCount: response.usageMetadata.candidatesTokenCount,
            totalTokenCount: response.usageMetadata.totalTokenCount,
          }
        : undefined,
      rawResponse: response,
    };
  }

  private normalizeToolCall(fc: FunctionCall): NormalizedToolCall {
    return {
      id: fc.id || '',
      name: fc.name ?? '',
      argumentsJson: fc.args,
      providerName: this.name,
      providerMetadata: {
        originalFunctionCall: fc,
      },
    };
  }
}
