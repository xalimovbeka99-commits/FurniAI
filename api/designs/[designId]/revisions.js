/**
 * GET  /api/designs/:designId/revisions — list revision summaries
 * POST /api/designs/:designId/revisions — save an accepted revision (immutable)
 */
import { withAuth, json, readJson, methodNotAllowed } from "../../../src/lib/persistence/http.js";

export default async function handler(req, res) {
  const designId = req.query?.designId;
  if (req.method === "GET") {
    return withAuth(req, res, async ({ userId, service }) => {
      const out = await service.listRevisions({ userId, designId });
      json(res, 200, out);
    });
  }
  if (req.method === "POST") {
    return withAuth(req, res, async ({ userId, service }) => {
      const body = await readJson(req);
      const out = await service.saveRevision({
        userId,
        designId,
        revision: body?.revision,
        fingerprint: body?.fingerprint,
        furniSpec: body?.furniSpec ?? body?.spec,
        partGraph: body?.partGraph,
        origins: body?.origins ?? null,
        validationStatus: body?.validationStatus ?? null,
        expectedPreviousRevision: body?.expectedPreviousRevision,
      });
      // 201 Created for a new revision; 200 for a replay of one already
      // stored, which created nothing.
      json(res, out?.idempotentReplay ? 200 : 201, out);
    });
  }
  return methodNotAllowed(res, "GET, POST");
}
