import { describe, it, expect, vi, beforeEach } from "vitest";

const generateFurnitureSpecification = vi.fn();
vi.mock("@/lib/services/furnitureGenerationService", () => ({ generateFurnitureSpecification }));
vi.mock("@/lib/ai-provider", () => ({ createExtractionAiProvider: vi.fn(() => ({})) }));

const { POST } = await import("./route.js");

function req(body) {
  return { json: async () => body };
}

async function post(body) {
  const res = await POST(req(body));
  return { status: res.status, body: await res.json() };
}

describe("POST /api/v1/furniture/generate — route-level request validation", () => {
  beforeEach(() => {
    generateFurnitureSpecification.mockReset();
    generateFurnitureSpecification.mockResolvedValue({ httpStatus: 200, body: { request_id: "r1", status: "success", data: {}, errors: [] } });
  });

  it("still accepts a plain message-only request (backward compatible) with attachments defaulted to []", async () => {
    const { status } = await post({ message: "a modern white wardrobe, 2400mm wide" });
    expect(status).toBe(200);
    expect(generateFurnitureSpecification).toHaveBeenCalledTimes(1);
    expect(generateFurnitureSpecification.mock.calls[0][0].attachments).toEqual([]);
  });

  it("rejects an empty message with no attachments", async () => {
    const { status, body } = await post({ message: "" });
    expect(status).toBe(400);
    expect(body.errors[0].code).toBe("EMPTY_MESSAGE");
  });

  it("accepts an empty message when attachments are provided instead", async () => {
    const { status } = await post({ message: "", attachments: [{ media_type: "image/png", data: "iVBORw0KGgo=" }] });
    expect(status).toBe(200);
    const forwarded = generateFurnitureSpecification.mock.calls[0][0];
    expect(forwarded.attachments).toEqual([{ kind: "image", mediaType: "image/png", data: "iVBORw0KGgo=" }]);
  });

  it("derives kind 'document' for application/pdf and 'image' for image/* media types", async () => {
    await post({
      message: "a wardrobe from this sketch and spec sheet",
      attachments: [
        { media_type: "image/jpeg", data: "abc=" },
        { media_type: "application/pdf", data: "def=" },
      ],
    });
    const forwarded = generateFurnitureSpecification.mock.calls[0][0].attachments;
    expect(forwarded.map((a) => a.kind)).toEqual(["image", "document"]);
  });

  it("rejects more than the maximum number of attachments", async () => {
    const attachments = Array.from({ length: 6 }, () => ({ media_type: "image/png", data: "iVBORw0KGgo=" }));
    const { status, body } = await post({ message: "a wardrobe", attachments });
    expect(status).toBe(400);
    expect(body.errors[0].code).toBe("INVALID_REQUEST");
    expect(body.errors[0].field).toBe("attachments");
  });

  it("rejects an unsupported attachment media type", async () => {
    const { status, body } = await post({ message: "a wardrobe", attachments: [{ media_type: "image/svg+xml", data: "abc=" }] });
    expect(status).toBe(400);
    expect(body.errors[0].field).toBe("attachments[0].media_type");
  });

  it("rejects an attachment missing base64 data", async () => {
    const { status, body } = await post({ message: "a wardrobe", attachments: [{ media_type: "image/png" }] });
    expect(status).toBe(400);
    expect(body.errors[0].field).toBe("attachments[0].data");
  });

  it("rejects an oversized attachment", async () => {
    const { status, body } = await post({
      message: "a wardrobe",
      attachments: [{ media_type: "image/png", data: "A".repeat(8_000_001) }],
    });
    expect(status).toBe(400);
    expect(body.errors[0].field).toBe("attachments[0].data");
  });

  it("rejects non-base64 attachment data", async () => {
    const { status, body } = await post({ message: "a wardrobe", attachments: [{ media_type: "image/png", data: "not base64!!" }] });
    expect(status).toBe(400);
    expect(body.errors[0].field).toBe("attachments[0].data");
  });

  it("rejects attachments that isn't an array", async () => {
    const { status, body } = await post({ message: "a wardrobe", attachments: "nope" });
    expect(status).toBe(400);
    expect(body.errors[0].field).toBe("attachments");
  });
});
