/**
 * Durable wardrobe design create / save / reopen.
 * Fail closed on auth, ownership, stale revision, fingerprint, and validation.
 * Does not store API keys or provider authorization data.
 */

import { fingerprintFurniSpec } from "../conversation/approval.js";
import { sha256Hex } from "../conversation/fingerprint.js";
import { serializeCanonicalJson } from "../furnispec/normalize.js";
import { validateFurniSpec } from "../furnispec/validate.js";
import { validatePartGraph } from "../partgraph/validatePartGraph.js";
import { PersistenceError, PERSISTENCE_ERROR } from "./errors.js";
import { getSharedMemoryStore } from "./memoryStore.js";

/**
 * @param {{ store?: object }} [deps]
 */
export function createDesignService(deps = {}) {
  const store = deps.store || getSharedMemoryStore();

  return {
    async createDesign({ userId, name, designId } = {}) {
      requireUser(userId);
      const row = await store.createDesign({
        ownerUserId: userId,
        name: typeof name === "string" && name.trim() ? name.trim() : "Untitled wardrobe",
        designId,
      });
      return {
        ok: true,
        designId: row.designId,
        ownerUserId: row.ownerUserId,
        name: row.name,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        latestRevision: null,
      };
    },

    async listDesigns({ userId } = {}) {
      requireUser(userId);
      const rows = await store.listDesigns(userId);
      return { ok: true, designs: rows };
    },

    async getDesign({ userId, designId } = {}) {
      requireUser(userId);
      const design = await requireOwnedDesign(store, userId, designId);
      const latest = await store.getLatestRevision(designId);
      return {
        ok: true,
        design: {
          designId: design.designId,
          ownerUserId: design.ownerUserId,
          name: design.name,
          createdAt: design.createdAt,
          updatedAt: design.updatedAt,
        },
        latestRevision: latest ? summarizeRevision(latest) : null,
      };
    },

    async listRevisions({ userId, designId } = {}) {
      requireUser(userId);
      await requireOwnedDesign(store, userId, designId);
      const list = await store.listRevisions(designId);
      return { ok: true, designId, revisions: list.map(summarizeRevision) };
    },

    async getRevision({ userId, designId, revision } = {}) {
      requireUser(userId);
      await requireOwnedDesign(store, userId, designId);
      const revNum = requirePositiveInt(revision, "revision");
      const row = await store.getRevision(designId, revNum);
      if (!row) {
        throw new PersistenceError(
          PERSISTENCE_ERROR.MISSING_DESIGN,
          "That revision was not found for this design.",
          { status: 404 }
        );
      }
      return {
        ok: true,
        designId,
        revision: row.revision,
        fingerprint: row.fingerprint,
        furniSpec: row.furniSpec,
        partGraph: row.partGraph,
        origins: row.origins ?? null,
        validationStatus: row.validationStatus ?? null,
        createdAt: row.createdAt,
      };
    },

    async saveRevision({
      userId,
      designId,
      revision,
      fingerprint,
      furniSpec,
      partGraph,
      origins = null,
      validationStatus = null,
      expectedPreviousRevision = undefined,
    } = {}) {
      requireUser(userId);
      await requireOwnedDesign(store, userId, designId);

      // The contract documents `"expectedPreviousRevision": null` for the
      // first revision, which genuinely has no predecessor. Treat null and
      // undefined alike, or a client following the documented example is
      // rejected for saying "there is none" correctly.
      if (expectedPreviousRevision === null) expectedPreviousRevision = undefined;

      const revNum = requirePositiveInt(revision, "revision");
      assertFurniSpec(furniSpec);
      assertPartGraph(partGraph);
      assertSpecGraphConsistency(furniSpec, partGraph);

      let expectedFp;
      try {
        expectedFp = fingerprintFurniSpec(furniSpec);
      } catch {
        throw new PersistenceError(
          PERSISTENCE_ERROR.INVALID_FURNISPEC,
          "The FurniSpec could not be fingerprinted.",
          { status: 400 }
        );
      }
      if (typeof fingerprint !== "string" || fingerprint !== expectedFp) {
        throw new PersistenceError(
          PERSISTENCE_ERROR.FINGERPRINT_MISMATCH,
          "The design fingerprint does not match the FurniSpec.",
          { status: 409, details: { expectedFingerprint: expectedFp } }
        );
      }

      // ---- Idempotent replay, checked BEFORE the sequence rules ----------
      //
      // The commonest real failure is not a race, it is a lost response: the
      // insert commits, the reply never arrives, the client retries the
      // identical body. Answering 409 there tells a customer their work was
      // rejected when it is sitting safely in the database.
      //
      // "Identical" spans EVERY persisted field, not the spec alone — see
      // revisionContentDigest. Two requests can agree on the FurniSpec
      // fingerprint and still disagree about the PartGraph, the provenance or
      // the validation status being stored; reporting the second as an exact
      // save of the first would be a false statement about the database.
      //
      // A true replay mutates nothing, so returning the stored row is
      // truthful. It stays correct even if later revisions have since been
      // saved, because a stored revision is immutable.
      const normalizedStatus =
        typeof validationStatus === "string" && validationStatus.trim()
          ? validationStatus.trim()
          : "ACCEPTED";
      const requestDigest = revisionContentDigest({
        fingerprint: expectedFp,
        specId: furniSpec.specId ?? null,
        revision: revNum,
        partGraph,
        origins,
        validationStatus: normalizedStatus,
      });

      const alreadyStored = await store.getRevision(designId, revNum);
      if (alreadyStored) {
        if (storedContentDigest(alreadyStored) === requestDigest) {
          return idempotentResult(designId, alreadyStored);
        }
        // Same revision number, different content. Whoever is right, this
        // caller is not replaying its own save and must not be told it is.
        throw new PersistenceError(
          PERSISTENCE_ERROR.STALE_REVISION,
          "A different design is already saved as that revision. Reload the design and try again.",
          {
            status: 409,
            details: { latestRevision: alreadyStored.revision, requestedRevision: revNum },
          }
        );
      }

      const latest = await store.getLatestRevision(designId);

      // ---- Compare-and-swap intent is mandatory after the first revision --
      //
      // `expectedPreviousRevision` was optional, so a client could append
      // blind and skip the only thing that makes a concurrent write safe.
      // Nothing in the system could tell a considered append from a guess.
      if (latest && expectedPreviousRevision === undefined) {
        throw new PersistenceError(
          PERSISTENCE_ERROR.BAD_REQUEST,
          "expectedPreviousRevision is required when the design already has a saved revision. Send the revision number you are building on.",
          { status: 400, details: { latestRevision: latest.revision } }
        );
      }

      if (latest) {
        const prevSpecId = latest.furniSpec?.specId;
        const nextSpecId = furniSpec.specId;
        if (prevSpecId && nextSpecId && prevSpecId !== nextSpecId) {
          throw new PersistenceError(
            PERSISTENCE_ERROR.BAD_REQUEST,
            "specId cannot change across saved revisions of the same design.",
            { status: 400 }
          );
        }
        if (expectedPreviousRevision !== undefined) {
          const prev = requirePositiveInt(expectedPreviousRevision, "expectedPreviousRevision");
          if (latest.revision !== prev) {
            throw new PersistenceError(
              PERSISTENCE_ERROR.STALE_REVISION,
              "Another revision was saved first. Reload the design and try again.",
              {
                status: 409,
                details: { latestRevision: latest.revision, expectedPreviousRevision: prev },
              }
            );
          }
        }
        if (revNum !== latest.revision + 1) {
          throw new PersistenceError(
            PERSISTENCE_ERROR.STALE_REVISION,
            "Saved revisions must advance by one from the latest revision.",
            {
              status: 409,
              details: { latestRevision: latest.revision, requestedRevision: revNum },
            }
          );
        }
      } else if (revNum !== 1) {
        throw new PersistenceError(
          PERSISTENCE_ERROR.STALE_REVISION,
          "The first saved revision must be revision 1.",
          { status: 409 }
        );
      }

      // ---- The write, and the only real serialization point ---------------
      //
      // Every check above reads before it acts, so two writers can both pass
      // all of them. None of that is mutual exclusion. The ONE thing that
      // actually decides which writer takes a revision number is
      // `unique (design_id, revision)` in the database — and a constraint on
      // its own only guarantees that one row exists, not that the loser is
      // told anything useful. The checks above exist to produce good errors
      // in the common sequential case; the constraint produces the guarantee;
      // the catch below translates its verdict truthfully.
      let saved;
      try {
        saved = await store.appendRevision({
          designId,
          revision: revNum,
          fingerprint: expectedFp,
          furniSpec,
          partGraph,
          origins,
          validationStatus: normalizedStatus,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        if (err?.code !== PERSISTENCE_ERROR.CONFLICT_REVISION) throw err;

        // Someone got here first, between our checks and our insert. Read
        // back what they wrote to say which of two very different things
        // happened.
        const winner = await store.getRevision(designId, revNum);
        if (winner && storedContentDigest(winner) === requestDigest) {
          // Our own write, replayed — or an identical concurrent one. Either
          // way the stored revision is exactly what this caller asked for.
          return idempotentResult(designId, winner);
        }
        // A different design took this revision number while we were in
        // flight. This caller has nothing to overwrite and did nothing wrong;
        // their view of the design is simply out of date. Reporting
        // CONFLICT_REVISION here would tell the UI the customer tried to
        // overwrite their own work.
        throw new PersistenceError(
          PERSISTENCE_ERROR.STALE_REVISION,
          "Another revision was saved first. Reload the design and try again.",
          {
            status: 409,
            details: {
              latestRevision: winner?.revision ?? revNum,
              requestedRevision: revNum,
              concurrent: true,
            },
          }
        );
      }

      return {
        ok: true,
        designId,
        revision: saved.revision,
        fingerprint: saved.fingerprint,
        createdAt: saved.createdAt,
        validationStatus: saved.validationStatus,
      };
    },
  };
}

/**
 * The answer to a save that was already stored. Shaped exactly like a fresh
 * save so a client needs no special path, plus `idempotentReplay: true` so
 * one that wants to tell them apart can.
 */
/** The same digest, computed from a row as it was stored. */
function storedContentDigest(row) {
  return revisionContentDigest({
    fingerprint: row.fingerprint,
    specId: row.furniSpec?.specId ?? null,
    revision: row.revision,
    partGraph: row.partGraph,
    origins: row.origins ?? null,
    validationStatus: row.validationStatus ?? null,
  });
}

function idempotentResult(designId, row) {
  return {
    ok: true,
    designId,
    revision: row.revision,
    fingerprint: row.fingerprint,
    createdAt: row.createdAt,
    validationStatus: row.validationStatus ?? null,
    idempotentReplay: true,
  };
}

function requireUser(userId) {
  if (typeof userId !== "string" || !userId.trim()) {
    throw new PersistenceError(PERSISTENCE_ERROR.MISSING_AUTH, "Sign in is required to save or open a design.");
  }
}

async function requireOwnedDesign(store, userId, designId) {
  if (typeof designId !== "string" || !designId.trim()) {
    throw new PersistenceError(PERSISTENCE_ERROR.BAD_REQUEST, "designId is required.");
  }
  const design = await store.getDesign(designId);
  // ONE answer for "not yours" and "not there".
  //
  // A 403 for another customer's design and a 404 for one that does not exist
  // is an existence oracle: anyone holding a design id learns whether it is
  // real. Under RLS the deployed path already behaved this way — PostgREST
  // returns an empty result for rows it hides rather than an error — so the
  // in-memory store's 403 was both a leak AND a divergence between
  // environments, which meant the cross-user test proved something the
  // deployment did not do. Both now answer 404.
  //
  // Authentication failures are different and stay 401: those say nothing
  // about any particular design.
  if (!design || design.ownerUserId !== userId) {
    throw new PersistenceError(
      PERSISTENCE_ERROR.MISSING_DESIGN,
      "That design was not found.",
      { status: 404 }
    );
  }
  return design;
}

function requirePositiveInt(value, field) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new PersistenceError(PERSISTENCE_ERROR.BAD_REQUEST, field + " must be a positive integer.");
  }
  return n;
}

