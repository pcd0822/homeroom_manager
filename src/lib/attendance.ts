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
import type { AttendanceRecord, CleaningReset, PeriodKind, PeriodMark, PeriodOp, PeriodRow, PeriodSchedule } from '@/types'
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

// ===================== 교시별 출결 (조회 + 1~N교시) =====================
/*
 * 칸 하나 = 한 학생의 한 교시. 교시 0은 조회.
 * 담임은 출결 구분을 고른 뒤 칸을 누르면 구분에 맞춰 자동으로 채운다.
 *   지각: 조회 ~ 누른 교시     조퇴: 누른 교시 ~ 마지막 교시
 *   결석: 조회 ~ 마지막 교시   결과·기타: 누른 칸만
 * 기타(O)는 담임만 넣는다(QR 출석부에서는 잠긴 칸). 지각·조퇴 점수와 조퇴 판정에 들어가지 않는다.
 * 결과(R)는 담임이 고른 구분이라 조퇴 판정에서 출석으로 본다(마지막 교시까지 결과여도 조퇴가 아니다).
 * 교과교사(QR 출석부)는 구분 없이 1~N교시 칸에 빗금(S)만 넣고 뺀다.
 * 조퇴 점수는 교시 체크로 자동 판정한다: 앞 교시에 한 시간이라도 출석하고, 그 뒤 어느 교시부터 마지막 교시까지 체크.
 */

export const PERIOD_MAX = 7
export const DEFAULT_PERIOD_SCHEDULE: PeriodSchedule = { weekday: [0, 7, 7, 7, 7, 7, 0], dates: {} }

export const KIND_OPTIONS: Array<{ value: Exclude<PeriodKind, ''>; label: string }> = [
  { value: 'L', label: '지각' },
  { value: 'E', label: '조퇴' },
  { value: 'A', label: '결석' },
  { value: 'R', label: '결과' },
  { value: 'O', label: '기타' },
]

export const MARK_LABELS: Record<PeriodMark, string> = {
  A: '결석',
  L: '지각',
  E: '조퇴',
  R: '결과',
  O: '기타',
  S: '교과 체크',
}

/** 칸 색(빗금 색). 유리 바탕 위에서 구분되도록 채도 있는 색 */
export const MARK_COLORS: Record<PeriodMark, string> = {
  A: '#e11d48',
  L: '#f59e0b',
  E: '#7c3aed',
  R: '#0284c7',
  O: '#0d9488',
  S: '#475569',
}

export type MarkMap = Partial<Record<number, PeriodMark>>

export function parseMarks(raw: string | undefined | null): MarkMap {
  const out: MarkMap = {}
  for (const part of String(raw ?? '').split(',')) {
    const m = /^\s*(\d)\s*:\s*([ALEROS])\s*$/.exec(part)
    if (!m) continue
    const p = Number(m[1])
    if (p >= 0 && p <= PERIOD_MAX) out[p] = m[2] as PeriodMark
  }
  return out
}

export function stringifyMarks(map: MarkMap): string {
  return Object.keys(map)
    .map(Number)
    .sort((a, b) => a - b)
    .filter((k) => map[k])
    .map((k) => `${k}:${map[k]}`)
    .join(',')
}

export function periodsForDate(schedule: PeriodSchedule, date: string): number {
  if (Object.prototype.hasOwnProperty.call(schedule.dates, date)) return schedule.dates[date]
  return schedule.weekday[parseDateKey(date).getDay()] ?? 0
}

/** 조퇴 판정에 쓰는 칸인지. 기타(O)·결과(R)는 출석으로 본다. 교과 체크(S)는 판정에 넣는다. */
function countsForEarly(m: PeriodMark | undefined): boolean {
  return !!m && m !== 'O' && m !== 'R'
}

/** 1~n교시 중 체크된 칸으로 조퇴인지 판정 (조회는 보지 않음, 기타·결과 칸은 빼고 본다) */
export function deriveEarly(marks: MarkMap, n: number): boolean {
  if (n < 2 || !countsForEarly(marks[n])) return false
  for (let p = 1; p < n; p++) if (!countsForEarly(marks[p])) return true
  return false
}

/** 1~n교시에 조퇴 판정 대상 체크(기타·결과 제외)가 있는지. 없으면 조퇴는 직접 체크한 값을 쓴다. */
export function hasPeriodMarks(marks: MarkMap, n: number): boolean {
  for (let p = 1; p <= n; p++) if (countsForEarly(marks[p])) return true
  return false
}

/** 화면에 보이는 칸(조회~n교시) 중 체크가 하나라도 있는지 */
export function hasAnyMark(marks: MarkMap, n: number): boolean {
  for (let p = 0; p <= n; p++) if (marks[p]) return true
  return false
}

/**
 * 칸을 누른 뒤의 지각(점수) 칸 값.
 * 체크를 지워 칸이 모두 비면 구분과 상관없이 해제하고, 지각 구분이면 지각 칸 유무에 맞춘다.
 * 다른 구분(예: 결석)이 지각 칸을 모두 덮어써 지각 칸이 사라져도 해제한다.
 * 그 밖에는 담임이 직접 정한 값을 유지한다.
 */
export function nextLateFlag(current: boolean, kind: PeriodKind, before: MarkMap, after: MarkMap, n: number): boolean {
  if (hasAnyMark(before, n) && !hasAnyMark(after, n)) return false
  if (kind === 'L') return Object.values(after).includes('L')
  if (Object.values(before).includes('L') && !Object.values(after).includes('L')) return false
  return current
}

