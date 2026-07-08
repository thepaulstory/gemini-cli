/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { sanitizeErrorMessage, sanitizeToolArgs } from './agent-sanitization-utils.js';

describe('Secrets Redaction', () => {
  it('should redact GEMINI_API_KEY', () => {
    const message = 'Error using key GEMINI_API_KEY=sk-12345';
    expect(sanitizeErrorMessage(message)).toContain('GEMINI_API_KEY=[REDACTED]');
  });

  it('should redact LLM_API_KEY', () => {
    const message = 'Connecting with LLM_API_KEY: my-secret-key';
    expect(sanitizeErrorMessage(message)).toContain('LLM_API_KEY: [REDACTED]');
  });

  it('should redact OPENAI_API_KEY', () => {
    const message = 'OpenAI call failed for OPENAI_API_KEY="sk-5678"';
    expect(sanitizeErrorMessage(message)).toContain('OPENAI_API_KEY=[REDACTED]');
  });

  it('should redact sensitive keys in tool arguments', () => {
    const args = {
      model: 'gpt-4',
      api_key: 'secret',
      llm_api_key: 'top-secret'
    };
    const sanitized = sanitizeToolArgs(args) as any;
    expect(sanitized.api_key).toBe('[REDACTED]');
    expect(sanitized.llm_api_key).toBe('[REDACTED]');
  });
});
