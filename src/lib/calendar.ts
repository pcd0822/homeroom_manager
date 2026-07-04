/**
 * 상담 캘린더용 날짜·시간 순수 유틸
 * 날짜 키는 로컬 타임존 기준 'YYYY-MM-DD' 문자열로 통일한다.
 * 시간은 'HH:mm'(zero-padded) 문자열이라 사전식 비교가 곧 시간 비교가 된다.
 */

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const

function pad2(n: number): string {
  return (n < 10 ? '0' : '') + n
}

/** Date → 'YYYY-MM-DD' (로컬 기준) */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 'YYYY-MM-DD' → Date (로컬 자정) */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map((v) => parseInt(v, 10))
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(1)
  r.setMonth(r.getMonth() + n)
  return r
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** 일요일 시작 기준 그 주의 일요일 */
export function startOfWeek(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  r.setDate(r.getDate() - r.getDay())
  return r
}

/** 해당 주(일~토) 7일 */
export function getWeekDays(d: Date): Date[] {
  const start = startOfWeek(d)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** 월 그리드: 해당 월을 포함하는 주 단위(일~토) 2차원 배열 */
export function getMonthGrid(year: number, month0: number): Date[][] {
  const first = new Date(year, month0, 1)
  const gridStart = startOfWeek(first)
  const weeks: Date[][] = []
  let cursor = gridStart
  // 최대 6주까지 채우되, 다음 달로 완전히 넘어가면 멈춘다.
  for (let w = 0; w < 6; w++) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(cursor, i))
    weeks.push(week)
    cursor = addDays(cursor, 7)
    // 다음 주 시작이 이미 다음 달이면 종료
    if (cursor.getMonth() !== month0 && cursor > new Date(year, month0 + 1, 0)) break
  }
  return weeks
}

export function formatMonthLabel(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`
}

/** 'YYYY-MM-DD' → 'M월 D일 (요일)' */
export function formatDateLabel(key: string): string {
  const d = parseDateKey(key)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_LABELS[d.getDay()]})`
}

/** 'HH:mm' → 분(number). 파싱 실패 시 0 */
export function timeToMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t || '').trim())
  if (!m) return 0
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

/** 시작~종료 시간 표기. 종료가 없거나 같으면 시작만 */
export function formatTimeRange(start: string, end: string): string {
  if (!start) return ''
  if (!end || end === start) return start
  return `${start} ~ ${end}`
}
