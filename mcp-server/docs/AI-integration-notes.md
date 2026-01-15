# AI & MCP Integration Notes for tm-editor / types-mcp

## Quick Reference

### Supported Endpoints
- **MCP Server** (port 3456)
  - `POST /extract` - Extract product/process from text
  - `POST /suggest/food` - Get food product suggestions
  - `POST /suggest/non-food` - Get non-food product suggestions
  - `POST /decompose/non-food` - Decompose non-food into BOM
  - `GET /ag-ui/stream` - Real-time event streaming (SSE)
- **LCA Chat** (port 4173)
  - `POST /result/calculate` - Calculate product system LCA impacts

### Available AI Providers

| Provider | Default Model | Use Case |
|----------|---------------|----------|
| **Gemini** | `gemini-1.5-flash` (MCP) / `gemini-2.5-pro` (LCA) | General purpose, structured extraction |
| **Groq** | `llama-3.3-70b-versatile` | Fast inference, long context |
| **OpenRouter** | `openai/gpt-4o-mini` | Multi-provider access, cost optimization |

### Quick Examples

**Extract with Gemini 2.0:**
```bash
curl -X POST https://mcp.trace.market/extract \
  -H "Authorization: Bearer YOUR_GEMINI_KEY" \
  -H "x-ai-provider: gemini" \
  -H "x-ai-model: gemini-2.0-flash-exp" \
  -d '{"text":"Product description here"}'
```

**Decompose with Groq (fast):**
```bash
curl -X POST https://mcp.trace.market/decompose/non-food \
  -H "Authorization: Bearer YOUR_GROQ_KEY" \
  -H "x-ai-provider: groq" \
  -H "x-ai-model: llama-3.1-8b-instant" \
  -d '{"query":"plastic bottle"}'
```

**LCA with Claude reasoning:**
```bash
curl -X POST https://lca.trace.market/result/calculate \
  -H "Authorization: Bearer YOUR_OPENROUTER_KEY" \
  -H "x-ai-provider: openrouter" \
  -H "x-ai-model: anthropic/claude-3.5-sonnet" \
  -d '{"productSystem":{...}}'
```

## Goal
Enable server-side AI extraction and enrichment so tm-editor features can:
- Run structured extraction (`runStructuredExtraction`) using the MCP server to return typed JSON (Trace Market types) from raw text/URLs.
- Auto-enrich imported products with `externalSources` (e.g., registry=`url`) by fetching page text and populating fields.
- Support chat/file enrichment in the AI tab via the same pipeline.

## Authentication & Headers

All AI endpoints now support header-based authentication and configuration:

### Required Headers
- `Authorization: Bearer <API_KEY>` - Your AI provider API key
- `x-ai-provider: <provider>` - Provider name: `gemini`, `groq`, or `openrouter`
- `x-ai-model: <model>` - (Optional) Specific model to use

### Model Selection Examples

**Gemini Models:**
```bash
# Use Gemini 2.0 Flash Experimental
curl -X POST https://mcp.trace.market/extract \
  -H "Authorization: Bearer YOUR_GEMINI_KEY" \
  -H "x-ai-provider: gemini" \
  -H "x-ai-model: gemini-2.0-flash-exp" \
  -H "Content-Type: application/json" \
  -d '{"text": "..."}'

# Use Gemini 1.5 Flash (default)
curl -X POST https://mcp.trace.market/suggest/food \
  -H "Authorization: Bearer YOUR_GEMINI_KEY" \
  -H "x-ai-provider: gemini" \
  -d '{"query": "organic milk"}'

# With models/ prefix (both formats work)
curl -X POST https://mcp.trace.market/decompose/non-food \
  -H "Authorization: Bearer YOUR_GEMINI_KEY" \
  -H "x-ai-provider: gemini" \
  -H "x-ai-model: models/gemini-2.5-pro" \
  -d '{...}'
```

