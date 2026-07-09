/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAICompatibleProvider } from './openai-compatible-provider.js';
import { LlmRole } from '../../telemetry/llmRole.js';
import { toGenerateContentResponse } from '../model-provider.js';
import { Type } from '@google/genai';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mockJsonResponse(body: unknown): void {
  vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function mockStreamResponse(body: ReadableStream<Uint8Array>): void {
  vi.mocked(fetch).mockResolvedValue(new Response(body, { status: 200 }));
}

function getRequestBody(): Record<string, unknown> {
  const requestBody = vi.mocked(fetch).mock.calls[0]?.[1]?.body;
  if (typeof requestBody !== 'string') {
    throw new Error('Expected fetch to receive a JSON string body.');
  }

  const parsed: unknown = JSON.parse(requestBody);
  if (!isRecord(parsed)) {
    throw new Error('Expected fetch body to contain a JSON object.');
  }
  return parsed;
}

describe('OpenAICompatibleProvider', () => {
  let provider: OpenAICompatibleProvider;
  const mockApiKey = 'test-api-key';
  const mockBaseUrl = 'https://api.example.com/v1';
  const mockModel = 'test-model';

  beforeEach(() => {
    provider = new OpenAICompatibleProvider({
      apiKey: mockApiKey,
      baseUrl: mockBaseUrl,
      model: mockModel,
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should send correct request to OpenAI API', async () => {
    const mockResponse = {
      choices: [
        {
          message: { content: 'Hello!' },
          finish_reason: 'stop',
        },
      ],
      usage: { total_tokens: 10 },
    };
    mockJsonResponse(mockResponse);

    const request = {
      model: 'ignore-me',
      contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
      promptId: 'test',
      role: LlmRole.MAIN,
    };

    const response = await provider.generateContent(request);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/chat/completions'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockApiKey}`,
        }),
        body: expect.stringContaining(mockModel),
      }),
    );
    expect(response.text).toBe('Hello!');
  });

  it('should convert OpenAI raw metadata into a Gemini-shaped response', async () => {
    const mockResponse = {
      choices: [
        {
          message: { content: 'Hello from OpenAI-compatible' },
          finish_reason: 'stop',
        },
      ],
    };
    mockJsonResponse(mockResponse);

    const response = await provider.generateContent({
      model: mockModel,
      contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
      promptId: 'test',
      role: LlmRole.MAIN,
    });
    const geminiResponse = toGenerateContentResponse(response);

    expect(geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text).toBe(
      'Hello from OpenAI-compatible',
    );
  });

  it('should handle tool calls in response', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            tool_calls: [
              {
                id: 'call_1',
                function: {
                  name: 'get_weather',
                  arguments: '{"city":"London"}',
                },
              },
            ],
          },
        },
      ],
    };
    mockJsonResponse(mockResponse);

    const request = {
      model: mockModel,
      contents: [],
      promptId: 'test',
      role: LlmRole.MAIN,
    };

    const response = await provider.generateContent(request);

    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls![0].name).toBe('get_weather');
    expect(response.toolCalls![0].argumentsJson).toEqual({ city: 'London' });
  });

  it('should handle object-valued tool arguments returned by GLM', async () => {
    mockJsonResponse({
      choices: [
        {
          message: {
            tool_calls: [
              {
                id: 'call_1',
                function: {
                  name: 'read_file',
                  arguments: { file_path: 'README.md' },
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    });

    const response = await provider.generateContent({
      model: 'glm-5.2',
      contents: [],
      promptId: 'test',
      role: LlmRole.MAIN,
    });

    expect(response.toolCalls?.[0]).toEqual(
      expect.objectContaining({
        name: 'read_file',
        argumentsJson: { file_path: 'README.md' },
        rawArguments: '{"file_path":"README.md"}',
      }),
    );
  });

  it('should format tool calls and responses in request', async () => {
    mockJsonResponse({ choices: [] });

    const request = {
      model: mockModel,
      contents: [
        {
          role: 'model',
          parts: [
            {
              functionCall: { name: 'test_tool', args: { x: 1 }, id: 'id1' },
            },
          ],
        },
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: 'test_tool',
                response: { result: 'ok' },
                id: 'id1',
              },
            },
          ],
        },
      ],
      promptId: 'test',
      role: LlmRole.MAIN,
    };

    await provider.generateContent(request);

    expect(getRequestBody()).toMatchObject({
      messages: [
        {
          role: 'assistant',
          content: null,
          tool_calls: [expect.objectContaining({ id: 'id1' })],
        },
        {
          role: 'tool',
          tool_call_id: 'id1',
        },
      ],
    });
  });

  it('should normalize Gemini tool schemas for OpenAI-compatible APIs', async () => {
    mockJsonResponse({ choices: [] });

    await provider.generateContent({
      model: mockModel,
      contents: [{ role: 'user', parts: [{ text: 'Use the tool' }] }],
      tools: [
        {
          functionDeclarations: [
            {
              name: 'search_files',
              description: 'Search files',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  query: { type: Type.STRING },
                  filters: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['query'],
                propertyOrdering: ['query', 'filters'],
              },
            },
          ],
        },
      ],
      promptId: 'test',
      role: LlmRole.MAIN,
    });

    expect(getRequestBody()).toMatchObject({
      tools: [
        {
          function: {
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                filters: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['query'],
            },
          },
        },
      ],
    });
  });

  it('should omit user-provided tools for Groq Compound', async () => {
    provider = new OpenAICompatibleProvider({
      apiKey: mockApiKey,
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'groq/compound',
    });
    mockJsonResponse({
      choices: [{ message: { content: 'Compound response' } }],
    });

    await provider.generateContent({
      model: 'groq/compound',
      contents: [{ role: 'user', parts: [{ text: 'Search the web' }] }],
      tools: [
        {
          functionDeclarations: [
            {
              name: 'local_tool',
              description: 'A local tool Compound does not accept',
            },
          ],
        },
      ],
      promptId: 'test',
      role: LlmRole.MAIN,
    });

    expect(getRequestBody()).not.toHaveProperty('tools');
  });

  it('should assemble streamed tool call argument chunks before exposing the call', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"get_weather","arguments":"{\\"city\\""}}]}}]}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":":\\"London\\"}"}}]},"finish_reason":"tool_calls"}]}\n\n',
          ),
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    mockStreamResponse(stream);

    const responseStream = await provider.generateContentStream({
      model: mockModel,
      contents: [],
      promptId: 'test',
      role: LlmRole.MAIN,
    });
    const responses = [];
    for await (const response of responseStream) {
      responses.push(response);
    }

    expect(responses).toHaveLength(1);
    expect(responses[0].toolCalls?.[0]).toEqual(
      expect.objectContaining({
        id: 'call_1',
        name: 'get_weather',
        argumentsJson: { city: 'London' },
      }),
    );
  });

  it('should parse streamed text chunks without a trailing newline', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            'data:{"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n' +
              'data:{"choices":[{"delta":{},"finish_reason":"stop"}]}',
          ),
        );
        controller.close();
      },
    });
    mockStreamResponse(stream);

    const responseStream = await provider.generateContentStream({
      model: mockModel,
      contents: [],
      promptId: 'test',
      role: LlmRole.MAIN,
    });
    const responses = [];
    for await (const response of responseStream) {
      responses.push(response);
    }

    expect(responses[0].text).toBe('Hello');
    expect(responses[1].finishReason).toBe('stop');
  });

  it('should convert Groq reasoning deltas into Gemini thought parts', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"reasoning":"The user is asking"},"finish_reason":null}]}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
          ),
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    mockStreamResponse(stream);

    const responseStream = await provider.generateContentStream({
      model: mockModel,
      contents: [],
      promptId: 'test',
      role: LlmRole.MAIN,
    });
    const responses = [];
    for await (const response of responseStream) {
      responses.push(response);
    }

    expect(responses[0].thought).toBe('The user is asking');
    const geminiResponse = toGenerateContentResponse(responses[0]);
    expect(geminiResponse.candidates?.[0]?.content?.parts?.[0]).toEqual({
      text: 'The user is asking',
      thought: true,
    });
  });

  it('should expose normalized tool calls as top-level Gemini functionCalls', async () => {
    const response = toGenerateContentResponse({
      toolCalls: [
        {
          id: 'call_1',
          name: 'read_file',
          argumentsJson: {
            file_path: 'C:\\DEV\\gemini-cli\\.gemini\\settings.json',
          },
          rawArguments:
            '{"file_path":"C:\\\\DEV\\\\gemini-cli\\\\.gemini\\\\settings.json"}',
          providerName: 'openai-compatible',
        },
      ],
      finishReason: 'tool_calls',
    });

    expect(response.functionCalls?.[0]).toEqual({
      id: 'call_1',
      name: 'read_file',
      args: { file_path: 'C:\\DEV\\gemini-cli\\.gemini\\settings.json' },
    });
    expect(response.candidates?.[0]?.content?.parts?.[0]?.functionCall).toEqual(
      response.functionCalls?.[0],
    );
  });
});
