# SECURITY — non-destructive audit of the legacy FurniAI repository

Audit date: 2026-08-30. Companion to `BASELINE.md`.

**No credential value was read, printed, copied, transmitted or rotated during this audit.**
`.env.local` was never opened; only its variable *names* were listed. Nothing in this document
contains a secret value.

Tags: `[VERIFIED]` `[INFERRED]` `[UNVERIFIED]` `[RISK]` `[KNOWN_GAP]` `[DECISION_REQUIRED]`

---

## 1. Environment files

| File | Tracked in Git? | Ever committed? | Gitignored? | Notes |
| --- | --- | --- | --- | --- |
| `.env.example` | **Yes** (intended) | yes | n/a | Template only — every value is blank except two non-secret defaults `[VERIFIED]` |
| `.env.local` | No | **No** — never appears in `git log --all --diff-filter=A` | Yes (`.env*.local`) | Present on disk. Contains 2 variable names: `ANTHROPIC_API_KEY`, `VERCEL_OIDC_TOKEN` `[VERIFIED]` |
| `.vercel.bak/.env.preview.local` | No | No | Yes (`.vercel.bak`) | **Stale environment file left on disk in a backup folder** `[RISK]` |
| `.claude/settings.local.json` | No | No | Yes | `[VERIFIED]` |

`[VERIFIED]` `git ls-files | grep -Ei '^\.env|^\.vercel|settings\.local'` returns only `.env.example`.
`[VERIFIED]` `git log --all --diff-filter=A --name-only` contains no `.env.local`, no `.vercel/`,
no `settings.local.json` — **no environment file has ever entered this repository's history.**

## 2. Gitignore coverage

`.gitignore` covers: `/node_modules`, `/coverage`, `/test-results`, `/playwright-report`,
`/blob-report`, `__pycache__/`, `*.py[cod]`, `.venv/`, `production-engine` output/jobs dirs,
`/.next/`, `/out/`, `/build`, `.DS_Store`, `*.pem`, debug logs, `.env*.local`,
`.claude/settings.local.json`, `.vercel`, `.vercel.bak`, `debug.log`. `[VERIFIED]`

Assessment: **adequate**. Every category the master plan names is covered. `[VERIFIED]`
`[KNOWN_GAP]` No `.gitattributes` (see `BASELINE.md` §7-8) — a hygiene gap, not a security one.

## 3. Hardcoded URLs and public keys

| Category | Location | Tracked? | Historical exposure possible? | Assessment |
| --- | --- | --- | --- | --- |
| Supabase project URL | `api/production.py:36-38` (env default), `index.html:2224` | **Yes** | Yes — in history since committed | Public by design. Still identifies the project to anyone reading the repo `[RISK-low]` |
| Supabase **anon** key (JWT) | `api/production.py:40-43` (env default), `index.html:2225` | **Yes** | Yes | Anon keys are public by design and safe to expose **only if** Row Level Security is enforced. **RLS status not verified** `[UNVERIFIED]` `[RISK]` |
| `FURNIAI_ALLOWED_ORIGINS` default | `api/production.py:52-56` → `https://furnia.vercel.app` | Yes | n/a | **Stale.** Current production is `furniai.vercel.app`. If the env var is unset in Vercel, the Python endpoint's origin allowlist points at a domain that is not the live site `[RISK]` `[DECISION_REQUIRED]` |
| Provider API keys | none found in tracked files | — | — | Only fake literals in tests (`sk-ant-should-never-be-logged`, `sk-ant-test-fake-key`, etc.), which exist precisely to assert redaction `[VERIFIED]` |
| AWS / GCP / other | none found | — | — | `[VERIFIED]` heuristic scan for `AKIA…`, `sk-…`, `eyJhbGciOi…` |

Scan command (patterns only, values never printed):
`git grep -nIE "sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{32,}|eyJhbGciOi[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}"` `[VERIFIED]`

## 4. Possible historical credential exposure

