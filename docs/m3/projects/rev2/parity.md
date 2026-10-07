## Parity: 82.8 / 100

> **Note:** the layout score here compares rev-1 screenshots (1200 px, FIXTURE) with rev-2 (1440 px / 390 px, SYNTHETIC/MOCKED). There is no "original app" screen for the concept gallery, so it measures how much the layout changed in rev 2 (new banner, intro, Concept label, Result row, availability note), **not** parity. The feature score against the brief (features.csv: original = required by the brief) is the number that matters: 93.1, must-haves 25/26 (the mount is a proposal only).

features 93.1  (31 counted, must-haves 25 of 26 done)
layout   41.8  (11 screens compared)

Not shippable yet: 1 must-have features are not done.

## By area, weakest first
- integration                   56.2  (3 features)
- retry                         80.0  (2 features)
- gallery list                  87.5  (2 features)
- card                          92.9  (5 features)
- states                       100.0  (8 features)
- reload                       100.0  (3 features)
- billing                      100.0  (3 features)
- polling                      100.0  (1 features)
- visual                       100.0  (3 features)
- a11y                         100.0  (1 features)

## Missing, in build order
- [must] integration: Mount on agreed mount point, partial  (no agreed mount in f472aef; MOUNT_PROPOSAL.md updated; index.html untouched)
- [should] integration: Reuse AG generic authed request, no  (not exported by designsApiClient (AG request AG-1))
- [should] card: Card: reference thumbnail when one exists, partial  (host hook resolveReferenceThumbnail; contract rev 2 has no thumbnail field (Claude request C-2); placeholder otherwise)
- [should] retry: No auto retry inside AE viewer, partial  (AE viewer v2.1 re-resolves once internally; question AE-1)
- [could] gallery list: List beyond 50 jobs, partial  (truncated note shown; pagination is Claude request C-1)

## Screens
- artifacts/rev2/mobile/03-list-rev2-fixture.SYNTHETIC.png  22.4
- artifacts/rev2/desktop/20-asset-unavailable-410.SYNTHETIC.png  39.3
- artifacts/rev2/desktop/19-asset-not-ready-409.SYNTHETIC.png  39.7
- artifacts/rev2/desktop/01-loading.SYNTHETIC.png  42.4
- artifacts/rev2/desktop/09-signed-out-401.SYNTHETIC.png  42.7
- artifacts/rev2/desktop/03-list-rev2-fixture.SYNTHETIC.png  44.4
- artifacts/rev2/desktop/16-not-configured-503.SYNTHETIC.png  45.4
- artifacts/rev2/desktop/12-server-5xx.SYNTHETIC.png  45.5
- artifacts/rev2/desktop/02-empty.SYNTHETIC.png  46.0
- artifacts/rev2/desktop/23-integrity-409.SYNTHETIC.png  46.0
- artifacts/rev2/desktop/11-network-error.SYNTHETIC.png  46.3
