/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { debugLogger } from '../utils/debugLogger.js';

export type ModelProviderName = 'google' | 'openai-compatible';

export interface ModelProviderProfileModel {
  id: string;
  displayName?: string;
  description?: string;
}

export interface ModelProviderProfile {
  id: string;
  displayName: string;
  provider: ModelProviderName;
  description?: string;
  baseUrl?: string;
  baseUrlEnv?: string;
  baseUrlEnvVars?: string[];
  apiKeyEnvVars?: string[];
  defaultModel?: string;
  models: ModelProviderProfileModel[];
}

export interface ModelProviderRuntimeConfig {
  provider: ModelProviderName;
  profile?: string;
  displayName?: string;
  baseUrl?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  model?: string;
}

export interface ResolveModelProviderConfigOptions {
  /**
   * Profile to use when no provider environment variable is set.
   * The default keeps Gemini CLI's normal Google behavior.
   */
  defaultProfile?: string;
  /**
   * Allows explicit OpenAI-compatible auth to infer a built-in profile from a
   * provider-specific API key such as GROQ_API_KEY.
   */
  inferProfileFromApiKey?: boolean;
}

const GOOGLE_PROFILE: ModelProviderProfile = {
  id: 'google',
  displayName: 'Google Gemini',
  provider: 'google',
  description: 'Default Gemini provider using the existing Google auth paths.',
  defaultModel: 'auto',
  models: [
    {
      id: 'auto',
      displayName: 'Auto',
      description: 'Use the CLI default Gemini model routing.',
    },
    {
      id: 'gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
    },
    {
      id: 'gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
    },
    {
      id: 'gemini-2.5-flash-lite',
      displayName: 'Gemini 2.5 Flash Lite',
    },
  ],
};

export const MODEL_PROVIDER_PROFILES: readonly ModelProviderProfile[] = [
  GOOGLE_PROFILE,
  {
    id: 'groq',
    displayName: 'Groq',
    provider: 'openai-compatible',
    description: 'OpenAI-compatible Groq chat completions endpoint.',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnvVars: ['GROQ_API_KEY'],
    defaultModel: 'openai/gpt-oss-120b',
    models: [
      {
        id: 'openai/gpt-oss-120b',
        displayName: 'GPT-OSS 120B',
        description:
          'High-capability reasoning and tool-use model hosted by Groq.',
      },
      {
        id: 'groq/compound',
        displayName: 'Groq Compound',
        description:
          'Groq agentic system with server-side web search and code execution.',
      },
      {
        id: 'qwen/qwen3.6-27b',
        displayName: 'Qwen 3.6 27B',
        description: 'Fast Qwen model hosted by Groq.',
      },
      {
        id: 'qwen/qwen3-32b',
        displayName: 'Qwen 3 32B',
        description: 'Qwen model with parallel tool-use support on Groq.',
      },
    ],
  },
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    provider: 'openai-compatible',
    description: 'DeepSeek OpenAI-compatible chat completions endpoint.',
    baseUrl: 'https://api.deepseek.com',
    apiKeyEnvVars: ['DEEPSEEK_API_KEY'],
    defaultModel: 'deepseek-v4-pro',
    models: [
      {
        id: 'deepseek-v4-pro',
        displayName: 'DeepSeek V4 Pro',
      },
      {
        id: 'deepseek-v4-flash',
        displayName: 'DeepSeek V4 Flash',
      },
    ],
  },
  {
    id: 'qwen',
    displayName: 'Qwen DashScope',
    provider: 'openai-compatible',
    description: 'DashScope OpenAI-compatible endpoint for Qwen models.',
    baseUrl: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1',
    baseUrlEnv: 'DASHSCOPE_BASE_URL',
    apiKeyEnvVars: ['DASHSCOPE_API_KEY'],
    defaultModel: 'qwen-plus',
    models: [
      {
        id: 'qwen-plus',
        displayName: 'Qwen Plus',
      },
      {
        id: 'qwen-max',
        displayName: 'Qwen Max',
      },
    ],
  },
  {
    id: 'kimi',
    displayName: 'Kimi',
    provider: 'openai-compatible',
    description: 'Moonshot/Kimi OpenAI-compatible endpoint.',
    baseUrl: 'https://api.moonshot.ai/v1',
    baseUrlEnv: 'KIMI_BASE_URL',
    apiKeyEnvVars: ['MOONSHOT_API_KEY', 'KIMI_API_KEY'],
    defaultModel: 'kimi-k2-0711-preview',
    models: [
      {
        id: 'kimi-k2-0711-preview',
        displayName: 'Kimi K2',
      },
      {
        id: 'moonshot-v1-128k',
        displayName: 'Moonshot 128K',
      },
    ],
  },
  {
    id: 'glm',
    displayName: 'Z.AI / GLM',
    provider: 'openai-compatible',
    description:
      'Z.AI OpenAI-compatible endpoint for current GLM coding and reasoning models.',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    baseUrlEnv: 'ZAI_BASE_URL',
    baseUrlEnvVars: ['ZAI_BASE_URL', 'GLM_BASE_URL'],
    apiKeyEnvVars: ['ZAI_API_KEY', 'GLM_API_KEY', 'BIGMODEL_API_KEY'],
    defaultModel: 'glm-5.2',
    models: [
      {
        id: 'glm-5.2',
        displayName: 'GLM 5.2',
        description: 'Flagship long-horizon coding model with 1M context.',
      },
      {
        id: 'glm-5',
        displayName: 'GLM 5',
      },
      {
        id: 'glm-5-turbo',
        displayName: 'GLM 5 Turbo',
      },
      {
        id: 'glm-4.7',
        displayName: 'GLM 4.7',
      },
      {
        id: 'glm-4.7-flashx',
        displayName: 'GLM 4.7 FlashX',
      },
      {
        id: 'glm-4.5-air',
        displayName: 'GLM 4.5 Air',
      },
    ],
  },
  {
    id: 'openai-compatible',
    displayName: 'Custom OpenAI-Compatible',
    provider: 'openai-compatible',
    description: 'Uses LLM_BASE_URL plus LLM_API_KEY or OPENAI_API_KEY.',
    baseUrlEnv: 'LLM_BASE_URL',
    apiKeyEnvVars: ['LLM_API_KEY', 'OPENAI_API_KEY'],
    models: [],
  },
];

