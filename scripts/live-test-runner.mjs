#!/usr/bin/env node
/**
 * scripts/live-test-runner.mjs — run the bounded live test from inside a
 * sandbox that has no DNS for node.
 *
 * WHY THIS EXISTS. The Cowork workspace VM reaches the internet only through
 * an HTTPS proxy and has no working DNS for Node. curl honours the proxy
 * natively; node-fetch (which @anthropic-ai/sdk uses) does not, and fails
 * with `getaddrinfo EAI_AGAIN`. Neither undici's ProxyAgent nor
 * NODE_USE_ENV_PROXY fixes it, because the SDK never touches Node's global
 * fetch. So this starts a localhost relay that forwards to
 * api.anthropic.com with curl, and points the SDK at it via
 * ANTHROPIC_BASE_URL — an option the SDK already supports.
 *
 * NOTHING ABOUT THE APPLICATION CHANGES. Vercel has DNS and no proxy; this
 * is purely a sandbox workaround for testing.
 *
 * Usage: FURNIAI_LIVE_TEST_AUTHORIZED=yes node scripts/live-test-runner.mjs
 * On a normal machine, run scripts/live-test-design-propose.mjs directly.
 */
import { startAnthropicRelay } from "./anthropic-relay.mjs";

const relay = await startAnthropicRelay();
process.env.ANTHROPIC_BASE_URL = relay.baseUrl;
console.log(`[sandbox] SDK -> ${relay.baseUrl} -> curl -> https://api.anthropic.com\n`);
process.on("exit", () => relay.close());
await import("./live-test-design-propose.mjs");
