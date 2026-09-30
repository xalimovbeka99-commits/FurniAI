# My Designs module — static Studio (pilot route)

**Owner:** Designs Engineer (`grok/my-designs-module`, worktree `FurniAI-Grok-Designs`)
**Base:** `c6bbe894e65adf39fd14ed2f449dcb52a82b228d` · **Written:** 2026-09-30 (Asia/Dubai) · local only, not pushed.
**Scope:** a framework-free DOM module that lists the signed-in customer's server-saved designs
and hands the chosen one to the Studio. Read-only: no create, rename, delete or save.

| Path | What |
|---|---|
| `src/lib/designs/myDesigns/state.js` | pure layer: reducer, error classifier, response parsers, fixed copy |
| `src/lib/designs/myDesigns/render.js`, `styles.js` | DOM rendering (no `innerHTML`), scoped `.fmd` CSS |
| `src/lib/designs/myDesigns/mountMyDesigns.js` | controller: `mountMyDesigns(rootEl, options)` + interface typedefs |
| `src/lib/designs/myDesigns/entry.js` | browser entry → IIFE global `FurniMyDesigns` |
| `src/lib/designs/myDesigns/fakeDesignsApiClient.js` | **test/demo only** fake of the 3 client methods (not bundled) |
| `src/lib/designs/myDesigns/*.test.js`, `__tests__/fakeDom.js` | unit tests (MOCKED) |
| `tests/contract/designs-api/**` | contract tests vs the real `api/designs/*` handlers (LOCAL in-process, memory store) |
| `demo/my-designs/**` | demo page, screenshot builder, mount-patch smoke |
| `docs/m3/patches/my-designs-mount.patch` | `index.html` mount patch for Antigravity (**not applied**) |
| `docs/m3/artifacts/my-designs/*.png` | screenshots (MOCKED data) |

## 1. API used (read-only)

The shapes come from `DESIGN_PERSISTENCE_API.md` §4. They are **pinned against the real handlers**
by `tests/contract/designs-api/designsApi.contract.test.js` (key sets in `shapes.js`).

| Step | Endpoint | Body the module reads |
|---|---|---|
| list | `GET /api/designs` | `{ ok, designs: [{ designId, ownerUserId, name, createdAt, updatedAt }] }`, `updatedAt` desc |
| open 1 | `GET /api/designs/:designId` | `{ ok, design: {…5 keys}, latestRevision: null \| { revision, fingerprint, specId, validationStatus, createdAt } }` |
| open 2 | `GET /api/designs/:designId/revisions/:revision` | `{ ok, designId, revision, fingerprint, furniSpec, partGraph, origins, validationStatus, createdAt }` |

How open works:
1. GET the design.
2. Take `latestRevision.revision` **exactly as the server states it**.
3. GET that revision.
4. Check that the body names exactly that `designId` and `revision`.
5. Call `onOpenDesign`.

If `latestRevision` is `null`, there is nothing to open (`no-revision`) and `getRevision` is not called.

Refusals the module classifies (all pinned in the contract tests):

| Answer | UI kind | Copy (fixed; server `error` text is never echoed) |
|---|---|---|
| `401 MISSING_AUTH`, or `getAccessToken()` gives no token (no request made) | `signed-out` | "Sign in to see your saved designs." + Sign in button (`onSignIn`) |
| no HTTP answer (`status` 0/absent + `NETWORK_ERROR`, or a raw fetch `TypeError`) | `network` | "Could not reach FurniAI…" |
| 5xx / anything else (`STORAGE_UNAVAILABLE`, `INTERNAL`, …) | `server` | generic; `PERSISTENCE_NOT_CONFIGURED` and `AUTH_UNAVAILABLE` get specific copy |
| `404 MISSING_DESIGN` **on open** (not yours = not there = malformed, byte-identical) | `not-found` | "…may no longer be available to this account." |
| `409 REVISION_INTEGRITY_FAILED` on reopen | `integrity` | "…failed its integrity check and was not opened." |
| 2xx body missing promised fields / naming another design or revision | `bad-response` | "…unexpected answer. Nothing was opened." |
| `onOpenDesign` throws/rejects | `handoff` | "…the Studio could not open it. Nothing was changed." |

