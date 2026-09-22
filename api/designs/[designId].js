/**
 * GET /api/designs/:designId — design summary + latest revision metadata
 */
import { withAuth, json, methodNotAllowed } from "../../src/lib/persistence/http.js";

export default async function handler(req, res) {
  const designId = req.query?.designId;
  if (req.method !== "GET") return methodNotAllowed(res, "GET");
  return withAuth(req, res, async ({ userId, service }) => {
    const out = await service.getDesign({ userId, designId });
    json(res, 200, out);
  });
}
