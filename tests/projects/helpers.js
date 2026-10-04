import { mountConceptGallery } from "../../src/lib/projects/conceptGallery/index.js";
// Asset Engineer's real source, imported for tests only (the gallery itself never imports it).
import { createCreativeAssetSource } from "../../src/lib/assetViewer/index.js";
import { createFakeDocument, byAttr, byClass } from "./fakeDom.js";
import { createFakeCreativeJobsClient } from "./fixtures/fakeCreativeJobsClient.js";
import { createFixtureFetch } from "./fixtures/fixtureFetch.js";

/**
 * handlers: { listJobs, getJob, getAssetUrl } (see fixtureFetch.js).
 * options: gallery options, plus { noSource: true } to mount without a creative source.
 */
export function setup(handlers = {}, options = {}) {
  const doc = createFakeDocument();
  const root = doc.createElement("div");
  doc.body.appendChild(root);
  const { noSource, sourceToken, ...galleryOptions } = options;
  const client = createFakeCreativeJobsClient(noSource ? handlers : { listJobs: handlers.listJobs });
  const fetchImpl = createFixtureFetch(handlers, client.calls);
  const creativeSource = noSource ? undefined : createCreativeAssetSource({ fetchImpl, getAuthToken: sourceToken || (() => "test-token") });
  const gallery = mountConceptGallery(root, {
    client,
    getAccessToken: () => "test-token",
    formatDate: (iso) => `D(${iso})`,
    ...(creativeSource ? { creativeSource } : {}),
    ...galleryOptions,
  });
  return { doc, root, client, gallery, creativeSource };
}

export const cards = (root) => byClass(root, "fcg-card");
export const card = (root, jobId) => byAttr(root, "data-job-id", jobId)[0] || null;
export const button = (scope, action) => byAttr(scope, "data-action", action)[0] || null;
export const panel = (root) => byClass(root, "fcg-panel")[0] || null;
export const live = (root) => byClass(root, "fcg-live")[0];
export const announcer = (root) => byAttr(root, "data-announcer")[0];
