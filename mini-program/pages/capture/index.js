const { analyzeImage } = require('../../utils/api')
const { getBackendUrl } = require('../../utils/config')

Page({
  data: {
    imagePath: '',
    textHint: '',
    loading: false,
    loadingText: '正在上传题目图片…',
    errorMessage: ''
  },

  chooseFromCamera() {
    this.chooseImage(['camera'])
  },

  chooseFromAlbum() {
    this.chooseImage(['album'])
  },

  chooseImage(sourceType = ['camera', 'album']) {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType,
      sizeType: ['compressed'],
      success: result => {
        const file = result.tempFiles && result.tempFiles[0]
        if (file) {
          this.setData({
            imagePath: file.tempFilePath,
            errorMessage: ''
          })
        }
      },
      fail: error => {
        if (!String(error.errMsg || '').includes('cancel')) {
          this.setData({ errorMessage: '无法读取图片，请检查相机或相册权限后重试。' })
        }
      }
    })
  },

  previewImage() {
    if (!this.data.imagePath) return
    wx.previewImage({
      current: this.data.imagePath,
      urls: [this.data.imagePath]
    })
  },

  clearImage() {
    this.setData({ imagePath: '', errorMessage: '' })
  },

  onHintInput(event) {
    this.setData({ textHint: event.detail.value })
  },

  async analyze() {
    if (!getBackendUrl()) {
      wx.showModal({
        title: '尚未配置后端',
        content: '请先在设置页填写已部署的 AI 后端地址。',
        confirmText: '去设置',
        success: result => {
          if (result.confirm) wx.switchTab({ url: '/pages/settings/index' })
        }
      })
      return
    }
    if (!this.data.imagePath) {
      wx.showToast({ title: '请先拍照或选择图片', icon: 'none' })
      return
    }
    this.setData({
      loading: true,
      loadingText: '正在上传并分析题目…',
      errorMessage: ''
    })
    try {
      const analysis = await analyzeImage(this.data.imagePath, this.data.textHint)
      getApp().globalData.pendingAnalysis = analysis
      getApp().globalData.pendingImagePath = this.data.imagePath
      wx.navigateTo({ url: '/pages/result/index' })
    } catch (error) {
      const message = error.message || String(error)
      this.setData({ errorMessage: message })
      wx.showModal({
        title: '分析失败',
        content: message,
        showCancel: false
      })
    } finally {
      this.setData({ loading: false })
    }
  }
})
