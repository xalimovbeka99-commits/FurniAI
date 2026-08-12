/**
 * POST /api/v1/furniture/generate
 * ----------------------------------------------------------------------
 * The one HTTP entry point for the Furniture Generation API (Section 5).
 * This file does ONLY transport: parse, validate the request shape,
 * construct the real AI provider, call the service, map the result to an
 * HTTP response. No prompts, no furniture rules, no configurator logic —
 * see furnitureGenerationService.js / furniture-brain / fsl / configurator-adapter.
 *
 * Deliberately new and versioned, alongside (not replacing) api/chat.js
 * (live static-site agent) and src/app/api/cad-lab/route.js (the separate
 * tool-based CAD Lab experiment) — see docs/furniai-existing-system-analysis.md.
 */
import { NextResponse } from "next/server";
import { generateFurnitureSpecification } from "@/lib/services/furnitureGenerationService";
import { createExtractionAiProvider, redactErrorForLogging } from "@/lib/ai-provider";
import { ERROR_CODES, httpStatusForCode } from "@/lib/fsl/errors";
import { GENERATION_TARGETS } from "@/lib/fsl/enums";

const MESSAGE_MIN_LENGTH = 3;
const MESSAGE_MAX_LENGTH = 4000;

// Pillar 1 (multi-channel input): a request may carry photos/scans/drawings
// or a single PDF instead of, or alongside, `message`. Limits are generous
// for a phone photo or a short spec sheet, tight enough to bound request
// size and provider cost.
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BASE64_LENGTH = 8_000_000; // ~6MB decoded
const ALLOWED_IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_DOCUMENT_MEDIA_TYPES = ["application/pdf"];
const ALLOWED_ATTACHMENT_MEDIA_TYPES = [...ALLOWED_IMAGE_MEDIA_TYPES, ...ALLOWED_DOCUMENT_MEDIA_TYPES];
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function errorResponse(code, message, { field = null, details = null, requestId = null } = {}) {
  return NextResponse.json(
    { request_id: requestId, status: "error", data: null, errors: [{ code, field, message, details }] },
    { status: httpStatusForCode(code) }
  );
}

/**
 * Validates `attachments` (Pillar 1 — photos/scans/PDFs). Wire shape is
 * `{ media_type, data }`; `kind` ("image" | "document") is derived here so
 * downstream layers never re-decide it from a caller-supplied flag.
 */
function validateAttachments(raw) {
  if (raw === undefined || raw === null) return { attachments: [] };
  if (!Array.isArray(raw)) {
    return { error: { code: ERROR_CODES.INVALID_REQUEST, message: "`attachments` must be an array.", field: "attachments" } };
  }
  if (raw.length > MAX_ATTACHMENTS) {
    return {
      error: {
        code: ERROR_CODES.INVALID_REQUEST,
        message: `A maximum of ${MAX_ATTACHMENTS} attachments is supported.`,
        field: "attachments",
        details: { received: raw.length, maximum: MAX_ATTACHMENTS },
      },
    };
  }

  const attachments = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    const field = `attachments[${i}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: { code: ERROR_CODES.INVALID_REQUEST, message: "Each attachment must be an object.", field } };
    }
    if (!ALLOWED_ATTACHMENT_MEDIA_TYPES.includes(item.media_type)) {
      return {
        error: {
          code: ERROR_CODES.INVALID_REQUEST,
          message: `\`${field}.media_type\` must be one of: ${ALLOWED_ATTACHMENT_MEDIA_TYPES.join(", ")}.`,
          field: `${field}.media_type`,
          details: { received: item.media_type ?? null },
        },
      };
    }
    if (typeof item.data !== "string" || item.data.length === 0) {
      return { error: { code: ERROR_CODES.INVALID_REQUEST, message: `\`${field}.data\` is required and must be a base64-encoded string.`, field: `${field}.data` } };
    }
    if (item.data.length > MAX_ATTACHMENT_BASE64_LENGTH) {
      return {
        error: {
          code: ERROR_CODES.INVALID_REQUEST,
          message: `\`${field}.data\` is too large.`,
          field: `${field}.data`,
          details: { maxBase64Length: MAX_ATTACHMENT_BASE64_LENGTH },
        },
      };
    }
    if (!BASE64_PATTERN.test(item.data)) {
      return { error: { code: ERROR_CODES.INVALID_REQUEST, message: `\`${field}.data\` must be valid base64.`, field: `${field}.data` } };
    }
    attachments.push({
      kind: ALLOWED_DOCUMENT_MEDIA_TYPES.includes(item.media_type) ? "document" : "image",
      mediaType: item.media_type,
      data: item.data,
    });
  }
  return { attachments };
}

