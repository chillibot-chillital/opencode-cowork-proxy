import { describe, it, expect } from 'vitest';
import { hashSystemPrompt, hasCacheControl, extractCachedTokens, extractInputTokens, extractOutputTokens, extractUncachedInputTokens } from '../src/cache';

describe('hashSystemPrompt', () => {
  it('produces a stable hash for the same string', () => {
    const h1 = hashSystemPrompt('You are a helpful assistant.');
    const h2 = hashSystemPrompt('You are a helpful assistant.');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^cache-/);
  });

  it('produces different hashes for different strings', () => {
    const h1 = hashSystemPrompt('You are helpful.');
    const h2 = hashSystemPrompt('You are sarcastic.');
    expect(h1).not.toBe(h2);
  });

  it('handles array system prompts', () => {
    const h = hashSystemPrompt([
      { type: 'text', text: 'Rule 1: be concise.' },
      { type: 'text', text: 'Rule 2: be accurate.' },
    ]);
    expect(h).toMatch(/^cache-/);
  });

  it('returns null for undefined system', () => {
    expect(hashSystemPrompt(undefined)).toBeNull();
  });

  it('returns null for empty string system', () => {
    expect(hashSystemPrompt('')).toBeNull();
  });

  it('returns null for empty array system', () => {
    expect(hashSystemPrompt([])).toBeNull();
  });
});

describe('hasCacheControl', () => {
  it('detects cache_control in array system messages', () => {
    expect(hasCacheControl([], [
      { type: 'text', text: 'cached', cache_control: { type: 'ephemeral' } },
    ])).toBe(true);
  });

  it('detects cache_control in content blocks', () => {
    expect(hasCacheControl([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'hello', cache_control: { type: 'ephemeral' } },
        ],
      },
    ])).toBe(true);
  });

  it('returns false when no cache_control markers present', () => {
    expect(hasCacheControl([
      { role: 'user', content: 'hello' },
    ])).toBe(false);
  });

  it('returns false for empty messages', () => {
    expect(hasCacheControl([])).toBe(false);
  });
});

describe('extractCachedTokens', () => {
  it('extracts cached_tokens from usage.prompt_tokens_details', () => {
    expect(extractCachedTokens({
      prompt_tokens_details: { cached_tokens: 500 },
    })).toBe(500);
  });

  it('returns 0 when prompt_tokens_details is missing', () => {
    expect(extractCachedTokens({ prompt_tokens: 100 })).toBe(0);
  });

  it('returns 0 for undefined usage', () => {
    expect(extractCachedTokens(undefined)).toBe(0);
  });

  it('returns 0 for null usage', () => {
    expect(extractCachedTokens(null)).toBe(0);
  });

  it('returns 0 when cached_tokens is 0', () => {
    expect(extractCachedTokens({
      prompt_tokens_details: { cached_tokens: 0 },
    })).toBe(0);
  });

  it('extracts cached tokens from Anthropic-compatible usage', () => {
    expect(extractCachedTokens({ cache_read_input_tokens: 123 })).toBe(123);
  });
});

describe('token usage extraction', () => {
  it('extracts OpenAI-style usage tokens', () => {
    const usage = { prompt_tokens: 10, completion_tokens: 5 };
    expect(extractInputTokens(usage)).toBe(10);
    expect(extractOutputTokens(usage)).toBe(5);
  });

  it('subtracts cached tokens from Anthropic input token mapping', () => {
    const usage = { prompt_tokens: 1000, completion_tokens: 50, prompt_tokens_details: { cached_tokens: 400 } };
    expect(extractUncachedInputTokens(usage)).toBe(600);
  });

  it('extracts Anthropic/OpenCode-compatible usage tokens', () => {
    const usage = { input_tokens: 12, output_tokens: 7 };
    expect(extractInputTokens(usage)).toBe(12);
    expect(extractOutputTokens(usage)).toBe(7);
  });

  it('extracts camelCase usage tokens', () => {
    const usage = { inputTokens: 20, outputTokens: 9 };
    expect(extractInputTokens(usage)).toBe(20);
    expect(extractOutputTokens(usage)).toBe(9);
  });
});
