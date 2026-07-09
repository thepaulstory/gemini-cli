/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@google/gemini-cli-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateAuthMethod } from './auth.js';

vi.mock('@google/gemini-cli-core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@google/gemini-cli-core')>();
  return {
    ...actual,
    loadApiKey: vi.fn().mockResolvedValue(null),
  };
});

vi.mock('./settings.js', () => ({
  loadEnvironment: vi.fn(),
  loadSettings: vi.fn().mockReturnValue({
    merged: vi.fn().mockReturnValue({}),
  }),
}));

describe('validateAuthMethod', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', undefined);
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', undefined);
    vi.stubEnv('GOOGLE_CLOUD_LOCATION', undefined);
    vi.stubEnv('GOOGLE_API_KEY', undefined);
    vi.stubEnv('AI_PROVIDER', '');
    vi.stubEnv('AI_MODEL', '');
    vi.stubEnv('AI_BASE_URL', '');
    vi.stubEnv('AI_API_KEY', '');
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('LLM_MODEL', '');
    vi.stubEnv('LLM_BASE_URL', '');
    vi.stubEnv('LLM_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubEnv('DEEPSEEK_API_KEY', '');
    vi.stubEnv('DASHSCOPE_API_KEY', '');
    vi.stubEnv('DASHSCOPE_BASE_URL', '');
    vi.stubEnv('MOONSHOT_API_KEY', '');
    vi.stubEnv('KIMI_API_KEY', '');
    vi.stubEnv('KIMI_BASE_URL', '');
    vi.stubEnv('GLM_API_KEY', '');
    vi.stubEnv('GLM_BASE_URL', '');
    vi.stubEnv('ZAI_API_KEY', '');
    vi.stubEnv('BIGMODEL_API_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    {
      description: 'should return null for LOGIN_WITH_GOOGLE',
      authType: AuthType.LOGIN_WITH_GOOGLE,
      envs: {},
      expected: null,
    },
    {
      description: 'should return null for COMPUTE_ADC',
      authType: AuthType.COMPUTE_ADC,
      envs: {},
      expected: null,
    },
    {
      description: 'should return null for USE_GEMINI if GEMINI_API_KEY is set',
      authType: AuthType.USE_GEMINI,
      envs: { GEMINI_API_KEY: 'test-key' },
      expected: null,
    },
    {
      description:
        'should return an error message for USE_GEMINI if GEMINI_API_KEY is not set',
      authType: AuthType.USE_GEMINI,
      envs: {},
      expected:
        'When using Gemini API, you must specify the GEMINI_API_KEY environment variable.\n' +
        'Update your environment and try again (no reload needed if using .env)!',
    },
    {
      description:
        'should return null for USE_VERTEX_AI if GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION are set',
      authType: AuthType.USE_VERTEX_AI,
      envs: {
        GOOGLE_CLOUD_PROJECT: 'test-project',
        GOOGLE_CLOUD_LOCATION: 'test-location',
      },
      expected: null,
    },
    {
      description:
        'should return null for USE_VERTEX_AI if GOOGLE_API_KEY is set',
      authType: AuthType.USE_VERTEX_AI,
      envs: { GOOGLE_API_KEY: 'test-api-key' },
      expected: null,
    },
    {
      description:
        'should return an error message for USE_VERTEX_AI if no required environment variables are set',
      authType: AuthType.USE_VERTEX_AI,
      envs: {},
      expected:
        'When using Vertex AI, you must specify either:\n' +
        '• GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION environment variables.\n' +
        '• GOOGLE_API_KEY environment variable (if using express mode).\n' +
        'Update your environment and try again (no reload needed if using .env)!',
    },
    {
      description:
        'should return null for OPENAI_COMPATIBLE if GROQ_API_KEY is set',
      authType: AuthType.OPENAI_COMPATIBLE,
      envs: { GROQ_API_KEY: 'test-groq-key' },
      expected: null,
    },
    {
      description:
        'should return null for OPENAI_COMPATIBLE if custom base URL and key are set',
      authType: AuthType.OPENAI_COMPATIBLE,
      envs: {
        LLM_BASE_URL: 'https://api.example.com/v1',
        LLM_API_KEY: 'test-openai-key',
      },
      expected: null,
    },
    {
      description:
        'should return an error message for OPENAI_COMPATIBLE if no provider configuration is set',
      authType: AuthType.OPENAI_COMPATIBLE,
      envs: {},
      expected:
        'When using OpenAI-compatible auth, you must specify LLM_BASE_URL ' +
        'or choose a provider profile with a built-in base URL.',
    },
    {
      description: 'should return an error message for an invalid auth method',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authType: 'invalid-method' as any,
      envs: {},
      expected: 'Invalid auth method selected.',
    },
  ])('$description', async ({ authType, envs, expected }) => {
    for (const [key, value] of Object.entries(envs)) {
      vi.stubEnv(key, value as string);
    }
    expect(await validateAuthMethod(authType)).toBe(expected);
  });
});
