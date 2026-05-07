import { hashSystemPrompt } from '../../cache';

export function formatAnthropicToOpenAI(body: any): any {
  const { model, messages, system, temperature, max_tokens, top_p, stop_sequences, tools, stream } = body;

  const openAIMessages = Array.isArray(messages)
    ? messages.flatMap((msg: any) => {
        if (typeof msg.content === "string") {
          return [{ role: msg.role, content: msg.content }];
        }
        if (!Array.isArray(msg.content)) return [];

        const result: any[] = [];

        if (msg.role === "assistant") {
          const assistantMsg: any = { role: "assistant", content: null };
          let text = "";
          let reasoningContent = "";
          const toolCalls: any[] = [];

          msg.content.forEach((part: any) => {
            if (part.type === "text") {
              text += (typeof part.text === "string" ? part.text : JSON.stringify(part.text)) + "\n";
            } else if (part.type === "thinking") {
              reasoningContent += (typeof part.thinking === "string" ? part.thinking : JSON.stringify(part.thinking)) + "\n";
            } else if (part.type === "tool_use") {
              toolCalls.push({
                id: part.id,
                type: "function",
                function: { name: part.name, arguments: JSON.stringify(part.input) },
              });
            }
          });

          const trimmed = text.trim();
          const trimmedReasoning = reasoningContent.trim();
          if (trimmed) assistantMsg.content = trimmed;
          if (trimmedReasoning) assistantMsg.reasoning_content = trimmedReasoning;
          if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;
          if (assistantMsg.content || assistantMsg.reasoning_content || assistantMsg.tool_calls) result.push(assistantMsg);
        }

        if (msg.role === "user") {
          let userText = "";
          let hasImage = false;
          const toolResults: any[] = [];

          msg.content.forEach((part: any) => {
            if (part.type === "text") {
              userText += (typeof part.text === "string" ? part.text : JSON.stringify(part.text)) + "\n";
            } else if (part.type === "image") {
              hasImage = true;
            } else if (part.type === "tool_result") {
              toolResults.push({
                role: "tool",
                tool_call_id: part.tool_use_id,
                content: typeof part.content === "string" ? part.content : JSON.stringify(part.content),
              });
            }
          });

          const trimmed = userText.trim();

          result.push(...toolResults);

          if (trimmed || hasImage) {
            const text = trimmed || "[An image was attached but this model does not support vision.]";
            result.push({ role: "user", content: text });
          }
        }

        return result;
      })
    : [];

  const systemMessages = Array.isArray(system)
    ? system.map((item: any) => ({ role: "system", content: item.text }))
    : system ? [{ role: "system", content: system }] : [];

  const data: any = {
    model,
    messages: [...systemMessages, ...openAIMessages],
  };

  if (max_tokens !== undefined) data.max_tokens = max_tokens;
  if (temperature !== undefined) data.temperature = temperature;
  if (top_p !== undefined) data.top_p = top_p;
  if (stream !== undefined) data.stream = stream;
  if (stream) data.stream_options = { include_usage: true };
  if (stop_sequences) data.stop = stop_sequences;

  if (tools) {
    data.tools = tools.map((item: any) => ({
      type: "function",
      function: {
        name: item.name,
        description: item.description,
        parameters: item.input_schema,
      },
    }));
  }

  // Inject prompt_cache_key from system prompt hash for OpenAI node affinity caching.
  // This ensures requests with the same system prompt are routed to the same backend
  // node, enabling automatic OpenAI-style prefix caching.
  const cacheKey = hashSystemPrompt(system);
  if (cacheKey) {
    data.prompt_cache_key = cacheKey;
  }

  return data;
}
