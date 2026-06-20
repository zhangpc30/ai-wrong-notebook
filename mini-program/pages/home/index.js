const { listQuestions } = require('../../utils/storage')
const { getBackendUrl } = require('../../utils/config')

function todayKey(value = new Date()) {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

function mostFrequent(values) {
  const counts = {}
  values.filter(Boolean).forEach(value => {
    counts[value] = (counts[value] || 0) + 1
  })
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || '暂无'
}

Page({
  data: {
    total: 0,
    highPriority: 0,
    unmastered: 0,
    todayNew: 0,
    weakModule: '暂无',
    commonReason: '暂无',
    backendConfigured: false,
    recent: []
  },

  onShow() {
    this.refresh()
  },

  onPullDownRefresh() {
    this.refresh()
    wx.stopPullDownRefresh()
  },

  refresh() {
    const questions = listQuestions()
    const today = todayKey()
    const sorted = questions
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    this.setData({
      total: questions.length,
      highPriority: questions.filter(item => item.reviewPriority === '高').length,
      unmastered: questions.filter(item => Number(item.masteryLevel) <= 2).length,
      todayNew: questions.filter(item => todayKey(item.createdAt) === today).length,
      weakModule: mostFrequent(questions.map(item => item.module)),
      commonReason: mostFrequent(questions.map(item => item.mistakeReason)),
      backendConfigured: Boolean(getBackendUrl()),
      recent: sorted.slice(0, 3).map(item => ({
        ...item,
        displayTitle: item.questionText || '未命名错题',
        displayMeta: [item.module, item.questionType].filter(Boolean).join(' · ') || '未分类',
        displayDate: String(item.createdAt || '').slice(0, 10)
      }))
    })
  },

  goCapture() {
    wx.switchTab({ url: '/pages/capture/index' })
  },

  goNotebook() {
    wx.switchTab({ url: '/pages/notebook/index' })
  },

  goSettings() {
    wx.switchTab({ url: '/pages/settings/index' })
  },

  openDetail(event) {
    wx.navigateTo({
      url: `/pages/detail/index?id=${event.currentTarget.dataset.id}`
    })
  }
})
