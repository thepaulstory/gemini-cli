/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { EOL } from 'node:os';
import { updateEnvFileContent } from './providerEnvironment.js';

describe('updateEnvFileContent', () => {
  it('appends a quoted environment value while preserving existing content', () => {
    expect(
      updateEnvFileContent(
        '# Provider settings\nAI_PROVIDER=groq\n',
        'LLM_BASE_URL',
        'https://api.example.com/v1',
      ),
    ).toContain('LLM_BASE_URL="https://api.example.com/v1"');
  });

  it('replaces an existing exported value without duplicating it', () => {
    const updated = updateEnvFileContent(
      'export AI_MODEL="old"\nAI_PROVIDER=groq\n',
      'AI_MODEL',
      'glm-5.2',
    );

    expect(updated).toContain('AI_MODEL="glm-5.2"');
    expect(updated.match(/AI_MODEL/g)).toHaveLength(1);
  });

  it('removes a cleared value', () => {
    expect(
      updateEnvFileContent(
        'AI_PROVIDER=glm\nLLM_API_KEY="secret"\n',
        'LLM_API_KEY',
        undefined,
      ),
    ).toBe(`AI_PROVIDER=glm${EOL}`);
  });

  it('escapes quotes in values', () => {
    expect(updateEnvFileContent('', 'AI_MODEL', 'model"name')).toBe(
      `AI_MODEL="model\\"name"${EOL}`,
    );
  });
});
