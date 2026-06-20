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
  assert.match(buttonRule[1], /display:\s*flex/)
  assert.match(buttonRule[1], /align-items:\s*center/)
  assert.match(buttonRule[1], /justify-content:\s*center/)
  assert.doesNotMatch(buttonRule[1], /line-height:\s*\d+rpx/)
})

test('MVP pages expose required configuration, capture and review controls', () => {
  const read = relativePath =>
    fs.readFileSync(path.join(root, relativePath), 'utf8')

  assert.match(read('pages/home/index.wxml'), /请先配置 AI 后端地址/)
  assert.match(read('pages/capture/index.wxml'), /bindtap="chooseFromCamera"/)
  assert.match(read('pages/capture/index.wxml'), /bindtap="chooseFromAlbum"/)
  assert.match(read('pages/result/index.wxml'), /AI 结果需要人工核对/)
  assert.match(read('pages/notebook/index.js'), /全部掌握程度/)
  assert.match(read('pages/notebook/index.wxml'), /catchtap="deleteItem"/)
  assert.match(read('pages/detail/index.wxml'), /保存复习状态/)
  assert.match(read('pages/settings/index.wxml'), /当前地址：/)
})
