const test = require('node:test')
const assert = require('node:assert/strict')

test('analysis uses a temporary cloud file instead of base64 request data', async () => {
  const calls = []
  global.wx = {
    cloud: {
      uploadFile(options) {
        calls.push(['upload', options.cloudPath, options.filePath])
        options.success({ fileID: 'cloud://temp-question.jpg' })
        return {}
      },
      getTempFileURL(options) {
        calls.push(['url', options.fileList])
        return Promise.resolve({
          fileList: [{
            fileID: 'cloud://temp-question.jpg',
            tempFileURL: 'https://example.tcb.qcloud.la/temp-question.jpg'
          }]
        })
      },
      callContainer(options) {
        calls.push(['container', options])
        if (options.path === '/api/analyze/jobs') {
          assert.equal(options.timeout, 20000)
          assert.equal(options.data.imageUrl, 'https://example.tcb.qcloud.la/temp-question.jpg')
          assert.equal(Object.hasOwn(options.data, 'imageBase64'), false)
          return Promise.resolve({
            statusCode: 202,
            data: { jobId: 'job-1', status: 'processing' }
          })
        }
        assert.equal(options.path, '/api/analyze/jobs/job-1')
        return Promise.resolve({
          statusCode: 200,
          data: {
            status: 'completed',
            result: {
              questionText: '测试题目',
              knowledgePoints: [],
              options: []
            }
          }
        })
      },
      deleteFile(options) {
        calls.push(['delete', options.fileList])
        return Promise.resolve({})
      }
    }
  }

  const apiPath = require.resolve('../utils/api')
  const cloudPath = require.resolve('../utils/cloud')
  delete require.cache[apiPath]
  delete require.cache[cloudPath]
  const { analyzeImage } = require('../utils/api')

  const result = await analyzeImage('/tmp/question.jpg')
  assert.equal(result.questionText, '测试题目')
  assert.deepEqual(calls.map(item => item[0]), [
    'upload',
    'url',
    'container',
    'container',
    'delete'
  ])
})

test.after(() => {
  delete global.wx
})
