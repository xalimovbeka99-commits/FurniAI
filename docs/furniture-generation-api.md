# Furniture Generation API

`POST /api/v1/furniture/generate` — turns a natural-language furniture idea
into a validated [FSL v1](fsl-v1.md) document, plus (best-effort) a payload
for the existing `/builder` configurator.

```
Next.js route (src/app/api/v1/furniture/generate/route.js)
  -> FurnitureGenerationService (src/lib/services/furnitureGenerationService.js)
       -> FurnitureBrain (src/lib/furniture-brain/brain.js)
            -> AI provider (src/lib/ai-provider — Anthropic today)
            -> Furniture Knowledge (src/lib/furniture-knowledge)
       -> FSL Validator (src/lib/fsl/validator.js)
       -> Configurator Adapter (src/lib/configurator-adapter/adapter.js)
            -> configSchema.js's existing validateConfig() gate
```

This is a new, additive endpoint. It does not modify or replace
`api/chat.js` (live static-site agent) or `src/app/api/cad-lab/route.js`
(the separate tool-based CAD Lab experiment).

## Environment

Reuses the existing `ANTHROPIC_API_KEY` (see `.env.example`) — no new
environment variable was introduced.

## Request

```json
{
  "message": "Create a modern white wardrobe, 2400 mm wide, 2600 mm high and 600 mm deep, with four hinged doors, six drawers, internal shelves, hanging rails and LED lighting.",
  "attachments": [
    { "media_type": "image/jpeg", "data": "<base64>" }
  ],
  "conversation_id": null,
  "project_id": null,
  "options": {
    "allow_defaults": true,
    "target": "configurator",
    "include_explanation": true
  }
}
```

- `message` — string, 3–4000 characters after trimming. Required UNLESS at
  least one attachment is provided, in which case it may be omitted or
  empty (a photo/PDF alone is a valid starting point — Pillar 1: multi-
  channel input).
- `attachments` — optional array (max 5) of `{ media_type, data }`, where
  `data` is base64. `media_type` must be one of `image/jpeg`, `image/png`,
  `image/gif`, `image/webp`, or `application/pdf` (~6MB decoded max each).
  Sent to Claude as native vision/document content — no separate OCR/CV
  step. The model only extracts what it can genuinely see or read; it never
  follows instructions found inside an attachment (same injection defense
  as `message` — see `promptTemplate.js`).
- `conversation_id` / `project_id` — optional strings, echoed into
  `fsl.metadata` for future persistence; nothing reads them back yet.
- `options.allow_defaults` (default `true`) — when `false`, anything not
  explicitly stated becomes a `missing_information` entry instead of a
  knowledge-base default.
- `options.target` — `"concept"` (default) or `"configurator"`.
  `"configurator"` is held to the same validation rules today but its
  `fsl.status` reflects whether it's actually renderable (`ready` vs.
  `partially_supported`), where `"concept"` reports `draft` when fully
  compatible.
- `options.include_explanation` (default `true`) — when `false`, the
  `interpretation` block is omitted from the response.

## Example: `curl`

```bash
curl -X POST http://localhost:3000/api/v1/furniture/generate \
  -H "Content-Type: application/json" \
  -d '{
    "message": "A modern white wardrobe, 2400mm wide, 2600mm high, 600mm deep, four hinged doors, six drawers, internal shelves, hanging rails and LED lighting.",
    "options": { "target": "configurator" }
  }'
```

## Success / needs_clarification response

```json
{
  "request_id": "…",
  "status": "success",
  "data": {
    "fsl": { "fsl_version": "1.0", "status": "partially_supported", "...": "…" },
    "configurator": {
      "compatible": false,
      "unsupported_fields": [
        { "field": "components[rail-group-1]", "code": "UNSUPPORTED_CONFIGURATOR_FEATURE", "message": "\"hanging_rail\": No hanging-rail geometry exists in the current configurator." }
      ],
      "adapter_payload": { "type": "wardrobe", "...": "the mapped FurnitureConfig, or null if the type has no configurator mapping at all" }
    },
    "interpretation": {
      "summary": "…",
      "explicit_requirements": ["Width: 2400mm", "…"],
      "defaults_applied": ["Style finish: matte (default)", "…"],
      "clarifications_required": []
    }
  },
  "errors": []
}
```

