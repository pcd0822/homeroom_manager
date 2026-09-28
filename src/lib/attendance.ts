/**
 * 출결(지각·조퇴) 점수 규칙 — 교사 화면·학생 대시보드가 같이 쓰는 유일한 계산 위치
 *
 * - 지각 1점, 조퇴 2점. 같은 날 둘 다 체크 가능.
 * - 서류(진료확인서·처방전·약봉투 등)를 냈어도 점수는 그대로 누적한다.
 * - 청소 점수는 서류 없는 지각·조퇴만 센다. 주와 상관없이 계속 누적해 3점 이상이면 청소 대상.
 *   교사가 청소 완료를 체크하면 **청소한 주(월~일) 이전 주까지**의 청소 점수만 버린다.
 *   청소하는 주에 생긴 점수(그 주 월요일부터)는 초기화되지 않고 다음 청소 점수로 그대로 이어진다.
 *   집계 기간(리셋)과는 무관하다.
 * - 점수·순위는 집계 기간별로 따로 센다. 교사가 리셋하면 그 날짜부터 새 기간(기록은 그대로).
 *   기간마다 점수 낮은 순 10명 문화상품권.
 */
import type { AttendanceRecord, CleaningReset } from '@/types'
import { addDays, parseDateKey, toDateKey } from '@/lib/calendar'

export const CLEANING_THRESHOLD = 3
export const REWARD_RANK_LIMIT = 10

export type AttendanceField = 'late' | 'early' | 'late_doc' | 'early_doc'
export type AttendanceFlags = Pick<AttendanceRecord, AttendanceField>

export const EMPTY_FLAGS: AttendanceFlags = { late: false, early: false, late_doc: false, early_doc: false }

export interface AttendanceStat {
  student_id: string
  late: number
  early: number
  late_doc: number
  early_doc: number
  score: number
}

export type RankKey = 'late' | 'early' | 'score'

export const RANK_KEY_LABELS: Record<RankKey, string> = { late: '지각', early: '조퇴', score: '총점' }

/** 서류만 체크되고 지각/조퇴가 빠진 경우 어떤 서류가 문제인지 */
export function invalidDocFields(f: AttendanceFlags): AttendanceField[] {
  const out: AttendanceField[] = []
  if (f.late_doc && !f.late) out.push('late_doc')
  if (f.early_doc && !f.early) out.push('early_doc')
  return out
}

export function scoreOf(f: AttendanceFlags): number {
  return (f.late ? 1 : 0) + (f.early ? 2 : 0)
}

export function cleaningScoreOf(f: AttendanceFlags): number {
  return (f.late && !f.late_doc ? 1 : 0) + (f.early && !f.early_doc ? 2 : 0)
}

/** 학생별 누적. from/to('YYYY-MM-DD', 포함)로 기간을 자른다. 기록이 없는 학생도 0으로 포함. */
export function aggregateStats(
  studentIds: string[],
  records: AttendanceRecord[],
  from?: string,
  to?: string
): AttendanceStat[] {
  const map = new Map<string, AttendanceStat>()
  for (const id of studentIds) {
    map.set(id, { student_id: id, late: 0, early: 0, late_doc: 0, early_doc: 0, score: 0 })
  }
  for (const r of records) {
    if (from && r.date < from) continue
    if (to && r.date > to) continue
    const s = map.get(r.student_id)
    if (!s) continue
    if (r.late) s.late += 1
    if (r.early) s.early += 1
    if (r.late && r.late_doc) s.late_doc += 1
    if (r.early && r.early_doc) s.early_doc += 1
    s.score += scoreOf(r)
  }
  return studentIds.map((id) => map.get(id)!)
}

/** 적을수록 높은 순위. 동점은 같은 순위(1, 1, 3 …). */
export function rankBy(stats: AttendanceStat[], key: RankKey): Map<string, number> {
  const ranks = new Map<string, number>()
  for (const s of stats) {
    ranks.set(s.student_id, 1 + stats.filter((o) => o[key] < s[key]).length)
  }
  return ranks
}

/** 학생별 마지막 청소 완료 날짜 */
export function lastCleaningResets(resets: CleaningReset[]): Map<string, string> {
  const last = new Map<string, string>()
  for (const r of resets) {
    const prev = last.get(r.student_id)
    if (!prev || r.date > prev) last.set(r.student_id, r.date)
  }
  return last
}

