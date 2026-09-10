/**
 * 阅读时长 / Flesch 易读性
 * - WPM：中文 300 字/分，英文 200 词/分
 * - Flesch 易读性：0-100 分，越高越易读
 *   中文走简化版：句长 + 汉字复杂度（每字笔画数估算过简，按句长折算）
 */
export function readingTime(text: string): { minutes: number; words: number; cjk: number; ascii: number; sentences: number; paragraphs: number } {
  const cjk = (text.match(/[一-龥]/g) || []).length
  const ascii = (text.match(/[A-Za-z]+/g) || []).length
  const cjkMinutes = cjk / 300
  const asciiMinutes = ascii / 200
  const minutes = Math.max(1, Math.ceil(cjkMinutes + asciiMinutes))
  // 句数
  const cnSents = (text.match(/[。！？!?]+/g) || []).length
  const enSents = (text.match(/[.!?]+/g) || []).length
  const sentences = Math.max(1, cnSents + enSents - cnSents * 0.5)
  // 段数
  const paragraphs = Math.max(1, text.split(/\n\s*\n/).filter((p) => p.trim()).length)
  return { minutes, words: cjk + ascii, cjk, ascii, sentences, paragraphs }
}

/**
 * Flesch Reading Ease（英文）
 * 公式：206.835 - 1.015 × (words/sentences) - 84.6 × (syllables/words)
 * 返回 0-100，越高越易读
 */
export function fleschEnglish(text: string): { score: number; level: string } {
  const sentences = Math.max(1, (text.match(/[.!?]+/g) || []).length)
  const words = (text.match(/[A-Za-z]+/g) || []).length || 1
  // 简化音节：每个单词元音组数
  const syllables = text.split(/\s+/).filter(Boolean).reduce((sum, w) => {
    return sum + Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) || []).length)
  }, 0)
  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
  const clamped = Math.max(0, Math.min(100, score))
  return { score: Math.round(clamped), level: fleschLevel(clamped) }
}

/**
 * 中文可读性（简化版）
 * 平均句长（字数/句）+ 平均段长
 * 句长 8-25 字最佳，过短或过长都扣分
 */
export function fleschChinese(text: string): { score: number; level: string } {
  const cjk = (text.match(/[一-龥]/g) || []).length
  const sentences = Math.max(1, (text.match(/[。！？!?]+/g) || []).length)
  const avgSent = cjk / sentences
  // 最佳句长 16 字，偏离越多越低
  const diff = Math.abs(avgSent - 16)
  let score = 100 - diff * 1.5
  if (avgSent > 40) score -= 10
  if (avgSent < 6) score -= 15
  score = Math.max(0, Math.min(100, score))
  return { score: Math.round(score), level: fleschLevel(score) }
}

function fleschLevel(score: number): string {
  if (score >= 90) return '非常通俗'
  if (score >= 80) return '通俗'
  if (score >= 70) return '较通俗'
  if (score >= 60) return '标准'
  if (score >= 50) return '较难'
  if (score >= 30) return '难'
  return '非常难'
}