**Groq Models (5 options):**
```bash
# Llama 3.3 70B Versatile (default - most capable, newest)
curl -X POST https://mcp.trace.market/extract \
  -H "Authorization: Bearer YOUR_GROQ_KEY" \
  -H "x-ai-provider: groq" \
  -H "x-ai-model: llama-3.3-70b-versatile" \
  -d '{"text": "..."}'

# Llama 3.1 70B Versatile (very large context: 131K tokens)
curl -X POST https://mcp.trace.market/extract \
  -H "Authorization: Bearer YOUR_GROQ_KEY" \
  -H "x-ai-provider: groq" \
  -H "x-ai-model: llama-3.1-70b-versatile" \
  -d '{"text": "..."}'

# Llama 3.1 8B Instant (fastest, highest rate limits)
curl -X POST https://mcp.trace.market/extract \
  -H "Authorization: Bearer YOUR_GROQ_KEY" \
  -H "x-ai-provider: groq" \
  -H "x-ai-model: llama-3.1-8b-instant" \
  -d '{"text": "..."}'

# Mixtral 8x7B (great quality/speed balance)
curl -X POST https://mcp.trace.market/extract \
  -H "Authorization: Bearer YOUR_GROQ_KEY" \
  -H "x-ai-provider: groq" \
  -H "x-ai-model: mixtral-8x7b-32768" \
  -d '{"text": "..."}'

# Gemma 2 9B (lightweight, very high limits)
curl -X POST https://mcp.trace.market/extract \
  -H "Authorization: Bearer YOUR_GROQ_KEY" \
  -H "x-ai-provider: groq" \
  -H "x-ai-model: gemma2-9b-it" \
  -d '{"text": "..."}'
```

**OpenRouter Models (9 options):**
```bash
# GPT-4o (most capable OpenAI model)
curl -X POST https://mcp.trace.market/extract \
  -H "Authorization: Bearer YOUR_OPENROUTER_KEY" \
  -H "x-ai-provider: openrouter" \
  -H "x-ai-model: openai/gpt-4o" \
  -d '{"text": "..."}'

# GPT-4o Mini (fast & affordable OpenAI, default)
curl -X POST https://mcp.trace.market/extract \
  -H "Authorization: Bearer YOUR_OPENROUTER_KEY" \
  -H "x-ai-provider: openrouter" \
  -H "x-ai-model: openai/gpt-4o-mini" \
  -d '{"text": "..."}'

# Claude 3.5 Sonnet (best reasoning)
curl -X POST https://mcp.trace.market/extract \
  -H "Authorization: Bearer YOUR_OPENROUTER_KEY" \
  -H "x-ai-provider: openrouter" \
  -H "x-ai-model: anthropic/claude-3.5-sonnet" \
  -d '{"text": "..."}'

# Claude 3 Haiku (fast & affordable Anthropic)
curl -X POST https://mcp.trace.market/extract \
  -H "Authorization: Bearer YOUR_OPENROUTER_KEY" \
  -H "x-ai-provider: openrouter" \
  -H "x-ai-model: anthropic/claude-3-haiku" \
  -d '{"text": "..."}'

# Gemini 2.0 Flash (free via OpenRouter)
curl -X POST https://mcp.trace.market/extract \
  -H "Authorization: Bearer YOUR_OPENROUTER_KEY" \
  -H "x-ai-provider: openrouter" \
  -H "x-ai-model: google/gemini-2.0-flash-exp" \
  -d '{"text": "..."}'

# Llama 3.3 70B Instruct (open source flagship)
curl -X POST https://mcp.trace.market/extract \
  -H "Authorization: Bearer YOUR_OPENROUTER_KEY" \
  -H "x-ai-provider: openrouter" \
  -H "x-ai-model: meta-llama/llama-3.3-70b-instruct" \
  -d '{"text": "..."}'

# Qwen 2.5 72B Instruct (Chinese multilingual)
curl -X POST https://mcp.trace.market/extract \
  -H "Authorization: Bearer YOUR_OPENROUTER_KEY" \
  -H "x-ai-provider: openrouter" \
  -H "x-ai-model: qwen/qwen-2.5-72b-instruct" \
  -d '{"text": "..."}'

# OpenAI Embedding 3 Small (affordable embeddings)
curl -X POST https://mcp.trace.market/extract \
  -H "Authorization: Bearer YOUR_OPENROUTER_KEY" \
  -H "x-ai-provider: openrouter" \
  -H "x-ai-model: openai/text-embedding-3-small" \
  -d '{"text": "..."}'

# OpenAI Embedding 3 Large (best quality embeddings)
curl -X POST https://mcp.trace.market/extract \
  -H "Authorization: Bearer YOUR_OPENROUTER_KEY" \
  -H "x-ai-provider: openrouter" \
  -H "x-ai-model: openai/text-embedding-3-large" \
  -d '{"text": "..."}'
```

