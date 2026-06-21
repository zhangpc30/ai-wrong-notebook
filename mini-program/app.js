const { CLOUD_ENV, CLOUD_SERVICE, initCloud } = require('./utils/cloud')

App({
  globalData: {
    cloudEnv: CLOUD_ENV,
    cloudService: CLOUD_SERVICE
  },

  onLaunch() {
    try {
      initCloud()
    } catch (error) {
      console.error('[cloud] init failed:', error)
    }
  }
})