function assertFurniSpec(spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    throw new PersistenceError(PERSISTENCE_ERROR.INVALID_FURNISPEC, "FurniSpec must be an object.");
  }
  if (!spec.envelope || typeof spec.envelope !== "object") {
    throw new PersistenceError(PERSISTENCE_ERROR.INVALID_FURNISPEC, "FurniSpec.envelope is required.");
  }
  if (typeof spec.specId !== "string" || !spec.specId.trim()) {
    throw new PersistenceError(PERSISTENCE_ERROR.INVALID_FURNISPEC, "FurniSpec.specId is required.");
  }
  if (spec.apiKey || spec.ANTHROPIC_API_KEY || spec.OPENAI_API_KEY || spec.authorization) {
    throw new PersistenceError(PERSISTENCE_ERROR.BAD_REQUEST, "Credentials must not be stored with a design.");
  }

  // The AUTHORITATIVE validator, not a shape check.
  //
  // The fingerprint is computed FROM the submitted spec, so tampering with
  // the spec and re-fingerprinting produces a perfectly consistent pair. It
  // proves the spec arrived intact; it says nothing about whether the spec
  // is a wardrobe that can be built. A spec whose bays no longer add up to
  // its envelope passed every check here and was stored immutably.
  const result = validateFurniSpec(spec);
  if (!result.valid) {
    throw new PersistenceError(
      PERSISTENCE_ERROR.INVALID_FURNISPEC,
      "The FurniSpec failed validation and cannot be saved.",
      { status: 400, details: { errors: (result.errors || []).slice(0, 20) } }
    );
  }
}