export function getModelProviderProfile(
  profileId: string | undefined,
): ModelProviderProfile | undefined {
  if (!profileId) {
    return undefined;
  }
  return MODEL_PROVIDER_PROFILES.find((profile) => profile.id === profileId);
}

export function getAllModelProviderProfiles(): readonly ModelProviderProfile[] {
  return MODEL_PROVIDER_PROFILES;
}

function readEnv(
  env: Record<string, string | undefined>,
  keys: readonly string[],
): { key: string; value: string } | undefined {
  for (const key of keys) {
    const value = env[key];
    if (value) {
      return { key, value };
    }
  }
  return undefined;
}

function profileFromProviderValue(
  providerValue: string | undefined,
  env: Record<string, string | undefined> = process.env,
  options: ResolveModelProviderConfigOptions = {},
): ModelProviderProfile | undefined {
  if (!providerValue) {
    if (
      options.defaultProfile &&
      (env['AI_BASE_URL'] ||
        env['LLM_BASE_URL'] ||
        env['AI_API_KEY'] ||
        env['LLM_API_KEY'])
    ) {
      return getModelProviderProfile(options.defaultProfile);
    }
    if (options.inferProfileFromApiKey) {
      const inferredProfile = inferProfileFromEnv(env);
      if (inferredProfile) {
        return inferredProfile;
      }
    }
    if (options.defaultProfile) {
      return getModelProviderProfile(options.defaultProfile);
    }
    return GOOGLE_PROFILE;
  }

  const normalized = providerValue.trim().toLowerCase();
  if (normalized === 'gemini') {
    return GOOGLE_PROFILE;
  }
  if (normalized === 'openai' || normalized === 'custom') {
    return getModelProviderProfile('openai-compatible');
  }

  const byId = getModelProviderProfile(normalized);
  if (byId) {
    return byId;
  }

  if (normalized === 'google' || normalized === 'openai-compatible') {
    return getModelProviderProfile(normalized);
  }

  return undefined;
}

function inferProfileFromEnv(
  env: Record<string, string | undefined>,
): ModelProviderProfile | undefined {
  const matches = MODEL_PROVIDER_PROFILES.filter(
    (profile) =>
      profile.provider === 'openai-compatible' &&
      profile.id !== 'openai-compatible' &&
      ((profile.apiKeyEnvVars ?? []).some((key) => !!env[key]) ||
        (profile.baseUrlEnvVars ?? []).some((key) => !!env[key]) ||
        !!(profile.baseUrlEnv && env[profile.baseUrlEnv])),
  );

  return matches.length === 1 ? matches[0] : undefined;
}

export function resolveModelProviderProfileConfig(
  profileId: string,
  env: Record<string, string | undefined> = process.env,
  model?: string,
): ModelProviderRuntimeConfig {
  const profile = getModelProviderProfile(profileId);
  if (!profile) {
    throw new Error(`Unknown model provider profile: ${profileId}`);
  }

  const baseUrl =
    env['AI_BASE_URL'] ||
    env['LLM_BASE_URL'] ||
    readEnv(env, [
      ...(profile.baseUrlEnvVars ?? []),
      ...(profile.baseUrlEnv ? [profile.baseUrlEnv] : []),
    ])?.value ||
    profile.baseUrl;
  const apiKey = readEnv(env, [
    'AI_API_KEY',
    'LLM_API_KEY',
    ...(profile.apiKeyEnvVars ?? []),
    'OPENAI_API_KEY',
  ]);

  return {
    provider: profile.provider,
    profile: profile.id,
    displayName: profile.displayName,
    baseUrl,
    apiKey: apiKey?.value,
    apiKeyEnv: apiKey?.key ?? profile.apiKeyEnvVars?.[0],
    model,
  };
}

export function resolveModelProviderConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
  options: ResolveModelProviderConfigOptions = {},
): ModelProviderRuntimeConfig {
  const providerValue = env['AI_PROVIDER'] || env['LLM_PROVIDER'];
  if (
    env['AI_PROVIDER'] &&
    env['LLM_PROVIDER'] &&
    env['AI_PROVIDER'] !== env['LLM_PROVIDER']
  ) {
    debugLogger.warn(
      `Both AI_PROVIDER and LLM_PROVIDER are set. Using AI_PROVIDER: ${env['AI_PROVIDER']}`,
    );
  }

  const profile = profileFromProviderValue(providerValue, env, options);
  if (!profile) {
    throw new Error(
      providerValue
        ? `Unsupported AI_PROVIDER: ${providerValue}`
        : `Unsupported default model provider profile: ${options.defaultProfile}`,
    );
  }

  const model = env['AI_MODEL'] || env['LLM_MODEL'];
  return resolveModelProviderProfileConfig(profile.id, env, model);
}

export function isOpenAICompatibleProviderConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  try {
    return (
      resolveModelProviderConfigFromEnv(env).provider === 'openai-compatible'
    );
  } catch {
    return false;
  }
}