/** Route-level request-schema validation only (Section 5) — no furniture semantics here. */
function validateRequestBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: { code: ERROR_CODES.INVALID_REQUEST, message: "Request body must be a JSON object." } };
  }
  if (body.message !== undefined && body.message !== null && typeof body.message !== "string") {
    return { error: { code: ERROR_CODES.INVALID_REQUEST, message: "`message` must be a string.", field: "message" } };
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";

  const { attachments, error: attachmentsError } = validateAttachments(body.attachments);
  if (attachmentsError) return { error: attachmentsError };

  // `message` is required UNLESS attachments carry the request instead — a
  // photo/PDF alone is a valid starting point (Pillar 1).
  if (message.length === 0 && attachments.length === 0) {
    return { error: { code: ERROR_CODES.EMPTY_MESSAGE, message: "`message` must not be empty when no attachments are provided.", field: "message" } };
  }
  if (message.length > 0 && (message.length < MESSAGE_MIN_LENGTH || message.length > MESSAGE_MAX_LENGTH)) {
    return {
      error: {
        code: ERROR_CODES.INVALID_REQUEST,
        message: `\`message\` must be between ${MESSAGE_MIN_LENGTH} and ${MESSAGE_MAX_LENGTH} characters.`,
        field: "message",
        details: { received: message.length, minimum: MESSAGE_MIN_LENGTH, maximum: MESSAGE_MAX_LENGTH },
      },
    };
  }

  for (const idField of ["conversation_id", "project_id"]) {
    const v = body[idField];
    if (v !== undefined && v !== null && typeof v !== "string") {
      return { error: { code: ERROR_CODES.INVALID_REQUEST, message: `\`${idField}\` must be a string or null.`, field: idField } };
    }
  }

  const rawOptions = body.options && typeof body.options === "object" ? body.options : {};
  if (rawOptions.target !== undefined && !Object.values(GENERATION_TARGETS).includes(rawOptions.target)) {
    return {
      error: {
        code: ERROR_CODES.INVALID_REQUEST,
        message: `\`options.target\` must be one of: ${Object.values(GENERATION_TARGETS).join(", ")}.`,
        field: "options.target",
        details: { received: rawOptions.target },
      },
    };
  }

  return {
    request: {
      message,
      attachments,
      conversation_id: body.conversation_id ?? null,
      project_id: body.project_id ?? null,
      options: {
        allow_defaults: rawOptions.allow_defaults !== false,
        target: rawOptions.target === GENERATION_TARGETS.CONFIGURATOR ? GENERATION_TARGETS.CONFIGURATOR : GENERATION_TARGETS.CONCEPT,
        include_explanation: rawOptions.include_explanation !== false,
      },
    },
  };
}

export async function POST(req) {
  let rawBody;
  try {
    rawBody = await req.json();
  } catch {
    return errorResponse(ERROR_CODES.INVALID_REQUEST, "Request body must be valid JSON.");
  }

  const { request, error } = validateRequestBody(rawBody);
  if (error) {
    return errorResponse(error.code, error.message, { field: error.field, details: error.details });
  }

  // Provider-independent by construction (Steps 2-5): tries every provider
  // named in AI_PROVIDER_ORDER, in order, and only fails over on
  // provider-level availability problems (missing/invalid key, rate limit,
  // quota, timeout, transient server error) — never on a real FurniAI
  // error. Construction never throws; a fully unconfigured server surfaces
  // as AI_PROVIDER_UNAVAILABLE from generateFurnitureSpecification below,
  // same as any other FslError.
  const aiProvider = createExtractionAiProvider();

  try {
    const { httpStatus, body } = await generateFurnitureSpecification(request, { aiProvider });
    return NextResponse.json(body, { status: httpStatus });
  } catch (err) {
    console.error("furniture generation route error:", redactErrorForLogging(err));
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, "Something went wrong generating the furniture specification.");
  }
}
