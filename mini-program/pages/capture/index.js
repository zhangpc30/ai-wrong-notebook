const { analyzeImage } = require('../../utils/api')

Page({
  data: {
    imagePath: '',
    textHint: '',
    loading: false,
    loadingText: '正在上传题目图片…',
    loadingStep: 1,
    uploadProgress: 0,
    imageSizeText: '',
    errorMessage: ''
  },

  chooseFromCamera() {
    this.chooseImage(['camera'], true)
  },

  chooseFromAlbum() {
    this.chooseImage(['album'], false)
  },

  chooseImage(sourceType = ['camera', 'album'], autoAnalyze = false) {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType,
      sizeType: ['compressed'],
      success: result => {
        const file = result.tempFiles && result.tempFiles[0]
        if (file) {
          if (Number(file.size || 0) > 20 * 1024 * 1024) {
            this.setData({
              imagePath: '',
              imageSizeText: '',
              errorMessage: '图片超过 20 MB，请裁剪后重新选择。'
            })
            return
          }
          this.setData(
            {
              imagePath: file.tempFilePath,
              imageSizeText: this.formatFileSize(file.size),
              errorMessage: ''
            },
            () => {
              if (autoAnalyze) this.analyze()
            }
          )
        }
      },
      fail: error => {
        const message = String(error.errMsg || '')
        if (!message.includes('cancel')) {
          this.setData({
            errorMessage: /auth deny|authorize/i.test(message)
              ? '相机权限未开启，请在微信设置中允许使用相机后重试。'
              : '无法读取图片，请检查相机或相册权限后重试。'
          })
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
    this.setData({ imagePath: '', imageSizeText: '', errorMessage: '' })
  },

  onHintInput(event) {
    this.setData({ textHint: event.detail.value })
  },

  formatFileSize(bytes) {
    const size = Number(bytes || 0)
    if (!size) return ''
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
    return `${(size / 1024 / 1024).toFixed(1)} MB`
  },

  compressImage(filePath) {
    if (!wx.compressImage) return Promise.resolve(filePath)
    return new Promise(resolve => {
      wx.compressImage({
        src: filePath,
        quality: 76,
        compressedWidth: 1800,
        success: result => resolve(result.tempFilePath || filePath),
        fail: () => resolve(filePath)
      })
    })
  },

  async analyze() {
    if (this.data.loading) return
    if (!this.data.imagePath) {
      wx.showToast({ title: '请先拍照或选择图片', icon: 'none' })
      return
    }
    this.setData({
      loading: true,
      loadingStep: 1,
      uploadProgress: 0,
      loadingText: '正在优化图片…',
      errorMessage: ''
    })
    try {
      const uploadPath = await this.compressImage(this.data.imagePath)
      this.setData({
        loadingStep: 2,
        uploadProgress: 1,
        loadingText: '正在上传题目图片…'
      })
      const analysis = await analyzeImage(
        uploadPath,
        this.data.textHint,
        progress => {
          const analyzing = progress.phase === 'analyzing'
          this.setData({
            loadingStep: analyzing ? 3 : 2,
            uploadProgress: progress.progress,
            loadingText: analyzing
              ? 'AI 正在云端识别并整理错题…'
              : `正在上传题目图片 ${progress.progress}%`
          })
        }
      )
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
