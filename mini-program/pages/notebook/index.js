const { listQuestions, deleteQuestion } = require('../../utils/storage')

Page({
  data: {
    query: '',
    moduleFilter: '',
    masteryFilter: 0,
    modules: [],
    moduleOptions: ['全部模块'],
    masteryOptions: ['全部掌握程度', '1 / 5', '2 / 5', '3 / 5', '4 / 5', '5 / 5'],
    questions: [],
    filtered: []
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
      .slice()
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .map(item => ({
        ...item,
        displayMeta: [item.module, item.questionType].filter(Boolean).join(' · ') || '未分类',
        displayDate: String(item.updatedAt || item.createdAt || '').slice(0, 10),
        knowledgeText: (item.knowledgePoints || []).join('、')
      }))
    const modules = Array.from(new Set(questions.map(item => item.module).filter(Boolean)))
    this.setData({
      questions,
      modules,
      moduleOptions: ['全部模块'].concat(modules)
    })
    this.applyFilters()
  },

  onSearch(event) {
    this.setData({ query: event.detail.value })
    this.applyFilters()
  },

  onModuleChange(event) {
    const index = Number(event.detail.value)
    this.setData({ moduleFilter: index === 0 ? '' : this.data.modules[index - 1] })
    this.applyFilters()
  },

  onMasteryChange(event) {
    this.setData({ masteryFilter: Number(event.detail.value) })
    this.applyFilters()
  },

  clearFilters() {
    this.setData({ query: '', moduleFilter: '', masteryFilter: 0 })
    this.applyFilters()
  },

  applyFilters() {
    const query = this.data.query.trim().toLowerCase()
    const moduleFilter = this.data.moduleFilter
    const masteryFilter = this.data.masteryFilter
    const filtered = this.data.questions.filter(item => {
      if (moduleFilter && item.module !== moduleFilter) return false
      if (masteryFilter && Number(item.masteryLevel) !== masteryFilter) return false
      if (!query) return true
      return [
        item.questionText,
        item.module,
        item.questionType,
        item.mistakeReason,
        item.knowledgeText
      ].join(' ').toLowerCase().includes(query)
    })
    this.setData({ filtered })
  },

  openDetail(event) {
    wx.navigateTo({
      url: `/pages/detail/index?id=${event.currentTarget.dataset.id}`
    })
  },

  deleteItem(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '删除错题',
      content: '删除后无法恢复，确定继续吗？',
      confirmColor: '#DC2626',
      success: result => {
        if (!result.confirm) return
        deleteQuestion(id)
        this.refresh()
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  }
})
