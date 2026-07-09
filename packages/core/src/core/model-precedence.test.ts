/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_GEMINI_MODEL } from '../config/models.js';
import { resolveModelWithEnvironment } from './geminiChat.js';

describe('Model Selection Precedence', () => {
  it('uses an explicitly resolved model before environment variables', () => {
    expect(
      resolveModelWithEnvironment('flag-model', {
        AI_MODEL: 'env-model',
      }),
    ).toBe('flag-model');
  });

  it('uses AI_MODEL when the resolved model is the default', () => {
    expect(
      resolveModelWithEnvironment(DEFAULT_GEMINI_MODEL, {
        AI_MODEL: 'env-model',
      }),
    ).toBe('env-model');
  });

  it('falls back to LLM_MODEL when AI_MODEL is not set', () => {
    expect(
      resolveModelWithEnvironment('auto', {
        LLM_MODEL: 'legacy-env-model',
      }),
    ).toBe('legacy-env-model');
  });
});
