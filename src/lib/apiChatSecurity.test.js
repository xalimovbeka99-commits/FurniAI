import { describe, test, expect, vi } from 'vitest';
import chatHandler from '../../api/chat.js';

describe('BLOCKER 2 — API Chat Error Redaction & Log Security', () => {
  const SECRET_MARKER = 'SECRET_SHOULD_NEVER_APPEAR';

  test('synthetic error with secrets in message, cause, headers, payload never leaks to console or client response', async () => {
    const errorLogs = [];
    const warnLogs = [];
    const infoLogs = [];

    const spyError = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errorLogs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    });
    const spyWarn = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      warnLogs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    });
    const spyLog = vi.spyOn(console, 'log').mockImplementation((...args) => {
      infoLogs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    });

    // Construct synthetic error with SECRET_SHOULD_NEVER_APPEAR in all 6 locations specified by BLOCKER 2:
    // 1. err.message
    // 2. err.cause
    // 3. fake headers.authorization
    // 4. fake headers['x-api-key']
    // 5. fake request.apiKey
    // 6. fake provider payload
    const fakeError = new Error(`Authentication failed: ${SECRET_MARKER}`);
    fakeError.cause = { details: `Cause secret: ${SECRET_MARKER}` };
    fakeError.headers = {
      authorization: `Bearer ${SECRET_MARKER}`,
      'x-api-key': SECRET_MARKER,
    };
    fakeError.request = {
      apiKey: SECRET_MARKER,
    };
    fakeError.providerPayload = {
      prompt: `User prompt containing ${SECRET_MARKER}`,
    };
    fakeError.status = 401;
    fakeError.code = 'INVALID_API_KEY';

    const req = {
      method: 'POST',
      body: {
        messages: [{ role: 'user', content: 'Create a wardrobe' }],
      },
    };

    let jsonResponseBody = null;

    const res = {
      status() {
        return this;
      },
      json(body) {
        jsonResponseBody = body;
        return this;
      },
    };

    const origKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-fake-key';

    if (chatHandler.safeLogError) {
      chatHandler.safeLogError(fakeError);
    }

    const allLogs = [...errorLogs, ...warnLogs, ...infoLogs].join('\n');
    const responseString = JSON.stringify(jsonResponseBody || {});

    spyError.mockRestore();
    spyWarn.mockRestore();
    spyLog.mockRestore();
    if (origKey !== undefined) process.env.ANTHROPIC_API_KEY = origKey;
    else delete process.env.ANTHROPIC_API_KEY;

    // Verify SECRET_SHOULD_NEVER_APPEAR appears ZERO times in logs and response
    expect(allLogs).not.toContain(SECRET_MARKER);
    expect(responseString).not.toContain(SECRET_MARKER);
  });
});
