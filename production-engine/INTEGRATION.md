# FurniAI production-engine integration boundary

## Decision

Keep the customer-facing web application and deterministic production engine as
separate runtimes.

- The web application owns conversation, uploads, clarification, configuration,
  visualization, user approval, and version history.
- The production service owns panel decomposition, machining operations,
  nesting, shop drawings, costing, inspection, and artifact packaging.
- The AI may propose a furniture specification. It must never write DXF,
  drilling, nesting, or CNC operations directly.

Do not spawn Python from a Vercel/Next.js request handler. Package this engine as
a separate containerized worker or service and call it through a versioned job
API.

## Required flow

1. FurniAI gathers the request and marks every value as explicit, defaulted, or
   unresolved.
2. The user approves a frozen design revision.
3. The web backend converts that revision to a versioned FurniSpec job.
4. The production service validates the job and generates an immutable pack.
5. FurniAI displays the software inspection result and all warnings.
6. Manufacturing release remains blocked unless the exact factory profile has a
   recorded, signed first-article qualification.

## Minimum job envelope

```json
{
  "contract_version": "furnispec-job/1",
  "project_id": "project-id",
  "revision_id": "immutable-revision-id",
  "requested_by": "user-id",
  "factory_profile_id": null,
  "spec": {
    "name": "Master Bedroom Wardrobe",
    "unit_id": "W1",
    "type": "wardrobe",
    "width": 3000,
    "height": 2600,
    "depth": 600,
    "material": "graphite",
    "handle": "black_strip",
    "led": "warm"
  }
}
```

All dimensions in this boundary are integer millimetres.

## Service API

- `POST /v1/production-jobs` validates and queues one immutable revision.
- `GET /v1/production-jobs/{job_id}` returns status, build ID, standards
  version, warnings, failures, and artifact manifest.
- `GET /v1/production-jobs/{job_id}/artifacts/{name}` returns a short-lived
  authorized download for an artifact.
- `POST /v1/factory-profiles/{profile_id}/qualifications` records a signed
  first-article result. This is an authenticated factory action, not an AI
  action.

Idempotency key: `project_id + revision_id + standards_version +
factory_profile_id`. Repeating the same job must return the same build rather
than silently regenerating different machine files.

## Release states

- `DRAFT`: design is still changing.
- `ENGINEERING_CHECKS_FAILED`: deterministic validation has failures.
- `ENGINEERING_CHECKS_PASSED`: the generated pack is internally consistent.
- `FACTORY_QUALIFICATION_REQUIRED`: software passed, but the selected machine
  profile has not passed its physical coupon/first-article test.
- `RELEASED_BY_FACTORY`: a responsible factory engineer approved the exact
  build and machine profile.

Only `RELEASED_BY_FACTORY` may be presented as ready to manufacture.

## Current integration gaps

- The existing configurator stores module widths as ratios; the Python planner
  may split long runs and currently discards custom bay layouts during that
  split. A lossless, tested module/bay adapter is required.
- The authenticated server bridge supports rectangular configurations and
  accepts `kitchen_l` only when the request supplies exactly two explicit run
  lengths. It deliberately rejects `kitchen_u` and island layouts rather than
  flattening them into an unsafe straight run.
- The engine has an experimental two-run L-kitchen placement proof with
  separate run lengths, perpendicular world geometry, separate drawing
  elevations and disclosed blind-corner bays. The current browser configurator
  still has no second-run input and marks L-kitchen production unsupported, so
  the server contract is exercised only by explicit API requests and tests. It
  is not a qualified corner-cabinet system. The product UI still needs separate
  run-length inputs, cabinet module widths, a selected
  corner-accessory/cabinet strategy, worktop and joinery finish, fillers,
  scribes and end panels.
- Vanity jobs cover the joinery unit only: cabinet geometry, drawers/doors,
  mounting system, wall substrate, finish and any user-specified cut-out
  envelope. FurniAI does not design plumbing or sanitary fixtures.
- Wardrobe mirror/sliding fronts require an approved supplier system and
  weight/hardware rules.
- Material and hardware catalog entries need supplier SKU, thickness,
  availability, machining template, and revision data.
- No factory profile has yet been physically qualified.

## Product scope boundary

FurniAI designs and manufactures furniture joinery only. It does not design,
select or engineer plumbing, electrical systems, sanitary fixtures or
appliances. When an external item affects the cabinet, FurniAI accepts only a
user- or professional-supplied clearance or cut-out envelope and treats it as a
fixed geometric constraint without reasoning about the external system.
