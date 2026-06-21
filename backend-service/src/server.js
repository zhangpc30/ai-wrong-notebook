import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { analyzeWithProvider } from './ai-provider.js';
import {
  createAccessToken,
  createImageSignature,
  HttpError,
  loginWithWechat,
  requireAuth,
} from './auth.js';
import { getDataDir, syncMistakes } from './store.js';

const app = express();
const port = Number(process.env.PORT ?? 8080);
const maxImageBytes = Number(process.env.MAX_IMAGE_BYTES ?? 20 * 1024 * 1024);
const maxRequestsPerMinute = Number(
  process.env.MAX_REQUESTS_PER_MINUTE ?? 30,
);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '*')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.disable('etag');
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  }),
);
app.use(express.json({ limit: '16mb' }));
app.use((request, response, next) => {
  const requestId = request.headers['x-request-id'] || crypto.randomUUID();
  request.requestId = String(requestId);
  response.setHeader('X-Request-Id', request.requestId);
  next();
});

const rateBuckets = new Map();
app.use('/api', (request, response, next) => {
  const now = Date.now();
  const key = request.ip || request.socket.remoteAddress || 'unknown';
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= 60_000) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    next();
    return;
  }
  bucket.count += 1;
  if (bucket.count > maxRequestsPerMinute) {
    response.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: '请求过于频繁，请稍后重试',
        requestId: request.requestId,
      },
    });
    return;
  }
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxImageBytes, files: 1 },
  fileFilter: (_request, file, callback) => {
    callback(
      file.mimetype.startsWith('image/')
        ? null
        : new Error('Only image uploads are supported'),
      file.mimetype.startsWith('image/'),
    );
  },
});

app.get('/health', (_request, response) => {
  response.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  response.status(200).json({ status: 'ok' });
});

app.post('/api/auth/wechat', async (request, response, next) => {
  try {
    const identity = await loginWithWechat({
      code: String(request.body?.code || ''),
      devUserId: String(request.body?.devUserId || ''),
    });
    response.json({
      accessToken: createAccessToken(identity.userId),
      expiresIn: Number(process.env.AUTH_TOKEN_DAYS ?? 30) * 86400,
      user: {
        id: identity.userId,
        source: identity.source,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/sync/mistakes', requireAuth, async (request, response, next) => {
  try {
    const result = await syncMistakes(request.user.id, request.body || {});
    response.json(result);
  } catch (error) {
    next(
      new HttpError(
        400,
        'INVALID_SYNC_PAYLOAD',
        error instanceof Error ? error.message : '同步数据无效',
      ),
    );
  }
});

app.post(
  '/api/sync/images',
  requireAuth,
  upload.single('image'),
  async (request, response, next) => {
    try {
      if (!request.file) {
        throw new HttpError(400, 'IMAGE_REQUIRED', '请选择需要同步的图片');
      }
      const extension = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      }[request.file.mimetype];
      if (!extension) {
        throw new HttpError(400, 'UNSUPPORTED_IMAGE_TYPE', '图片格式不受支持');
      }
      const userHash = crypto
        .createHash('sha256')
        .update(request.user.id)
        .digest('hex')
        .slice(0, 32);
      const fileName = `${crypto.randomUUID()}.${extension}`;
      const directory = path.join(getDataDir(), 'images', userHash);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(path.join(directory, fileName), request.file.buffer, {
        flag: 'wx',
      });
      const signature = createImageSignature(userHash, fileName);
      const baseUrl =
        process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '') ||
        `${request.protocol}://${request.get('host')}`;
      response.status(201).json({
        url: `${baseUrl}/files/${userHash}/${fileName}?signature=${signature}`,
      });
    } catch (error) {
      next(error);
    }
  },
);

app.get('/files/:userHash/:fileName', async (request, response, next) => {
  try {
    const { userHash, fileName } = request.params;
    if (!/^[a-f0-9]{32}$/.test(userHash) || !/^[a-f0-9-]+\.(jpg|png|webp)$/.test(fileName)) {
      throw new HttpError(404, 'FILE_NOT_FOUND', '图片不存在');
    }
    const expected = createImageSignature(userHash, fileName);
    const actual = String(request.query.signature || '');
    if (
      actual.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    ) {
      throw new HttpError(403, 'INVALID_FILE_SIGNATURE', '图片访问签名无效');
    }
    response.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    response.sendFile(
      path.join(getDataDir(), 'images', userHash, fileName),
      (error) => {
        if (error && !response.headersSent) next(error);
      },
    );
  } catch (error) {
    next(error);
  }
});

app.post('/api/analyze', upload.single('image'), async (request, response) => {
  try {
    const textHint =
      typeof request.body?.textHint === 'string' ? request.body.textHint : '';
    let imageBase64 = request.file?.buffer.toString('base64') ?? '';
    let imageMimeType = request.file?.mimetype ?? 'image/jpeg';

    if (!imageBase64 && typeof request.body?.imageBase64 === 'string') {
      const raw = request.body.imageBase64.trim();
      const dataUrl = raw.match(/^data:([^;]+);base64,(.+)$/s);
      imageMimeType =
        dataUrl?.[1] ??
        (typeof request.body?.imageMimeType === 'string'
          ? request.body.imageMimeType
          : 'image/jpeg');
      imageBase64 = dataUrl?.[2] ?? raw;
    }

    if (!imageBase64 && !textHint.trim()) {
      return response.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'image、imageBase64 或 textHint 至少提供一项',
        },
      });
    }
    if (imageBase64) {
      if (!/^image\/(jpeg|jpg|png|webp)$/i.test(imageMimeType)) {
        return response.status(400).json({
          error: {
            code: 'UNSUPPORTED_IMAGE_TYPE',
            message: '仅支持 JPEG、PNG 或 WebP 图片',
            requestId: request.requestId,
          },
        });
      }
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
        return response.status(400).json({
          error: {
            code: 'INVALID_BASE64',
            message: 'imageBase64 不是有效的 Base64 内容',
            requestId: request.requestId,
          },
        });
      }
      const estimatedBytes = Math.floor((imageBase64.length * 3) / 4);
      if (estimatedBytes > maxImageBytes) {
        return response.status(413).json({
          error: {
            code: 'IMAGE_TOO_LARGE',
            message: `图片不能超过 ${Math.floor(maxImageBytes / 1024 / 1024)} MB`,
            requestId: request.requestId,
          },
        });
      }
    }

    const result = await analyzeWithProvider({
      imageBase64,
      imageMimeType,
      textHint,
    });
    return response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown backend error';
    const status = message.startsWith('Missing required') ? 503 : 502;
    return response.status(status).json({
      error: {
        code: status === 503 ? 'BACKEND_NOT_CONFIGURED' : 'AI_PROVIDER_ERROR',
        message,
        requestId: request.requestId,
      },
    });
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        requestId: _request.requestId,
      },
    });
    return;
  }
  const isMulterError = error instanceof multer.MulterError;
  const notFound = error?.code === 'ENOENT';
  response.status(notFound ? 404 : isMulterError ? 413 : 400).json({
    error: {
      code: notFound
        ? 'FILE_NOT_FOUND'
        : isMulterError
          ? 'IMAGE_TOO_LARGE'
          : 'INVALID_UPLOAD',
      message: notFound
        ? '图片不存在'
        : error instanceof Error
          ? error.message
          : 'Invalid upload',
      requestId: _request.requestId,
    },
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, '0.0.0.0', () => {
    console.log(`AI backend listening on http://0.0.0.0:${port}`);
  });
}

export { app };
