import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-secret-that-is-long-enough-for-hmac';
process.env.ALLOW_DEV_LOGIN = 'true';
process.env.DATA_DIR = path.join(os.tmpdir(), `wrong-notebook-${process.pid}`);
const { app } = await import('../src/server.js');

test('health and request validation do not require a model call', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok');

    const invalid = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, 'INVALID_REQUEST');
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('development login protects and isolates mistake sync', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function login(devUserId) {
    const response = await fetch(`${baseUrl}/api/auth/wechat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devUserId }),
    });
    assert.equal(response.status, 200);
    return (await response.json()).accessToken;
  }

  try {
    const unauthorized = await fetch(`${baseUrl}/api/sync/mistakes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(unauthorized.status, 401);

    const tokenA = await login('student-a');
    const tokenB = await login('student-b');
    const item = {
      id: 'question-1',
      questionText: '用户 A 的错题',
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    };
    const saved = await fetch(`${baseUrl}/api/sync/mistakes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: [item], deletions: [] }),
    });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).items.length, 1);

    const isolated = await fetch(`${baseUrl}/api/sync/mistakes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: [], deletions: [] }),
    });
    assert.equal(isolated.status, 200);
    assert.equal((await isolated.json()).items.length, 0);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