/**
 * The PartGraph must describe THIS FurniSpec.
 *
 * Both can be individually valid and still belong to different designs: a
 * valid 1800 mm spec stored with a valid 2400 mm graph is a lie that survives
 * every other check, and once saved it is immutable, reopened as
 * authoritative, and exported as a cutting list.
 *
 * Identity alone is not enough either — a graph can carry the right
 * `sourceSpecId` and the wrong geometry — so the envelope is compared too.
 * The compiler records it in deci-mm.
 */
function assertSpecGraphConsistency(spec, partGraph) {
  const graphSpecId = partGraph.sourceSpecId ?? null;
  if (graphSpecId != null && String(graphSpecId) !== String(spec.specId)) {
    throw new PersistenceError(
      PERSISTENCE_ERROR.INVALID_PARTGRAPH,
      "The PartGraph does not describe this FurniSpec and cannot be saved.",
      { status: 400, details: { specId: spec.specId, partGraphSpecId: graphSpecId } }
    );
  }

  const graphRevision = partGraph.sourceRevision ?? null;
  if (
    graphRevision != null &&
    spec.revision != null &&
    Number(graphRevision) !== Number(spec.revision)
  ) {
    throw new PersistenceError(
      PERSISTENCE_ERROR.INVALID_PARTGRAPH,
      "The PartGraph was built from a different revision of this FurniSpec and cannot be saved.",
      { status: 400, details: { specRevision: spec.revision, partGraphRevision: graphRevision } }
    );
  }

  const env = partGraph.summary?.envelope;
  if (env) {
    const expected = {
      widthDmm: Math.round(Number(spec.envelope.widthMm) * 10),
      heightDmm: Math.round(Number(spec.envelope.heightMm) * 10),
      depthDmm: Math.round(Number(spec.envelope.depthMm) * 10),
    };
    const disagreements = Object.entries(expected).filter(
      ([k, v]) => Number.isFinite(v) && Number(env[k]) !== v
    );
    if (disagreements.length > 0) {
      throw new PersistenceError(
        PERSISTENCE_ERROR.INVALID_PARTGRAPH,
        "The PartGraph envelope does not match the FurniSpec and cannot be saved.",
        {
          status: 400,
          details: {
            envelope: { expected, actual: { ...env } },
            disagreed: disagreements.map(([k]) => k),
          },
        }
      );
    }
  }
}

