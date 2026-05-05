import { extractCachedTokens, extractOutputTokens, extractUncachedInputTokens } from '../../cache';

export function streamOpenAIToAnthropic(openaiStream: ReadableStream, model: string): ReadableStream {
  const messageId = "msg_" + Date.now();

  const enqueueSSE = (controller: ReadableStreamDefaultController, eventType: string, data: any) => {
    controller.enqueue(new TextEncoder().encode(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`));
  };

  return new ReadableStream({
    async start(controller) {
      let contentBlockIndex = -1;
      let hasStartedTextBlock = false;
      let hasStartedThinkingBlock = false;
      let isToolUse = false;
      let currentToolCallId: string | null = null;
      let toolCallJsonMap = new Map<string, string>();
      let lastUsage: any = null;
      let finishReason: string | null = null;
      let messageStarted = false;

      const reader = openaiStream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function processStreamDelta(delta: any, parsed: any) {
        // Capture usage from any chunk that has it
        if (parsed.usage) {
          lastUsage = {
            input_tokens: extractUncachedInputTokens(parsed.usage),
            output_tokens: extractOutputTokens(parsed.usage),
            cache_read_input_tokens: extractCachedTokens(parsed.usage),
            cache_creation_input_tokens: 0,
          };
        }

        // Capture finish reason
        if (parsed.choices?.[0]?.finish_reason) {
          finishReason = parsed.choices[0].finish_reason;
        }

        // Handle tool calls
        if (delta.tool_calls?.length > 0) {
          for (const toolCall of delta.tool_calls) {
            const toolCallId = toolCall.id;

            if (toolCallId && toolCallId !== currentToolCallId) {
              if (isToolUse || hasStartedTextBlock || hasStartedThinkingBlock) {
                enqueueSSE(controller, "content_block_stop", {
                  type: "content_block_stop",
                  index: contentBlockIndex,
                });
              }

              isToolUse = true;
              hasStartedTextBlock = false;
              hasStartedThinkingBlock = false;
              currentToolCallId = toolCallId;
              contentBlockIndex++;
              toolCallJsonMap.set(toolCallId, "");

              const toolBlock = {
                type: "tool_use",
                id: toolCallId,
                name: toolCall.function?.name,
                input: {},
              };

              // Send message_start on first content block
              if (!messageStarted) {
                enqueueSSE(controller, "message_start", {
                  type: "message_start",
                  message: {
                    id: messageId,
                    type: "message",
                    role: "assistant",
                    content: [],
                    model,
                    stop_reason: null,
                    stop_sequence: null,
                    usage: { input_tokens: 0, output_tokens: 0 },
                  },
                });
                messageStarted = true;
              }

              enqueueSSE(controller, "content_block_start", {
                type: "content_block_start",
                index: contentBlockIndex,
                content_block: toolBlock,
              });
            }

            if (toolCall.function?.arguments && currentToolCallId) {
              const currentJson = toolCallJsonMap.get(currentToolCallId) || "";
              toolCallJsonMap.set(currentToolCallId, currentJson + toolCall.function.arguments);

              enqueueSSE(controller, "content_block_delta", {
                type: "content_block_delta",
                index: contentBlockIndex,
                delta: {
                  type: "input_json_delta",
                  partial_json: toolCall.function.arguments,
                },
              });
            }
          }
        } else if (delta.reasoning_content) {
          if (isToolUse || hasStartedTextBlock) {
            enqueueSSE(controller, "content_block_stop", {
              type: "content_block_stop",
              index: contentBlockIndex,
            });
            isToolUse = false;
            hasStartedTextBlock = false;
            currentToolCallId = null;
            contentBlockIndex++;
          }

          if (!hasStartedThinkingBlock) {
            if (contentBlockIndex < 0) contentBlockIndex = 0;

            if (!messageStarted) {
              enqueueSSE(controller, "message_start", {
                type: "message_start",
                message: {
                  id: messageId,
                  type: "message",
                  role: "assistant",
                  content: [],
                  model,
                  stop_reason: null,
                  stop_sequence: null,
                  usage: { input_tokens: 0, output_tokens: 0 },
                },
              });
              messageStarted = true;
            }

            enqueueSSE(controller, "content_block_start", {
              type: "content_block_start",
              index: contentBlockIndex,
              content_block: { type: "thinking", thinking: "", signature: "" },
            });
            hasStartedThinkingBlock = true;
          }

          enqueueSSE(controller, "content_block_delta", {
            type: "content_block_delta",
            index: contentBlockIndex,
            delta: { type: "thinking_delta", thinking: delta.reasoning_content },
          });
        } else if (delta.content) {
          if (isToolUse || hasStartedThinkingBlock) {
            enqueueSSE(controller, "content_block_stop", {
              type: "content_block_stop",
              index: contentBlockIndex,
            });
            isToolUse = false;
            hasStartedThinkingBlock = false;
            currentToolCallId = null;
            contentBlockIndex++;
          }

          if (!hasStartedTextBlock) {
            if (contentBlockIndex < 0) contentBlockIndex = 0;

            if (!messageStarted) {
              enqueueSSE(controller, "message_start", {
                type: "message_start",
                message: {
                  id: messageId,
                  type: "message",
                  role: "assistant",
                  content: [],
                  model,
                  stop_reason: null,
                  stop_sequence: null,
                  usage: { input_tokens: 0, output_tokens: 0 },
                },
              });
              messageStarted = true;
            }

            enqueueSSE(controller, "content_block_start", {
              type: "content_block_start",
              index: contentBlockIndex,
              content_block: { type: "text", text: "" },
            });
            hasStartedTextBlock = true;
          }

          enqueueSSE(controller, "content_block_delta", {
            type: "content_block_delta",
            index: contentBlockIndex,
            delta: { type: "text_delta", text: delta.content },
          });
        }
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              const lines = buffer.split('\n');
              for (const line of lines) {
                if (line.trim() && line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') continue;
                  try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta;
                    if (delta) processStreamDelta(delta, parsed);
                  } catch { /* parse error */ }
                }
              }
            }
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() && line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                if (delta) processStreamDelta(delta, parsed);
              } catch { continue; }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Close last content block
      if (isToolUse || hasStartedTextBlock || hasStartedThinkingBlock) {
        enqueueSSE(controller, "content_block_stop", {
          type: "content_block_stop",
          index: contentBlockIndex,
        });
      }

      // Map finish reason and usage
      let stopReason = "end_turn";
      if (finishReason === "tool_calls") stopReason = "tool_use";
      else if (finishReason === "length") stopReason = "max_tokens";
      else if (finishReason === "stop") stopReason = "end_turn";

      enqueueSSE(controller, "message_delta", {
        type: "message_delta",
        delta: { stop_reason: stopReason, stop_sequence: null },
        usage: lastUsage || { input_tokens: 0, output_tokens: 0 },
      });

      enqueueSSE(controller, "message_stop", {
        type: "message_stop",
      });

      controller.close();
    },
  });
}
