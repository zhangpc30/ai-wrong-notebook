const {
  getQuestion,
  deleteQuestion,
  upsertQuestion,
  updateMistake
} = require('../../utils/storage')
const { analyzeImage } = require('../../utils/api')

Page({
  data: {
    id: '',
    question: null,
    knowledgeText: '',
    notesDraft: '',
    masteryLevels: [1, 2, 3, 4, 5],
    loading: false
  },

  onLoad(options) {
    this.setData({ id: options.id || '' })
  },

  onShow() {
    this.loadQuestion()
  },

  loadQuestion() {
    const question = getQuestion(this.data.id)
    if (!question) {
      wx.showToast({ title: '错题不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 400)
      return
    }
    this.setData({
      question,
      knowledgeText: (question.knowledgePoints || []).join('、'),
      notesDraft: question.notes || ''
    })
  },

  previewImage() {
    const path = this.data.question && this.data.question.imagePath
    if (!path) return
    wx.previewImage({ current: path, urls: [path] })
  },

  edit() {
    wx.navigateTo({ url: `/pages/result/index?id=${this.data.id}` })
  },

  onNotesInput(event) {
    this.setData({ notesDraft: event.detail.value })
  },

  onMasteryChange(event) {
    const masteryLevel = this.data.masteryLevels[Number(event.detail.value)]
    this.setData({ 'question.masteryLevel': masteryLevel })
  },

  saveReviewState() {
    const question = this.data.question
    if (!question) return
    const updated = updateMistake(question.id, {
      masteryLevel: question.masteryLevel,
      notes: this.data.notesDraft
    })
    if (updated) {
      this.setData({ question: updated, notesDraft: updated.notes })
      wx.showToast({ title: '复习状态已保存', icon: 'success' })
    }
  },

  backToNotebook() {
    wx.switchTab({ url: '/pages/notebook/index' })
  },

  async reanalyze() {
    const question = this.data.question
    if (!question || !question.imagePath) {
      wx.showToast({ title: '该错题没有可用原图', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      const analysis = await analyzeImage(question.imagePath, question.questionText)
      upsertQuestion({
        ...question,
        ...analysis,
        notes: question.notes,
        imagePath: question.imagePath
      })
      wx.showToast({ title: '重新分析完成', icon: 'success' })
      this.loadQuestion()
    } catch (error) {
      wx.showModal({
        title: '重新分析失败',
        content: error.message || String(error),
        showCancel: false
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  remove() {
    wx.showModal({
      title: '删除错题',
      content: '删除后无法恢复，确定继续吗？',
      confirmColor: '#DC2626',
      success: result => {
        if (!result.confirm) return
        deleteQuestion(this.data.id)
        wx.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => wx.switchTab({ url: '/pages/notebook/index' }), 400)
      }
    })
  }
})