/**
 * Fields that decide whether two save requests are THE SAME request.
 *
 * The FurniSpec fingerprint covers the spec and nothing else, so two requests
 * can agree on it and still disagree about the geometry and provenance being
 * stored. Answering "already saved, identical" to the second would be a false
 * statement about what is in the database.
 *
 * Equivalence therefore spans every field a revision persists:
 *   specId, revision, FurniSpec (via its fingerprint), PartGraph, origins,
 *   validationStatus.
 * Canonical serialization makes key order irrelevant, so a re-serialized but
 * semantically identical retry is still recognised as a replay.
 */
export function revisionContentDigest({
  fingerprint,
  specId,
  revision,
  partGraph,
  origins,
  validationStatus,
}) {
  return sha256Hex(
    serializeCanonicalJson({
      fingerprint: fingerprint ?? null,
      specId: specId ?? null,
      revision: revision ?? null,
      partGraph: partGraph ?? null,
      origins: origins ?? null,
      validationStatus: validationStatus ?? null,
    })
  );
}

function assertPartGraph(partGraph) {
  if (!partGraph || typeof partGraph !== "object") {
    throw new PersistenceError(PERSISTENCE_ERROR.INVALID_PARTGRAPH, "PartGraph must be an object.");
  }

  // An UNSUPPORTED component does NOT make the graph invalid — a diagnostic
  // graph is meant to validate while recording what the kernel could not
  // represent. That is exactly why this needs its own check: such a graph
  // passed validation and was stored as though the design were complete,
  // silently missing whatever the customer asked for that the kernel cannot
  // build.
  const outcomes = Array.isArray(partGraph.componentOutcomes) ? partGraph.componentOutcomes : [];
  const unsupportedOutcomes = outcomes.filter((o) => o && o.outcome === "UNSUPPORTED");
  const unsupportedCount = Number(partGraph.summary?.unsupportedComponents ?? 0);
  if (unsupportedOutcomes.length > 0 || unsupportedCount > 0) {
    throw new PersistenceError(
      PERSISTENCE_ERROR.UNSUPPORTED_COMPONENT,
      "This design includes an unsupported component and cannot be saved.",
      {
        status: 400,
        details: {
          unsupported: unsupportedOutcomes.slice(0, 20).map((o) => ({
            componentId: o.componentId ?? null,
            componentType: o.componentType ?? null,
            bayIndex: o.bayIndex ?? null,
            reason: o.reason ?? null,
          })),
          unsupportedComponents: unsupportedCount || unsupportedOutcomes.length,
        },
      }
    );
  }

  const result = validatePartGraph(partGraph);
  if (!result.valid) {
    const unsupported = (result.errors || []).some(
      (e) => /unsupported/i.test(e.code || "") || /unsupported/i.test(e.message || "")
    );
    throw new PersistenceError(
      unsupported ? PERSISTENCE_ERROR.UNSUPPORTED_COMPONENT : PERSISTENCE_ERROR.INVALID_PARTGRAPH,
      unsupported
        ? "This design includes an unsupported component and cannot be saved."
        : "PartGraph failed validation and cannot be saved.",
      { status: 400, details: { errors: (result.errors || []).slice(0, 20) } }
    );
  }
}

function summarizeRevision(row) {
  return {
    revision: row.revision,
    fingerprint: row.fingerprint,
    specId: row.furniSpec?.specId ?? null,
    validationStatus: row.validationStatus ?? null,
    createdAt: row.createdAt,
  };
}
