/**
 * Framework-null Vercel transport for the protected static FurniAI site.
 *
 * This deliberately delegates to the canonical Next route instead of
 * creating a second provider or agent implementation. When the approved
 * provider-router change is integrated into that route, this transport uses
 * it automatically. Provider credentials remain server-side.
 */
import { POST } from "../../src/app/api/wardrobe/chat/route.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Only POST is supported." });
  }

  const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? null);
  const request = new Request("https://furniai.invalid/api/wardrobe/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const response = await POST(request);
  response.headers.forEach((value, name) => res.setHeader(name, value));
  return res.status(response.status).send(await response.text());
}
