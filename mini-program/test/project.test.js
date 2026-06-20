const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

test('declared mini-program pages contain complete native files', () => {
  const appConfig = JSON.parse(
    fs.readFileSync(path.join(root, 'app.json'), 'utf8')
  )

  assert.deepEqual(appConfig.tabBar.list.map(item => item.text), [
    '首页',
    '拍照',
    '错题本',
    '设置'
  ])

  appConfig.pages.forEach(page => {
    ;['js', 'json', 'wxml', 'wxss'].forEach(extension => {
      const file = path.join(root, `${page}.${extension}`)
      assert.equal(fs.existsSync(file), true, `missing ${file}`)
    })
  })

  assert.equal(fs.existsSync(path.join(root, 'utils/uuid.js')), true)
})

test('front-end contains no model secret or direct provider endpoint', () => {
  const content = fs
    .readdirSync(root, { recursive: true })
    .filter(file => !String(file).startsWith('test/'))
    .filter(file => /\.(js|json|wxml|wxss)$/.test(file))
    .map(file => fs.readFileSync(path.join(root, file), 'utf8'))
    .join('\n')

  assert.equal(content.includes('/chat/completions'), false)
  assert.equal(content.includes('sk-'), false)
  assert.equal(content.includes('/api/analyze'), true)
  assert.equal(content.includes("name: 'image'"), true)
  assert.equal(content.includes("clientType: 'wechat-mini-program'"), true)
  assert.equal(content.includes('API_KEY'), false)
})

test('shared button styles keep labels horizontally and vertically centered', () => {
  const styles = fs.readFileSync(path.join(root, 'app.wxss'), 'utf8')
  const buttonRule = styles.match(/button\s*\{([\s\S]*?)\}/)

  assert.ok(buttonRule, 'missing shared button rule')
  assert.match(buttonRule[1], /display:\s*grid/)
  assert.match(buttonRule[1], /place-items:\s*center/)
  assert.match(buttonRule[1], /min-width:\s*0/)
  assert.doesNotMatch(buttonRule[1], /line-height:\s*\d+rpx/)
})

test('MVP pages expose required configuration, capture and review controls', () => {
  const read = relativePath =>
    fs.readFileSync(path.join(root, relativePath), 'utf8')

  assert.match(read('pages/home/index.wxml'), /请先配置 AI 后端地址/)
  assert.match(read('pages/capture/index.wxml'), /bindtap="chooseFromCamera"/)
  assert.match(read('pages/capture/index.wxml'), /拍照并分析/)
  assert.match(read('pages/capture/index.js'), /chooseImage\(\['camera'\], true\)/)
  assert.match(read('pages/capture/index.wxml'), /bindtap="chooseFromAlbum"/)
  assert.match(read('pages/result/index.wxml'), /AI 结果需要人工核对/)
  assert.match(read('pages/notebook/index.js'), /全部掌握程度/)
  assert.match(read('pages/notebook/index.wxml'), /catchtap="deleteItem"/)
  assert.match(read('pages/detail/index.wxml'), /保存复习状态/)
  assert.match(read('pages/settings/index.wxml'), /固定服务地址/)
  assert.match(read('utils/config.js'), /FIXED_BACKEND_URL = 'https:\/\/api\.pczhang\.press'/)
  assert.match(read('utils/config.js'), /return FIXED_BACKEND_URL/)
  assert.match(read('pages/capture/index.js'), /wx\.compressImage/)
  assert.match(read('pages/capture/index.wxml'), /优化/)
  assert.match(read('pages/result/index.wxml'), /全部拆分保存/)
  assert.match(read('pages/notebook/index.wxml'), /批量管理/)
  assert.match(read('pages/home/index.wxml'), /今日复习/)
  assert.match(read('pages/review/index.wxml'), /翻开答案/)
  assert.match(read('pages/settings/index.wxml'), /微信登录并迁移本地数据/)
  assert.match(read('utils/auth.js'), /wx\.login/)
  assert.match(read('utils/sync.js'), /\/api\/sync\/mistakes/)
  assert.match(read('utils/api.js'), /res\.statusCode === 401/)
  assert.match(read('utils/api.js'), /upload\('', false\)/)
  assert.match(read('utils/api.js'), /url not in domain list/)
  assert.match(read('utils/api.js'), /health\?_\=\$\{Date\.now\(\)\}/)
  assert.match(read('utils/api.js'), /res\.statusCode === 304/)
  assert.match(read('pages/home/index.wxml'), /cloudStatusText/)
  assert.match(read('pages/settings/index.wxml'), /从剪贴板恢复/)
})
