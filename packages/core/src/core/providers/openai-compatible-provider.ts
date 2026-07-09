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
import { type Content, type Part, type Tool } from '@google/genai';
import { debugLogger } from '../../utils/debugLogger.js';

type OpenAIRole = 'system' | 'user' | 'assistant' | 'tool';

interface OpenAIFunction {
  name?: string;
  arguments?: unknown;
}

interface OpenAIToolCall {
  id?: string;
  index?: number;
  function?: OpenAIFunction;
}

interface OpenAIResponseMessage {
  content?: string | null;
  reasoning?: string;
  reasoningContent?: string;
  toolCalls?: OpenAIToolCall[];
}

interface OpenAIChoice {
  message?: OpenAIResponseMessage;
  delta?: OpenAIResponseMessage;
  finishReason?: string | null;
}

interface OpenAIUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface OpenAIResponsePayload {
  choices: OpenAIChoice[];
  usage?: OpenAIUsage;
}

interface OpenAIRequestMessage {
  role: OpenAIRole;
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: OpenAIRequestToolCall[];
}

interface OpenAIRequestToolCall {
  id: string;
  type: 'function';
  function: {
    name?: string;
    arguments: string;
  };
}

interface OpenAIRequestTool {
  type: 'function';
  function: {
    name?: string;
    description?: string;
    parameters: unknown;
  };
}

