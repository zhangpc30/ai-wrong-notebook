const { getBackendUrl } = require('./utils/config')

App({
  globalData: {
    backendUrl: ''
  },

  onLaunch() {
    this.globalData.backendUrl = getBackendUrl()
  }
})