`status` is `"needs_clarification"` (still HTTP 200) when
`data.fsl.missing_information` contains a required entry — see
[fsl-v1.md](fsl-v1.md#status) for the full status table.

## Error response

```json
{
  "request_id": "…",
  "status": "error",
  "data": null,
  "errors": [
    { "code": "INVALID_DIMENSION", "field": "dimensions.depth_mm", "message": "…", "details": { "received": -100, "minimum": 250, "maximum": 900 } }
  ]
}
```

| Code | HTTP | When |
|---|---|---|
| `INVALID_REQUEST` | 400 | Malformed body / bad `options.target` / message too long / invalid `attachments` (bad type, too many, too large, non-base64) |
| `EMPTY_MESSAGE` | 400 | Both `message` is blank after trimming AND no `attachments` were provided |
| `UNSUPPORTED_FURNITURE_TYPE` | 422 | An assembled FSL document has a `furniture_type` outside the enum (defense-in-depth; the live NL path degrades to `needs_clarification` instead) |
| `INVALID_FSL` | 422 | Schema-level failure (wrong `fsl_version`, bad material enum) |
| `INVALID_DIMENSION` | 422 | A dimension is non-numeric, ≤ 0, or outside the category's hard bounds |
| `INVALID_COMPONENT` | 422 | Unknown component type or non-positive quantity |
| `UNSUPPORTED_CONFIGURATOR_FEATURE` | 200 | Not a blocking error — appears inside `data.configurator.unsupported_fields[].code` |
| `AI_PROVIDER_ERROR` | 502 | The AI provider call failed (including missing API key) |
| `AI_PROVIDER_TIMEOUT` | 504 | The AI provider didn't respond within the timeout (20s default) |
| `STRUCTURED_OUTPUT_ERROR` | 502 | The AI provider never returned a valid structured response, even after one repair attempt |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Running locally

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env.local
npm run dev
# POST http://localhost:3000/api/v1/furniture/generate
```

## Running tests

```bash
npm test          # vitest run — all tests, no live API calls
npm run test:watch
```

Every test mocks the AI provider — either `createFakeProvider()` (a small
heuristic NL extractor, see `src/lib/ai-provider/fakeProvider.js`), a fixed
canned object, or a function that throws to simulate provider failures.
`src/lib/ai-provider/anthropicProvider.test.js` mocks `@anthropic-ai/sdk`
itself to test the real provider's timeout/repair/error-mapping logic
without ever calling Claude.

## Extending

- **New furniture category**: add a `furniture-knowledge/<type>.js` file
  (dimension rules, defaults, component rules — model it on `wardrobe.js`),
  register it in `furniture-knowledge/index.js`'s `KNOWLEDGE_BY_TYPE`, and
  add a `CONFIGURATOR_TYPE_MAP` entry in `categories.js` if `/builder` can
  render it.
- **New component type**: add it to `fsl/enums.js COMPONENT_TYPES`, then add
  a matching entry to `furniture-knowledge/components.js`'s
  `CONFIGURATOR_COMPONENT_SUPPORT` (a startup check throws if you forget —
  see the bottom of that file).
- **New AI provider**: write a new file under `src/lib/ai-provider/`
  exporting `{ extractRequirements(message, attachments) }` (see
  `anthropicProvider.js`), and construct it in the route instead of
  `createAnthropicProvider()`. Nothing in `furniture-brain` needs to change.
  If the provider can't see images/PDFs itself, it can simply ignore the
  `attachments` argument (see `fakeProvider.js`).

## Current limitations

See [fsl-v1.md](fsl-v1.md#known-limitations-v1).

## Next recommended steps

1. Give `target: "configurator"` requests a second, stricter validation
   pass once real users start relying on `ready` vs. `partially_supported`
   (today both paths use identical dimension rules).
2. Wire `conversation_id`/`project_id` to Supabase once the saved-projects
   schema (`supabase/schema.sql`) is actually applied — right now they're
   accepted and echoed into `fsl.metadata` but nothing persists them.
3. ~~Add dedicated knowledge for the other four configurator-supported
   types~~ — done: `kitchen.js`, `bookcase.js`, `officeCabinet.js`
   (2026-07-22), and `sideboard.js` (2026-07-23, after confirming via a
   read-only audit that it had the same inherited-default mismatch
   `office_cabinet` had — the `cabinet` configurator type's 1800mm height
   default). All five configurator-supported types now have dedicated
   knowledge (see `docs/furniture-knowledge/*.md`).
4. Consider whether hanging rails and drawer boxes are worth adding to
   `buildGeometry.js` — they're the two most product-relevant gaps the
   compatibility system surfaces today.
5. Add a manual `/cad-lab`-style page for this endpoint so non-engineers can
   exercise it without `curl`.
