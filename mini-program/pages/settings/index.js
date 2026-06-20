const { getBackendUrl, setBackendUrl, isValidBackendUrl } = require('../../utils/config')
const { healthCheck } = require('../../utils/api')
const { listQuestions, clearQuestions } = require('../../utils/storage')

Page({
  data: {
    backendUrl: '',
    questionCount: 0,
    testing: false,
    status: ''
  },

  onShow() {
    this.setData({
      backendUrl: getBackendUrl(),
      questionCount: listQuestions().length
    })
  },

  onUrlInput(event) {
    this.setData({ backendUrl: event.detail.value, status: '' })
  },

  saveBackend() {
    if (!isValidBackendUrl(this.data.backendUrl)) {
      wx.showToast({ title: '请输入有效的 HTTP 或 HTTPS 地址', icon: 'none' })
      return
    }
    const value = setBackendUrl(this.data.backendUrl)
    this.setData({ backendUrl: value, status: '后端地址已保存' })
    wx.showToast({ title: '保存成功', icon: 'success' })
  },

  async testBackend() {
    if (!isValidBackendUrl(this.data.backendUrl)) {
      wx.showToast({ title: '请先填写有效后端地址', icon: 'none' })
      return
    }
    setBackendUrl(this.data.backendUrl)
    this.setData({ testing: true, status: '正在检查后端连接…' })
    try {
      const result = await healthCheck()
      this.setData({
        status: `连接成功 · ${result.service || 'AI backend'}`
      })
    } catch (error) {
      this.setData({ status: `连接失败：${error.message || error}` })
    } finally {
      this.setData({ testing: false })
    }
  },

  exportData() {
    const questions = listQuestions()
    if (!questions.length) {
      wx.showToast({ title: '暂无数据可导出', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: JSON.stringify({
        format: 'public-exam-mini-program-backup',
        exportedAt: new Date().toISOString(),
        questions
      }, null, 2),
      success() {
        wx.showToast({ title: 'JSON 已复制', icon: 'success' })
      }
    })
  },

  clearData() {
    wx.showModal({
      title: '清空本地错题',
      content: `确定删除全部 ${this.data.questionCount} 道错题吗？此操作不可恢复。`,
      confirmColor: '#DC2626',
      success: result => {
        if (!result.confirm) return
        clearQuestions()
        this.setData({ questionCount: 0 })
        wx.showToast({ title: '已清空', icon: 'success' })
      }
    })
  }
})
