/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FinishReason,
  GenerateContentResponse,
  type Content,
  type FunctionCall,
  type Part,
  type GenerateContentConfig,
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
  systemInstruction?: GenerateContentConfig['systemInstruction'];
  tools?: GenerateContentConfig['tools'];
  generationConfig?: GenerateContentConfig;
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
  thought?: string;
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

  generateContent(request: ModelRequest): Promise<ModelResponse>;

  generateContentStream(
    request: ModelRequest,
  ): Promise<AsyncGenerator<ModelResponse>>;
}

function isGenerateContentResponse(
  response: unknown,
): response is GenerateContentResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'candidates' in response &&
    !('choices' in response)
  );
}

/**
 * Utility to convert ModelResponse back to GenerateContentResponse for backward compatibility.
 */
export function toGenerateContentResponse(
  response: ModelResponse,
): GenerateContentResponse {
  if (isGenerateContentResponse(response.rawResponse)) {
    return response.rawResponse;
  }

  const parts: Part[] = [];
  if (response.thought) {
    parts.push({ text: response.thought, thought: true });
  }
  if (response.text) {
    parts.push({ text: response.text });
  }
  const functionCalls: FunctionCall[] = (response.toolCalls ?? [])
    .filter((tc) => !tc.parseError)
    .map((tc) => ({
      name: tc.name,
      args: isRecord(tc.argumentsJson) ? tc.argumentsJson : undefined,
      id: tc.id,
    }));
  for (const functionCall of functionCalls) {
    parts.push({ functionCall });
  }

  const result = new GenerateContentResponse();
  result.candidates = [
    {
      content: {
        role: 'model',
        parts,
      },
      finishReason: toFinishReason(response.finishReason),
    },
  ];
  result.usageMetadata = response.usageMetadata;
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toFinishReason(reason: string | undefined): FinishReason | undefined {
  switch (reason?.toLowerCase()) {
    case 'stop':
    case 'tool_calls':
    case 'function_call':
      return FinishReason.STOP;
    case 'length':
    case 'max_tokens':
      return FinishReason.MAX_TOKENS;
    case 'content_filter':
      return FinishReason.SAFETY;
    case undefined:
      return undefined;
    default:
      return FinishReason.OTHER;
  }
}
