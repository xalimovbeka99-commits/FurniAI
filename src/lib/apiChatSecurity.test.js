import { describe, test, expect, vi } from 'vitest';
import chatHandler from '../../api/chat.js';

describe('BLOCKER 2 (round 2) — API Chat Error Redaction & Log Security', () => {
  const SECRET_MARKER = 'SECRET_SHOULD_NEVER_APPEAR';

  test('synthetic error with the secret marker planted in every field simultaneously (including name/code/status) never leaks to console or client response', async () => {
    const errorLogs = [];
    const warnLogs = [];
    const infoLogs = [];

    const spyError = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errorLogs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    });
    const spyWarn = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      warnLogs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    });
    const spyLog = vi.spyOn(console, 'log').mockImplementation((...args) => {
      infoLogs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    });

    // Round 2: Codex proved the round-1 fix still logged err.name/err.code
    // verbatim (name/status/code were treated as "safe by type" — any string/
    // number was trusted). This plants the marker in EVERY field the review
    // named, including name/code/status themselves, not just message/cause/
    // headers/payload.
    const fakeError = new Error(`Authentication failed: ${SECRET_MARKER}`);
    fakeError.name = SECRET_MARKER;
    fakeError.code = SECRET_MARKER;
    fakeError.status = SECRET_MARKER; // deliberately not a number
    fakeError.cause = { details: `Cause secret: ${SECRET_MARKER}` };
    fakeError.stack = `Error: ${SECRET_MARKER}\n    at somewhere`;
    fakeError.headers = {
      authorization: `Bearer ${SECRET_MARKER}`,
      'x-api-key': SECRET_MARKER,
    };
    fakeError.apiKey = SECRET_MARKER;
    fakeError.request = { apiKey: SECRET_MARKER, headers: { authorization: `Bearer ${SECRET_MARKER}` } };
    fakeError.response = { body: { error: SECRET_MARKER } };
    fakeError.payload = { prompt: `User prompt containing ${SECRET_MARKER}` };
    fakeError.providerPayload = { prompt: `User prompt containing ${SECRET_MARKER}` };
    fakeError.error = { type: SECRET_MARKER, message: SECRET_MARKER };

    const req = {
      method: 'POST',
      body: { messages: [{ role: 'user', content: 'Create a wardrobe' }] },
    };
    let jsonResponseBody = null;
    const res = {
      status() { return this; },
      json(body) { jsonResponseBody = body; return this; },
    };

    const origKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-fake-key';

    expect(typeof chatHandler.safeLogError).toBe('function');
    chatHandler.safeLogError(fakeError);

    const allLogs = [...errorLogs, ...warnLogs, ...infoLogs].join('\n');
    const responseString = JSON.stringify(jsonResponseBody || {});

    spyError.mockRestore();
    spyWarn.mockRestore();
    spyLog.mockRestore();
    if (origKey !== undefined) process.env.ANTHROPIC_API_KEY = origKey;
    else delete process.env.ANTHROPIC_API_KEY;

    expect(allLogs).not.toContain(SECRET_MARKER);
    expect(responseString).not.toContain(SECRET_MARKER);
    // Prove something WAS actually logged (not vacuous), and that it's the
    // fixed, generic shape — never the attacker-supplied name/code/status.
    expect(errorLogs.length).toBe(1);
    expect(errorLogs[0]).toContain('"name":"Error"');
    expect(errorLogs[0]).toContain('"code":"UNKNOWN_ERROR"');
    expect(errorLogs[0]).toContain('"status":500');
  });

  test('a genuinely safe, allowlisted classification still passes through (not over-redacted to the point of being useless)', () => {
    const logs = [];
    const spyError = vi.spyOn(console, 'error').mockImplementation((...args) => {
      logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    });

    const realError = new Error('The request timed out');
    realError.name = 'APIConnectionTimeoutError';
    realError.code = 'rate_limit_error';
    realError.status = 429;

    chatHandler.safeLogError(realError);
    spyError.mockRestore();

    expect(logs[0]).toContain('"name":"APIConnectionTimeoutError"');
    expect(logs[0]).toContain('"code":"rate_limit_error"');
    expect(logs[0]).toContain('"status":429');
  });

  test('a spoofed name/code that merely resembles a safe value is not trusted (exact allowlist match only)', () => {
    const logs = [];
    const spyError = vi.spyOn(console, 'error').mockImplementation((...args) => {
      logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    });

    const spoofed = new Error('spoofed');
    spoofed.name = 'APIError; DROP TABLE users; --';
    spoofed.code = 'rate_limit_error\nAuthorization: Bearer sk-real-secret';
    spoofed.status = 200.5; // not an integer

    chatHandler.safeLogError(spoofed);
    spyError.mockRestore();

    expect(logs[0]).toContain('"name":"Error"');
    expect(logs[0]).toContain('"code":"UNKNOWN_ERROR"');
    expect(logs[0]).toContain('"status":500');
  });
});
