const { getBackendUrl } = require('./utils/config')
const { isLoggedIn } = require('./utils/auth')
const { syncNow } = require('./utils/sync')

App({
  globalData: {
    backendUrl: ''
  },

  onLaunch() {
    this.globalData.backendUrl = getBackendUrl()
    if (isLoggedIn()) {
      syncNow().catch(() => {
        // 启动同步失败不影响离线使用，用户可在设置页手动重试。
      })
    }
  }
})
