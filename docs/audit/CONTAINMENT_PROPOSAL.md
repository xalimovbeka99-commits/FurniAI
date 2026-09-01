# CONTAINMENT PROPOSAL — legacy production exposure

Status: **PROPOSAL ONLY. NOTHING EXECUTED.**
Date: 2026-08-30. Companion to `SECURITY.md`.
Repository classification: `LEGACY_SOURCE — READ-ONLY COMPONENT REFERENCE`

No legacy source was modified. No deployment was changed. No environment value was read,
printed or rotated. Execution of every option below requires separate owner approval.

Tags: `[VERIFIED]` `[UNVERIFIED]` `[RISK]` `[DECISION_REQUIRED]`

---

## 1. The four exposures, ranked

| # | Exposure | What can go wrong | Severity | Reversible? |
| --- | --- | --- | --- | --- |
| **E1** | `/api/wardrobe/chat`, `/api/sales-agent`, `/api/v1/furniture/generate` accept unauthenticated public POSTs and each invokes a **paid** LLM provider | Anyone who finds the endpoints can spend your Anthropic/OpenAI balance at scale. No login, no origin check, no quota. `[VERIFIED]` | **High — financial** | n/a (spend is not recoverable) |
| **E2** | No rate limiting anywhere in the codebase | Amplifies E1 from "someone can call it" to "someone can call it thousands of times a minute". Also exposes `/api/production` and `/api/whatsapp/webhook`. `[VERIFIED]` | **High** | n/a |
| **E3** | Landing page presents `CNC INTEGRATED CONFIG`, `0.0 mm TOLERANCE LIMIT`, `Direct FACTORY DISPATCH`, "send your spec straight to production" while the Python engine is `FACTORY_QUALIFICATION_REQUIRED` | A customer or partner reads a manufacturing guarantee you cannot yet honour. This is a commercial/legal exposure, not a technical one. `[VERIFIED]` | **Medium–High** | Yes (copy edit) |
| **E4** | `.vercel.bak/.env.preview.local` — a loose preview environment file on local disk | Whatever it names is sitting unencrypted in a OneDrive-synced folder. Never committed, so no repository exposure. `[VERIFIED]` — contents **not opened** | **Medium** | Yes |

E1 and E2 are one problem: **the endpoints are open and the meter is running.** Treat them together.

---

## 2. Options considered

### Option A — Remove provider API keys from Vercel Production env, then redeploy ✅ **RECOMMENDED for E1+E2**

Delete `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` from the `furniai` project's **Production**
environment, then trigger one redeploy so the running deployment picks up the change.

- **Effect:** every AI route fails closed. The existing code already handles this —
  `providerRouter` skips unconfigured providers and the route returns
  `503 AI_PROVIDER_UNAVAILABLE`. No stack trace, no key, no partial behaviour. `[VERIFIED]` from route source.
- **Kills:** the entire financial exposure, immediately and completely.
- **Costs:** the "Ask AI" panel stops working. The manual builder, landing page and gallery are unaffected — the master plan already requires the manual builder to survive provider failure.
- **Zero source changes.** Works on any Vercel plan. Fully reversible by re-adding the keys.
- **Caveat:** environment changes do **not** auto-redeploy; a redeploy is required for them to take effect. `[VERIFIED]` — that redeploy is the only production action.

### Option B — Vercel Deployment Protection on the whole project

Turn on Vercel Authentication / Password Protection for Production.

- **Effect:** the entire site, including all API routes, requires authentication. Closes E1, E2 **and** E3 in one toggle.
- **Costs:** the public demo disappears. Anyone you have shared the URL with loses access.
- `[UNVERIFIED]` **Availability is plan-dependent.** The project shows Pro upsells (build machines, rolling releases, concurrent builds), which indicates a non-Pro plan; production-scope protection may not be available. Verify in Settings → Deployment Protection before relying on this.

### Option C — Take the deployment offline (unassign the production domain)

- **Effect:** `furniai.vercel.app` stops resolving to the app. Total containment.
- **Costs:** nothing works, including anything you want to show people. Heaviest possible action.
- **Note:** unassigning an alias is reversible; **deleting** the project or deployments is not, and is out of scope under the destructive-action prohibition.

### Option D — Add rate limiting and auth to the legacy code ❌ **NOT RECOMMENDED NOW**

- **Effect:** fixes E1/E2 properly.
- **Why not:** it is product development inside a repository just classified `READ-ONLY COMPONENT REFERENCE`, it builds on the architecture being migrated away from, and it needs a source change, a commit into the CRLF-churned working tree, and a deploy. The clean rebuild carries rate limiting from its first API commit instead (Phase 1 plan, Wave 8).

### Option E — Vercel Firewall / edge rate-limit rules

- **Effect:** rate limiting with no code change.
- `[UNVERIFIED]` Persistent custom rules are a paid-plan feature; Attack Challenge Mode is broadly available but is a bot-mitigation blunt instrument, not a per-route quota. Worth checking, but do not depend on it.

---

## 3. Recommended sequence

**The safest temporary action is Option A — not taking the deployment offline.**
It removes the entire financial exposure with one env change and one redeploy, keeps the
manual builder demonstrable, requires no source modification, and reverses in a minute.
Going fully offline (Option C) buys containment you do not need and costs you the demo.

| Step | Action | Addresses | Approval |
| --- | --- | --- | --- |
| 1 | Remove `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` from `furniai` → Settings → Environment Variables → **Production**. Redeploy once. Verify `/api/wardrobe/chat` returns `503 AI_PROVIDER_UNAVAILABLE` and `/builder` still renders. | E1, E2 | `[DECISION_REQUIRED]` |
| 2 | **Owner-only, local:** open `.vercel.bak\.env.preview.local` yourself, note which credentials it names, rotate those, then delete the whole `.vercel.bak` folder. I have not opened it and will not. Deletion in that folder is also blocked for me by design. | E4 | `[DECISION_REQUIRED]` |
| 3 | Decide E3. Two honest routes — **(a)** one minimal, copy-only commit to the landing page replacing the four claims with accurate language ("millimetre-precision configurator", "spec sheet ready for your maker"), which is the only exception I would ask you to make to the read-only rule; or **(b)** leave the copy and accept that the public page overstates the product until the clean rebuild replaces it. Doing nothing is a choice, not a default. | E3 | `[DECISION_REQUIRED]` |
| 4 | Check Settings → Deployment Protection to learn what your plan actually offers. Information only — no change. | future | safe |
| 5 | Leave `/api/production` and `/fsl-lab` as they are. Step 1 does not touch them; neither costs money per request, and both disappear when the clean rebuild takes over. | — | none |

**Explicitly not proposed:** deleting any deployment, project, repository, branch or domain;
rotating any credential on your behalf; opening any environment file; modifying legacy source
outside the single optional copy-only commit in step 3.

**If you approve nothing:** the standing exposure is that three paid endpoints remain open to
the internet with no quota. That is a real, ongoing cost risk, and it is the one item I would
not leave open indefinitely.