`STALE_REVISION 409` is a **save** answer, so these reads never return it. The contract tests
pin it anyway (409, `details.latestRevision`) so it is never mistaken for a read answer. If a
client surfaced it on a read, the module would show the generic `server` copy.

Found while pinning: the real fingerprint prefix is **`fs256:`**, but the examples in
`DESIGN_PERSISTENCE_API.md` show `sha256:…`. The module treats the fingerprint as opaque, so this does not affect it.

## 2. Interface expected from `designsApiClient` (Antigravity)

The module never builds a URL or an Authorization header, and it ships no client. It receives
the result of `createDesignsApiClient()` and uses **exactly three methods**
(typedef `DesignsApiClientLike` in `mountMyDesigns.js`):

```js
client.listDesigns(options?)                      // → parsed 200 body of GET /api/designs
client.getDesign(designId, options?)              // → parsed 200 body of GET /api/designs/:designId
client.getRevision(designId, revision, options?)  // → parsed 200 body of GET …/revisions/:revision
// options = { accessToken?: string, signal?: AbortSignal }  (always passed; may be ignored)
// non-2xx / transport failure → reject with a DesignsApiError: { status: number, code: string, message }
//   status = HTTP status (0 or absent when there was no HTTP answer); code = server `code`
```

`createDesign`, `saveAcceptedRevision` and `mapDesignsApiError` are not used. Tests use
`fakeDesignsApiClient.js`. It implements only those three methods and is checked against the
same pinned key sets as the real handlers.

## 3. Mount API and states

```js
const h = FurniMyDesigns.mountMyDesigns(rootEl, {
  client,                 // required: createDesignsApiClient(...)
  onOpenDesign,           // required: (selection, record) => void | Promise<void>
  getAccessToken,         // optional: () => token | null (sync or async). Falsy → signed-out, no request
  onSignIn,               // optional: shows a "Sign in" button in signed-out states
  document, formatDate, injectStyles = true, autoLoad = true, title = "My designs",
});
h.refresh(); h.openDesign(designId); h.getState(); h.destroy();
```

State (`getState()`, frozen) = `{ list: { status, designs, error, seq }, open: { status, designId, revision, name, error, seq } }`.

- `list.status`: `idle` → `loading` → `empty` | `list` | `error` (`error.kind` as in §1).
- `open.status`: `idle` → `opening` → `opened` | `error`; Dismiss returns to `idle`.

Guards:
- **Stale responses:** every list or open request carries a sequence number, and the reducer drops
  any answer that is not for the current request. Refresh aborts the previous request's `AbortSignal`.
  A second open replaces the first, and only the latest one reaches `onOpenDesign`.
- **Destroy mid-request:** aborts signals and removes markup and listeners. Late answers render
  nothing, and `onOpenDesign` is never called. `refresh` and `openDesign` after destroy do nothing.
- **No invented ids:** only a `designId` from the current server list can be opened; any other id
  makes no request. List rows without a server `designId` are dropped. The revision comes only from
  `latestRevision.revision`, and the revision body must echo it.
- **Escaping:** every string from a response goes through `textContent` or `setAttribute`. There is no
  `innerHTML` anywhere. The fake DOM in the tests throws on `innerHTML`. The demo renders a hostile name
  (`<img src=x onerror=…>`) as plain text; Chromium shows 0 `<img>` elements.
- **Accessibility:** real `<button type="button">`s; section `aria-busy` while loading/opening;
  persistent `role="status" aria-live="polite"` line; errors in `role="alert"`; opening button gets
  `aria-busy`, the opened one `aria-current`; `aria-describedby` for each row's date; focus-visible
  outline; reduced-motion respected.

## 4. Open callback contract

```js
onOpenDesign(selection, record)
// selection: Object.freeze({ designId, revision, name })
//   designId, revision ← GET …/revisions/:revision body (== the requested id and latestRevision.revision)
//   name               ← GET /api/designs/:designId → design.name (string | null)
// record: Object.freeze({ designId, revision, fingerprint, furniSpec, partGraph, origins, validationStatus, createdAt })
//   the reopen body, so reopenDesignFromApi need not fetch it again
```

It is called only after both reads succeed and while the request is still the current one. If it
throws or rejects, the module shows the `handoff` error and does not mark the design as opened.
Rotating the editing session and replacing Studio state (`DESIGN_PERSISTENCE_API.md` §7) stay with
Antigravity's `reopenDesignFromApi`. The module does not touch editor state.

