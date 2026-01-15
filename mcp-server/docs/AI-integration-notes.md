# AI & MCP Integration Notes for tm-editor / types-mcp

## Goal
Enable server-side AI extraction and enrichment so tm-editor features can:
- Run structured extraction (`runStructuredExtraction`) using the MCP server to return typed JSON (Trace Market types) from raw text/URLs.
- Auto-enrich imported products with `externalSources` (e.g., registry=`url`) by fetching page text and populating fields.
- Support chat/file enrichment in the AI tab via the same pipeline.

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

Implementing this server handler will unblock: structured fill of imported products, chat enrichment, and URL-based auto-population.
