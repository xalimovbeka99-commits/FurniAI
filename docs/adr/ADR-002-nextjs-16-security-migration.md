# ADR-002: Migrate the Next.js workspace to supported Next.js 16

## Status

Accepted for pull-request review on 2026-08-12. This decision does not change
which application `vercel.json` deploys and does not authorize production
promotion.

## Context

The `src/` App Router workspace used Next.js 14.2.35 and React 18.3.1.
Next.js 14 is outside the current Next.js LTS policy, and the production
dependency audit reported high-severity findings in the deployed dependency
graph. FurniAI needs a supported framework line before the modern application
can be considered for a Vercel preview.

The workspace also contains a React Three Fiber/Drei 3D builder. The installed
React Three Fiber 8 and Drei 9 resolution did not accept React 19, so upgrading
Next.js and React alone produced a real npm peer-dependency conflict.

## Decision

- Pin Next.js 16.3.0, the latest stable Active LTS release available from npm
  when this migration was prepared.
- Pin React and React DOM 19.2.8.
- Move React Three Fiber to 9.7.0 and Drei to 10.7.8, whose peer contracts
  support React 19. Keep Three.js and Zustand on their existing compatible
  release lines to avoid unrelated runtime change.
- Replace the removed `next lint` command with ESLint 9 and the Next.js 16 flat
  `core-web-vitals` configuration.
- Keep Turbopack, now the Next.js 16 default, after the production build and
  route generation passed without a Webpack fallback.
- Disable Next.js development-time agent-rule generation so `next dev` does
  not create unrequested `AGENTS.md` or `CLAUDE.md` files.
- Leave `vercel.json`, the legacy static application, `api/production.py`, and
  all deterministic geometry and production contracts unchanged.

No install uses `--force` or `--legacy-peer-deps`.

## Alternatives considered

1. **Remain on Next.js 14.** Rejected because it is unsupported and retains
   confirmed high-severity production findings.
2. **Stop on Next.js 15.** Rejected because the requested target is Active LTS
   and the application builds on Next.js 16 without an intermediate code
   migration.
3. **Upgrade only Next.js and React.** Rejected because npm demonstrated that
   the installed 3D bindings' React peer ranges were incompatible.
4. **Use force or legacy peer resolution.** Rejected because it would hide an
   invalid React/3D dependency graph rather than establish compatibility.
5. **Retain Webpack for builds.** Rejected because the existing application
   compiles and generates all routes under the Next.js 16 Turbopack default.

## Consequences

- The modern workspace requires Node.js 20.9 or newer. The verified migration
  environment uses Node.js 24.14.0 and npm 11.9.0.
- React 19 and the 3D binding majors require manual browser acceptance before
  production promotion even though deterministic and build tests pass.
- `npm run lint` now scopes ESLint to `src/` and `tests/`, matching the Next.js
  workspace rather than parsing the separate legacy root browser bundle.
- Development no longer generates framework-authored agent instruction files.
- The production dependency audit reports zero critical, high, moderate, or
  low findings after the migration. Development-only audit findings remain a
  separate tooling-maintenance concern and are not part of the deployed
  dependency graph.

## Migration and rollback

Merge through a reviewed pull request. Do not alter the static Vercel
deployment selector in this change. If a regression is found, revert this
single migration commit; no data, API, production, or persistence contract is
changed.

Before a preview deployment, manually verify the homepage and builder in a
real browser, including WebGL rendering, dimension edits, component edits,
hydration, and the browser console.

## Verification

- clean `npm ci` without peer-resolution overrides;
- `npm test`, `npm run lint`, `npm run docs:check`, and `npm run build`;
- production-only npm audit;
- local HTTP smoke tests for `/`, `/builder`, `/api/wardrobe/chat`, and
  `/api/v1/furniture/generate`;
- deterministic Python production verification and bridge tests.

Browser-based 3D interaction remains a required pre-deployment acceptance
gate when a browser backend is available.
