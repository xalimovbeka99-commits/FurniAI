/**
 * GET /api/designs/:designId/revisions/:revision — reopen an exact immutable revision
 */
import { withAuth, json, methodNotAllowed } from "../../../../src/lib/persistence/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, "GET");
  const designId = req.query?.designId;
  const revision = req.query?.revision;
  return withAuth(req, res, async ({ userId, service }) => {
    const out = await service.getRevision({ userId, designId, revision });
    json(res, 200, out);
  });
}
