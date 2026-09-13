# FurniAI integration map (2026-09-11)

| Component | Agent | Branch / commit | Dependencies | Verification still missing |
|---|---|---|---|---|
| AI conversation + live model | Antigravity (+ Claude scripts) | `finish-visible-designer` @ `206ee06` | Anthropic / relay | Live model on **candidate** SHA |
| Conversational edits + Undo | Antigravity | same | intake schema | Width + Undo on candidate |
| Hanging-rail PREVIEW_ONLY | Grok → **Antigravity editor** | `exp/hanging-rail-preview` @ `5f416ce` | previews[] | Candidate-SHA screenshots |
| Unsupported fail-closed | Claude M2-OMIT | **MISSING** | validate/builder | Scenario 8 blocked |
| Material vs rail chrome | Antigravity | in designer + EXP-01 note | updateParametricMaterial | Candidate proof |
| Safety net | Grok merged | `main` @ `dc94bda` | — | included in integ |
| **Integration candidate** | Grok | `integ/ai-rails-viewer` | see SHA below | Journey §4 |

EXP-01 PR #2 draft open; historical `28f8677`; latest rails `5f416ce`. Not on main.
