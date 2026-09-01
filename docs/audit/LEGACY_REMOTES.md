# LEGACY_REMOTES — external relationships of the legacy repository

Audit date: 2026-08-30. Companion to `BASELINE.md` and `SECURITY.md`.

**Nothing in this document has been changed, disconnected, archived or deleted.**
It is an inventory plus a detachment plan requiring explicit owner approval.

Tags: `[VERIFIED]` `[INFERRED]` `[UNVERIFIED]` `[RISK]` `[DECISION_REQUIRED]`

---

## 1. Git

| Item | Value | Evidence |
| --- | --- | --- |
| Remote `origin` (fetch) | `https://github.com/xalimovbeka99-commits/furnia.git` | `[VERIFIED]` |
| Remote `origin` (push) | same | `[VERIFIED]` |
| Other remotes | none | `[VERIFIED]` |
| Tracking branch | `main` → `origin/main` | `[VERIFIED]` |
| Local branches | 15 (see `BASELINE.md` §1) | `[VERIFIED]` |
| Tags | 0 | `[VERIFIED]` |
| History depth | 78 commits, from `b88ac91` (2026-06-18) to `4f4f1cd` (2026-08-30) | `[VERIFIED]` |
| `.git/` size | full history, includes every legacy branch | `[VERIFIED]` |

## 2. GitHub

| Item | Value | Evidence |
| --- | --- | --- |
| Owner | `xalimovbeka99-commits` | `[VERIFIED]` |
| Repository | `furnia` | `[VERIFIED]` |
| Visibility | not determined — not required for this audit | `[UNVERIFIED]` |
| Branch → deployment linkage | `main` is the Vercel production branch; feature branches produced Preview deployments (e.g. `93c7687` on `claude/M1-webgl-stability-recovery-20260817`) | `[VERIFIED]` deployments list |
| GitHub → Vercel auto-deploy | **Active.** Pushes to `main` trigger Production builds automatically | `[VERIFIED]` — four automatic builds followed the `f34a53a`/`4f4f1cd` pushes |

`[RISK]` The auto-deploy link is live. Any push to `main` in this repository deploys to
`furniai.vercel.app` without further action.

## 3. Vercel

| Item | Value | Evidence |
| --- | --- | --- |
| Project name | `furniai` | `[VERIFIED]` |
| Project ID | `prj_Ynh5dWulo2ndc9peCBmIVd9MQ0H2` | `[VERIFIED]` `.vercel/project.json` |
| Org / team ID | `team_dd65MomZZ9d1RAmMjVGtVvjJ` | `[VERIFIED]` `.vercel/project.json` |
| Team slug | `xalimovbeka99-commits-projects` | `[VERIFIED]` |
| Production domain | `https://furniai.vercel.app` | `[VERIFIED]` |
| Current production deployment | `myS5ZNUgx` (Ready) for commit `4f4f1cd` | `[VERIFIED]` |
| Deployment alias (that build) | `furniai-n0m4iit4p-xalimovbeka99-commits-projects.vercel.app` | `[VERIFIED]` |
| Custom domain attached | none observed | `[INFERRED]` — only `.vercel.app` domains appeared in the deployment panel |
| Node.js version | 22.x | `[VERIFIED]` |
| Deployment Checks | `Lint`, `TypeCheck` — Preview + Production | `[VERIFIED]` |
| Retention policy | Canceled 30 d · Errored 90 d · Pre-Production 180 d · Production 1 y | `[VERIFIED]` |
| Local linkage files | `.vercel/project.json`, `.vercel/README.txt` (untracked, gitignored) | `[VERIFIED]` |
| Stale linkage backup | `.vercel.bak/` — `project.json`, `repo.json`, `index.html`, `node`, `.env.preview.local` | `[VERIFIED]` `[RISK]` |

## 4. Other FurniAI URLs found in code and documentation

