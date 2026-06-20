import test from 'node:test';
import assert from 'node:assert/strict';

import { createAccessToken, verifyAccessToken } from '../src/auth.js';

test('creates signed access tokens and rejects tampering', () => {
  process.env.AUTH_SECRET = 'test-secret-that-is-long-enough-for-hmac';
  const token = createAccessToken('wx:user-1');
  assert.equal(verifyAccessToken(token).sub, 'wx:user-1');
  assert.throws(
    () => verifyAccessToken(`${token.slice(0, -1)}x`),
    /登录状态无效/,
  );
});
