const CLOUD_ENV = 'prod-d5gzlt33v072ebddc'
const CLOUD_SERVICE = 'express-vm2i'

function initCloud() {
  if (!wx.cloud) {
    throw new Error('当前微信版本不支持云托管，请升级微信后重试')
  }
  wx.cloud.init({ env: CLOUD_ENV, traceUser: true })
}

function callContainer({ path, method = 'GET', data, header = {} }) {
  if (!wx.cloud || typeof wx.cloud.callContainer !== 'function') {
    return Promise.reject(new Error('当前微信版本不支持云托管，请升级微信后重试'))
  }
  return wx.cloud.callContainer({
    config: { env: CLOUD_ENV },
    path,
    method,
    data,
    header: {
      'X-WX-SERVICE': CLOUD_SERVICE,
      ...header
    }
  })
}

module.exports = { CLOUD_ENV, CLOUD_SERVICE, initCloud, callContainer }