| URL | Where | Meaning |
| --- | --- | --- |
| `https://furniai.vercel.app` | current production | live `[VERIFIED]` |
| `https://furnia.vercel.app` | `.env.example:32` and `api/production.py:56` as the `FURNIAI_ALLOWED_ORIGINS` default | **stale alternate domain baked in as a default** `[RISK]` `[VERIFIED]` |
| `https://furnia-xalimovbeka99-commits-xalimovbeka99-commits-projects.vercel.app/` | `docs/LEGACY_BUILDER_PARITY_GATE.md` — frozen reference deployment | historical parity reference `[VERIFIED]` |
| `dpl_WmF7vQVWso7zpSfRHMk5RNirfkJj` | `docs/LEGACY_BUILDER_PARITY_GATE.md` | frozen reference deployment ID `[VERIFIED]` |
| `9b21e8b62d59d9d0fdad5d49d720c1f4c579b2e2` | `docs/LEGACY_BUILDER_PARITY_GATE.md` | frozen legacy source commit `[VERIFIED]` |

`[DECISION_REQUIRED]` The existence of both `furnia.vercel.app` and `furniai.vercel.app`
suggests an earlier Vercel project or rename. The owner should confirm whether a second
Vercel project still exists before any cleanup is considered.

## 5. Supabase

| Item | Value | Evidence |
| --- | --- | --- |
| Project ref | `upavdjmovubblowrxncp` | `[VERIFIED]` `api/production.py:38`, `index.html:2224` |
| Project URL | `https://upavdjmovubblowrxncp.supabase.co` | `[VERIFIED]` |
| Anon key | hardcoded as an env default in `api/production.py` and inline in `index.html` — value not reproduced here | `[VERIFIED]` see `SECURITY.md` |
| Usage | server-side token validation via `/auth/v1/user` (`api/production.py:544-556`); legacy browser client (dead) | `[VERIFIED]` |
| `supabase/` directory | present in the repository | `[VERIFIED]` |
| RLS status | **not verified** | `[UNVERIFIED]` `[RISK]` |

## 6. AI and messaging providers

| Provider | Reference | Evidence |
| --- | --- | --- |
| Anthropic | `@anthropic-ai/sdk@0.28.0`; `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | `[VERIFIED]` |
| OpenAI | `openai@4.104.0`; `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-5.6-luna` in `.env.example`) | `[VERIFIED]` |
| Provider order | `AI_PROVIDER_ORDER` (default `anthropic,openai`) | `[VERIFIED]` |
| WhatsApp Cloud API | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`; `/api/whatsapp/webhook` | `[VERIFIED]` |

