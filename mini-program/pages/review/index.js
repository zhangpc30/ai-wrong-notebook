const { listQuestions, markReviewed, toggleFavorite } = require('../../utils/storage')
const { getReviewQueue } = require('../../utils/review')
const { scheduleSync } = require('../../utils/sync')

function normalizeExercise(value) {
  if (typeof value === 'string') {
    return { question: value, answer: '', analysis: '' }
  }
  const source = value && typeof value === 'object' ? value : {}
  return {
    question: String(
      source.questionText || source.question || source.prompt || source.stem || ''
    ),
    answer: String(source.correctAnswer || source.answer || ''),
    analysis: String(source.analysis || source.standardAnalysis || source.explanation || '')
  }
}

Page({
  data: {
    queue: [],
    current: null,
    originalCount: 0,
    completedCount: 0,
    progress: 0,
    revealed: false,
    exercise: null,
    exerciseRevealed: false,
    finished: false
  },

  onLoad() {
    this.loadQueue()
  },

  loadQueue() {
    const queue = getReviewQueue(listQuestions())
    this.setData({
      queue,
      originalCount: queue.length,
      completedCount: 0,
      finished: queue.length === 0
    })
    this.showCurrent()
  },

  showCurrent() {
    const current = this.data.queue[0] || null
    const exerciseSource = current && current.generatedExercises
      ? current.generatedExercises[0]
      : null
    const exercise = normalizeExercise(exerciseSource)
    this.setData({
      current,
      revealed: false,
      exercise: exercise.question ? exercise : null,
      exerciseRevealed: false,
      progress: this.data.originalCount
        ? Math.round(this.data.completedCount * 100 / this.data.originalCount)
        : 100,
      finished: !current
    })
  },

  previewImage() {
    const path = this.data.current && this.data.current.imagePath
    if (path) wx.previewImage({ current: path, urls: [path] })
  },

  reveal() {
    this.setData({ revealed: true })
  },

  revealExercise() {
    this.setData({ exerciseRevealed: true })
  },

  toggleFavorite() {
    if (!this.data.current) return
    const updated = toggleFavorite(this.data.current.id)
    if (updated) {
      this.setData({ 'current.isFavorite': updated.isFavorite })
      scheduleSync()
    }
  },

  rate(event) {
    const mastery = Number(event.currentTarget.dataset.mastery)
    const current = this.data.current
    if (!current) return
    markReviewed(current.id, mastery)
    scheduleSync()
    this.setData({
      queue: this.data.queue.slice(1),
      completedCount: this.data.completedCount + 1
    })
    this.showCurrent()
  },

  openDetail() {
    if (!this.data.current) return
    wx.navigateTo({ url: `/pages/detail/index?id=${this.data.current.id}` })
  },

  goCapture() {
    wx.switchTab({ url: '/pages/capture/index' })
  },

  goNotebook() {
    wx.switchTab({ url: '/pages/notebook/index' })
  }
})
