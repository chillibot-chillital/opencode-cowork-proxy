import { describe, it, expect } from 'vitest';
import { formatAnthropicToOpenAI } from '../src/translate/request/anthropic-to-openai';
import { formatOpenAIToAnthropic } from '../src/translate/request/openai-to-anthropic';

describe('formatAnthropicToOpenAI (Anthropic → OpenAI request)', () => {
  it('converts a simple text message', () => {
    const result = formatAnthropicToOpenAI({
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 1024,
    });
    expect(result.model).toBe('claude-sonnet-4-20250514');
    expect(result.max_tokens).toBe(1024);
    expect(result.messages).toEqual([
      { role: 'user', content: 'Hello' },
    ]);
  });

  it('converts messages with content arrays', () => {
    const result = formatAnthropicToOpenAI({
      model: 'claude-sonnet-4-20250514',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'What is 2+2?' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'The answer is 4.' }] },
      ],
      max_tokens: 1024,
    });
    expect(result.messages).toEqual([
      { role: 'user', content: 'What is 2+2?' },
      { role: 'assistant', content: 'The answer is 4.' },
    ]);
  });

  it('converts system messages', () => {
    const result = formatAnthropicToOpenAI({
      model: 'claude-sonnet-4-20250514',
      system: 'You are helpful.',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 1024,
    });
    expect(result.messages[0]).toEqual({ role: 'system', content: 'You are helpful.' });
    expect(result.messages[1]).toEqual({ role: 'user', content: 'Hi' });
  });

  it('converts array system messages', () => {
    const result = formatAnthropicToOpenAI({
      model: 'claude-sonnet-4-20250514',
      system: [
        { type: 'text', text: 'Rule 1' },
        { type: 'text', text: 'Rule 2' },
      ],
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 1024,
    });
    expect(result.messages[0]).toEqual({ role: 'system', content: 'Rule 1' });
    expect(result.messages[1]).toEqual({ role: 'system', content: 'Rule 2' });
  });

  it('converts tool_use to tool_calls', () => {
    const result = formatAnthropicToOpenAI({
      model: 'claude-sonnet-4-20250514',
      messages: [{
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me check.' },
          { type: 'tool_use', id: 'tool_001', name: 'get_weather', input: { city: 'Paris' } },
        ],
      }],
      max_tokens: 1024,
    });
    expect(result.messages[0].role).toBe('assistant');
    expect(result.messages[0].content).toBe('Let me check.');
    expect(result.messages[0].tool_calls).toEqual([
      { id: 'tool_001', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Paris"}' } },
    ]);
  });

  it('converts thinking blocks to reasoning_content', () => {
    const result = formatAnthropicToOpenAI({
      model: 'deepseek-reasoner',
      messages: [{
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'internal reasoning' },
          { type: 'text', text: 'final answer' },
        ],
      }],
      max_tokens: 1024,
    });
    expect(result.messages[0].reasoning_content).toBe('internal reasoning');
    expect(result.messages[0].content).toBe('final answer');
  });

  it('converts tool_result to tool messages', () => {
    const result = formatAnthropicToOpenAI({
      model: 'claude-sonnet-4-20250514',
      messages: [{
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'tool_001', content: 'Sunny, 22°C' },
        ],
      }],
      max_tokens: 1024,
    });
    expect(result.messages[0]).toEqual({
      role: 'tool', tool_call_id: 'tool_001', content: 'Sunny, 22°C',
    });
  });

  it('puts tool_result messages before user text in mixed Anthropic user turns', () => {
    const result = formatAnthropicToOpenAI({
      model: 'deepseek-reasoner',
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'tool_001', name: 'search', input: { query: 'cats' } }],
        },
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'tool_001', content: 'cats result' },
            { type: 'text', text: 'Use that result.' },
          ],
        },
      ],
      max_tokens: 1024,
    });
    expect(result.messages).toEqual([
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'tool_001', type: 'function', function: { name: 'search', arguments: '{"query":"cats"}' } }],
      },
      { role: 'tool', tool_call_id: 'tool_001', content: 'cats result' },
      { role: 'user', content: 'Use that result.' },
    ]);
  });

  it('passes through optional parameters', () => {
    const result = formatAnthropicToOpenAI({
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 4096,
      temperature: 0.7,
      top_p: 0.9,
      stream: true,
      stop_sequences: ['END'],
    });
    expect(result.max_tokens).toBe(4096);
    expect(result.temperature).toBe(0.7);
    expect(result.top_p).toBe(0.9);
    expect(result.stream).toBe(true);
    expect(result.stream_options).toEqual({ include_usage: true });
    expect(result.stop).toEqual(['END']);
  });

  it('requests usage in OpenAI-compatible streams', () => {
    const result = formatAnthropicToOpenAI({
      model: 'deepseek-v4-pro',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 4096,
      stream: true,
    });
    expect(result.stream_options).toEqual({ include_usage: true });
  });

  it('omits undefined optional parameters', () => {
    const result = formatAnthropicToOpenAI({
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 1024,
    });
    expect(result.temperature).toBeUndefined();
    expect(result.top_p).toBeUndefined();
    expect(result.stream).toBeUndefined();
  });

  it('converts tools format', () => {
    const result = formatAnthropicToOpenAI({
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Weather?' }],
      max_tokens: 1024,
      tools: [
        { name: 'get_weather', description: 'Get weather', input_schema: { type: 'object', properties: { city: { type: 'string' } } } },
      ],
    });
    expect(result.tools).toEqual([
      { type: 'function', function: { name: 'get_weather', description: 'Get weather', parameters: { type: 'object', properties: { city: { type: 'string' } } } } },
    ]);
  });

  it('strips images and keeps text when image is attached', () => {
    const result = formatAnthropicToOpenAI({
      model: 'claude-sonnet-4-20250514',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'What is in this image?' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc123' } },
        ],
      }],
      max_tokens: 1024,
    });
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].content).toBe('What is in this image?');
  });

  it('inserts fallback text when message contains only an image', () => {
    const result = formatAnthropicToOpenAI({
      model: 'claude-sonnet-4-20250514',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: 'https://example.com/cat.jpg' } },
        ],
      }],
      max_tokens: 1024,
    });
    expect(result.messages[0].content).toBe('[An image was attached but this model does not support vision.]');
  });

  it('returns string content when user message has no images', () => {
    const result = formatAnthropicToOpenAI({
      model: 'claude-sonnet-4-20250514',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Hello world' },
        ],
      }],
      max_tokens: 1024,
    });
    expect(result.messages[0].content).toBe('Hello world');
  });

  it('strips image and keeps only text in message', () => {
    const result = formatAnthropicToOpenAI({
      model: 'claude-sonnet-4-20250514',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'xyz' } },
        ],
      }],
      max_tokens: 1024,
    });
    expect(result.messages[0].content).toBe('What is this?');
  });
});

