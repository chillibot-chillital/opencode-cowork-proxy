import { extractCachedTokens, extractOutputTokens, extractUncachedInputTokens } from '../../cache';

function parseToolArguments(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function formatOpenAIToAnthropic(completion: any, model: string): any {
  const messageId = "msg_" + Date.now();

  let content: any = [];
  const message = completion.choices?.[0]?.message;

  if (message?.reasoning_content) {
    content.push({ type: "thinking", thinking: message.reasoning_content, signature: "" });
  }

  if (message?.content) {
    content.push({ text: message.content, type: "text" });
  }

  if (message?.tool_calls) {
    content.push(...message.tool_calls.map((item: any) => ({
      type: 'tool_use',
      id: item.id,
      name: item.function?.name,
      input: parseToolArguments(item.function?.arguments),
    })));
  }

  // Map OpenAI finish_reason to Anthropic stop_reason
  const finishReason = completion.choices?.[0]?.finish_reason;
  let stopReason = "end_turn";
  if (finishReason === "tool_calls") stopReason = "tool_use";
  else if (finishReason === "length") stopReason = "max_tokens";
  else if (finishReason === "stop") stopReason = "end_turn";

  const result: any = {
    id: messageId,
    type: "message",
    role: "assistant",
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    model,
  };

  if (completion.usage) {
    const cached = extractCachedTokens(completion.usage);
    result.usage = {
      input_tokens: extractUncachedInputTokens(completion.usage),
      output_tokens: extractOutputTokens(completion.usage),
      cache_read_input_tokens: cached,
      cache_creation_input_tokens: 0, // OpenAI doesn't expose write tokens
    };
  }

  return result;
}
