/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AuthType,
  loadApiKey,
  resolveModelProviderConfigFromEnv,
  type ModelProviderRuntimeConfig,
} from '@google/gemini-cli-core';
import { loadEnvironment, loadSettings } from './settings.js';

export async function validateAuthMethod(
  authMethod: string,
): Promise<string | null> {
  loadEnvironment(loadSettings().merged, process.cwd());
  if (
    authMethod === AuthType.LOGIN_WITH_GOOGLE ||
    authMethod === AuthType.COMPUTE_ADC
  ) {
    return null;
  }

  if (authMethod === AuthType.USE_GEMINI) {
    const key = process.env['GEMINI_API_KEY'] || (await loadApiKey());
    if (!key) {
      return (
        'When using Gemini API, you must specify the GEMINI_API_KEY environment variable.\n' +
        'Update your environment and try again (no reload needed if using .env)!'
      );
    }
    return null;
  }

  if (authMethod === AuthType.USE_VERTEX_AI) {
    const hasVertexProjectLocationConfig =
      !!process.env['GOOGLE_CLOUD_PROJECT'] &&
      !!process.env['GOOGLE_CLOUD_LOCATION'];
    const hasGoogleApiKey = !!process.env['GOOGLE_API_KEY'];
    if (!hasVertexProjectLocationConfig && !hasGoogleApiKey) {
      return (
        'When using Vertex AI, you must specify either:\n' +
        '• GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION environment variables.\n' +
        '• GOOGLE_API_KEY environment variable (if using express mode).\n' +
        'Update your environment and try again (no reload needed if using .env)!'
      );
    }
    return null;
  }

  if (authMethod === AuthType.OPENAI_COMPATIBLE) {
    let providerConfig: ModelProviderRuntimeConfig;
    try {
      providerConfig = resolveModelProviderConfigFromEnv(process.env, {
        defaultProfile: 'openai-compatible',
        inferProfileFromApiKey: true,
      });
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
    if (providerConfig.provider !== 'openai-compatible') {
      return (
        'When using OpenAI-compatible auth, set AI_PROVIDER=openai-compatible ' +
        'or choose a provider profile such as AI_PROVIDER=groq.'
      );
    }
    if (!providerConfig.baseUrl) {
      return (
        'When using OpenAI-compatible auth, you must specify LLM_BASE_URL ' +
        'or choose a provider profile with a built-in base URL.'
      );
    }
    if (!providerConfig.apiKey) {
      return (
        `When using ${providerConfig.displayName ?? 'OpenAI-compatible'} auth, ` +
        `you must specify ${providerConfig.apiKeyEnv ?? 'LLM_API_KEY'} ` +
        'or LLM_API_KEY/OPENAI_API_KEY.'
      );
    }
    return null;
  }

  return 'Invalid auth method selected.';
}