/** 청소 주는 월~일. 해당 날짜가 속한 주의 월요일('YYYY-MM-DD'). */
export function cleaningWeekStart(key: string): string {
  const d = parseDateKey(key)
  const offset = (d.getDay() + 6) % 7 // 월=0 … 일=6
  return toDateKey(addDays(d, -offset))
}

/**
 * 청소 완료 날짜 → 청소 점수를 새로 세기 시작하는 날짜(= 청소한 주의 월요일).
 * 이 날짜 이전(이전 주까지)의 청소 점수만 초기화되고, 이 날짜부터의 점수는 유지된다.
 */
export function cleaningCountFrom(resetDate: string): string {
  return cleaningWeekStart(resetDate)
}

/** 학생별 청소 점수 계산 시작일(마지막 청소 완료 주의 월요일). 완료 기록이 없으면 없음. */
export function cleaningCountStarts(resets: CleaningReset[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const [id, date] of lastCleaningResets(resets)) out.set(id, cleaningCountFrom(date))
  return out
}

/**
 * 현재 청소 점수: 마지막 청소 완료 주의 월요일부터 쌓인 점수(이전 주까지는 초기화). 기록이 없는 학생도 0으로 포함.
 */
export function currentCleaningScores(
  studentIds: string[],
  records: AttendanceRecord[],
  resets: CleaningReset[]
): Map<string, number> {
  const from = cleaningCountStarts(resets)
  const scores = new Map<string, number>(studentIds.map((id) => [id, 0]))
  for (const r of records) {
    const cur = scores.get(r.student_id)
    if (cur === undefined) continue
    const start = from.get(r.student_id)
    if (start && r.date < start) continue
    scores.set(r.student_id, cur + cleaningScoreOf(r))
  }
  return scores
}

/**
 * 성을 뗀 이름에 친근한 소유격을 붙인다. 끝소리(받침)가 있으면 '이의', 없으면 '의'.
 * 김리헌 → 리헌이의, 김지우 → 지우의, 김솔 → 솔이의, 남궁민수 → 민수의.
 * 한글이 아니면 이름 그대로 + '의'.
 */
export function friendlyPossessive(fullName: string): string {
  const name = fullName.trim()
  if (!name) return '나의'
  const given = name.length >= 3 ? name.slice(-2) : name.length === 2 ? name.slice(-1) : name
  const code = given.charCodeAt(given.length - 1) - 0xac00
  if (code < 0 || code > 11171) return `${name}의`
  return code % 28 !== 0 ? `${given}이의` : `${given}의`
}

/** 'YYYY-MM-DD' → 'M/D' */
export function shortDate(key: string): string {
  const [, m, d] = key.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`
}

/** 집계 기간. from/to가 없으면 그쪽 끝이 열려 있음(처음부터 / 다음 리셋 전까지). */
export interface AttendancePeriod {
  from?: string
  to?: string
}

/**
 * 리셋 시작일 목록 → 연속된 기간 목록.
 * 예: ['2026-10-17', '2026-11-17'] → [~10/16], [10/17~11/16], [11/17~]
 */
export function buildPeriods(starts: string[]): AttendancePeriod[] {
  const sorted = [...new Set(starts)].sort()
  if (sorted.length === 0) return [{}]
  const dayBefore = (key: string) => toDateKey(addDays(parseDateKey(key), -1))
  const periods: AttendancePeriod[] = [{ to: dayBefore(sorted[0]) }]
  sorted.forEach((from, i) => {
    periods.push({ from, to: sorted[i + 1] ? dayBefore(sorted[i + 1]) : undefined })
  })
  return periods
}

/** 날짜가 속한 기간의 인덱스 */
export function periodIndexOf(periods: AttendancePeriod[], dateKey: string): number {
  const i = periods.findIndex((p) => (!p.from || p.from <= dateKey) && (!p.to || dateKey <= p.to))
  return i >= 0 ? i : periods.length - 1
}

export function periodLabel(p: AttendancePeriod): string {
  if (!p.from && !p.to) return '전체 기간'
  return `${p.from ? shortDate(p.from) : '처음'} ~ ${p.to ? shortDate(p.to) : '진행 중'}`
}
