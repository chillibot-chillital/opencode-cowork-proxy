# opencode-cowork-proxy

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/chillibot-chillital/opencode-cowork-proxy)

This project lets Claude use OpenCode Go models.

Claude normally speaks the Anthropic API format. OpenCode Go mostly speaks OpenAI-compatible API format. This small Cloudflare Worker sits in the middle and translates between them.

In plain English:

1. You deploy this Worker to Cloudflare.
2. You copy your Worker URL.
3. You open Claude's **Configure third-party Inference** settings.
4. You paste the Worker URL as the gateway URL.
5. You paste your OpenCode Go API key.
6. You manually add the OpenCode Go model names you want to use.

After that, Claude can call models like `deepseek-v4-pro`, `kimi-k2.6`, or `qwen3.5-plus` through your Worker.

## Quick Claude Configuration

Use these values in Claude's **Configure third-party Inference** screen:

| Setting | Value |
|---------|-------|
| Provider | Gateway / third-party inference gateway |
| Base URL | Your deployed Worker URL, or add `/go` or `/zen` |
| Auth scheme | `x-api-key` |
| API key | Your OpenCode Go API key |
| Models | Add manually, for example `deepseek-v4-pro` |

Important: use the Worker root URL only, optionally ending in `/go` or `/zen`. Do not add `/v1/messages` yourself. Claude adds the API path automatically.

## What This Does

The Worker accepts Claude's Anthropic-style requests at `/v1/messages`, converts them to OpenAI-style requests, and sends them to OpenCode Go by default.

You can choose an OpenCode upstream by adding a prefix to the Worker URL:

| Worker URL suffix | Upstream |
|-------------------|----------|
| no suffix | OpenCode Go |
| `/go` | OpenCode Go |
| `/zen` | OpenCode Zen |

For example, use `YOUR_DEPLOYED_WORKER_URL/go` for Go models and `YOUR_DEPLOYED_WORKER_URL/zen` for Zen models.

It also handles tool calls, streaming, and DeepSeek reasoning output so coding-agent workflows work correctly.

Important: this proxy has been live-tested with `minimax-m2.7`. Other OpenCode Go models are included from the public OpenCode Go model list, but provider behavior can vary, especially around streaming usage/token accounting.

## For Developers

Technically, this is a Cloudflare Worker gateway that lets Anthropic/Claude clients talk to OpenAI-compatible APIs, and lets OpenAI clients talk to Anthropic-compatible APIs.

