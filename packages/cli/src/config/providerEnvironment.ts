/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { GEMINI_DIR } from '@google/gemini-cli-core';

export interface ProviderEnvironmentVariableDefinition {
  name: string;
  label: string;
  description: string;
  secret?: boolean;
}

export const PROVIDER_ENVIRONMENT_VARIABLES: readonly ProviderEnvironmentVariableDefinition[] =
  [
    {
      name: 'AI_PROVIDER',
      label: 'AI Provider',
      description:
        'Provider profile: google, groq, qwen, kimi, glm, deepseek, or openai-compatible.',
    },
    {
      name: 'LLM_PROVIDER',
      label: 'Legacy LLM Provider',
      description: 'Fallback provider profile when AI_PROVIDER is not set.',
    },
    {
      name: 'AI_MODEL',
      label: 'AI Model',
      description: 'Preferred model. Takes precedence over LLM_MODEL.',
    },
    {
      name: 'LLM_MODEL',
      label: 'Legacy LLM Model',
      description: 'Fallback model when AI_MODEL is not set.',
    },
    {
      name: 'AI_BASE_URL',
      label: 'AI Base URL',
      description:
        'OpenAI-compatible base URL. Takes precedence over LLM_BASE_URL.',
    },
    {
      name: 'LLM_BASE_URL',
      label: 'LLM Base URL',
      description: 'OpenAI-compatible base URL.',
    },
    {
      name: 'AI_API_KEY',
      label: 'AI API Key',
      description:
        'Provider API key. Takes precedence over other provider keys.',
      secret: true,
    },
    {
      name: 'LLM_API_KEY',
      label: 'LLM API Key',
      description: 'Generic OpenAI-compatible provider API key.',
      secret: true,
    },
    {
      name: 'OPENAI_API_KEY',
      label: 'OpenAI API Key',
      description: 'OpenAI or compatible provider API key.',
      secret: true,
    },
    {
      name: 'GROQ_API_KEY',
      label: 'Groq API Key',
      description: 'API key for the Groq profile.',
      secret: true,
    },
    {
      name: 'DEEPSEEK_API_KEY',
      label: 'DeepSeek API Key',
      description: 'API key for the DeepSeek profile.',
      secret: true,
    },
    {
      name: 'DASHSCOPE_API_KEY',
      label: 'DashScope API Key',
      description: 'API key for the Qwen DashScope profile.',
      secret: true,
    },
    {
      name: 'MOONSHOT_API_KEY',
      label: 'Moonshot API Key',
      description: 'API key for the Kimi/Moonshot profile.',
      secret: true,
    },
    {
      name: 'KIMI_API_KEY',
      label: 'Kimi API Key',
      description: 'Alternate API key for the Kimi profile.',
      secret: true,
    },
    {
      name: 'ZAI_API_KEY',
      label: 'Z.AI API Key',
      description: 'API key for the Z.AI/GLM profile.',
      secret: true,
    },
    {
      name: 'GLM_API_KEY',
      label: 'GLM API Key',
      description: 'Alternate API key for the Z.AI/GLM profile.',
      secret: true,
    },
    {
      name: 'BIGMODEL_API_KEY',
      label: 'BigModel API Key',
      description: 'Legacy API key for the GLM profile.',
      secret: true,
    },
    {
      name: 'GEMINI_API_KEY',
      label: 'Gemini API Key',
      description: 'API key for the Google Gemini API.',
      secret: true,
    },
    {
      name: 'GOOGLE_API_KEY',
      label: 'Google API Key',
      description: 'API key for Google API or Vertex AI express mode.',
      secret: true,
    },
    {
      name: 'DASHSCOPE_BASE_URL',
      label: 'DashScope Base URL',
      description: 'Optional base URL override for Qwen DashScope.',
    },
    {
      name: 'KIMI_BASE_URL',
      label: 'Kimi Base URL',
      description: 'Optional base URL override for Kimi.',
    },
    {
      name: 'ZAI_BASE_URL',
      label: 'Z.AI Base URL',
      description: 'Optional base URL override for Z.AI.',
    },
    {
      name: 'GLM_BASE_URL',
      label: 'GLM Base URL',
      description: 'Legacy base URL override for GLM.',
    },
  ];

const ALLOWED_VARIABLES = new Set(
  PROVIDER_ENVIRONMENT_VARIABLES.map(({ name }) => name),
);

export function updateEnvFileContent(
  content: string,
  name: string,
  value: string | undefined,
): string {
  const assignmentPattern = new RegExp(
    `^\\s*(?:export\\s+)?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`,
  );
  const lines = content ? content.split(/\r?\n/) : [];
  const nextAssignment =
    value === undefined || value === ''
      ? undefined
      : `${name}=${JSON.stringify(value)}`;
  let replaced = false;

  const updated = lines.flatMap((line) => {
    if (!assignmentPattern.test(line)) {
      return [line];
    }
    if (replaced || nextAssignment === undefined) {
      return [];
    }
    replaced = true;
    return [nextAssignment];
  });

  if (!replaced && nextAssignment !== undefined) {
    if (updated.length > 0 && updated[updated.length - 1] !== '') {
      updated.push('');
    }
    updated.push(nextAssignment);
  }

  while (updated.length > 0 && updated[updated.length - 1] === '') {
    updated.pop();
  }
  return updated.length > 0 ? `${updated.join(os.EOL)}${os.EOL}` : '';
}

async function writeUserEnvFile(
  name: string,
  value: string | undefined,
): Promise<void> {
  const directory = path.join(os.homedir(), GEMINI_DIR);
  const envPath = path.join(directory, '.env');
  let content = '';

  try {
    content = await fs.readFile(envPath, 'utf8');
  } catch (error) {
    if (
      !(error instanceof Error && 'code' in error && error.code === 'ENOENT')
    ) {
      throw error;
    }
  }

  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.writeFile(envPath, updateEnvFileContent(content, name, value), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

function updateWindowsUserEnvironment(
  name: string,
  value: string | undefined,
): Promise<void> {
  const args =
    value === undefined || value === ''
      ? ['DELETE', 'HKCU\\Environment', '/v', name, '/f']
      : [
          'ADD',
          'HKCU\\Environment',
          '/v',
          name,
          '/t',
          'REG_SZ',
          '/d',
          value,
          '/f',
        ];

  return new Promise((resolve, reject) => {
    execFile('reg.exe', args, { windowsHide: true }, (error) => {
      if (error && value !== undefined && value !== '') {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function setProviderEnvironmentVariable(
  name: string,
  value: string | undefined,
): Promise<void> {
  if (!ALLOWED_VARIABLES.has(name)) {
    throw new Error(`Unsupported provider environment variable: ${name}`);
  }

  const normalizedValue = value?.trim() || undefined;
  if (normalizedValue === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = normalizedValue;
  }

  await writeUserEnvFile(name, normalizedValue);
  if (process.platform === 'win32') {
    await updateWindowsUserEnvironment(name, normalizedValue);
  }
}