| Credential | Exposure route | Verdict |
| --- | --- | --- |
| Anthropic API key | present in local `.env.local` only; never committed | **No repository exposure** `[VERIFIED]`. Whether the key was exposed by other means (archives, ZIP handovers, screenshots) is outside this repository's evidence `[UNVERIFIED]` |
| Vercel OIDC token | `.env.local` only; short-lived by design | **No repository exposure** `[VERIFIED]` |
| Vercel account credential | `.vercel/` never committed | **No repository exposure** `[VERIFIED]` |
| Supabase anon key | **committed** in 2 tracked files | Exposed by design-category, but permanently in history `[VERIFIED]` |
| Supabase service-role key | not found anywhere in tracked files | **Not present** `[VERIFIED]` — good |
| WhatsApp token / verify token | read from env only; no literal in tracked files | **No repository exposure** `[VERIFIED]` |
| `.vercel.bak/.env.preview.local` | on disk, never committed | **No repository exposure**, but a loose env file `[RISK]` |

## 5. Secret-redaction implementation

`src/lib/ai-provider/errors.js` exports `classifySdkError()`, `toFslProviderError()`,
`isRetriableProviderFailure()`, `redactErrorForLogging()`, `errorCodeOf()`. `[VERIFIED]`

Every AI route catches, redacts, and returns a typed envelope rather than the raw provider
error — e.g. `/api/wardrobe/chat` returns `AI_PROVIDER_UNAVAILABLE` (503),
`AI_PROVIDER_TIMEOUT` (504), `WARDROBE_AGENT_ERROR` (500), and logs via
`redactErrorForLogging(err)`. `[VERIFIED]` (route source lines 84-98)

**Security-related tests** (5 files) assert that a key-shaped string never reaches logs or
responses, including when it arrives inside `error.cause`: `src/lib/ai-provider/errors.test.js`,
`providerRouter.test.js`, `openaiProvider.test.js`, `src/lib/apiChatSecurity.test.js`,
`src/app/api/{wardrobe/chat,sales-agent}/route.test.js`. `[VERIFIED]` by inspection;
**execution blocked** in this environment `[BLOCKED]`.

Assessment: **this is the strongest security control in the repository** and should migrate
first (see `REUSE_MATRIX.md`).

## 6. Client / server environment separation

- **Zero `NEXT_PUBLIC_*` variables anywhere in the repository.** `[VERIFIED]`
- Server-side reads only: `AI_PROVIDER_ORDER`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`,
  `FURNIAI_FOUNDER_PREVIEW`, `NODE_ENV`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `WHATSAPP_TOKEN`,
  `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` (Node) and `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `FURNIAI_ALLOWED_ORIGINS`, `VERCEL` (Python). `[VERIFIED]`
- **No provider key is exposed to the browser.** `[VERIFIED]`
- `FURNIAI_FOUNDER_PREVIEW` gates a `{provider, fallback}` debug field. The code comment
  states it never exposes keys or raw payloads, and the shape returned is limited to a provider
  name and a boolean `[VERIFIED]`. Enabling it in production is still a deliberate information
  disclosure `[DECISION_REQUIRED]`.
- Correct naming note: this codebase reads **`SUPABASE_URL` / `SUPABASE_ANON_KEY`** — the
  `NEXT_PUBLIC_`-prefixed variants are read by nothing and have no effect. `[VERIFIED]`

## 7. Supabase configuration risks

`[RISK]` `api/production.py` falls back to a **hardcoded project URL and anon key** when the
env vars are unset. The endpoint therefore works against the real project even with no
configuration — which hides misconfiguration and pins a specific project into source.
`[DECISION_REQUIRED]` Remove the defaults; fail closed instead.

`[UNVERIFIED]` Row Level Security status on the Supabase project. An anon key is only safe
when RLS is on for every table. **This must be confirmed before the clean rebuild reintroduces
Supabase.**

`[RISK]` `index.html` embeds the same URL and key inline in tracked source. The file is no
longer served, so this is now dead code that still advertises the project.

## 8. Application-layer findings