## 5. Bundling (CraZy owns `scripts/build-static.mjs`, not edited here)

Add after the `ai-designer-transport.js` build call in `scripts/build-static.mjs`:

```js
// Build the standalone My Designs panel (window.FurniMyDesigns). No client inside:
// Antigravity's designsApiClient is injected at mount time.
await build({
  entryPoints: [resolve(root, "src/lib/designs/myDesigns/entry.js")],
  bundle: true,
  format: "iife",
  globalName: "FurniMyDesigns",
  outfile: resolve(root, "my-designs.js"),
});
```

Also add `"my-designs.js",` to the `files` array, after `"ai-designer-transport.js",`. The other
root bundles are committed, so `my-designs.js` would be committed too.

Checked with the repo's esbuild 0.21.5, output to a temp dir (`node demo/my-designs/build-demo.mjs --entry-check`):
- Size: 27,911 bytes.
- Inputs: 5, only `src/lib/designs/myDesigns/{state,render,styles,mountMyDesigns,entry}.js`. No fake client, nothing from `persistence/`.
- No `innerHTML` in the output.
- Loaded in real Chromium, it exposes `FurniMyDesigns.{mountMyDesigns, ERROR_KIND, LIST_STATUS, OPEN_STATUS, version}`. It mounts, escapes `<b>x</b>`, opens with `{designId:"srv-1", revision:4, name:"<b>x</b>"}`, and destroys cleanly.

## 6. Mount patch — `docs/m3/patches/my-designs-mount.patch` (for Antigravity; not applied)

Against `index.html` @ `c6bbe89`. `#view-projects` exists (line 4025), so the panel goes there. The legacy
Supabase `projects` grid (`#projectsGrid`, with its delete) is **kept unchanged** below the new panel.

1. `<script src="/my-designs.js"></script>` after `ai-designer-transport.js`.
2. `<div id="myDesignsRoot" hidden></div>` above `#projectsGrid` in `#view-projects`.
3. `showProjects()` calls `mountMyDesignsPanel()` after `loadProjects()`.
4. `mountMyDesignsPanel()` and `myDesignsAccessToken()`:
   - `myDesignsAccessToken()` reads `sb.auth.getSession()` the same way `downloadProductionPack` does. The token goes to the client only and is never logged.
   - The panel mounts once, then calls `refresh()` on later visits.
   - `onSignIn: openAuthModal`.
   - `onOpenDesign: (selection, record) => window.reopenDesignFromApi(selection, record)`.
   - If `window.FurniMyDesigns` or `window.FurniDesignsApi.createDesignsApiClient` is missing, the panel stays hidden.
   - If `reopenDesignFromApi` is missing, opening shows the `handoff` error.

Checks: `git apply --check` and `git apply --check --cached` are both clean against `c6bbe89`. The patch
uses LF, like the committed blob. The worktree is CRLF (via `core.autocrlf=true`), and the patch applies to both.
`index.html` in the worktree is unmodified.

Runtime smoke (`node demo/my-designs/verify-mount-patch.mjs`, MOCKED):
- Setup: HEAD `index.html` + the patch in a temp dir, served on 127.0.0.1. All other requests aborted. Supabase stubbed with a fake session. Stub `FurniDesignsApi` and `reopenDesignFromApi`.
- Boot OK, 0 page errors.
- Calls, in order: `listDesigns(tok) → getDesign(id, tok) → getRevision(id, 2, tok)`.
- `reopenDesignFromApi` got `{designId:"3f7d…1c11", revision:2, name:"Bedroom wardrobe"}` + `record.fingerprint`.
- Without the client global, the panel stays hidden with 0 children.
- Result: **PASS (MOCKED).**

Seen during the smoke. **This is already in base; the patch does not cause it:** on a direct `#/projects` load
the legacy `loadProjects()` runs before `sb.auth.getSession()` resolves. It sees `currentUser = null`,
shows "Sign in to see your saved designs." and opens the auth modal over the page, even with a
valid session. The new panel is not affected because it calls `getSession()` itself.

## 7. Requests to Antigravity