describe('formatOpenAIToAnthropic (OpenAI → Anthropic request)', () => {
  it('converts a simple message', () => {
    const result = formatOpenAIToAnthropic({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(result.model).toBe('gpt-4');
    expect(result.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
    ]);
    expect(result.max_tokens).toBe(4096);
  });

  it('extracts system messages from messages array', () => {
    const result = formatOpenAIToAnthropic({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hi' },
      ],
    });
    expect(result.system).toBe('You are helpful.');
    expect(result.messages.length).toBe(1);
    expect(result.messages[0].role).toBe('user');
  });

  it('handles multiple system messages', () => {
    const result = formatOpenAIToAnthropic({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Rule 1' },
        { role: 'system', content: 'Rule 2' },
        { role: 'user', content: 'Hi' },
      ],
    });
    expect(Array.isArray(result.system)).toBe(true);
    expect(result.system).toEqual(['Rule 1', 'Rule 2']);
  });

  it('converts tool_calls to tool_use blocks', () => {
    const result = formatOpenAIToAnthropic({
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'Weather?' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Paris"}' } },
          ],
        },
      ],
    });
    const assistant = result.messages[1];
    expect(assistant.role).toBe('assistant');
    expect(assistant.content[0].type).toBe('tool_use');
    expect(assistant.content[0].name).toBe('get_weather');
    expect(assistant.content[0].input).toEqual({ city: 'Paris' });
  });

  it('does not throw on malformed tool call arguments', () => {
    const result = formatOpenAIToAnthropic({
      model: 'gpt-4',
      messages: [
        { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'broken', arguments: '{bad json' } }] },
      ],
    });
    expect(result.messages[0].content[0].input).toEqual({});
  });

  it('extracts image media type from data URL, not detail', () => {
    const result = formatOpenAIToAnthropic({
      model: 'gpt-4',
      messages: [{
        role: 'user',
        content: [{
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,abc123', detail: 'high' },
        }],
      }],
    });
    expect(result.messages[0].content[0].source).toEqual({
      type: 'base64',
      media_type: 'image/png',
      data: 'abc123',
    });
  });

  it('merges standalone tool messages into user tool_result blocks', () => {
    const result = formatOpenAIToAnthropic({
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'What is 2+2?' },
        { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'calc', arguments: '{"expr":"2+2"}' } }] },
        { role: 'tool', tool_call_id: 'c1', content: '4' },
      ],
    });
    // Should have 3 messages: user, assistant (tool_use), user (tool_result)
    expect(result.messages.length).toBe(3);
    
    // First message: user with text
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].content[0]).toEqual({ type: "text", text: "What is 2+2?" });
    
    // Second message: assistant with tool_use
    expect(result.messages[1].role).toBe('assistant');
    expect(result.messages[1].content[0].type).toBe('tool_use');
    
    // Third message: user with tool_result (from standalone tool message)
    const toolResult = result.messages[2];
    expect(toolResult.role).toBe('user');
    expect(toolResult.content[0]).toEqual({ type: 'tool_result', tool_use_id: 'c1', content: '4' });
  });

  it('passes through optional parameters', () => {
    const result = formatOpenAIToAnthropic({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hi' }],
      temperature: 0.5,
      top_p: 0.8,
      stop: ['END'],
    });
    expect(result.temperature).toBe(0.5);
    expect(result.top_p).toBe(0.8);
    expect(result.stop_sequences).toEqual(['END']);
  });

  it('handles multi-stop array', () => {
    const result = formatOpenAIToAnthropic({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hi' }],
      stop: ['\n', 'END'],
    });
    expect(result.stop_sequences).toEqual(['\n', 'END']);
  });

  it('converts tools format', () => {
    const result = formatOpenAIToAnthropic({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hi' }],
      tools: [
        { type: 'function', function: { name: 'search', description: 'Search', parameters: { type: 'object' } } },
      ],
    });
    expect(result.tools[0]).toEqual({
      name: 'search', description: 'Search', input_schema: { type: 'object' },
    });
  });
});

