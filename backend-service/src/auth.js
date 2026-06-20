import crypto from 'node:crypto';

const encoder = new TextEncoder();

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function authSecret() {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value) throw new HttpError(503, 'AUTH_NOT_CONFIGURED', 'AUTH_SECRET 未配置');
  if (value.length < 32) {
    throw new HttpError(
      503,
      'AUTH_SECRET_TOO_SHORT',
      'AUTH_SECRET 至少需要 32 个字符',
    );
  }
  return value;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(value) {
  return crypto
    .createHmac('sha256', authSecret())
    .update(value)
    .digest('base64url');
}

export function createAccessToken(userId) {
  const now = Math.floor(Date.now() / 1000);
  const days = Math.max(1, Number(process.env.AUTH_TOKEN_DAYS ?? 30));
  const payload = encode({
    sub: userId,
    iat: now,
    exp: now + days * 86400,
    nonce: crypto.randomBytes(8).toString('hex'),
  });
  return `${payload}.${sign(payload)}`;
}

export function verifyAccessToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) {
    throw new HttpError(401, 'UNAUTHORIZED', '登录状态无效');
  }
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new HttpError(401, 'UNAUTHORIZED', '登录状态无效');
  }
  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new HttpError(401, 'UNAUTHORIZED', '登录状态无效');
  }
  if (!decoded.sub || Number(decoded.exp) <= Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, 'TOKEN_EXPIRED', '登录状态已过期，请重新登录');
  }
  return decoded;
}

export function requireAuth(request, _response, next) {
  try {
    const header = String(request.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const payload = verifyAccessToken(token);
    request.user = { id: String(payload.sub) };
    next();
  } catch (error) {
    next(error);
  }
}

export function optionalAuth(request, _response, next) {
  const header = String(request.headers.authorization || '');
  if (!header.startsWith('Bearer ')) {
    next();
    return;
  }
  requireAuth(request, _response, next);
}

export async function loginWithWechat({ code, devUserId }) {
  if (devUserId && process.env.ALLOW_DEV_LOGIN === 'true') {
    return {
      userId: `dev:${crypto.createHash('sha256').update(devUserId).digest('hex').slice(0, 24)}`,
      source: 'development',
    };
  }

  const appId = process.env.WECHAT_APP_ID?.trim();
  const appSecret = process.env.WECHAT_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new HttpError(
      503,
      'WECHAT_AUTH_NOT_CONFIGURED',
      'WECHAT_APP_ID 或 WECHAT_APP_SECRET 未配置',
    );
  }
  if (!code) throw new HttpError(400, 'INVALID_LOGIN_CODE', '缺少微信登录 code');

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', appSecret);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok || body.errcode || !body.openid) {
    throw new HttpError(
      401,
      'WECHAT_LOGIN_FAILED',
      body.errmsg || '微信登录失败',
    );
  }
  const identity = body.unionid || body.openid;
  return {
    userId: `wx:${crypto.createHash('sha256').update(identity).digest('hex')}`,
    source: 'wechat',
  };
}

export function createImageSignature(userId, fileName) {
  return crypto
    .createHmac('sha256', authSecret())
    .update(encoder.encode(`${userId}/${fileName}`))
    .digest('hex');
}
