/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type Content,
  type Part,
  type Tool,
  type GenerateContentResponse,
  type GenerationConfig,
} from '@google/genai';
import { type LlmRole } from '../telemetry/llmRole.js';

/**
 * Normalized tool call structure.
 */
export interface NormalizedToolCall {
  id: string;
  name: string;
  argumentsJson?: unknown;
  rawArguments?: string;
  providerName: string;
  providerMetadata?: unknown;
  parseError?: string;
}

/**
 * Capabilities supported by a model provider.
 */
export interface ProviderCapabilities {
  supportsNativeToolCalling: boolean;
  supportsStreaming: boolean;
  supportsSystemInstruction: boolean;
  supportsJsonSchemaTools: boolean;
  supportsToolChoice: boolean;
  supportsUsageMetadata: boolean;
  supportsThoughts?: boolean;
}

/**
 * Normalized model request parameters.
 */
export interface ModelRequest {
  model: string;
  contents: Content[];
  systemInstruction?: string | Part | Part[] | Content;
  tools?: Tool[];
  generationConfig?: GenerationConfig;
  abortSignal?: AbortSignal;
  promptId: string;
  role: LlmRole;
  streaming?: boolean;
  /** Provider-specific options as an escape hatch */
  providerOptions?: Record<string, unknown>;
}

/**
 * Normalized model response.
 */
export interface ModelResponse {
  text?: string;
  toolCalls?: NormalizedToolCall[];
  finishReason?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  /** Provider-specific raw response for debug or specialized handling */
  rawResponse?: unknown;
}

/**
 * Interface for a Model Provider.
 */
export interface ModelProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  generateContent(
    request: ModelRequest,
  ): Promise<ModelResponse>;

  generateContentStream(
    request: ModelRequest,
  ): Promise<AsyncGenerator<ModelResponse>>;
}

/**
 * Utility to convert ModelResponse back to GenerateContentResponse for backward compatibility.
 */
export function toGenerateContentResponse(response: ModelResponse): GenerateContentResponse {
    // Only return rawResponse directly for Google provider to maintain full compatibility.
    // For other providers, we must use the normalized fields.
    if (response.rawResponse && (response.rawResponse as any).candidates) {
        return response.rawResponse as GenerateContentResponse;
    }

    const parts: Part[] = [];
    if (response.text) {
        parts.push({ text: response.text });
    }
    if (response.toolCalls) {
        for (const tc of response.toolCalls) {
            parts.push({
                functionCall: {
                    name: tc.name,
                    args: tc.argumentsJson as any,
                    id: tc.id,
                }
            });
        }
    }

    return {
        candidates: [
            {
                content: {
                    role: 'model',
                    parts,
                },
                finishReason: response.finishReason as any,
            }
        ],
        usageMetadata: response.usageMetadata as any,
    } as GenerateContentResponse;
}
