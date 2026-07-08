/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAICompatibleProvider } from './openai-compatible-provider.js';
import { LlmRole } from '../../telemetry/llmRole.js';

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
      choices: [{
        message: { content: 'Hello!' },
        finish_reason: 'stop'
      }],
      usage: { total_tokens: 10 }
    };
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const request = {
      model: 'ignore-me',
      contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
      promptId: 'test',
      role: LlmRole.USER,
    };

    const response = await provider.generateContent(request);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/chat/completions'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': `Bearer ${mockApiKey}`,
        }),
        body: expect.stringContaining(mockModel),
      })
    );
    expect(response.text).toBe('Hello!');
  });

  it('should handle tool calls in response', async () => {
    const mockResponse = {
      choices: [{
        message: {
          tool_calls: [{
            id: 'call_1',
            function: { name: 'get_weather', arguments: '{"city":"London"}' }
          }]
        }
      }]
    };
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const request = {
      model: mockModel,
      contents: [],
      promptId: 'test',
      role: LlmRole.USER,
    };

    const response = await provider.generateContent(request);

    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls![0].name).toBe('get_weather');
    expect(response.toolCalls![0].argumentsJson).toEqual({ city: 'London' });
  });

  it('should format tool calls and responses in request', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [] })
      });

      const request = {
        model: mockModel,
        contents: [
            {
                role: 'model',
                parts: [{
                    functionCall: { name: 'test_tool', args: { x: 1 }, id: 'id1' }
                }]
            },
            {
                role: 'user',
                parts: [{
                    functionResponse: { name: 'test_tool', response: { result: 'ok' }, id: 'id1' }
                }]
            }
        ],
        promptId: 'test',
        role: LlmRole.USER,
      };

      await provider.generateContent(request);

      const fetchArgs = (fetch as any).mock.calls[0][1];
      const body = JSON.parse(fetchArgs.body);

      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('assistant');
      expect(body.messages[0].tool_calls).toHaveLength(1);
      expect(body.messages[1].role).toBe('tool');
      expect(body.messages[1].tool_call_id).toBe('id1');
  });
});
