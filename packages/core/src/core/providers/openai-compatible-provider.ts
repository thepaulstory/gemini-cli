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
import { type Content, type Part } from '@google/genai';

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

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal: request.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return this.normalizeResponse(data);
  }

  async *generateContentStream(
    request: ModelRequest,
  ): Promise<AsyncGenerator<ModelResponse>> {
    const url = this.getCompletionsUrl();
    const body = this.prepareRequestBody(request, true);

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal: request.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is null');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

          if (trimmedLine.startsWith('data: ')) {
            const jsonStr = trimmedLine.substring(6);
            try {
              const data = JSON.parse(jsonStr);
              yield this.normalizeStreamChunk(data);
            } catch (e) {
              console.error('Failed to parse OpenAI stream chunk:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private getCompletionsUrl(): string {
    const base = this.config.baseUrl || 'https://api.openai.com/v1';
    return base.endsWith('/chat/completions') ? base : `${base.replace(/\/$/, '')}/chat/completions`;
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

  private prepareRequestBody(request: ModelRequest, stream: boolean): any {
    const messages: any[] = [];

    if (request.systemInstruction) {
      messages.push({
        role: 'system',
        content: this.partToString(request.systemInstruction),
      });
    }

    for (const content of request.contents) {
      const role = content.role === 'model' ? 'assistant' : 'user';
      const parts = content.parts || [];

      const toolCalls = parts.filter(p => p.functionCall).map(p => ({
        id: p.functionCall?.id,
        type: 'function',
        function: {
          name: p.functionCall?.name,
          arguments: JSON.stringify(p.functionCall?.args),
        }
      }));

      const toolResponses = parts.filter(p => p.functionResponse);
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

      const text = parts.filter(p => p.text).map(p => p.text).join('\n');

      const message: any = { role };
      if (text) message.content = text;
      if (toolCalls.length > 0) message.tool_calls = toolCalls;

      messages.push(message);
    }

    const body: any = {
      model: this.config.model || request.model,
      messages,
      stream,
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map(t => ({
        type: 'function',
        function: {
          name: t.functionDeclarations?.[0]?.name,
          description: t.functionDeclarations?.[0]?.description,
          parameters: t.functionDeclarations?.[0]?.parameters,
        }
      })).filter(t => t.function.name);
    }

    if (request.generationConfig) {
      if (request.generationConfig.temperature !== undefined) body.temperature = request.generationConfig.temperature;
      if (request.generationConfig.topP !== undefined) body.top_p = request.generationConfig.topP;
      if (request.generationConfig.maxOutputTokens !== undefined) body.max_tokens = request.generationConfig.maxOutputTokens;
      if (request.generationConfig.stopSequences !== undefined) body.stop = request.generationConfig.stopSequences;
    }

    return body;
  }

  private partToString(part: string | Part | Part[] | Content): string {
    if (typeof part === 'string') return part;
    if (Array.isArray(part)) return part.map(p => p.text || '').join('\n');
    if ('parts' in part) return (part.parts || []).map(p => p.text || '').join('\n');
    return part.text || '';
  }

  private normalizeResponse(data: any): ModelResponse {
    const choice = data.choices?.[0];
    const message = choice?.message;

    return {
      text: message?.content || undefined,
      toolCalls: message?.tool_calls?.map((tc: any) => this.normalizeToolCall(tc)),
      finishReason: choice?.finish_reason,
      usageMetadata: data.usage ? {
        promptTokenCount: data.usage.prompt_tokens,
        candidatesTokenCount: data.usage.completion_tokens,
        totalTokenCount: data.usage.total_tokens,
      } : undefined,
      rawResponse: data,
    };
  }

  private normalizeStreamChunk(data: any): ModelResponse {
    const choice = data.choices?.[0];
    const delta = choice?.delta;

    return {
      text: delta?.content || undefined,
      toolCalls: delta?.tool_calls?.map((tc: any) => this.normalizeToolCall(tc)),
      finishReason: choice?.finish_reason,
      usageMetadata: data.usage ? {
        promptTokenCount: data.usage.prompt_tokens,
        candidatesTokenCount: data.usage.completion_tokens,
        totalTokenCount: data.usage.total_tokens,
      } : undefined,
      rawResponse: data,
    };
  }

  private normalizeToolCall(tc: any): NormalizedToolCall {
    let argumentsJson: any;
    try {
      argumentsJson = typeof tc.function.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function.arguments;
    } catch (e) {
      // For streaming, arguments arrive in chunks. We'll handle partial JSON downstream if needed
      // but for now we just store the raw string if it fails to parse
    }

    return {
      id: tc.id,
      name: tc.function.name,
      argumentsJson,
      rawArguments: tc.function.arguments,
      providerName: this.name,
    };
  }
}