### LCA Chat Service
The `/result/calculate` endpoint also supports the same headers:
```bash
curl -X POST https://lca.trace.market/result/calculate \
  -H "Authorization: Bearer YOUR_GEMINI_KEY" \
  -H "x-ai-provider: gemini" \
  -H "x-ai-model: gemini-2.0-flash-exp" \
  -H "Content-Type: application/json" \
  -d '{"productSystem": {...}}'
```

### Fallback Behavior
If `x-ai-model` header is not provided, these defaults are used:

**Gemini API Defaults:**
- MCP Server: `gemini-1.5-flash`
- LCA Chat Service: `gemini-2.5-pro`

**Groq Defaults:**
- `llama-3.3-70b-versatile` (most capable, newest)

**OpenRouter Defaults:**
- `openai/gpt-4o-mini` (fast & affordable)

**Model Name Formatting:**
- Gemini: Auto-prefixed with `models/` if not present
  - `gemini-2.0-flash-exp` → `models/gemini-2.0-flash-exp`
  - `models/gemini-2.5-pro` → `models/gemini-2.5-pro` (unchanged)
- Groq & OpenRouter: Used as-is, no prefix needed

## Existing client-side hooks (tm-editor)
- `src/services/ai/AiEnrichmentService.ts`
  - `enrichFromPayload(payload)` aggregates: message text, uploaded files, and `externalSources` with `registry: "url"` or https `id`/`url`.
  - Fetches page text (sanitized HTML→text) and calls `runStructuredExtraction` (currently stub).
- `src/components/ai/AIChatPanel.vue`
  - On send, builds payload from text + file contents → `enrichFromPayload` → displays summary.
- `src/components/editors/ProductInstanceEditor.vue`
  - Post-import, we can call `enrichFromPayload` to populate product/process.

## What to implement server-side (MCP)
1) **Endpoint/handler** (HTTP or MCP action) that accepts:
   ```json
   {
     "text": "...aggregated plain text...",
     "attachments": [ {"name": "file.ext", "content": "..."} ],
     "context": {"source": "tm-editor", "schema": "trace-market"}
   }
   ```

2) **LLM/MCP chain**
   - Use your validated AI key/model (same provider as SemanticSearchEngine) OR a dedicated model for extraction.
   - Prompt to output JSON conforming to `@trace.market/types` (ProductInstance, Process, LocalInputInstance[], etc.).
   - If openLCA API is available, optionally enrich impacts: map to `Impact[]` (carbon/water), and attach to process.price/impacts when possible.

3) **Response shape**
   ```json
   {
     "summary": "short what-was-extracted",
     "populated": {
       "instance": { /* typed ProductInstance */ },
       "process": { /* typed Process with inputInstances */ }
     },
     "rawText": "(optional) echoed text"
   }
   ```
   - `populated` can include partial fields; client will merge.

4) **Error handling**
   - Return HTTP 200 with `{ summary: "...", populated: null, error: "message" }` on soft failures so UI can show placeholder.

## Wiring client → server
- In `AiEnrichmentService.ts`, replace the stub `runStructuredExtraction` with a call to your MCP/HTTP endpoint.
  Example:
  ```ts
  async function runStructuredExtraction(input: { text: string; attachments?: Attachment[] }) {
    const resp = await axios.post('<YOUR_MCP_ENDPOINT>/extract', input, { timeout: 30000 });
    return resp.data as EnrichmentResult;
  }
  ```
