# Public Exam AI Backend

统一承接 Flutter iOS 和小程序的多模态题目分析请求。客户端只配置本服务地址，
模型密钥、模型名称和供应商地址全部保存在服务端环境变量中。

## 本地运行

```bash
cp .env.example .env
npm install
npm start
```

健康检查：

```bash
curl http://localhost:8080/health
```

生产环境可通过 `MAX_REQUESTS_PER_MINUTE`、`MAX_IMAGE_BYTES` 和
`TRUST_PROXY` 控制基础限流、图片大小及反向代理识别。

`GET /health` 和 `POST /api/analyze` 保持第一版 MVP 的匿名接口契约。
登录和鉴权仅用于云同步接口，不影响基础健康检查和图片分析。

## 登录与云同步

后端支持微信 `code2session` 登录、HMAC 签名访问令牌、用户数据隔离、
错题增量合并和题目图片持久化。生产环境至少配置：

```text
AUTH_SECRET=使用 openssl rand -hex 32 生成
WECHAT_APP_ID=正式小程序 AppID
WECHAT_APP_SECRET=正式小程序 AppSecret
DATA_DIR=/app/data
PUBLIC_BASE_URL=https://你的后端域名
```

本地联调可设置 `ALLOW_DEV_LOGIN=true`，客户端传入 `devUserId`。
生产环境必须关闭该开关。

同步接口：

```text
POST /api/auth/wechat
POST /api/sync/mistakes
POST /api/sync/images
```

`docker-compose.yml` 已挂载命名卷 `ai-data`，重新创建容器不会丢失错题和图片。

首次部署：

```bash
cp .env.example .env
openssl rand -hex 32
# 将输出写入 .env 的 AUTH_SECRET，并填写微信 AppID/AppSecret 与公网 HTTPS 地址
docker compose up -d --build
docker compose logs -f ai-backend
```

升级时不要执行 `docker compose down -v`，其中 `-v` 会删除错题数据卷。
当前持久化实现适合单实例 MVP；以后若需要多实例水平扩容，应将 `src/store.js`
替换为 PostgreSQL，并将图片目录迁移到对象存储。

Multipart 分析：

```bash
curl -X POST http://localhost:8080/api/analyze \
  -F "image=@/path/to/question.jpg" \
  -F "textHint=用户补充文字"
```

Base64 JSON：

```bash
curl -X POST http://localhost:8080/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"BASE64_DATA","imageMimeType":"image/jpeg"}'
```

## Docker

```bash
docker build -t public-exam-ai-backend .
docker run --rm -p 127.0.0.1:3000:8080 --env-file .env public-exam-ai-backend
```
