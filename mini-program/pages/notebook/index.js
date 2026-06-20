const {
  listQuestions,
  deleteQuestion,
  deleteMistakes,
  toggleFavorite
} = require('../../utils/storage')
const { isDue } = require('../../utils/review')
const { scheduleSync } = require('../../utils/sync')

Page({
  data: {
    query: '',
    moduleFilter: '',
    moduleIndex: 0,
    questionTypeFilter: '',
    questionTypeIndex: 0,
    masteryFilter: 0,
    difficultyFilter: '',
    difficultyIndex: 0,
    priorityFilter: '',
    priorityIndex: 0,
    viewMode: 'all',
    selectionMode: false,
    selectedIds: [],
    modules: [],
    questionTypes: [],
    moduleOptions: ['全部模块'],
    questionTypeOptions: ['全部题型'],
    masteryOptions: ['全部掌握程度', '1 / 5', '2 / 5', '3 / 5', '4 / 5', '5 / 5'],
    difficultyOptions: ['全部难度', '低', '中', '高'],
    priorityOptions: ['全部优先级', '低', '中', '高'],
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
    const questionTypes = Array.from(new Set(questions.map(item => item.questionType).filter(Boolean)))
    this.setData({
      questions,
      modules,
      questionTypes,
      moduleOptions: ['全部模块'].concat(modules),
      questionTypeOptions: ['全部题型'].concat(questionTypes)
    })
    this.applyFilters()
  },

  onSearch(event) {
    this.setData({ query: event.detail.value })
    this.applyFilters()
  },

  onModuleChange(event) {
    const index = Number(event.detail.value)
    this.setData({
      moduleIndex: index,
      moduleFilter: index === 0 ? '' : this.data.modules[index - 1]
    })
    this.applyFilters()
  },

  onMasteryChange(event) {
    this.setData({ masteryFilter: Number(event.detail.value) })
    this.applyFilters()
  },

  onQuestionTypeChange(event) {
    const index = Number(event.detail.value)
    this.setData({
      questionTypeIndex: index,
      questionTypeFilter: index === 0 ? '' : this.data.questionTypes[index - 1]
    })
    this.applyFilters()
  },

  onDifficultyChange(event) {
    const index = Number(event.detail.value)
    this.setData({
      difficultyIndex: index,
      difficultyFilter: index === 0 ? '' : this.data.difficultyOptions[index]
    })
    this.applyFilters()
  },

  onPriorityChange(event) {
    const index = Number(event.detail.value)
    this.setData({
      priorityIndex: index,
      priorityFilter: index === 0 ? '' : this.data.priorityOptions[index]
    })
    this.applyFilters()
  },

  setViewMode(event) {
    this.setData({ viewMode: event.currentTarget.dataset.mode })
    this.applyFilters()
  },

  clearFilters() {
    this.setData({
      query: '',
      moduleFilter: '',
      moduleIndex: 0,
      questionTypeFilter: '',
      questionTypeIndex: 0,
      masteryFilter: 0,
      difficultyFilter: '',
      difficultyIndex: 0,
      priorityFilter: '',
      priorityIndex: 0,
      viewMode: 'all'
    })
    this.applyFilters()
  },

  applyFilters() {
    const query = this.data.query.trim().toLowerCase()
    const moduleFilter = this.data.moduleFilter
    const questionTypeFilter = this.data.questionTypeFilter
    const masteryFilter = this.data.masteryFilter
    const difficultyFilter = this.data.difficultyFilter
    const priorityFilter = this.data.priorityFilter
    const viewMode = this.data.viewMode
    const selectedIds = this.data.selectedIds
    const filtered = this.data.questions.filter(item => {
      if (moduleFilter && item.module !== moduleFilter) return false
      if (questionTypeFilter && item.questionType !== questionTypeFilter) return false
      if (masteryFilter && Number(item.masteryLevel) !== masteryFilter) return false
      if (difficultyFilter && item.difficulty !== difficultyFilter) return false
      if (priorityFilter && item.reviewPriority !== priorityFilter) return false
      if (viewMode === 'due' && !isDue(item)) return false
      if (viewMode === 'favorite' && !item.isFavorite) return false
      if (viewMode === 'weak' && Number(item.masteryLevel) > 2) return false
      if (!query) return true
      return [
        item.questionText,
        item.module,
        item.questionType,
        item.mistakeReason,
        item.knowledgeText
      ].join(' ').toLowerCase().includes(query)
    })
    this.setData({
      filtered: filtered.map(item => ({
        ...item,
        selected: selectedIds.includes(item.id)
      }))
    })
  },

  handleCardTap(event) {
    if (this.data.selectionMode) {
      this.toggleSelect(event)
      return
    }
    wx.navigateTo({
      url: `/pages/detail/index?id=${event.currentTarget.dataset.id}`
    })
  },

  toggleSelectionMode() {
    this.setData({
      selectionMode: !this.data.selectionMode,
      selectedIds: []
    })
    this.applyFilters()
  },

  toggleSelect(event) {
    const id = event.currentTarget.dataset.id
    const selectedIds = this.data.selectedIds.includes(id)
      ? this.data.selectedIds.filter(item => item !== id)
      : this.data.selectedIds.concat(id)
    this.setData({ selectedIds })
    this.applyFilters()
  },

  selectAll() {
    this.setData({ selectedIds: this.data.filtered.map(item => item.id) })
    this.applyFilters()
  },

  favoriteItem(event) {
    toggleFavorite(event.currentTarget.dataset.id)
    scheduleSync()
    this.refresh()
  },

  batchFavorite() {
    if (!this.data.selectedIds.length) return
    this.data.selectedIds.forEach(id => toggleFavorite(id, true))
    scheduleSync()
    this.setData({ selectedIds: [], selectionMode: false })
    this.refresh()
    wx.showToast({ title: '已批量收藏', icon: 'success' })
  },

  batchDelete() {
    if (!this.data.selectedIds.length) return
    wx.showModal({
      title: '批量删除',
      content: `确定删除选中的 ${this.data.selectedIds.length} 道错题吗？`,
      confirmColor: '#B7472A',
      success: result => {
        if (!result.confirm) return
        deleteMistakes(this.data.selectedIds)
        scheduleSync()
        this.setData({ selectedIds: [], selectionMode: false })
        this.refresh()
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  },

  deleteItem(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '删除错题',
      content: '删除后无法恢复，确定继续吗？',
      confirmColor: '#B7472A',
      success: result => {
        if (!result.confirm) return
        deleteQuestion(id)
        scheduleSync()
        this.refresh()
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  }
})
