/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GoogleGeminiProvider } from './google-gemini-provider.js';
import { OpenAICompatibleProvider } from './openai-compatible-provider.js';
import { LlmRole } from '../../telemetry/llmRole.js';

describe('Model Providers', () => {
  describe('GoogleGeminiProvider', () => {
    let generateContent: Mock;
    let provider: GoogleGeminiProvider;

    beforeEach(() => {
      generateContent = vi.fn();
      const mockGenerator = {
        generateContent,
        generateContentStream: vi.fn(),
        countTokens: vi.fn(),
        embedContent: vi.fn(),
      };
      provider = new GoogleGeminiProvider(mockGenerator, {});
    });

    it('should normalize Gemini response correctly', async () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Hello world' }],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      };
      generateContent.mockResolvedValue(geminiResponse);

      const request = {
        model: 'gemini-pro',
        contents: [],
        promptId: 'test-prompt',
        role: LlmRole.MAIN,
      };

      const response = await provider.generateContent(request);

      expect(response.text).toBe('Hello world');
      expect(response.usageMetadata?.totalTokenCount).toBe(15);
      expect(response.rawResponse).toBe(geminiResponse);
    });

    it('should normalize Gemini tool calls correctly', async () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'test_tool',
                    args: { arg1: 'val1' },
                    id: 'call_1',
                  },
                },
              ],
            },
          },
        ],
        functionCalls: [
          {
            name: 'test_tool',
            args: { arg1: 'val1' },
            id: 'call_1',
          },
        ],
      };
      generateContent.mockResolvedValue(geminiResponse);

      const request = {
        model: 'gemini-pro',
        contents: [],
        promptId: 'test-prompt',
        role: LlmRole.MAIN,
      };

      const response = await provider.generateContent(request);

      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls![0].name).toBe('test_tool');
      expect(response.toolCalls![0].argumentsJson).toEqual({ arg1: 'val1' });
      expect(response.toolCalls![0].id).toBe('call_1');
    });
  });

  describe('OpenAICompatibleProvider', () => {
    it('should identify itself as openai-compatible', () => {
      const provider = new OpenAICompatibleProvider({});
      expect(provider.name).toBe('openai-compatible');
    });

    it('should have correct capabilities', () => {
      const provider = new OpenAICompatibleProvider({});
      expect(provider.capabilities.supportsNativeToolCalling).toBe(true);
      expect(provider.capabilities.supportsStreaming).toBe(true);
    });
  });
});
