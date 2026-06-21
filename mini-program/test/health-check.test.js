const test = require('node:test')
const assert = require('node:assert/strict')

function loadHealthCheck(response) {
  global.wx = {
    cloud: {
      callContainer(options) {
        assert.deepEqual(options.config, {
          env: 'prod-d5gzlt33v072ebddc'
        })
        assert.equal(options.path, '/health')
        assert.equal(options.method, 'GET')
        assert.equal(options.header['X-WX-SERVICE'], 'express-vm2i')
        return Promise.resolve(response)
      }
    }
  }

  const apiPath = require.resolve('../utils/api')
  const cloudPath = require.resolve('../utils/cloud')
  delete require.cache[apiPath]
  delete require.cache[cloudPath]
  return require('../utils/api').healthCheck
}

test('health check accepts simplified cloud container response', async () => {
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