The default upstream is [OpenCode Go](https://opencode.ai/docs/go/#endpoints):

```text
https://opencode.ai/zen/go/v1
```

This means Claude can be configured to use OpenCode Go models through this proxy without additional server-side configuration.

```text
Claude / Anthropic SDK  ->  /v1/messages           ->  OpenAI-compatible upstream
OpenAI SDK              ->  /v1/chat/completions   ->  OpenAI-compatible upstream
OpenAI SDK              ->  /v1/chat/completions   ->  Anthropic upstream with x-upstream-format: anthropic
```

## Detailed Claude Setup

Use Claude's **Configure third-party Inference** flow and add the Worker as a custom gateway.

Configure the gateway like this:

| Setting | Value |
|---------|-------|
| Base URL | Your deployed Worker URL, or add `/go` or `/zen` |
| Auth scheme | `x-api-key` |
| API key | Your OpenCode Go API key |
| Model | Add manually, for example `deepseek-v4-pro` |

Do not include `/v1/messages` in the Claude base URL. Claude will call `/v1/messages`; the Worker handles that path.

Use `/go` for OpenCode Go subscription models. Use `/zen` for OpenCode Zen models. Zen includes multiple endpoint styles; this proxy's Claude translation path is for Zen models available through the OpenAI-compatible `/chat/completions` endpoint.

### Manual Model Setup

Claude may not discover the OpenCode Go models automatically. Add the model manually in **Configure third-party Inference**.

Common OpenCode Go model IDs:

| Model | Model ID | Upstream API style |
|-------|----------|--------------------|
| GLM-5.1 | `glm-5.1` | OpenAI-compatible |
| GLM-5 | `glm-5` | OpenAI-compatible |
| Kimi K2.5 | `kimi-k2.5` | OpenAI-compatible |
| Kimi K2.6 | `kimi-k2.6` | OpenAI-compatible |
| DeepSeek V4 Pro | `deepseek-v4-pro` | OpenAI-compatible |
| DeepSeek V4 Flash | `deepseek-v4-flash` | OpenAI-compatible |
| MiMo-V2-Pro | `mimo-v2-pro` | OpenAI-compatible |
| MiMo-V2-Omni | `mimo-v2-omni` | OpenAI-compatible |
| MiMo-V2.5-Pro | `mimo-v2.5-pro` | OpenAI-compatible |
| MiMo-V2.5 | `mimo-v2.5` | OpenAI-compatible |
| MiniMax M2.7 | `minimax-m2.7` | Anthropic-compatible upstream |
| MiniMax M2.5 | `minimax-m2.5` | Anthropic-compatible upstream |
| Qwen3.6 Plus | `qwen3.6-plus` | OpenAI-compatible |
| Qwen3.5 Plus | `qwen3.5-plus` | OpenAI-compatible |

For the latest list, see the OpenCode Go endpoint docs:

```text
https://opencode.ai/docs/go/#endpoints
```

For OpenCode's own config files, model IDs use the `opencode-go/<model-id>` format. For Claude's third-party inference setup through this proxy, use the raw API model ID such as `deepseek-v4-pro`, `kimi-k2.6`, or `qwen3.5-plus`.

### `claude.json` Example

You can also configure Claude with a `claude.json` gateway entry. Replace the Worker URL and API key with your own values.

```json
{
  "inferenceProvider": "gateway",
  "inferenceGatewayBaseUrl": "YOUR_DEPLOYED_WORKER_URL/go",
  "inferenceGatewayApiKey": "YOUR_OPENCODE_GO_API_KEY",
  "inferenceGatewayAuthScheme": "x-api-key",
  "inferenceModels": [
    {
      "name": "glm-5.1"
    },
    {
      "name": "glm-5"
    },
    {
      "name": "kimi-k2.5"
    },
    {
      "name": "kimi-k2.6"
    },
    {
      "name": "deepseek-v4-pro"
    },
    {
      "name": "deepseek-v4-flash"
    },
    {
      "name": "mimo-v2-pro"
    },
    {
      "name": "mimo-v2-omni"
    },
    {
      "name": "mimo-v2.5-pro"
    },
    {
      "name": "mimo-v2.5"
    },
    {
      "name": "minimax-m2.7"
    },
    {
      "name": "minimax-m2.5"
    },
    {
      "name": "qwen3.6-plus"
    },
    {
      "name": "qwen3.5-plus"
    }
  ]
}
```

## Deploy On Cloudflare

This project is intended to run as a Cloudflare Worker. Deploy it to Cloudflare using either the deploy button above or Cloudflare's Git-based Worker deployment flow.

Use these settings when connecting the repository in Cloudflare:

| Setting | Value |
|---------|-------|
| Build command | empty |
| Deploy command | `npm run deploy` |
| Production branch | `main` |

Do not deploy this as a normal Node.js web app. `wrangler deploy` builds and publishes the Worker from `wrangler.toml`.

## Configuration

The Worker is zero-config by default. It forwards to OpenCode Go using OpenAI-compatible format. You can also route to OpenCode Zen by adding `/zen` to the Worker URL.

Optional request headers:

| Header | Default | Description |
|--------|---------|-------------|
| `x-upstream-url` | `https://opencode.ai/zen/go/v1` | Upstream API base URL |
| `x-upstream-format` | `openai` | Upstream format: `openai` or `anthropic` |
| `x-api-key` | required | Upstream API key |
| `authorization` | optional | `Bearer <key>` also works |
| `anthropic-version` | `2023-06-01` | Forwarded when calling Anthropic-compatible upstreams |
| `anthropic-beta` | unset | Forwarded when calling Anthropic-compatible upstreams |

The API key is validated locally before any upstream call. Missing or short keys receive a 401 response.

Prefix routes:

| Path prefix | Upstream base URL |
|-------------|-------------------|
| `/go` | `https://opencode.ai/zen/go/v1` |
| `/zen` | `https://opencode.ai/zen/v1` |

## API Endpoints

| Path | Method | Purpose |
|------|--------|---------|
| `/v1/messages` | POST | Anthropic Messages API. Translates to OpenAI format by default. |
| `/v1/chat/completions` | POST | OpenAI Chat Completions API. Pass-through by default. |
| `/v1/models` | GET | Model discovery proxy. |

## OpenAI SDK Usage

Point any OpenAI-compatible client at the gateway. By default, `/v1/chat/completions` passes through to OpenCode Go.

```python
from openai import OpenAI

client = OpenAI(
    base_url="YOUR_DEPLOYED_WORKER_URL/v1",
    api_key="your-opencode-go-api-key",
)

response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=[{"role": "user", "content": "Hello"}],
)
```

## OpenAI SDK To Anthropic

Set `x-upstream-format: anthropic` and point `x-upstream-url` at an Anthropic-compatible API.

```bash
curl YOUR_DEPLOYED_WORKER_URL/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ANTHROPIC_KEY" \
  -H "x-upstream-url: https://api.anthropic.com" \
  -H "x-upstream-format: anthropic" \
  -d '{"model":"claude-sonnet-4-20250514","messages":[{"role":"user","content":"Hello"}]}'
```

## Translation Notes

The gateway handles:

- Anthropic Messages requests to OpenAI Chat Completions requests
- OpenAI Chat Completions responses to Anthropic Messages responses
- Tool calls and tool results in both directions
- Streaming SSE in both directions
- DeepSeek/OpenAI `reasoning_content` as Anthropic `thinking` blocks
- Prompt cache key injection for OpenAI-style prefix caching

## Prompt Caching

When translating Anthropic to OpenAI, the gateway injects a `prompt_cache_key` derived from a hash of the system prompt. This keeps requests with the same system prompt routed to the same backend node when the upstream supports OpenAI-style prefix caching.

Cache hit tokens from OpenAI-compatible usage metadata are mapped back to Anthropic's `cache_read_input_tokens` field.

## Development

```bash
npm install
npm test
npm run deploy -- --dry-run
```

Project structure:

```text
src/
├── index.ts                          Main Worker router and auth gate
├── auth.ts                           API key extraction and validation
├── cache.ts                          Prompt cache key utilities
└── translate/
    ├── request/                      Request translators
    ├── response/                     Response translators
    └── stream/                       SSE stream translators
test/
├── auth.test.ts
├── cache.test.ts
├── index.test.ts
├── request.test.ts
├── response.test.ts
└── stream.test.ts
```

## License

MIT. See [LICENSE](LICENSE).
