import { mountConceptGallery } from "../../src/lib/projects/conceptGallery/index.js";
import { createFakeDocument, byAttr, byClass } from "./fakeDom.js";
import { createFakeCreativeJobsClient } from "./fixtures/fakeCreativeJobsClient.js";

export function setup(handlers = {}, options = {}) {
  const doc = createFakeDocument();
  const root = doc.createElement("div");
  doc.body.appendChild(root);
  const client = createFakeCreativeJobsClient(handlers);
  const gallery = mountConceptGallery(root, {
    client,
    getAccessToken: () => "test-token",
    formatDate: (iso) => `D(${iso})`,
    ...options,
  });
  return { doc, root, client, gallery };
}

export const cards = (root) => byClass(root, "fcg-card");
export const card = (root, jobId) => byAttr(root, "data-job-id", jobId)[0] || null;
export const button = (scope, action) => byAttr(scope, "data-action", action)[0] || null;
export const panel = (root) => byClass(root, "fcg-panel")[0] || null;
export const live = (root) => byClass(root, "fcg-live")[0];
export const announcer = (root) => byAttr(root, "data-announcer")[0];
