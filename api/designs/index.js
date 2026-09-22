/**
 * GET  /api/designs — list the caller's designs
 * POST /api/designs — create a design
 */
import { withAuth, json, readJson, methodNotAllowed } from "../../src/lib/persistence/http.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return withAuth(req, res, async ({ userId, service }) => {
      const out = await service.listDesigns({ userId });
      json(res, 200, out);
    });
  }
  if (req.method === "POST") {
    return withAuth(req, res, async ({ userId, service }) => {
      const body = await readJson(req);
      const out = await service.createDesign({
        userId,
        name: body?.name,
        designId: body?.designId,
      });
      json(res, 201, out);
    });
  }
  return methodNotAllowed(res, "GET, POST");
}