1. **Expose the client to the static page.** On the pilot route the module needs `createDesignsApiClient`
   at runtime. The patch expects `window.FurniDesignsApi.createDesignsApiClient`, for example from
   an IIFE bundle of `designsApiClient.js` with `globalName: "FurniDesignsApi"`. A different global name
   is fine; changing it is one line in the patch.
2. **Confirm the factory options.** The patch calls `createDesignsApiClient({ getAccessToken })`.
   If your client takes a different option (for example `fetchImpl`, `baseUrl` or a token string),
   change that one line.
3. **Confirm method signatures and return values** match §2:
   - Positional `(designId)` / `(designId, revision)`, with a trailing `options` argument.
   - Each method resolves with the **parsed body** as-is. For example, the list must still be `{ designs: [...] }`, not a bare array.
   - The module passes `{ accessToken, signal }`. Honour `signal` if you can (abort on refresh/destroy); otherwise ignore it.
4. **Confirm the error shape:** `DesignsApiError` with a numeric `status` (0 when there was no HTTP answer) and
   a string `code` (the server `code`, or `NETWORK_ERROR` for transport failures). A raw fetch `TypeError`
   is also understood.
5. **`reopenDesignFromApi(selection, record)`:** confirm this signature, or send yours. `record`
   already holds the reopen body, so there is no need to fetch it again. The module expects this function to also navigate to the Studio view
   (`go('#/ai')` or similar).
6. Optional: call `mountMyDesignsPanel()` (or `myDesignsHandle.refresh()`) from
   `sb.auth.onAuthStateChange`, so the panel refreshes on sign-in and sign-out. This is not in the patch
   because auth wiring is yours.

## 8. Test results (2026-09-30, Windows, Node 24.14.0, vitest 2.1.9)

| Suite | Command | Result | Evidence |
|---|---|---|---|
| Module unit | `npx vitest run src/lib/designs` | 2 files, **74 passed** (state 33, mount 41) | MOCKED (fake client, fake DOM) |
| Contract | `npx vitest run --config tests/contract/designs-api/vitest.config.js` | 1 file, **21 passed** | LOCAL in-process real handlers + memory store + `test:` auth bypass |
| Full | `npx vitest run` | **113 passed / 1 skipped files; 1437 passed, 4 skipped, 20 todo, 0 failed** (base 1363 + 74) | — |
| Lint | `npx eslint src/lib/designs tests/contract demo/my-designs` | 0 problems | — |
| Static build | `npm run build:legacy` | OK, 8 files in `dist/` (unchanged list) | — |
| Next build | `npm run build` | OK | — |
| Entry bundle | `node demo/my-designs/build-demo.mjs --entry-check` | OK (§5) | real Chromium, MOCKED |
| Mount patch | `git apply --check` + `verify-mount-patch.mjs` | clean + PASS (§6) | MOCKED |

The root `vitest.config.js` `include` list does not cover `tests/contract/**`, so the full run does
**not** include the 21 contract tests. For CraZy: to fold them in, add `"tests/contract/**/*.test.js"`
to that `include` array (not edited here).

`npm run build:legacy` rewrites the committed `ai-designer-transport.js` and `partgraph-runtime-bridge.js`
with LF endings (no content change on this Windows checkout). Both files were restored and not committed.

## 9. Demo and screenshots (MOCKED data)

`node demo/my-designs/build-demo.mjs` builds `demo/my-designs/index.html` and a bundle into a temp dir, then
prints the path to open. The page has a state switcher (`?state=<name>`).

`--screenshots` writes `docs/m3/artifacts/my-designs/<state>.png` at 1100×720 for these states:
`loading`, `empty`, `signed-out`, `error-401`, `error-network`, `error-5xx`, `error-not-configured`, `list`,
`opening`, `opened`, `open-404`, `open-no-revision`, `open-integrity`, `open-network`.
There are also `list-390.png` (390 px wide) and `patched-index-projects.png` (from the mount-patch smoke).

## 10. Out of scope / not done

- No rename/delete (not in the API), no save, no editor-state or session-guard changes.
- Not run against a real database, hosted Supabase or a live session. The contract evidence is the
  in-process handlers with the memory store.
- `index.html`, `scripts/build-static.mjs`, `vitest.config.js`, `src/lib/persistence/**` and `api/**` were not modified.