## 7. Deployment configuration (`vercel.json`, tracked)

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "cleanUrls": true,
  "functions": {
    "api/production.py": {
      "maxDuration": 60,
      "includeFiles": "production-engine/furniai_engine/**",
      "excludeFiles": "{production-engine/**/output/**,production-engine/**/out*/**,production-engine/**/jobs/**,production-engine/**/test*.py,production-engine/**/run_all_harnesses.py}"
    }
  }
}
```
`[VERIFIED]`

Two lessons for the clean rebuild:

1. **`outputDirectory` is absent.** A dashboard override for a key `vercel.json` does not
   declare still wins — that is precisely what broke every Next.js build on 2026-08-30 (the
   dashboard's Output Directory `dist`, left over from the static-site era, against a
   `vercel.json` that only set `buildCommand`). Declare framework settings in one place. `[VERIFIED]`
2. **The `functions` block binds the Python factory engine into the deployment.** The clean
   v0.1 must not carry this block, or `/api/production` ships again by accident. `[RISK]`

---

## 8. What must NOT be copied into the clean rebuild

| Item | Reason |
| --- | --- |
| `.git/` | 78 commits of legacy history, 15 legacy branches, and the permanent record of a committed Supabase anon key. The rebuild requires fresh `main` history. |
| `.vercel/` | Binds the working copy to `prj_Ynh5dWulo2ndc9peCBmIVd9MQ0H2`. Copying it would make the "new" project deploy over the old one. |
| `.vercel.bak/` | Stale linkage **plus** a loose `.env.preview.local`. |
| Old Git remote (`origin` → `furnia.git`) | The new repository gets its own remote; the legacy one is never added. |
| Old project / org IDs | `prj_Ynh5…`, `team_dd65…` must not appear in any new config file. |
| Old deployment URLs as *active configuration* | `furnia.vercel.app` and `furniai.vercel.app` may appear in documentation as history, never as an `ALLOWED_ORIGINS` default or a runtime constant. |
| `.env.local`, `.env*.local`, `.env.preview.local` | Credentials. The new repo starts from a sanitized `.env.example` only. |
| Hardcoded Supabase URL and anon key | Even though the anon key is public by design, dead hardcoded integration code is rejected (see `REUSE_MATRIX.md`). |
| `.next/`, `out/`, `build/`, `test-results/`, `playwright-report/` | Generated. |
| `node_modules/` | Generated — and this copy is Windows-specific, which is exactly what blocked two audit gates. |
| `__pycache__/`, `*.pyc`, `production-engine` output/jobs | Generated. |
| `package-lock.json` | Only if the dependency strategy changes. If the rebuild keeps the same manager and pins, carrying the lockfile is defensible; if TypeScript, Zod and Prettier are added (they must be), the lockfile is regenerated anyway. `[DECISION_REQUIRED]` |
| `vercel.json` (as-is) | Written fresh: Next.js framework detection, repository root, no `functions` block for the Python engine, no `dist`. |
| `.claude/settings.local.json` | Local agent settings. |
| `debug.log`, `base_builder.txt`, `index_3.html`, `FurniAI/` | Dead artefacts. |

---

## 9. Clean-detachment checklist

Every step below requires explicit owner approval before execution. **None has been performed.**

**Phase A — confirm, change nothing**
1. `[DECISION_REQUIRED]` Confirm the authenticated GitHub owner for the new repository.
2. `[DECISION_REQUIRED]` Confirm the Vercel team that will hold the new project.
3. `[DECISION_REQUIRED]` Confirm whether a second Vercel project behind `furnia.vercel.app` still exists.
4. `[DECISION_REQUIRED]` Confirm Supabase RLS status before any auth work is planned.
5. `[DECISION_REQUIRED]` Confirm the `FurniAI/` deletion in the working tree was intentional.
6. `[DECISION_REQUIRED]` Decide the fate of the 168-file CRLF churn (recommendation: discard, do not commit).

**Phase B — create the new home (additive only)**
7. Create a **new** empty directory outside this repository — never `git init` inside it.
8. Commit `.gitattributes` as the first commit, before any source.
9. Scaffold Next.js 16 + React 19 + **TypeScript** + **Zod** + Zustand + Vitest + Playwright + ESLint + **Prettier**.
10. Write a sanitized `.env.example` with no defaults that point at real projects.
11. Extract only the `REUSE_AS_IS` list from `REUSE_MATRIX.md`, by reading — never by copying directory trees.
12. Run a secret scan **before** the first push.

**Phase C — connect, additively**
13. Create the new GitHub repository under a new name (e.g. `furniai-clean`); confirm it does not already exist.
14. Push fresh `main`; record repository URL and commit SHA.
15. Create a **new** Vercel project linked only to the new repository; use framework detection and the repository root.
16. Add only the environment variables the new code actually reads.
17. Deploy the exact SHA that passed local gates; verify `/`, `/builder`, `/api/health`.
18. Record deployment URL, deployment ID, project name and SHA.
19. **Do not attach any custom domain.** **Do not touch `furniai.vercel.app`.**

**Phase D — legacy disposition (owner decision, later)**
20. Keep `xalimovbeka99-commits/furnia` and Vercel project `furniai` **running and untouched** until the rebuild is verified in production.
21. Only then, and only with written approval, consider archiving the legacy repository (archive, never delete) and pausing the legacy Vercel project (pause, never delete).
22. Preserve this `docs/audit/` package — copy it into the new repository as the migration record.

`[RISK]` Until Phase D, two deployments describe themselves as FurniAI. Decide which URL is
authoritative before sharing either one with customers.
