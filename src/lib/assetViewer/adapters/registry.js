/**
 * Format adapter registry. An adapter turns the ORIGINAL asset bytes into a
 * three.js Object3D using the injected THREE namespace/loader classes; it
 * never imports three itself.
 *
 * Adapter interface (PROVISIONAL — formats beyond glTF wait on Integration):
 *   {
 *     id:          string            registry key, e.g. "glb"
 *     label:       string            human name
 *     mime:        string            canonical mime used by download()
 *     mimes:       string[]          mimes accepted as a format hint
 *     extensions:  string[]          lowercase, no dot; [0] is used for download names
 *     requires:    string[]          names of deps the adapter needs (e.g. "GLTFLoader")
 *     sniff(bytes: Uint8Array): boolean        content check on the first bytes
 *     load(arrayBuffer, ctx): Promise<{ root: Object3D | null, info?: object }>
 *       ctx = { three, deps, resourcePath }
 *   }
 *
 * The viewer always fetches the bytes itself (progress, size limit, and an
 * honest download() of the original file), so `load` only receives bytes.
 */
export function createAdapterRegistry(adapters = []) {
  const byId = new Map();
  const registry = {
    register(adapter) {
      validateAdapter(adapter);
      byId.set(adapter.id, adapter);
      return registry;
    },
    get(id) {
      return (id && byId.get(String(id).toLowerCase())) || null;
    },
    list() {
      return [...byId.values()];
    },
    byMime(mime) {
      if (!mime || mime === "application/octet-stream") return null;
      const m = mime.split(";")[0].trim().toLowerCase();
      return registry.list().find((a) => a.mime === m || (a.mimes || []).includes(m)) || null;
    },
    byExtension(ext) {
      if (!ext) return null;
      return registry.list().find((a) => a.extensions.includes(ext)) || null;
    },
    sniff(bytes) {
      return registry.list().find((a) => safeSniff(a, bytes)) || null;
    },
  };
  adapters.forEach((a) => registry.register(a));
  return registry;
}

function safeSniff(adapter, bytes) {
  try {
    return typeof adapter.sniff === "function" && adapter.sniff(bytes) === true;
  } catch {
    return false;
  }
}

export function validateAdapter(a) {
  const problems = [];
  if (!a || typeof a !== "object") throw new TypeError("adapter must be an object");
  if (typeof a.id !== "string" || !/^[a-z0-9-]+$/.test(a.id)) problems.push("id");
  if (typeof a.mime !== "string") problems.push("mime");
  if (!Array.isArray(a.extensions) || a.extensions.length === 0) problems.push("extensions");
  if (typeof a.load !== "function") problems.push("load");
  if (problems.length) throw new TypeError(`invalid asset adapter (${problems.join(", ")})`);
}
