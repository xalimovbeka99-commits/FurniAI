/**
 * PROVISIONAL neutral asset descriptor. No provider (Scenario or other)
 * field names are assumed; Integration maps the provider result onto this.
 *
 *   {
 *     url?:         string        // http(s)/blob:/data: URL, fetched by the viewer
 *     arrayBuffer?: ArrayBuffer   // raw bytes (or a Uint8Array / other view)
 *     blob?:        Blob          // e.g. a File the user picked
 *     format?:      string        // registry key, e.g. "glb"; wins over mime/extension
 *     mime?:        string        // e.g. "model/gltf-binary"
 *     filename?:    string        // used for format detection and download()
 *     scale?:       unknown       // accepted but IGNORED until a provider scale contract exists
 *   }
 *
 * Exactly one of url / arrayBuffer / blob is required.
 */
import { AssetViewerError } from "./errors.js";

export function normalizeAsset(asset) {
  if (!asset || typeof asset !== "object") {
    throw new AssetViewerError("INVALID_ASSET", "asset descriptor must be an object");
  }
  const sources = [];
  if (typeof asset.url === "string" && asset.url.length > 0) sources.push("url");
  if (asset.arrayBuffer != null) sources.push("arrayBuffer");
  if (asset.blob != null) sources.push("blob");
  if (sources.length !== 1) {
    throw new AssetViewerError(
      "INVALID_ASSET",
      sources.length === 0 ? "asset needs one of url | arrayBuffer | blob" : `asset has several sources: ${sources.join(", ")}`,
    );
  }
  const source = sources[0];
  let bytes = null;
  if (source === "arrayBuffer") bytes = toArrayBuffer(asset.arrayBuffer);
  if (source === "blob" && typeof asset.blob.arrayBuffer !== "function") {
    throw new AssetViewerError("INVALID_ASSET", "blob does not implement arrayBuffer()");
  }
  const filename =
    (typeof asset.filename === "string" && asset.filename.trim()) ||
    (source === "blob" && typeof asset.blob.name === "string" && asset.blob.name) ||
    (source === "url" && filenameFromUrl(asset.url)) ||
    null;
  const mime =
    (typeof asset.mime === "string" && asset.mime.trim().toLowerCase()) ||
    (source === "blob" && typeof asset.blob.type === "string" && asset.blob.type.toLowerCase()) ||
    null;
  return {
    source,
    url: source === "url" ? asset.url : null,
    blob: source === "blob" ? asset.blob : null,
    bytes,
    format: typeof asset.format === "string" ? asset.format.trim().toLowerCase() : null,
    mime: mime || null,
    filename,
    hasScaleMetadata: asset.scale !== undefined && asset.scale !== null,
  };
}

export function toArrayBuffer(value) {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }
  // Cross-realm ArrayBuffer (e.g. from a worker or another vm context).
  if (value && typeof value.byteLength === "number" && typeof value.slice === "function") return value;
  throw new AssetViewerError("INVALID_ASSET", "arrayBuffer must be an ArrayBuffer or typed array");
}

/** Last path segment of a URL, without query/hash (signed URLs carry long queries). */
export function filenameFromUrl(url) {
  if (typeof url !== "string" || url.startsWith("data:") || url.startsWith("blob:")) return null;
  const noQuery = url.split(/[?#]/)[0];
  const seg = noQuery.split("/").filter(Boolean).pop();
  if (!seg || !seg.includes(".")) return null;
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

export function extensionOf(name) {
  if (typeof name !== "string") return null;
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : null;
}

/** Ensures the download filename ends with an extension valid for the adapter. */
export function downloadFilename(filename, adapter) {
  const base = (filename || "generated-model").replace(/[\\/:*?"<>|]+/g, "_");
  const ext = extensionOf(base);
  if (ext && adapter.extensions.includes(ext)) return base;
  const stem = ext ? base.slice(0, -(ext.length + 1)) : base;
  return `${stem || "generated-model"}.${adapter.extensions[0]}`;
}
