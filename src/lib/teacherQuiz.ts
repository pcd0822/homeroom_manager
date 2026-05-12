import type { TeacherQuizQuestion, TeacherQuizType } from '@/types'

export const QUIZ_TYPES: Array<{ value: TeacherQuizType; label: string; emoji: string }> = [
  { value: 'choice', label: '선택형 (객관식)', emoji: '🔘' },
  { value: 'short', label: '주관식', emoji: '✍️' },
  { value: 'ox', label: 'OX 퀴즈', emoji: '⭕' },
  { value: 'image', label: '사진 보고 맞추기 (주관식)', emoji: '🖼️' },
  { value: 'imageMc', label: '사진 보고 맞추기 (객관식)', emoji: '🧩' },
  { value: 'imageChoice', label: '이미지 선택지', emoji: '🎨' },
  { value: 'youtube', label: '유튜브 영상', emoji: '📺' },
  { value: 'survey', label: '설문형 (정답 없음)', emoji: '📝' },
]

export function quizTypeLabel(t: TeacherQuizType) {
  return QUIZ_TYPES.find((x) => x.value === t)?.label || t
}

export function emptyQuestion(orderNo: number): TeacherQuizQuestion {
  return {
    id: `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    order_no: orderNo,
    type: 'choice',
    question: '',
    choices: ['', ''],
    choice_images: [],
    correct_answer: '0',
    image_data: '',
    youtube_url: '',
    hint: '',
    time_limit: 30,
  }
}

/** 정답 비교 (주관식/이미지/유튜브용). 공백 trim + 소문자화 */
export function isShortAnswerCorrect(input: string, expected: string) {
  const a = input.trim().toLowerCase().replace(/\s+/g, '')
  const b = expected.trim().toLowerCase().replace(/\s+/g, '')
  if (!b) return false
  return a === b
}

/**
 * 정답 시 받는 포인트: 100점에서 timeLimit 동안 균등하게 10점까지 차감.
 * 60초/6초 간격 → 0~6: 100, 6~12: 90, ..., 54~ : 10.
 * 일반화: unit = timeLimit / 10, score = max(10, 100 - floor(elapsed / unit) * 10)
 */
export function computeAnswerPoints(timeLimitSec: number, elapsedSec: number) {
  const unit = timeLimitSec / 10
  if (unit <= 0) return 10
  const dec = Math.floor(elapsedSec / unit)
  const pts = 100 - dec * 10
  return Math.max(10, Math.min(100, pts))
}

/**
 * 설문형(정답 없음) 보상 포인트.
 * 시간 내 제출: 100p (만점), 시간 만료 후 제출: 10p.
 */
export function computeSurveyPoints(timeLimitSec: number, elapsedSec: number) {
  return elapsedSec <= timeLimitSec ? 100 : 10
}

/** 유튜브 URL/ID에서 video ID 추출 */
export function extractYoutubeId(input: string): string | null {
  if (!input) return null
  const s = input.trim()
  // 이미 11자 ID 같으면 그대로
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  // youtu.be/<id>
  const m1 = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/)
  if (m1) return m1[1]
  // youtube.com/watch?v=<id>
  const m2 = s.match(/[?&]v=([A-Za-z0-9_-]{11})/)
  if (m2) return m2[1]
  // youtube.com/embed/<id>
  const m3 = s.match(/embed\/([A-Za-z0-9_-]{11})/)
  if (m3) return m3[1]
  // youtube.com/shorts/<id>
  const m4 = s.match(/shorts\/([A-Za-z0-9_-]{11})/)
  if (m4) return m4[1]
  return null
}

