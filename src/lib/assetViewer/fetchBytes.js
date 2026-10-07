/**
 * Byte acquisition with progress, size limit and abort. The viewer keeps
 * these ORIGINAL bytes for download(); nothing is re-encoded.
 */
import { AssetViewerError, FETCH_FAILED_MESSAGE, isViewerError } from "./errors.js";

/** Placeholder ceiling until Integration agrees a max file size. */
export const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

export function isAbortError(e) {
  return Boolean(e && (e.name === "AbortError" || e.code === 20));
}

/** v3: why a link failed, from the HTTP status (0/none = transport; `offline` true or a transport reason such as "cross-origin"). */
export function fetchFailureReason(status, offline = false) {
  if (!status) return offline === true ? "offline" : offline || "network";
  if (status === 404 || status === 410) return "gone";
  if (status === 401 || status === 403) return "denied";
  if (status >= 500 || status === 408 || status === 429) return "server";
  return "http";
}

function fetchFailed(detail, status, offline) {
  const reason = fetchFailureReason(status, offline);
  return new AssetViewerError("FETCH_FAILED", detail, { reason, message: FETCH_FAILED_MESSAGE[reason], ...(status ? { status } : {}) });
}

export async function fetchBytes(url, { fetchImpl, signal, maxBytes, onProgress, credentials = "omit", isOffline = () => false } = {}) {
  if (typeof fetchImpl !== "function") {
    throw new AssetViewerError("MISSING_DEPENDENCY", "no fetch implementation available");
  }
  let res;
  try {
    res = await fetchImpl(url, { signal, credentials });
  } catch (e) {
    if (isAbortError(e)) throw e;
    throw fetchFailed(`network error: ${e && e.message ? e.message : e}`, 0, isOffline());
  }
  if (!res || !res.ok) {
    const status = res ? res.status : 0;
    throw fetchFailed(`HTTP ${status}${res && res.statusText ? " " + res.statusText : ""}`, status, false);
  }
  const lenHeader = res.headers && typeof res.headers.get === "function" ? res.headers.get("content-length") : null;
  let total = lenHeader != null && /^\d+$/.test(String(lenHeader)) ? Number(lenHeader) : null;
  if (maxBytes && total && total > maxBytes) {
    throw new AssetViewerError("FILE_TOO_LARGE", `content-length ${total} > limit ${maxBytes}`);
  }
  const report = (loaded) => {
    if (typeof onProgress !== "function") return;
    const t = total && loaded <= total ? total : null;
    onProgress({ loaded, total: t, ratio: t ? loaded / t : null });
  };
  try {
    if (res.body && typeof res.body.getReader === "function") {
      const reader = res.body.getReader();
      const chunks = [];
      let loaded = 0;
      report(0);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        if (maxBytes && loaded > maxBytes) {
          try {
            reader.cancel();
          } catch {
            /* ignore */
          }
          throw new AssetViewerError("FILE_TOO_LARGE", `streamed ${loaded} bytes > limit ${maxBytes}`);
        }
        report(loaded);
      }
      const out = new Uint8Array(loaded);
      let o = 0;
      for (const c of chunks) {
        out.set(c, o);
        o += c.byteLength;
      }
      return out.buffer;
    }
    const buf = await res.arrayBuffer();
    if (maxBytes && buf.byteLength > maxBytes) {
      throw new AssetViewerError("FILE_TOO_LARGE", `${buf.byteLength} bytes > limit ${maxBytes}`);
    }
    total = buf.byteLength;
    report(buf.byteLength);
    return buf;
  } catch (e) {
    if (isViewerError(e) || isAbortError(e)) throw e;
    throw fetchFailed(`body read failed: ${e && e.message ? e.message : e}`, 0, isOffline());
  }
}

export async function readBlob(blob, { maxBytes } = {}) {
  if (maxBytes && typeof blob.size === "number" && blob.size > maxBytes) {
    throw new AssetViewerError("FILE_TOO_LARGE", `blob ${blob.size} bytes > limit ${maxBytes}`);
  }
  try {
    return await blob.arrayBuffer();
  } catch (e) {
    throw new AssetViewerError("FETCH_FAILED", `blob read failed: ${e && e.message ? e.message : e}`);
  }
}