// Cache-specific tests (Anthropic→OpenAI direction only, since cache injection is relevant here)
describe('Anthropic→OpenAI prompt_cache_key injection', () => {
  it('injects prompt_cache_key when system prompt exists', () => {
    const result = formatAnthropicToOpenAI({
      model: 'claude-sonnet-4-20250514',
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 1024,
    });
    expect(result.prompt_cache_key).toMatch(/^cache-/);
  });

  it('omits prompt_cache_key when no system prompt', () => {
    const result = formatAnthropicToOpenAI({
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 1024,
    });
    expect(result.prompt_cache_key).toBeUndefined();
  });

  it('uses same cache key for same system prompt', () => {
    const r1 = formatAnthropicToOpenAI({
      model: 'c1', system: 'You are helpful.', messages: [{ role: 'user', content: 'A' }], max_tokens: 1024,
    });
    const r2 = formatAnthropicToOpenAI({
      model: 'c2', system: 'You are helpful.', messages: [{ role: 'user', content: 'B' }], max_tokens: 1024,
    });
    expect(r1.prompt_cache_key).toBe(r2.prompt_cache_key);
  });

  it('uses different cache keys for different system prompts', () => {
    const r1 = formatAnthropicToOpenAI({
      model: 'c1', system: 'You are helpful.', messages: [{ role: 'user', content: 'A' }], max_tokens: 1024,
    });
    const r2 = formatAnthropicToOpenAI({
      model: 'c2', system: 'You are a code reviewer.', messages: [{ role: 'user', content: 'B' }], max_tokens: 1024,
    });
    expect(r1.prompt_cache_key).not.toBe(r2.prompt_cache_key);
  });
});