/**
 * 담임이 구분을 고른 채 칸을 눌렀을 때의 새 칸 상태.
 * 같은 범위를 다시 누르면(예: 지각 2교시를 또 누름) 그 구분 체크를 모두 지운다.
 */
export function applyKindClick(marks: MarkMap, kind: PeriodKind, period: number, n: number): MarkMap {
  const next: MarkMap = { ...marks }
  const clearKind = (k: PeriodMark) => {
    for (let p = 0; p <= PERIOD_MAX; p++) if (next[p] === k) delete next[p]
  }
  if (kind === 'L') {
    let end = -1
    for (let p = 0; p <= n && marks[p] === 'L'; p++) end = p
    clearKind('L')
    if (end === period) return next
    for (let p = 0; p <= period; p++) next[p] = 'L'
    return next
  }
  if (kind === 'E') {
    let start = -1
    for (let p = n; p >= 1 && marks[p] === 'E'; p--) start = p
    clearKind('E')
    if (start === period) return next
    for (let p = Math.max(1, period); p <= n; p++) next[p] = 'E'
    return next
  }
  if (kind === 'A') {
    let all = true
    for (let p = 0; p <= n; p++) if (marks[p] !== 'A') all = false
    if (all) {
      clearKind('A')
      return next
    }
    for (let p = 0; p <= n; p++) next[p] = 'A'
    return next
  }
  // 결과·기타 또는 구분 없음: 누른 칸만 넣고 뺀다
  if (next[period]) delete next[period]
  else next[period] = kind === 'R' || kind === 'O' ? kind : 'S'
  return next
}

/** 두 칸 상태의 차이를 저장용 op로 */
export function diffMarkOps(studentId: string, before: MarkMap, after: MarkMap): PeriodOp[] {
  const ops: PeriodOp[] = []
  for (let p = 0; p <= PERIOD_MAX; p++) {
    if ((before[p] || '') !== (after[p] || '')) {
      ops.push({ student_id: studentId, type: 'mark', period: p, value: after[p] || '' })
    }
  }
  return ops
}

/** 서버 행에 아직 안 보낸 op를 덧씌운다(폴링 결과와 내 변경이 섞일 때) */
export function applyOpsToRows(rows: PeriodRow[], date: string, ops: PeriodOp[]): PeriodRow[] {
  if (!ops.length) return rows
  const map = new Map(rows.map((r) => [r.student_id, { ...r }]))
  for (const op of ops) {
    const cur = map.get(op.student_id) || { date, student_id: op.student_id, kind: '' as PeriodKind, marks: '', note: '' }
    if (op.type === 'mark') {
      const m = parseMarks(cur.marks)
      if (op.value) m[op.period] = op.value
      else delete m[op.period]
      cur.marks = stringifyMarks(m)
    } else if (op.type === 'kind') cur.kind = op.kind
    else cur.note = op.note
    map.set(op.student_id, cur)
  }
  return [...map.values()]
}

/**
 * 점수 계산에 쓸 출결 기록: 교시 체크가 있는 날은 조퇴를 교시로 자동 판정하고,
 * 교시 체크가 없는 날(예전 기록 등)은 직접 체크한 조퇴를 그대로 쓴다. 지각은 직접 체크한 값.
 */
export function effectiveRecords(
  records: AttendanceRecord[],
  periodMarks: Array<{ date: string; student_id: string; marks: string }>,
  schedule: PeriodSchedule
): AttendanceRecord[] {
  const key = (d: string, s: string) => `${d}|${s}`
  const base = new Map(records.map((r) => [key(r.date, r.student_id), r]))
  const derived = new Map<string, boolean>()
  for (const pm of periodMarks) {
    const n = periodsForDate(schedule, pm.date)
    const marks = parseMarks(pm.marks)
    if (!hasPeriodMarks(marks, n)) continue
    derived.set(key(pm.date, pm.student_id), deriveEarly(marks, n))
  }
  const out: AttendanceRecord[] = []
  const keys = new Set([...base.keys(), ...derived.keys()])
  for (const k of keys) {
    const r = base.get(k)
    const [date, student_id] = k.split('|')
    const late = r?.late ?? false
    const early = derived.has(k) ? derived.get(k)! : r?.early ?? false
    if (!late && !early) continue
    out.push({
      date,
      student_id,
      late,
      early,
      late_doc: late && !!r?.late_doc,
      early_doc: early && !!r?.early_doc,
    })
  }
  return out.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.student_id.localeCompare(b.student_id)))
}

/** 칸 상태 요약(예: '지각 조회~2교시 · 교과 5교시') */
export function describeMarks(marks: MarkMap, n: number): string {
  const groups: Array<{ mark: PeriodMark; from: number; to: number }> = []
  for (let p = 0; p <= n; p++) {
    const m = marks[p]
    if (!m) continue
    const last = groups[groups.length - 1]
    if (last && last.mark === m && last.to === p - 1) last.to = p
    else groups.push({ mark: m, from: p, to: p })
  }
  const name = (p: number) => (p === 0 ? '조회' : `${p}교시`)
  return groups
    .map((g) => `${MARK_LABELS[g.mark]} ${g.from === g.to ? name(g.from) : `${name(g.from)}~${name(g.to)}`}`)
    .join(' · ')
}
