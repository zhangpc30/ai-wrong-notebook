const test = require('node:test')
const assert = require('node:assert/strict')

function loadHealthCheck(response) {
  const storage = { ai_backend_url: 'https://api.pczhang.press/' }
  global.wx = {
    getStorageSync(key) {
      return storage[key] || ''
    },
    setStorageSync(key, value) {
      storage[key] = value
    },
    request(options) {
      assert.equal(options.url, 'https://api.pczhang.press/health')
      options.success(response)
    }
  }

  const apiPath = require.resolve('../utils/api')
  const configPath = require.resolve('../utils/config')
  delete require.cache[apiPath]
  delete require.cache[configPath]
  return require('../utils/api').healthCheck
}

test('health check accepts the simplified backend JSON string', async () => {
  const healthCheck = loadHealthCheck({
    statusCode: 200,
    data: '{"status":"ok"}'
  })

  assert.deepEqual(await healthCheck(), { status: 'ok' })
})

test('health check accepts legacy ok and success response shapes', async () => {
  let healthCheck = loadHealthCheck({
    statusCode: 200,
    data: { ok: true }
  })
  assert.deepEqual(await healthCheck(), { ok: true })

  healthCheck = loadHealthCheck({
    statusCode: 200,
    data: { success: true }
  })
  assert.deepEqual(await healthCheck(), { success: true })
})

test.after(() => {
  delete global.wx
})
