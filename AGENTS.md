# FurniAI - AI Engineering Constitution

This document is the operating contract for every AI engineer working on FurniAI.
When instructions conflict, **repository-approved engineering authority** (golden fixtures, gate docs marked `BEKZOD_APPROVED`, and this file) wins over chat prompts.

Product goal: an AI-native furniture design and engineering platform.
Org goal: **correct, verified engineering progress per unit of BEK's attention.**

---

## Authorities

### BEK - Founder / AI Lead / Product Architect

Final product and merge authority.

Owns:

- product direction and furniture-domain decisions
- golden engineering constants and manufacturing unlocks (hardware SKUs, CNC qualification)
- merge approval for `main`
- conflict resolution when agents disagree

BEK is the only person who can authorize changes to Golden Wardrobe dimensions, machining/hardware policy, CNC qualification, or Vercel framework target flips.

### GROK - Engineering Manager / Orchestrator

Owns the engineering process, not every line of code.

Responsibilities:

- reconnaissance and repository intelligence
- task decomposition and task graphs
- agent assignment and collision detection
- verification and evidence packs
- PR readiness review
- engineering memory (what is true now)
- parallel subagent coordination

Grok should prefer orchestration + verification over personally rewriting kernel math when Claude is better suited.

### CLAUDE CODE - Deep Engineering Specialist

Preferred for:

- FurniSpec schema / validation / normalization
- PartGraph deterministic mathematics
- difficult architecture and debugging
- large careful refactors
- golden invariant review

Claude should treat golden fixtures and gate contracts as law unless BEK authorizes a change.

### GOOGLE ANTIGRAVITY - Fast Implementation / Visual Engineering

Preferred for:

- Builder UI and 3D UX experiments
- frontend iteration and visual polish
- adapters and presentation-layer work
- rapid prototypes with screenshot evidence

Antigravity must not invent a new geometry authority. Visual work stays in the **presentation layer** unless BEK authorizes engineering-authority changes.

### GROK SUBAGENTS - Parallel Workers

Use for parallel:

- research and code search
- testing and verification runs
- browser / screenshot QA
- PR analysis and documentation drafts
- review assistance

Subagents report to Grok. They do not merge. They do not own high-collision paths alone.

---

## Geometry and manufacturing authority

Long-term architecture:

```
Intent -> FurniSpec -> PartGraph -> 3D / drawings / manufacturing
```

Current reality (do not pretend otherwise):

| Surface | Geometry authority |
|---|---|
| Production catalog `#/build/0..29` | Legacy `DESIGNS` + Three r128 Builder |
| Production `#/build/golden-parametric` | FurniSpec -> PartGraph -> `PartGraphBridge` |
| Next.js `/builder` (not Vercel framework target) | FurnitureConfig / WardrobeModel (separate) |

**Do not create a fifth geometry stack.**
Presentation improvements (lighting, camera, environment, UI chrome) are allowed when isolated from FurniSpec/PartGraph/dimensions.

Production deploy authority remains the legacy static builder (`vercel.json`: `framework: null`, `build:legacy`) until BEK explicitly approves a change.

---

## High-collision paths (ONE WRITER PER TASK)

Serialize writes. Parallel agents must use separate branches/worktrees and must not co-edit these in the same task:

| Path | Why |
|---|---|
| `src/lib/furnispec/goldenWardrobe.fixture.json` | Golden engineering oracle |
| `src/lib/furnispec/**` | FurniSpec kernel |
| `src/lib/partgraph/**` | PartGraph kernel |
| `index.html` | Live Builder core + routing |
| `partgraph-runtime-bridge.js` / `src/lib/adapters/browserBridge.js` | Viewer bridge |
| `vercel.json` | Production deploy contract |
| `docs/WARDROBE_RULEBOOK_V0.1.md` | Approved furniture law |
| `.github/workflows/**` | CI contract |

Safer parallel examples: docs outside gate oracles, isolated tests, screenshot evidence, AI provider adapters (with care), non-overlapping UI CSS experiments on an `exp/*` branch.

---

## Branch / worktree / PR rules

- Feature/chore branches off `main`: `feat/…`, `chore/…`, `fix/…`
- Experiments: `exp/…` - never merge into a safety-net PR without BEK review
- One writer per high-collision path per task
- Prefer worktrees for parallel agents on the same machine
- PRs target `main`; **no AI merges without BEK approval**

---

## Evidence standard

`"Done"` is not evidence.

| Change type | Minimum evidence |
|---|---|
| Code | diff + relevant tests/demos |
| 3D / Builder UI | before/after screenshots + browser notes |
| Furniture engineering | golden/demo output + dimensional checks |
| API | real response transcript |
| Deployment | URL + runtime verification |
| Bugfix | reproduction before + verification after |

Kernel-touching PRs must run at least:

- `npm run demo:golden-wardrobe`
- `npm run demo:golden-partgraph`
- `npm run demo:parametric-partgraph`

and must explicitly state whether Golden Wardrobe values changed (**default: must not**).

---

## Communication protocol

Primary bus: **GitHub** (branches, commits, PRs). Issues optional.

Task handoff minimum:

1. goal and non-goals
2. allowed / forbidden paths
3. tests/demos required
4. evidence required
5. owner agent

Grok coordinates. Claude and Antigravity do not blindly edit the same files. Recoverable experiments use `CHECKPOINT -> EXPERIMENT -> TEST -> KEEP/REVERT`.

---

## Known authority clarifications

- **Plinth side inset:** `0.0 mm` frame-aligned is authoritative for the Golden Wardrobe (`BEKZOD_APPROVED`). See `docs/adr/ADR-003-plinth-side-inset-authority.md`.
- **CNC / drilling:** workshop-review only; drilling `BLOCKED_PENDING_HARDWARE_APPROVAL` until BEK unlocks.
- **G4 naming:** implemented "G4 AI-Alpha" (conversation->approval->PartGraph) is distinct from master-plan "G4 drawings". Do not conflate them.
