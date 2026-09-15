/**
 * 출결(지각·조퇴) 점수 규칙 — 교사 화면·학생 대시보드가 같이 쓰는 유일한 계산 위치
 *
 * - 지각 1점, 조퇴 2점. 같은 날 둘 다 체크 가능.
 * - 서류(진료확인서·처방전·약봉투 등)를 냈어도 점수는 그대로 누적한다.
 * - 청소 점수는 서류 없는 지각·조퇴만 센다. 한 주(월~일) 청소 점수가 3점 이상이면 다음 주 청소 대상.
 * - 점수·순위는 SCORE_CUTOFF_DATE까지의 기록만 집계한다(점수 낮은 순 10명 문화상품권).
 */
import type { AttendanceRecord } from '@/types'
import { addDays, toDateKey } from '@/lib/calendar'

export const SCORE_CUTOFF_DATE = '2026-10-16'
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
  cleaning_score: number
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
    map.set(id, { student_id: id, late: 0, early: 0, late_doc: 0, early_doc: 0, score: 0, cleaning_score: 0 })
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
    s.cleaning_score += cleaningScoreOf(r)
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

/** 그 주 월요일(로컬 자정) */
export function mondayOf(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7))
  return r
}

export function weekRange(monday: Date): { from: string; to: string } {
  return { from: toDateKey(monday), to: toDateKey(addDays(monday, 6)) }
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