- Ensure CORS allows localhost:9000 (Quasar dev) and your prod origin.
- Keep the sanitization step (already present) to strip scripts/styles.

## Auto-enrichment on import
- After importing a product (OpenFoodFacts/Wizard) call `enrichFromPayload({ externalSources })` where `externalSources` includes registry=`url` or https ids.
- Merge `populated.instance` and `populated.process` into the local model (preserve existing inputInstances if present).

## Chat/file enrichment (AI tab)
- The chat panel already sends text + file contents to `enrichFromPayload`. Once wired, the assistant message will show the real extraction summary.

## openLCA hook (optional)
- If you have an openLCA API, add a server step to compute impacts and place them into `populated.process.impacts` or attach a separate `impacts` object; keep units clear.

## Validation & readiness
- `ai-config-updated` event is broadcast after Test Connection in settings. The chat and Flow suggestion UIs listen and refresh availability.
- Semantic search (for suggestions) uses the same AI config; ensure the MCP endpoint uses a compatible key/model or proxy through MCP.

## Input suggestions → move OFF + rerank server-side
- Goal: avoid running OpenFoodFacts fetch + semantic re-rank on the browser (slow on low-end devices) and return typed `LocalInputInstance[]`.
- Suggested MCP/HTTP handler: `POST https://mcp.trace.market/suggest/food`
  - Request: `{ title?: string, brand?: string, category?: string, type?: string, ids?: [{id, registry}], query?: string }`
  - Server steps: (1) fan out to OpenFoodFacts (or other catalog) using `title/type/query`, (2) run semantic re-rank with your GPU/LLM, (3) map top N to typed `LocalInputInstance` with stable `externalSources`, (4) dedupe by `instance.type`.
  - Response: `{ suggestions: LocalInputInstance[], summary?: string, error?: string }`
- Client wiring (tm-editor):
  1) Replace `suggestInputsFromQuery` in `src/services/ai/AiInputSuggester.ts` to `POST` the above endpoint with `{ title, brand, category, type, ids, query }` derived from the output instance.
  2) Respect `aiReady()` gating, reuse `ai-config-updated` for availability, and keep `lastQuery` debouncing in `NftInputsFlow.vue`.
  3) Ensure CORS allows dev/prod origins; keep a ~10s timeout to avoid UI stalls.
- Typesafety: the MCP handler should emit data already conforming to `LocalInputInstance`, so the client only needs to render, not transform, the results.

## Deploy notes
- Place this server alongside built tm-editor assets; expose the MCP/HTTP endpoint on localhost (dev) and your chosen host in prod.
- Keep timeouts generous (e.g., 30s) for extraction + fetch.

## Minimal contract summary
- **Request**: `{ text: string, attachments?: [{name, content}], context?: {...} }`
- **Response**: `{ summary: string, populated?: { instance?: ProductInstance, process?: Process }, rawText?: string, error?: string }`

## Client change notice (AG-UI events + provider preference)
### New streaming endpoint
- **SSE stream**: `GET https://add.trace.market/ag-ui/stream`
- Event name: `ag-ui`
- Payload shape: `{ eventType: string, payload?: any, requestId?: string, ts: number }`
- Common `eventType`s:
  - `extract-start`, `extract-complete`, `extract-error`
  - `suggest-food-start`, `suggest-food-complete`, `suggest-food-error`
  - `suggest-non-food-start`, `suggest-non-food-complete`, `suggest-non-food-error`
  - `decompose-non-food-start`, `decompose-non-food-complete`, `decompose-non-food-error`
  - `connected`, `heartbeat`

### Provider selection behavior
- `x-ai-provider` is now **respected first** for `/decompose/non-food`.
- If the preferred provider fails, the server may fall back to configured keys.
- Valid provider values: `gemini`, `openrouter`, `groq`.

Implementing this server handler will unblock: structured fill of imported products, chat enrichment, and URL-based auto-population.