interface OpenAIRequestBody {
  model: string;
  messages: OpenAIRequestMessage[];
  stream: boolean;
  tools?: OpenAIRequestTool[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function getNumber(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function parseToolCall(value: unknown): OpenAIToolCall | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const functionValue = value['function'];
  const functionCall = isRecord(functionValue)
    ? {
        name: getString(functionValue, 'name'),
        arguments: functionValue['arguments'],
      }
    : undefined;

  return {
    id: getString(value, 'id'),
    index: getNumber(value, 'index'),
    function: functionCall,
  };
}

function parseResponseMessage(
  value: unknown,
): OpenAIResponseMessage | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const content = value['content'];
  const rawToolCalls = value['tool_calls'];
  const toolCalls = Array.isArray(rawToolCalls)
    ? rawToolCalls
        .map(parseToolCall)
        .filter(
          (toolCall): toolCall is OpenAIToolCall => toolCall !== undefined,
        )
    : undefined;

  return {
    content:
      typeof content === 'string' || content === null ? content : undefined,
    reasoning: getString(value, 'reasoning'),
    reasoningContent: getString(value, 'reasoning_content'),
    toolCalls,
  };
}

function parseResponsePayload(value: unknown): OpenAIResponsePayload {
  if (!isRecord(value)) {
    return { choices: [] };
  }

  const rawChoices = value['choices'];
  const choices = Array.isArray(rawChoices)
    ? rawChoices.flatMap((rawChoice): OpenAIChoice[] => {
        if (!isRecord(rawChoice)) {
          return [];
        }
        const finishReason = rawChoice['finish_reason'];
        return [
          {
            message: parseResponseMessage(rawChoice['message']),
            delta: parseResponseMessage(rawChoice['delta']),
            finishReason:
              typeof finishReason === 'string' || finishReason === null
                ? finishReason
                : undefined,
          },
        ];
      })
    : [];

  const rawUsage = value['usage'];
  const usage = isRecord(rawUsage)
    ? {
        promptTokenCount: getNumber(rawUsage, 'prompt_tokens'),
        candidatesTokenCount: getNumber(rawUsage, 'completion_tokens'),
        totalTokenCount: getNumber(rawUsage, 'total_tokens'),
      }
    : undefined;

  return { choices, usage };
}

/**
 * OpenAI Compatible Model Provider.
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
    supportsThoughts: true,
  };

  constructor(
    private readonly config: {
      baseUrl?: string;
      apiKey?: string;
      model?: string;
    },
  ) {}

  async generateContent(request: ModelRequest): Promise<ModelResponse> {
    const url = this.getCompletionsUrl();
    const body = this.prepareRequestBody(request, false);
    debugLogger.debug(
      `[OpenAICompatibleProvider] generateContent model=${body.model} url=${url}`,
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal: request.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      debugLogger.error(
        `[OpenAICompatibleProvider] request failed status=${response.status}`,
      );
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data: unknown = await response.json();
    return this.normalizeResponse(data);
  }

  async generateContentStream(
    request: ModelRequest,
  ): Promise<AsyncGenerator<ModelResponse>> {
    const url = this.getCompletionsUrl();
    const body = this.prepareRequestBody(request, true);
    debugLogger.debug(
      `[OpenAICompatibleProvider] generateContentStream model=${body.model} url=${url}`,
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal: request.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      debugLogger.error(
        `[OpenAICompatibleProvider] stream request failed status=${response.status}`,
      );
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is null');
    }

    return this.parseStream(reader);
  }

  private async *parseStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ): AsyncGenerator<ModelResponse> {
    const decoder = new TextDecoder();
    let buffer = '';
    const toolCallBuffers = new Map<
      number,
      { id?: string; function: { name?: string; arguments: string } }
    >();

    const parseLine = (line: string): ModelResponse[] => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine === 'data: [DONE]') {
        return [];
      }
      if (!trimmedLine.startsWith('data:')) {
        return [];
      }

      const jsonStr = trimmedLine.substring(5).trimStart();
      if (jsonStr === '[DONE]') {
        return [];
      }

      const responses: ModelResponse[] = [];
      try {
        const rawData: unknown = JSON.parse(jsonStr);
        const data = parseResponsePayload(rawData);
        const choice = data.choices?.[0];
        const delta = choice?.delta;

        if (delta?.toolCalls) {
          for (const toolCallDelta of delta.toolCalls) {
            const index = toolCallDelta.index ?? 0;
            const existing = toolCallBuffers.get(index) ?? {
              function: { arguments: '' },
            };
            existing.id = toolCallDelta.id ?? existing.id;
            existing.function.name =
              toolCallDelta.function?.name ?? existing.function.name;
            if (typeof toolCallDelta.function?.arguments === 'string') {
              existing.function.arguments += toolCallDelta.function.arguments;
            }
            toolCallBuffers.set(index, existing);
          }
        }

        const normalized = this.normalizeStreamChunk(data);
        if (normalized.text || normalized.thought || normalized.usageMetadata) {
          responses.push({ ...normalized, finishReason: undefined });
        }

        if (choice?.finishReason) {
          const toolCalls = [...toolCallBuffers.entries()]
            .sort(([a], [b]) => a - b)
            .map(([index, toolCall]) =>
              this.normalizeToolCall({
                id: toolCall.id ?? `call_${index}`,
                function: toolCall.function,
              }),
            );

          responses.push({
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            finishReason: choice.finishReason,
            rawResponse: rawData,
          });
        }
      } catch (e) {
        debugLogger.debug('Failed to parse OpenAI stream chunk:', e);
      }

      return responses;
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          for (const response of parseLine(buffer)) {
            yield response;
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          for (const response of parseLine(line)) {
            yield response;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private getCompletionsUrl(): string {
    const base = this.config.baseUrl || 'https://api.openai.com/v1';
    return base.endsWith('/chat/completions')
      ? base
      : `${base.replace(/\/$/, '')}/chat/completions`;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  private prepareRequestBody(
    request: ModelRequest,
    stream: boolean,
  ): OpenAIRequestBody {
    const messages: OpenAIRequestMessage[] = [];

    if (request.systemInstruction) {
      messages.push({
        role: 'system',
        content: this.partToString(request.systemInstruction),
      });
    }

    for (const content of request.contents) {
      const role = content.role === 'model' ? 'assistant' : 'user';
      const parts = content.parts || [];

      const toolCalls = parts
        .filter((p) => p.functionCall)
        .map(
          (p, index): OpenAIRequestToolCall => ({
            id: p.functionCall?.id ?? `call_${index}`,
            type: 'function',
            function: {
              name: p.functionCall?.name,
              arguments: JSON.stringify(p.functionCall?.args),
            },
          }),
        );

      const toolResponses = parts.filter((p) => p.functionResponse);
      if (toolResponses.length > 0) {
        for (const tr of toolResponses) {
          messages.push({
            role: 'tool',
            tool_call_id: tr.functionResponse?.id,
            content: JSON.stringify(tr.functionResponse?.response),
          });
        }
        continue;
      }

      const text = parts
        .filter((p) => p.text)
        .map((p) => p.text)
        .join('\n');

      const message: OpenAIRequestMessage = { role };
      if (text) {
        message.content = text;
      } else if (toolCalls.length > 0) {
        message.content = null;
      }
      if (toolCalls.length > 0) message.tool_calls = toolCalls;

      messages.push(message);
    }

    const body: OpenAIRequestBody = {
      model: this.config.model || request.model,
      messages,
      stream,
    };

    const functionTools = this.supportsUserProvidedTools(
      this.config.model || request.model,
    )
      ? this.getFunctionTools(request.tools)
      : [];
    if (functionTools.length > 0) {
      body.tools = functionTools
        .flatMap((tool) => tool.functionDeclarations ?? [])
        .map(
          (declaration): OpenAIRequestTool => ({
            type: 'function',
            function: {
              name: declaration.name,
              description: declaration.description,
              parameters: this.normalizeJsonSchema(declaration.parameters),
            },
          }),
        )
        .filter((t) => t.function.name);
    }

    if (request.generationConfig) {
      if (request.generationConfig.temperature !== undefined)
        body.temperature = request.generationConfig.temperature;
      if (request.generationConfig.topP !== undefined)
        body.top_p = request.generationConfig.topP;
      if (request.generationConfig.maxOutputTokens !== undefined)
        body.max_tokens = request.generationConfig.maxOutputTokens;
      if (request.generationConfig.stopSequences !== undefined)
        body.stop = request.generationConfig.stopSequences;
    }

    return body;
  }

  private normalizeJsonSchema(schema: unknown): unknown {
    if (!schema || typeof schema !== 'object') {
      return { type: 'object', properties: {} };
    }

    if (Array.isArray(schema)) {
      return schema.map((item) => this.normalizeJsonSchema(item));
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema)) {
      if (key === 'propertyOrdering') {
        continue;
      }

      if (key === 'type') {
        if (typeof value === 'string') {
          result[key] = value.toLowerCase();
        } else if (Array.isArray(value)) {
          result[key] = value.map((item: unknown) =>
            typeof item === 'string' ? item.toLowerCase() : item,
          );
        } else {
          result[key] = value;
        }
        continue;
      }

      if (
        key === 'properties' &&
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        result[key] = Object.fromEntries(
          Object.entries(value).map(([propertyName, propertySchema]) => [
            propertyName,
            this.normalizeJsonSchema(propertySchema),
          ]),
        );
        continue;
      }

      if (key === 'items' || key === 'additionalProperties') {
        result[key] =
          value && typeof value === 'object'
            ? this.normalizeJsonSchema(value)
            : value;
        continue;
      }

      if (
        (key === 'anyOf' || key === 'oneOf' || key === 'allOf') &&
        Array.isArray(value)
      ) {
        result[key] = value.map((item) => this.normalizeJsonSchema(item));
        continue;
      }

      result[key] = value;
    }

    return result;
  }

  private getFunctionTools(tools: ModelRequest['tools']): Tool[] {
    return (tools ?? []).filter(
      (tool): tool is Tool =>
        'functionDeclarations' in tool &&
        Array.isArray(tool.functionDeclarations),
    );
  }

  private supportsUserProvidedTools(model: string): boolean {
    return model !== 'groq/compound' && model !== 'groq/compound-mini';
  }

  private partToString(
    part: string | Part | Array<string | Part> | Content,
  ): string {
    if (typeof part === 'string') return part;
    if (Array.isArray(part)) {
      return part
        .map((p) => (typeof p === 'string' ? p : p.text || ''))
        .join('\n');
    }
    if ('parts' in part)
      return (part.parts || []).map((p) => p.text || '').join('\n');
    return 'text' in part ? part.text || '' : '';
  }

  private normalizeResponse(rawData: unknown): ModelResponse {
    const data = parseResponsePayload(rawData);
    const choice = data.choices[0];
    const message = choice?.message;

    return {
      text: message?.content ?? undefined,
      thought: message?.reasoning ?? message?.reasoningContent,
      toolCalls: message?.toolCalls?.map((toolCall) =>
        this.normalizeToolCall(toolCall),
      ),
      finishReason: choice?.finishReason ?? undefined,
      usageMetadata: data.usage
        ? {
            promptTokenCount: data.usage.promptTokenCount,
            candidatesTokenCount: data.usage.candidatesTokenCount,
            totalTokenCount: data.usage.totalTokenCount,
          }
        : undefined,
      rawResponse: rawData,
    };
  }

  private normalizeStreamChunk(rawData: unknown): ModelResponse {
    const data = parseResponsePayload(rawData);
    const choice = data.choices[0];
    const delta = choice?.delta;

    return {
      text: delta?.content ?? undefined,
      thought: delta?.reasoning ?? delta?.reasoningContent,
      toolCalls: delta?.toolCalls?.map((toolCall) =>
        this.normalizeToolCall(toolCall),
      ),
      finishReason: choice?.finishReason ?? undefined,
      usageMetadata: data.usage
        ? {
            promptTokenCount: data.usage.promptTokenCount,
            candidatesTokenCount: data.usage.candidatesTokenCount,
            totalTokenCount: data.usage.totalTokenCount,
          }
        : undefined,
      rawResponse: rawData,
    };
  }

  private normalizeToolCall(toolCall: OpenAIToolCall): NormalizedToolCall {
    let argumentsJson: unknown;
    let parseError: string | undefined;
    const providerArguments = toolCall.function?.arguments;
    const rawArguments =
      typeof providerArguments === 'string'
        ? providerArguments
        : providerArguments === undefined
          ? undefined
          : JSON.stringify(providerArguments);
    try {
      argumentsJson =
        typeof providerArguments === 'string'
          ? JSON.parse(providerArguments || '{}')
          : providerArguments;
    } catch (e) {
      parseError = e instanceof Error ? e.message : String(e);
    }

    return {
      id: toolCall.id ?? '',
      name: toolCall.function?.name ?? '',
      argumentsJson,
      rawArguments,
      providerName: this.name,
      parseError,
    };
  }
}
