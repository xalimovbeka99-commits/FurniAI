/**
 * Scripted CreativeJobsClient for tests and the fixture demo. Makes no network
 * calls. Each handler is a function (args) => body | Promise<body>, or throws
 * / rejects with a client error from contractFixtures.js.
 */
export function createFakeCreativeJobsClient({ listJobs, getJob, getAssetUrl, getConfig } = {}) {
  const calls = [];
  const call = (method, handler, args) => {
    calls.push({ method, args: { ...args, signal: undefined } });
    if (typeof handler !== "function") return Promise.reject(new Error(`fake client: no ${method} handler`));
    return new Promise((resolve) => resolve(handler(args)));
  };
  return {
    calls,
    count: (method) => calls.filter((c) => c.method === method).length,
    listJobs: (args) => call("listJobs", listJobs, args),
    getJob: (args) => call("getJob", getJob, args),
    getAssetUrl: (args) => call("getAssetUrl", getAssetUrl, args),
    // Only present when scripted, so "no config call" stays the default (nothing is guessed).
    ...(typeof getConfig === "function" ? { getConfig: (args) => call("getConfig", getConfig, args) } : {}),
  };
}
