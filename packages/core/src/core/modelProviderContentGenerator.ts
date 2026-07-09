/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type CountTokensParameters,
  type CountTokensResponse,
  type EmbedContentParameters,
  type EmbedContentResponse,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai';
import { toContents } from '../code_assist/converter.js';
import type { LlmRole } from '../telemetry/llmRole.js';
import type { ModelProvider, ModelRequest } from './model-provider.js';
import { toGenerateContentResponse } from './model-provider.js';
import type { ContentGenerator } from './contentGenerator.js';

/**
 * ContentGenerator adapter for providers that do not have a Google GenAI SDK
 * ContentGenerator underneath them.
 */
export class ModelProviderContentGenerator implements ContentGenerator {
  constructor(private readonly provider: ModelProvider) {}

  getProvider(): ModelProvider {
    return this.provider;
  }

  async generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
    role: LlmRole,
  ): Promise<GenerateContentResponse> {
    const response = await this.provider.generateContent(
      this.toModelRequest(request, userPromptId, role, false),
    );
    return toGenerateContentResponse(response);
  }

  async generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
    role: LlmRole,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const stream = await this.provider.generateContentStream(
      this.toModelRequest(request, userPromptId, role, true),
    );

    return (async function* () {
      for await (const response of stream) {
        yield toGenerateContentResponse(response);
      }
    })();
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    const serialized = JSON.stringify(request.contents ?? '');
    return {
      totalTokens: Math.ceil(serialized.length / 4),
    } as CountTokensResponse;
  }

  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    throw new Error(
      `Embedding is not supported by the ${this.provider.name} provider.`,
    );
  }

  private toModelRequest(
    request: GenerateContentParameters,
    promptId: string,
    role: LlmRole,
    streaming: boolean,
  ): ModelRequest {
    const config = request.config ?? {};
    return {
      model: request.model,
      contents: toContents(request.contents),
      systemInstruction: config.systemInstruction,
      tools: config.tools,
      generationConfig: config,
      abortSignal: config.abortSignal,
      promptId,
      role,
      streaming,
    };
  }
}
