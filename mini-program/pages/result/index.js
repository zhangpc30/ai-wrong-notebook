const { normalizeAnalysis, createRecord, toStringList } = require('../../utils/schema')
const { upsertQuestion, getQuestion } = require('../../utils/storage')
const { scheduleSync } = require('../../utils/sync')

const EXAM_TYPES = ['国考', '省考', '事业编', '三支一扶', '军队文职', '选调生', '无法判断']
const PAPER_TYPES = ['行测', '申论', '公基', '职测', '综合应用能力', '无法判断']
const MODULES = [
  '言语理解',
  '判断推理',
  '数量关系',
  '资料分析',
  '常识判断',
  '公基法律',
  '公基政治',
  '公基经济',
  '公基管理',
  '公文',
  '人文科技',
  '其他'
]
const DIFFICULTIES = ['低', '中', '高']
const PRIORITIES = ['低', '中', '高']
const MASTERY_LEVELS = [1, 2, 3, 4, 5]

Page({
  data: {
    form: normalizeAnalysis({}),
    knowledgePointsText: '',
    optionsText: '',
    notes: '',
    imagePath: '',
    editId: '',
    examTypes: EXAM_TYPES,
    paperTypes: PAPER_TYPES,
    modules: MODULES,
    difficulties: DIFFICULTIES,
    priorities: PRIORITIES,
    masteryLevels: MASTERY_LEVELS,
    qualityNeedsReview: false,
    qualityWarnings: [],
    splitQuestions: [],
    saving: false
  },

  onLoad(options) {
    const app = getApp()
    const existing = options.id ? getQuestion(options.id) : null
    const source = existing || app.globalData.pendingAnalysis || {}
    const form = normalizeAnalysis(source)
    const splitQuestions = !existing && form.multiQuestion.detected
      ? form.multiQuestion.questions
          .map(item => normalizeAnalysis({
            ...form,
            ...item,
            multiQuestion: { detected: false, questions: [] }
          }))
          .filter(item => item.questionText)
      : []
    this.setData({
      form,
      knowledgePointsText: form.knowledgePoints.join('、'),
      optionsText: form.options.join('\n'),
      notes: form.notes,
      qualityNeedsReview: Boolean(form.qualityCheck.needsReview),
      qualityWarnings: form.qualityCheck.warnings,
      splitQuestions,
      imagePath: existing
        ? existing.imagePath || ''
        : app.globalData.pendingImagePath || '',
      editId: existing ? existing.id : ''
    })
  },

  onTextInput(event) {
    const field = event.currentTarget.dataset.field
    const patch = { [`form.${field}`]: event.detail.value }
    if (field === 'standardAnalysis') {
      patch['form.analysis'] = event.detail.value
    }
    this.setData(patch)
  },

  onKnowledgeInput(event) {
    this.setData({ knowledgePointsText: event.detail.value })
  },

  onOptionsInput(event) {
    this.setData({ optionsText: event.detail.value })
  },

  onNotesInput(event) {
    this.setData({ notes: event.detail.value })
  },

  onPickerChange(event) {
    const field = event.currentTarget.dataset.field
    const source = event.currentTarget.dataset.source
    const values = this.data[source]
    this.setData({ [`form.${field}`]: values[Number(event.detail.value)] })
  },

  previewImage() {
    if (!this.data.imagePath) return
    wx.previewImage({
      current: this.data.imagePath,
      urls: [this.data.imagePath]
    })
  },

  buildForm() {
    return normalizeAnalysis({
      ...this.data.form,
      knowledgePoints: toStringList(this.data.knowledgePointsText),
      options: toStringList(this.data.optionsText)
    })
  },

  async persistImage() {
    let imagePath = this.data.imagePath
    if (!imagePath || this.data.editId) {
      return imagePath
    }
    try {
      const saved = await new Promise((resolve, reject) => {
        wx.saveFile({
          tempFilePath: imagePath,
          success: resolve,
          fail: reject
        })
      })
      return saved.savedFilePath
    } catch (_) {
      return imagePath
    }
  },

  finishSave(savedId, message) {
    getApp().globalData.pendingAnalysis = null
    getApp().globalData.pendingImagePath = ''
    wx.showToast({ title: message, icon: 'success' })
    setTimeout(() => {
      if (this.data.editId) {
        wx.navigateBack()
      } else if (savedId) {
        wx.redirectTo({ url: `/pages/detail/index?id=${savedId}` })
      } else {
        wx.switchTab({ url: '/pages/notebook/index' })
      }
    }, 500)
  },

  async save() {
    const form = this.buildForm()
    if (!form.questionText) {
      wx.showToast({ title: '题目原文不能为空', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      const imagePath = await this.persistImage()
      const existing = this.data.editId ? getQuestion(this.data.editId) : null
      const record = existing
        ? {
            ...existing,
            ...form,
            notes: this.data.notes,
            imagePath
          }
        : createRecord(form, {
            notes: this.data.notes,
            imagePath
          })
      const saved = upsertQuestion(record)
      scheduleSync()
      this.finishSave(saved.id, '已保存到错题本')
    } finally {
      this.setData({ saving: false })
    }
  },

  async saveSplitQuestions() {
    if (!this.data.splitQuestions.length || this.data.saving) return
    this.setData({ saving: true })
    try {
      const imagePath = await this.persistImage()
      this.data.splitQuestions.forEach(question => {
        upsertQuestion(createRecord(question, {
          imagePath,
          notes: this.data.notes
        }))
      })
      scheduleSync()
      this.finishSave('', `已拆分保存 ${this.data.splitQuestions.length} 题`)
    } finally {
      this.setData({ saving: false })
    }
  }
})
