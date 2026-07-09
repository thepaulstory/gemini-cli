/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  getModelProviderProfile,
  resolveModelProviderProfileConfig,
} from './providerProfiles.js';

describe('model provider profiles', () => {
  it('includes the supported Z.AI GLM models and endpoint', () => {
    const profile = getModelProviderProfile('glm');

    expect(profile?.baseUrl).toBe('https://api.z.ai/api/paas/v4');
    expect(profile?.defaultModel).toBe('glm-5.2');
    expect(profile?.models.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'glm-5.2',
        'glm-5',
        'glm-5-turbo',
        'glm-4.7',
        'glm-4.7-flashx',
        'glm-4.5-air',
      ]),
    );
  });

  it('includes GPT-OSS, Compound, and Qwen in the Groq profile', () => {
    const profile = getModelProviderProfile('groq');

    expect(profile?.baseUrl).toBe('https://api.groq.com/openai/v1');
    expect(profile?.defaultModel).toBe('openai/gpt-oss-120b');
    expect(profile?.models.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'openai/gpt-oss-120b',
        'groq/compound',
        'qwen/qwen3.6-27b',
        'qwen/qwen3-32b',
      ]),
    );
  });

  it('supports current and legacy GLM environment variable names', () => {
    expect(
      resolveModelProviderProfileConfig('glm', {
        ZAI_BASE_URL: 'https://current.example/v4',
        ZAI_API_KEY: 'current-key',
      }),
    ).toEqual(
      expect.objectContaining({
        baseUrl: 'https://current.example/v4',
        apiKey: 'current-key',
        apiKeyEnv: 'ZAI_API_KEY',
      }),
    );

    expect(
      resolveModelProviderProfileConfig('glm', {
        GLM_BASE_URL: 'https://legacy.example/v4',
        GLM_API_KEY: 'legacy-key',
      }),
    ).toEqual(
      expect.objectContaining({
        baseUrl: 'https://legacy.example/v4',
        apiKey: 'legacy-key',
        apiKeyEnv: 'GLM_API_KEY',
      }),
    );
  });
});
