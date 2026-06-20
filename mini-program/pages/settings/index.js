const { getBackendUrl, setBackendUrl, isValidBackendUrl } = require('../../utils/config')
const { healthCheck } = require('../../utils/api')
const {
  listQuestions,
  clearQuestions,
  saveQuestions
} = require('../../utils/storage')
const {
  getCloudUser,
  isLoggedIn,
  login,
  logout
} = require('../../utils/auth')
const { scheduleSync, syncNow } = require('../../utils/sync')

Page({
  data: {
    backendUrl: '',
    questionCount: 0,
    testing: false,
    status: '',
    loggedIn: false,
    cloudUserLabel: '',
    syncing: false,
    syncStatus: ''
  },

  onShow() {
    const user = getCloudUser()
    this.setData({
      backendUrl: getBackendUrl(),
      questionCount: listQuestions().length,
      loggedIn: isLoggedIn(),
      cloudUserLabel: user ? this.maskUserId(user.id) : ''
    })
  },

  maskUserId(value) {
    const text = String(value || '')
    if (text.length <= 14) return text
    return `${text.slice(0, 7)}…${text.slice(-6)}`
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

  async loginCloud() {
    if (!isValidBackendUrl(this.data.backendUrl)) {
      wx.showToast({ title: '请先配置有效后端地址', icon: 'none' })
      return
    }
    setBackendUrl(this.data.backendUrl)
    this.setData({ syncing: true, syncStatus: '正在通过微信安全登录…' })
    try {
      const user = await login()
      this.setData({
        loggedIn: true,
        cloudUserLabel: this.maskUserId(user.id),
        syncStatus: '登录成功，正在迁移本地错题…'
      })
      await this.runSync()
    } catch (error) {
      this.setData({ syncStatus: `登录失败：${error.message || error}` })
    } finally {
      this.setData({ syncing: false })
    }
  },

  async runSync() {
    if (!isLoggedIn()) {
      wx.showToast({ title: '请先登录云同步', icon: 'none' })
      return
    }
    this.setData({ syncing: true, syncStatus: '正在同步错题记录…' })
    try {
      const result = await syncNow(progress => {
        if (progress.phase === 'images') {
          this.setData({
            syncStatus: `正在同步题目图片 ${progress.completed}/${progress.total}`
          })
        } else {
          this.setData({ syncStatus: '正在合并多端错题记录…' })
        }
      })
      this.setData({
        questionCount: result.count,
        syncStatus: `同步完成 · 云端共 ${result.count} 道错题`
      })
      wx.showToast({ title: '同步完成', icon: 'success' })
    } catch (error) {
      if (error.statusCode === 401) {
        logout()
        this.setData({ loggedIn: false, cloudUserLabel: '' })
      }
      this.setData({ syncStatus: `同步失败：${error.message || error}` })
    } finally {
      this.setData({ syncing: false })
    }
  },

  logoutCloud() {
    wx.showModal({
      title: '退出云同步',
      content: '本机错题仍会保留，但之后的修改不会上传云端。',
      success: result => {
        if (!result.confirm) return
        logout()
        this.setData({
          loggedIn: false,
          cloudUserLabel: '',
          syncStatus: '已退出，当前为本地模式'
        })
      }
    })
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

  importData() {
    wx.getClipboardData({
      success: result => {
        try {
          const parsed = JSON.parse(result.data)
          const incoming = Array.isArray(parsed)
            ? parsed
            : parsed && Array.isArray(parsed.questions)
              ? parsed.questions
              : null
          if (!incoming) throw new Error('剪贴板中不是有效的错题备份')
          const merged = new Map(listQuestions().map(item => [item.id, item]))
          incoming.forEach(item => {
            if (!item || !item.id) return
            const current = merged.get(item.id)
            if (
              !current ||
              String(current.updatedAt || '') < String(item.updatedAt || '')
            ) {
              merged.set(item.id, item)
            }
          })
          const questions = saveQuestions(Array.from(merged.values()))
          this.setData({ questionCount: questions.length })
          scheduleSync(100)
          wx.showToast({ title: `已恢复 ${incoming.length} 条`, icon: 'success' })
        } catch (error) {
          wx.showModal({
            title: '无法导入',
            content: error.message || String(error),
            showCancel: false
          })
        }
      },
      fail() {
        wx.showToast({ title: '无法读取剪贴板', icon: 'none' })
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
        scheduleSync(100)
        this.setData({ questionCount: 0 })
        wx.showToast({ title: '已清空', icon: 'success' })
      }
    })
  }
})