| Finding | Detail | Severity |
| --- | --- | --- |
| **No rate limiting anywhere** | No limiter, no throttle, no quota check in any route. `/api/wardrobe/chat`, `/api/sales-agent` and `/api/v1/furniture/generate` each invoke a paid LLM provider on unauthenticated public POSTs. | `[RISK]` **High — financial and abuse exposure** `[VERIFIED]` |
| **No authentication on the Next API** | Only `api/production.py` validates a bearer token. Every App Router endpoint is open. | `[RISK]` High `[VERIFIED]` |
| Input validation | `/api/wardrobe/chat` guards JSON parsing and calls `validateBody()`, returning `400 INVALID_JSON` / `400 INVALID_REQUEST`. Hand-written, not schema-driven. | `[RISK]` Medium — replace with Zod `[VERIFIED]` |
| WhatsApp webhook | `POST /api/whatsapp/webhook` with an empty body returned **200** in production. Whether Meta signature verification runs could not be determined without sending crafted payloads (out of scope). | `[RISK]` Medium `[UNVERIFIED]` |
| Public factory endpoint | `/api/production` is deployed and returns 200. The Python engine is `FACTORY_QUALIFICATION_REQUIRED`. | `[RISK]` Medium — quarantine is documentary, not enforced `[VERIFIED]` |
| `/fsl-lab` publicly routable | Internal experiment surface on the production domain, 340 lines, no tests. | `[RISK]` Low–Medium `[VERIFIED]` |
| Unsafe logging | Not found. Route error paths log through `redactErrorForLogging()`. | ✅ `[VERIFIED]` |
| Unsafe error responses | Not found. Responses use typed codes and generic messages; provider payloads are never echoed. | ✅ `[VERIFIED]` |
| Prohibited product claims | Landing page ships `CNC INTEGRATED`, `0.0 mm TOLERANCE LIMIT`, `FACTORY DISPATCH`, "straight to production" while the engine is unqualified. | `[RISK]` **Commercial/legal, not technical** `[VERIFIED]` — see `BASELINE.md` §6 |
| Vendored `three` r128 | 603 KB pinned bundle, far behind the `^0.166.0` npm dependency; unmaintained copy in tree. | `[RISK]` Low (no longer served) `[VERIFIED]` |

---

## 9. Credential-rotation checklist

**Nothing below has been rotated. This is a checklist for the owner to execute.**

| # | Credential | Reason | Classification |
| --- | --- | --- | --- |
| 1 | **Anthropic API key** | Present in `.env.local` inside a folder that has been zipped and handed between agents/machines; also the key most exposed to abuse given there is no rate limiting. Repository history is clean, so this is precautionary but cheap. | **RECOMMENDED** — becomes **REQUIRED BEFORE MIGRATION** if the key ever left this machine in an archive `[DECISION_REQUIRED]` |
| 2 | **OpenAI API key** | Same reasoning; declared in `.env.example`, so one exists somewhere. | **RECOMMENDED** `[DECISION_REQUIRED]` |
| 3 | **Vercel account token / CLI credential** | Not present in this repository. Rotate only if a token was ever pasted into a chat, archive or CI config. | **OWNER CONFIRMATION NEEDED** |
| 4 | `VERCEL_OIDC_TOKEN` in `.env.local` | Short-lived and auto-issued; regenerates on its own. | **NOT REQUIRED** |
| 5 | **Supabase anon key** | Public by design — rotation is not a security fix. What matters is confirming **RLS is enabled on every table**. | **NOT REQUIRED** (rotation) / **REQUIRED BEFORE MIGRATION** (RLS verification) |
| 6 | **Supabase service-role key** | Not found in the repository. If one exists elsewhere, it must never enter the new repo. | **OWNER CONFIRMATION NEEDED** |
| 7 | **WhatsApp token + verify token** | Env-only; no repository exposure. Rotate if the webhook is going live without signature verification. | **RECOMMENDED** |
| 8 | `.vercel.bak/.env.preview.local` | Loose preview environment file on disk. Inspect (owner only) and delete; rotate anything it names. | **REQUIRED BEFORE MIGRATION** `[DECISION_REQUIRED]` |

### Hardening items that are not rotations
- **REQUIRED BEFORE MIGRATION** — add rate limiting to every LLM-invoking endpoint.
- **REQUIRED BEFORE MIGRATION** — remove hardcoded Supabase defaults from `api/production.py`; fail closed.
- **REQUIRED BEFORE MIGRATION** — confirm Supabase RLS.
- **RECOMMENDED** — set `FURNIAI_ALLOWED_ORIGINS` explicitly in Vercel rather than relying on the stale default.
- **RECOMMENDED** — decide whether `/api/production` and `/fsl-lab` should be publicly routable at all.
- **RECOMMENDED** — replace hand-written body validation with Zod in the rebuild.
- **OWNER CONFIRMATION NEEDED** — confirm `FURNIAI_FOUNDER_PREVIEW` is unset in production.
