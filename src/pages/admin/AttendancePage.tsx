import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  CalendarCog,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  QrCode,
  RefreshCw,
  X,
} from 'lucide-react'
import {
  addAttendancePeriod,
  addCleaningReset,
  deleteAttendancePeriod,
  deleteCleaningReset,
  getAttendancePeriods,
  getAttendanceRecords,
  getAttendanceShareKey,
  getCleaningResets,
  getPeriodAttendance,
  getPeriodSchedule,
  getStudents,
  rotateAttendanceShareKey,
  saveAttendanceDay,
  savePeriodOps,
  savePeriodSchedule,
} from '@/api/api'
import type { AttendanceRecord, CleaningReset, PeriodKind, PeriodOp, PeriodRow, PeriodSchedule, Student } from '@/types'
import {
  CLEANING_THRESHOLD,
  DEFAULT_PERIOD_SCHEDULE,
  EMPTY_FLAGS,
  KIND_OPTIONS,
  PERIOD_MAX,
  REWARD_RANK_LIMIT,
  aggregateStats,
  applyKindClick,
  applyOpsToRows,
  buildPeriods,
  cleaningCountFrom,
  cleaningWeekStart,
  currentCleaningScores,
  deriveEarly,
  describeMarks,
  diffMarkOps,
  effectiveRecords,
  hasPeriodMarks,
  lastCleaningResets,
  parseMarks,
  periodIndexOf,
  periodLabel,
  periodsForDate,
  rankBy,
  shortDate,
  type AttendanceField,
  type AttendanceFlags,
  type AttendancePeriod,
} from '@/lib/attendance'
import {
  WEEKDAY_LABELS,
  addMonths,
  formatDateLabel,
  formatMonthLabel,
  getMonthGrid,
  toDateKey,
} from '@/lib/calendar'
import { buildShareUrl } from '@/lib/gasUrl'
import {
  CleaningNotice,
  ClassStatsTable,
  PersonalStatsTable,
} from '@/components/attendance/AttendanceStatsTables'
import { MarkLegend, PeriodCell, periodHeader } from '@/components/attendance/PeriodCell'
import { PageTitle } from '@/components/ui/Glyph'
import { cn } from '@/lib/utils'

type StatsTab = 'personal' | 'class' | 'cleaning'
type Draft = Record<string, AttendanceFlags>
type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

const POLL_MS = 15000
const FLAG_SAVE_DELAY = 700
const PERIOD_SAVE_DELAY = 400

function photoSrc(photo?: string) {
  if (!photo) return undefined
  return photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`
}

function buildDraft(records: AttendanceRecord[], date: string): Draft {
  const draft: Draft = {}
  for (const r of records) {
    if (r.date !== date) continue
    draft[r.student_id] = { late: r.late, early: r.early, late_doc: r.late_doc, early_doc: r.early_doc }
  }
  return draft
}

export function AttendancePage() {
  const todayKey = toDateKey(new Date())
  const [students, setStudents] = useState<Student[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [periodRows, setPeriodRows] = useState<PeriodRow[]>([])
  const [schedule, setSchedule] = useState<PeriodSchedule>(DEFAULT_PERIOD_SCHEDULE)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [month, setMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [draft, setDraft] = useState<Draft>({})
  const [flagState, setFlagState] = useState<SaveState>('idle')
  const [periodState, setPeriodState] = useState<SaveState>('idle')
  const [lastSync, setLastSync] = useState<number | null>(null)

  const [tab, setTab] = useState<StatsTab>('class')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [cleaningResets, setCleaningResets] = useState<CleaningReset[]>([])

  const [periodStarts, setPeriodStarts] = useState<string[]>([])
  const [periodIdx, setPeriodIdx] = useState<number | null>(null)
  const [showReset, setShowReset] = useState(false)
  const [panel, setPanel] = useState<'none' | 'share' | 'schedule'>('none')

  // 저장 대기 중인 교시 변경(op)과 지각·서류 변경. ref로 들고 있어야 폴링·날짜 이동과 섞이지 않는다.
  const pendingOps = useRef<PeriodOp[]>([])
  const inflightOps = useRef<PeriodOp[]>([])
  const periodTimer = useRef<number | undefined>()
  const flagTimer = useRef<number | undefined>()
  const flagDirty = useRef(false)
  const draftRef = useRef<Draft>({})
  const dateRef = useRef(selectedDate)
  const studentsRef = useRef<Student[]>([])
  const periodRowsRef = useRef<PeriodRow[]>([])
  const scheduleRef = useRef<PeriodSchedule>(DEFAULT_PERIOD_SCHEDULE)
  draftRef.current = draft
  dateRef.current = selectedDate
  studentsRef.current = students
  periodRowsRef.current = periodRows
  scheduleRef.current = schedule

  useEffect(() => {
    Promise.all([
      getStudents(),
      getAttendanceRecords(),
      getAttendancePeriods(),
      getCleaningResets(),
      getPeriodAttendance(),
      getPeriodSchedule(),
    ])
      .then(([stuRes, attRes, perRes, cleanRes, rowRes, schRes]) => {
        const errors: string[] = []
        if (perRes.success && perRes.data) setPeriodStarts(perRes.data.starts)
        else errors.push(perRes.error || '집계 기간을 불러오지 못했습니다.')
        if (cleanRes.success && cleanRes.data) setCleaningResets(cleanRes.data)
        else errors.push(cleanRes.error || '청소 완료 기록을 불러오지 못했습니다.')
        if (stuRes.success && stuRes.data) {
          setStudents(stuRes.data)
          if (stuRes.data[0]) setSelectedStudentId(stuRes.data[0].student_id)
        } else errors.push(stuRes.error || '학생 목록을 불러오지 못했습니다.')
        if (attRes.success && attRes.data) {
          setRecords(attRes.data)
          setDraft(buildDraft(attRes.data, todayKey))
        } else errors.push(attRes.error || '출결 기록을 불러오지 못했습니다.')
        if (rowRes.success && rowRes.data) setPeriodRows(rowRes.data)
        else errors.push('교시 출결을 불러오지 못했습니다. GAS를 새 버전으로 다시 배포했는지 확인해 주세요.')
        if (schRes.success && schRes.data) setSchedule(schRes.data)
        if (errors.length) setLoadError(errors.join(' · '))
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const replaceDayRows = useCallback((date: string, rows: PeriodRow[]) => {
    setPeriodRows((prev) => prev.filter((r) => r.date !== date).concat(rows))
  }, [])

  // ----- 교시 op 저장 (모아서 보냄) -----
  const flushPeriodOps = useCallback(async () => {
    window.clearTimeout(periodTimer.current)
    if (inflightOps.current.length || !pendingOps.current.length) return
    const date = dateRef.current
    const ops = pendingOps.current
    pendingOps.current = []
    inflightOps.current = ops
    setPeriodState('saving')
    const res = await savePeriodOps(date, ops)
    inflightOps.current = []
    if (res.success && res.data) {
      if (dateRef.current === date) replaceDayRows(date, applyOpsToRows(res.data.rows, date, pendingOps.current))
      setLastSync(Date.now())
      setPeriodState(pendingOps.current.length ? 'pending' : 'saved')
      if (pendingOps.current.length) void flushPeriodOps()
    } else {
      // 실패한 변경은 다시 대기열 앞에 둔다
      pendingOps.current = ops.concat(pendingOps.current)
      setPeriodState('error')
      alert(res.error || '교시 출결 저장에 실패했습니다.')
    }
  }, [replaceDayRows])

  const queueOps = (ops: PeriodOp[]) => {
    if (!ops.length) return
    pendingOps.current = pendingOps.current.concat(ops)
    setPeriodRows((prev) => {
      const day = prev.filter((r) => r.date === selectedDate)
      return prev.filter((r) => r.date !== selectedDate).concat(applyOpsToRows(day, selectedDate, ops))
    })
    setPeriodState('pending')
    window.clearTimeout(periodTimer.current)
    periodTimer.current = window.setTimeout(() => void flushPeriodOps(), PERIOD_SAVE_DELAY)
  }

  // ----- 지각·조퇴·서류 저장 (그날 통째 교체, 담임만 쓴다) -----
  const flushFlags = useCallback(async () => {
    window.clearTimeout(flagTimer.current)
    if (!flagDirty.current) return
    flagDirty.current = false
    const date = dateRef.current
    const n = periodsForDate(scheduleRef.current, date)
    const rowsByStudent = new Map(periodRowsRef.current.filter((r) => r.date === date).map((r) => [r.student_id, r]))
    const dayRecords: AttendanceRecord[] = studentsRef.current
      .map((s) => {
        const f = draftRef.current[s.student_id] || EMPTY_FLAGS
        const marks = parseMarks(rowsByStudent.get(s.student_id)?.marks)
        const early = hasPeriodMarks(marks, n) ? deriveEarly(marks, n) : f.early
        return {
          student_id: s.student_id,
          date,
          late: f.late,
          early,
          late_doc: f.late && f.late_doc,
          early_doc: early && f.early_doc,
        }
      })
      .filter((r) => r.late || r.early)
    setFlagState('saving')
    const res = await saveAttendanceDay(date, dayRecords)
    if (!res.success) {
      flagDirty.current = true
      setFlagState('error')
      alert(res.error || '지각·조퇴 저장에 실패했습니다.')
      return
    }
    setRecords((prev) => prev.filter((r) => r.date !== date).concat(dayRecords))
    setFlagState(flagDirty.current ? 'pending' : 'saved')
  }, [])

  const markFlagsDirty = () => {
    flagDirty.current = true
    setFlagState('pending')
    window.clearTimeout(flagTimer.current)
    flagTimer.current = window.setTimeout(() => void flushFlags(), FLAG_SAVE_DELAY)
  }

  // 화면을 떠날 때 남은 변경을 보낸다
  useEffect(() => {
    return () => {
      void flushPeriodOps()
      void flushFlags()
    }
  }, [flushPeriodOps, flushFlags])

  // ----- 실시간: 교과교사 체크를 주기적으로 받아온다 -----
  useEffect(() => {
    if (loading) return
    let stopped = false
    const tick = async () => {
      if (document.hidden || inflightOps.current.length) return
      const date = dateRef.current
      const res = await getPeriodAttendance(date)
      if (stopped || !res.success || !res.data || dateRef.current !== date || inflightOps.current.length) return
      replaceDayRows(date, applyOpsToRows(res.data, date, pendingOps.current))
      setLastSync(Date.now())
    }
    void tick()
    const id = window.setInterval(() => void tick(), POLL_MS)
    const onVisible = () => {
      if (!document.hidden) void tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loading, selectedDate, replaceDayRows])

  // ----- 파생 값 -----
  const effRecords = useMemo(() => effectiveRecords(records, periodRows, schedule), [records, periodRows, schedule])
  const dayPeriods = periodsForDate(schedule, selectedDate)
  const dayRows = useMemo(
    () => new Map(periodRows.filter((r) => r.date === selectedDate).map((r) => [r.student_id, r])),
    [periodRows, selectedDate]
  )

  // 날짜별로 출결 기록(지각·조퇴 또는 교시 체크)이 있는 학생 수
  const countByDate = useMemo(() => {
    const sets = new Map<string, Set<string>>()
    const add = (d: string, s: string) => {
      if (!sets.has(d)) sets.set(d, new Set())
      sets.get(d)!.add(s)
    }
    for (const r of effRecords) add(r.date, r.student_id)
    for (const r of periodRows) if (r.marks) add(r.date, r.student_id)
    const m = new Map<string, number>()
    for (const [d, s] of sets) m.set(d, s.size)
    return m
  }, [effRecords, periodRows])

  const nameOf = useMemo(() => new Map(students.map((s) => [s.student_id, s.name])), [students])
  const studentIds = useMemo(() => students.map((s) => s.student_id), [students])
  const periods = useMemo(() => buildPeriods(periodStarts), [periodStarts])
  const activeIdx = Math.min(periodIdx ?? periodIndexOf(periods, todayKey), periods.length - 1)
  const period = periods[activeIdx]
  const stats = useMemo(
    () => aggregateStats(studentIds, effRecords, period.from, period.to),
    [studentIds, effRecords, period.from, period.to]
  )
  const cleaningScores = useMemo(
    () => currentCleaningScores(studentIds, effRecords, cleaningResets),
    [studentIds, effRecords, cleaningResets]
  )
  const lastResets = useMemo(() => lastCleaningResets(cleaningResets), [cleaningResets])
  const statRanks = useMemo(
    () => ({ late: rankBy(stats, 'late'), early: rankBy(stats, 'early'), score: rankBy(stats, 'score') }),
    [stats]
  )

  const applyStarts = (starts: string[]) => {
    setPeriodStarts(starts)
    setPeriodIdx(null)
  }

  const selectDate = (key: string) => {
    if (key === selectedDate) return
    // 이전 날짜의 남은 변경은 그 날짜로 먼저 보낸다
    void flushPeriodOps()
    void flushFlags()
    setSelectedDate(key)
    setDraft(buildDraft(records, key))
  }

  // ----- 표 조작 -----
  const toggleFlag = (studentId: string, field: AttendanceField) => {
    setDraft((prev) => {
      const cur = prev[studentId] || EMPTY_FLAGS
      const next = { ...cur, [field]: !cur[field] }
      // 서류 칸은 해당 지각/조퇴가 있어야 의미가 있다
      if (field === 'late' && !next.late) next.late_doc = false
      if (field === 'early' && !next.early) next.early_doc = false
      return { ...prev, [studentId]: next }
    })
    markFlagsDirty()
  }

  const clickCell = (studentId: string, p: number) => {
    const row = dayRows.get(studentId)
    const kind = (row?.kind || '') as PeriodKind
    const before = parseMarks(row?.marks)
    const after = applyKindClick(before, kind, p, dayPeriods)
    queueOps(diffMarkOps(studentId, before, after))
    if (kind === 'L') {
      // 지각 구분으로 채우면 지각(점수) 칸도 함께 맞춘다. 직접 해제할 수 있다.
      const hasLate = Object.values(after).includes('L')
      const cur = draftRef.current[studentId] || EMPTY_FLAGS
      if (cur.late !== hasLate) {
        setDraft((prev) => ({
          ...prev,
          [studentId]: { ...cur, late: hasLate, late_doc: hasLate && cur.late_doc },
        }))
        markFlagsDirty()
      }
    }
    // 교시 판정으로 조퇴가 바뀌면 저장된 지각·조퇴 기록도 맞춘다
    if (deriveEarly(before, dayPeriods) !== deriveEarly(after, dayPeriods)) markFlagsDirty()
  }

  const setKind = (studentId: string, kind: PeriodKind) => {
    queueOps([{ student_id: studentId, type: 'kind', kind }])
  }

  const setNote = (studentId: string, note: string) => {
    if ((dayRows.get(studentId)?.note || '') === note) return
    queueOps([{ student_id: studentId, type: 'note', note }])
  }

  const setDayPeriods = async (n: number) => {
    const dates = { ...schedule.dates }
    const weekdayDefault = schedule.weekday[new Date(`${selectedDate}T00:00:00`).getDay()]
    if (n === weekdayDefault) delete dates[selectedDate]
    else dates[selectedDate] = n
    const res = await savePeriodSchedule({ weekday: schedule.weekday, dates })
    if (res.success && res.data) setSchedule(res.data)
    else alert(res.error || '교시 수 저장에 실패했습니다.')
  }

  const selectStudentForStats = (id: string) => {
    setSelectedStudentId(id)
    setTab('personal')
  }

  const busy = flagState === 'saving' || periodState === 'saving'
  const pending = flagState === 'pending' || periodState === 'pending'
  const failed = flagState === 'error' || periodState === 'error'

  return (
    <div className="space-y-4">
      <PageTitle
        icon={ClipboardCheck}
        tone="mint"
        title="출석 관리"
        sub={
          <>
            출결 구분을 고르고 교시 칸을 누르면 자동으로 채워집니다(지각: 조회~누른 교시 · 조퇴: 누른 교시~끝 · 결석:
            전체 · 결과: 누른 칸). 지각 1점 · 조퇴 2점, 조퇴는 교시 체크로 자동 판정. 서류 제출분은 청소 점수에서
            빠지고, 청소 점수 {CLEANING_THRESHOLD}점 이상이면 청소 대상.
          </>
        }
        right={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPanel((p) => (p === 'schedule' ? 'none' : 'schedule'))}
              className={cn(
                'glass-pill flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-gray-700',
                panel === 'schedule' && 'ring-2 ring-sky-300'
              )}
            >
              <CalendarCog className="h-4 w-4" /> 교시 설정
            </button>
            <button
              type="button"
              onClick={() => setPanel((p) => (p === 'share' ? 'none' : 'share'))}
              className={cn(
                'btn-liquid flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold',
                panel === 'share' && 'ring-2 ring-sky-300'
              )}
            >
              <QrCode className="h-4 w-4" /> QR 출석부
            </button>
          </div>
        }
      />

      {loading && <p className="text-sm text-gray-500">불러오는 중...</p>}
      {loadError && <p className="glass rounded-xl px-3 py-2 text-sm text-red-600">{loadError}</p>}

      {panel === 'share' && <SharePanel onClose={() => setPanel('none')} />}
      {panel === 'schedule' && (
        <SchedulePanel schedule={schedule} onSaved={setSchedule} onClose={() => setPanel('none')} />
      )}

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-1">
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            selectedDate={selectedDate}
            todayKey={todayKey}
            countByDate={countByDate}
            onSelect={selectDate}
          />

          <section className="glass-strong min-w-0 rounded-2xl p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-gray-900">{formatDateLabel(selectedDate)} 출석부</h2>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500">
                  <span
                    className={cn(
                      'inline-block h-2 w-2 rounded-full',
                      failed ? 'bg-red-500' : busy || pending ? 'bg-amber-400' : 'bg-emerald-500'
                    )}
                  />
                  {failed
                    ? '저장 실패 — 다시 체크해 주세요'
                    : busy
                      ? '저장 중...'
                      : pending
                        ? '곧 저장됩니다'
                        : '자동 저장됨'}
                  {lastSync && <span>· 교과교사 체크 {new Date(lastSync).toLocaleTimeString('ko-KR')} 반영</span>}
                </p>
              </div>
              <label className="glass-pill flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-gray-600">
                이날 수업
                <select
                  value={dayPeriods}
                  onChange={(e) => void setDayPeriods(Number(e.target.value))}
                  className="rounded-md border border-gray-200 bg-white/80 px-1.5 py-0.5 text-xs font-semibold"
                >
                  {Array.from({ length: PERIOD_MAX + 1 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? '없음' : `${i}교시까지`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mb-2">
              <MarkLegend />
            </div>

            <DayTable
              students={students}
              loading={loading}
              periods={dayPeriods}
              rows={dayRows}
              draft={draft}
              onFlag={toggleFlag}
              onCell={clickCell}
              onKind={setKind}
              onNote={setNote}
              onStudent={selectStudentForStats}
            />
          </section>
        </div>

        {/* 오른쪽 단: 점수 통계 */}
        <section className="glass-strong h-fit rounded-2xl p-4 2xl:sticky 2xl:top-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-800">점수 통계</h2>
            <button
              type="button"
              onClick={() => setShowReset((v) => !v)}
              className="rounded-full border border-red-200 bg-white/60 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              {showReset ? '닫기' : '리셋'}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="shrink-0 text-gray-500">집계 기간</span>
            <select
              value={activeIdx}
              onChange={(e) => setPeriodIdx(Number(e.target.value))}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white/80 px-2 py-1 text-xs"
            >
              {periods.map((p, i) => (
                <option key={i} value={i}>
                  {i + 1}차 · {periodLabel(p)}
                  {i === periodIndexOf(periods, todayKey) ? ' (현재)' : ''}
                </option>
              ))}
            </select>
          </div>
          <p className="mb-3 mt-1 text-[11px] text-gray-500">
            기간마다 점수 낮은 순 {REWARD_RANK_LIMIT}명 문화상품권 · 청소 점수는 기간과 상관없이 계산
          </p>
          {showReset && (
            <ResetPanel todayKey={todayKey} periods={periods} periodStarts={periodStarts} onChange={applyStarts} />
          )}
          <div className="mb-3 flex gap-1 rounded-xl bg-white/50 p-1 text-sm ring-1 ring-white/70">
            {(
              [
                ['personal', '개인별'],
                ['class', '학급별'],
                ['cleaning', '청소 대상자'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  'flex-1 rounded-lg py-1.5 font-medium transition-colors',
                  tab === key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'personal' && (
            <PersonalTab
              students={students}
              selectedId={selectedStudentId}
              onSelect={setSelectedStudentId}
              stats={stats}
              ranks={statRanks}
              records={effRecords}
              periodRows={periodRows}
              schedule={schedule}
              period={period}
              cleaningScore={cleaningScores.get(selectedStudentId) ?? 0}
              lastReset={lastResets.get(selectedStudentId)}
            />
          )}

          {tab === 'class' && (
            <ClassStatsTable
              rows={stats.map((stat) => ({
                stat,
                label: (
                  <span>
                    {nameOf.get(stat.student_id)}
                    <span className="ml-1 text-[11px] text-gray-400">{stat.student_id}</span>
                  </span>
                ),
              }))}
              highlightId={selectedStudentId}
              onSelect={selectStudentForStats}
            />
          )}

          {tab === 'cleaning' && (
            <CleaningTab
              todayKey={todayKey}
              studentIds={studentIds}
              scores={cleaningScores}
              lastResets={lastResets}
              resets={cleaningResets}
              onResetsChange={setCleaningResets}
              nameOf={nameOf}
            />
          )}
        </section>
      </div>
    </div>
  )
}

/** 담임 출석부 표: 학생 · 출결 구분 · 조회~N교시 · 비고 · 지각/조퇴/서류 */
function DayTable({
  students,
  loading,
  periods,
  rows,
  draft,
  onFlag,
  onCell,
  onKind,
  onNote,
  onStudent,
}: {
  students: Student[]
  loading: boolean
  periods: number
  rows: Map<string, PeriodRow>
  draft: Draft
  onFlag: (id: string, field: AttendanceField) => void
  onCell: (id: string, period: number) => void
  onKind: (id: string, kind: PeriodKind) => void
  onNote: (id: string, note: string) => void
  onStudent: (id: string) => void
}) {
  const cols = Array.from({ length: periods + 1 }, (_, i) => i)
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-[11px] text-gray-500">
            <th className="sticky left-0 z-10 bg-white/70 py-2 pl-1 text-left font-semibold backdrop-blur">학생</th>
            <th className="w-20 py-2 text-center font-semibold">출결 구분</th>
            {cols.map((p) => (
              <th key={p} className={cn('py-2 text-center font-semibold', p === 0 ? 'w-11' : 'w-10')}>
                {periodHeader(p)}
              </th>
            ))}
            <th className="min-w-[160px] py-2 pl-2 text-left font-semibold">비고 (출결 사유)</th>
            <th className="w-12 py-2 text-center font-semibold">지각</th>
            <th className="w-12 py-2 text-center font-semibold" title="교시 체크로 자동 판정">
              조퇴
            </th>
            <th className="w-14 py-2 text-center font-semibold">지각 서류</th>
            <th className="w-14 py-2 text-center font-semibold">조퇴 서류</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const row = rows.get(s.student_id)
            const marks = parseMarks(row?.marks)
            const flags = draft[s.student_id] || EMPTY_FLAGS
            const auto = hasPeriodMarks(marks, periods)
            const early = auto ? deriveEarly(marks, periods) : flags.early
            const any = !!row?.marks || flags.late || early
            return (
              <tr key={s.student_id} className={cn(any && 'bg-amber-50/50')}>
                <td className="sticky left-0 z-10 border-t border-white/70 bg-white/70 py-1.5 pl-1 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => onStudent(s.student_id)}
                    className="flex items-center gap-2 text-left"
                    title="개인별 통계 보기"
                  >
                    <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/80 ring-1 ring-white">
                      {s.photo_data ? (
                        <img src={photoSrc(s.photo_data)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                          {s.name.charAt(0) || '?'}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-900">{s.name}</span>
                      <span className="block text-[11px] text-gray-500">{s.student_id}</span>
                    </span>
                  </button>
                </td>
                <td className="border-t border-white/70 px-1 py-1.5 text-center">
                  <select
                    value={row?.kind || ''}
                    onChange={(e) => onKind(s.student_id, e.target.value as PeriodKind)}
                    aria-label={`${s.name} 출결 구분`}
                    className={cn(
                      'w-full rounded-lg border border-gray-200 bg-white/80 px-1 py-1 text-xs',
                      row?.kind && 'font-semibold text-gray-900'
                    )}
                  >
                    <option value="">선택</option>
                    {KIND_OPTIONS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </td>
                {cols.map((p) => (
                  <td key={p} className="border-t border-white/70 py-1.5 text-center">
                    <PeriodCell
                      mark={marks[p]}
                      label={`${s.name} ${p === 0 ? '조회' : `${p}교시`}`}
                      onClick={() => onCell(s.student_id, p)}
                    />
                  </td>
                ))}
                <td className="border-t border-white/70 py-1.5 pl-2">
                  <NoteInput value={row?.note || ''} onCommit={(v) => onNote(s.student_id, v)} label={s.name} />
                </td>
                <td className="border-t border-white/70 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={flags.late}
                    onChange={() => onFlag(s.student_id, 'late')}
                    aria-label={`${s.name} 지각`}
                    className="h-5 w-5 cursor-pointer accent-amber-500"
                  />
                </td>
                <td className="border-t border-white/70 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={early}
                    disabled={auto}
                    onChange={() => onFlag(s.student_id, 'early')}
                    aria-label={`${s.name} 조퇴`}
                    title={auto ? '교시 체크로 자동 판정됩니다' : '교시 체크가 없을 때만 직접 체크'}
                    className="h-5 w-5 cursor-pointer accent-violet-600 disabled:cursor-default"
                  />
                </td>
                <td className="border-t border-white/70 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={flags.late && flags.late_doc}
                    disabled={!flags.late}
                    onChange={() => onFlag(s.student_id, 'late_doc')}
                    aria-label={`${s.name} 지각 서류 제출`}
                    className="h-5 w-5 cursor-pointer accent-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
                  />
                </td>
                <td className="border-t border-white/70 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={early && flags.early_doc}
                    disabled={!early}
                    onChange={() => onFlag(s.student_id, 'early_doc')}
                    aria-label={`${s.name} 조퇴 서류 제출`}
                    className="h-5 w-5 cursor-pointer accent-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
                  />
                </td>
              </tr>
            )
          })}
          {!loading && students.length === 0 && (
            <tr>
              <td colSpan={periods + 8} className="py-6 text-center text-xs text-gray-400">
                등록된 학생이 없습니다. 학생관리에서 먼저 학생을 등록해 주세요.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {periods === 0 && (
        <p className="mt-2 text-xs text-gray-500">이날은 수업이 없는 날로 설정되어 있어 조회 칸만 보입니다.</p>
      )}
    </div>
  )
}

/** 비고 입력: 칸을 벗어나거나 Enter를 누르면 저장. 다른 곳에서 바뀐 값은 입력 중이 아닐 때만 반영 */
function NoteInput({ value, onCommit, label }: { value: string; onCommit: (v: string) => void; label: string }) {
  const [text, setText] = useState(value)
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(value)
  }, [value, focused])
  return (
    <input
      type="text"
      value={text}
      maxLength={300}
      placeholder="사유 입력"
      aria-label={`${label} 비고`}
      onFocus={() => setFocused(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false)
        onCommit(text.trim())
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      className="w-full rounded-lg border border-gray-200 bg-white/70 px-2 py-1 text-xs placeholder:text-gray-300 focus:border-sky-300 focus:bg-white focus:outline-none"
    />
  )
}

/** QR 출석부 공유: 링크·QR·재발급 */
function SharePanel({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState('')
  const [qr, setQr] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const url = key ? buildShareUrl(`/attendance-board?k=${encodeURIComponent(key)}`) : ''

  useEffect(() => {
    getAttendanceShareKey().then((res) => {
      if (res.success && res.data) setKey(res.data.key)
      else setError(res.error || '공유 키를 불러오지 못했습니다. GAS를 새 버전으로 다시 배포했는지 확인해 주세요.')
    })
  }, [])

  useEffect(() => {
    if (!url) return
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 640 })
      .then(setQr)
      .catch(() => setError('QR을 만들지 못했습니다.'))
  }, [url])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      prompt('아래 링크를 복사하세요', url)
    }
  }

  const rotate = async () => {
    if (!confirm('QR을 새로 만들까요?\n지금까지 나눠 준 QR·링크는 더 이상 열리지 않습니다.')) return
    setBusy(true)
    const res = await rotateAttendanceShareKey()
    setBusy(false)
    if (res.success && res.data) setKey(res.data.key)
    else alert(res.error || '재발급에 실패했습니다.')
  }

  return (
    <section className="glass-strong rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">QR 출석부</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            교실에 붙이거나 교과 선생님께 보내 주세요. 찍으면 일자별 1~7교시 출결과 비고가 실시간으로 보이고, 교과
            선생님은 오늘 수업 교시 칸에 빗금으로 체크할 수 있습니다. 체크는 이 화면에 바로 공유됩니다. 지각·조퇴 서류와
            청소 점수는 보이지 않습니다.
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-white/70" aria-label="닫기">
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {key && (
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="mx-auto shrink-0 rounded-2xl bg-white p-2 shadow-sm sm:mx-0">
            {qr ? <img src={qr} alt="QR 출석부" className="h-48 w-48" /> : <div className="h-48 w-48 animate-pulse rounded-xl bg-gray-100" />}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="break-all rounded-xl bg-white/70 px-3 py-2 text-[11px] text-gray-600 ring-1 ring-white">{url}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copy} className="glass-pill flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700">
                <Copy className="h-3.5 w-3.5" /> {copied ? '복사됨' : '링크 복사'}
              </button>
              <a href={url} target="_blank" rel="noreferrer" className="glass-pill flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700">
                <ExternalLink className="h-3.5 w-3.5" /> 출석부 열기
              </a>
              {qr && (
                <a href={qr} download="출석부-QR.png" className="glass-pill flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700">
                  <Download className="h-3.5 w-3.5" /> QR 이미지 저장
                </a>
              )}
              <button
                type="button"
                onClick={rotate}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-full border border-red-200 bg-white/60 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> QR 재발급
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              링크가 있으면 누구나 볼 수 있습니다(비고 포함). 링크가 퍼졌다면 재발급하세요.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

/** 요일별 기본 교시 수 + 날짜별 예외 */
function SchedulePanel({
  schedule,
  onSaved,
  onClose,
}: {
  schedule: PeriodSchedule
  onSaved: (s: PeriodSchedule) => void
  onClose: () => void
}) {
  const [weekday, setWeekday] = useState<number[]>(schedule.weekday)
  const [dates, setDates] = useState<Record<string, number>>(schedule.dates)
  const [newDate, setNewDate] = useState(toDateKey(new Date()))
  const [newN, setNewN] = useState(5)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const res = await savePeriodSchedule({ weekday, dates })
    setBusy(false)
    if (res.success && res.data) {
      onSaved(res.data)
      onClose()
    } else alert(res.error || '저장에 실패했습니다.')
  }

  const sortedDates = Object.keys(dates).sort()
  const select = (value: number, onChange: (n: number) => void, label: string) => (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={label}
      className="rounded-lg border border-gray-200 bg-white/80 px-1.5 py-1 text-xs"
    >
      {Array.from({ length: PERIOD_MAX + 1 }, (_, i) => (
        <option key={i} value={i}>
          {i === 0 ? '수업 없음' : `${i}교시`}
        </option>
      ))}
    </select>
  )

  return (
    <section className="glass-strong rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">교시 설정</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            요일마다 몇 교시까지 있는지 정하고, 단축수업·행사일은 날짜별로 따로 정합니다. 출석부와 QR 출석부 칸이 이대로
            나옵니다.
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-white/70" aria-label="닫기">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-gray-700">요일별 기본</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 md:grid-cols-4 lg:grid-cols-7">
            {WEEKDAY_ORDER.map((d) => (
              <label key={d} className="flex flex-col items-center gap-1 rounded-xl bg-white/60 p-2 text-xs ring-1 ring-white">
                <span className={cn('font-semibold', d === 0 && 'text-red-500', d === 6 && 'text-blue-500')}>
                  {WEEKDAY_LABELS[d]}
                </span>
                {select(weekday[d], (n) => setWeekday((w) => w.map((v, i) => (i === d ? n : v))), `${WEEKDAY_LABELS[d]}요일 교시 수`)}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-gray-700">날짜별 예외</p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white/80 px-2 py-1 text-xs"
            />
            {select(newN, setNewN, '예외 교시 수')}
            <button
              type="button"
              onClick={() => newDate && setDates((d) => ({ ...d, [newDate]: newN }))}
              className="glass-pill rounded-full px-3 py-1 font-semibold text-gray-700"
            >
              추가
            </button>
          </div>
          {sortedDates.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {sortedDates.map((d) => (
                <li key={d} className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-0.5 text-xs ring-1 ring-white">
                  {formatDateLabel(d)} · {dates[d] === 0 ? '수업 없음' : `${dates[d]}교시`}
                  <button
                    type="button"
                    onClick={() =>
                      setDates((prev) => {
                        const next = { ...prev }
                        delete next[d]
                        return next
                      })
                    }
                    className="text-gray-400 hover:text-red-600"
                    aria-label={`${d} 예외 삭제`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-gray-400">예외 날짜가 없습니다.</p>
          )}
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={save} disabled={busy} className="btn-liquid rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-50">
          {busy ? '저장 중...' : '설정 저장'}
        </button>
      </div>
    </section>
  )
}

/** 리셋 = 새 집계 기간 시작. 기록은 지우지 않으므로 잘못 눌러도 취소하면 원래대로 돌아간다. */
function ResetPanel({
  todayKey,
  periods,
  periodStarts,
  onChange,
}: {
  todayKey: string
  periods: AttendancePeriod[]
  periodStarts: string[]
  onChange: (starts: string[]) => void
}) {
  const [startDate, setStartDate] = useState(todayKey)
  const [busy, setBusy] = useState(false)

  const handleReset = async () => {
    if (!startDate) return
    if (periodStarts.includes(startDate)) {
      alert('그 날짜에 시작하는 집계 기간이 이미 있습니다.')
      return
    }
    const splitting = periods[periodIndexOf(periods, startDate)]
    const msg =
      `${shortDate(startDate)}부터 점수·순위를 0에서 새로 집계합니다.\n` +
      `지금의 "${periodLabel(splitting)}" 기간은 그 전날까지로 나뉘고, 기록과 통계는 그대로 남아 ` +
      '집계 기간 선택에서 볼 수 있습니다.\n\n리셋할까요?'
    if (!confirm(msg)) return
    setBusy(true)
    const res = await addAttendancePeriod(startDate)
    setBusy(false)
    if (res.success && res.data) onChange(res.data.starts)
    else alert(res.error || '리셋에 실패했습니다.')
  }

  const handleUndo = async (date: string) => {
    if (!confirm(`${shortDate(date)} 리셋을 취소할까요? 그 기간은 앞 기간과 합쳐져 다시 계산됩니다.`)) return
    setBusy(true)
    const res = await deleteAttendancePeriod(date)
    setBusy(false)
    if (res.success && res.data) onChange(res.data.starts)
    else alert(res.error || '취소에 실패했습니다.')
  }

  return (
    <div className="mb-3 space-y-2 rounded-lg border border-red-200 bg-red-50/50 p-3 text-xs">
      <p className="font-semibold text-red-700">점수 리셋 (새 집계 기간 시작)</p>
      <p className="text-gray-600">
        지각·조퇴 기록은 지워지지 않습니다. 고른 날짜부터 점수와 순위를 새로 셉니다. 미리 다음 기간 시작일을 넣어 둬도
        됩니다.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-xs"
        />
        <span className="text-gray-500">부터 새로 집계</span>
        <button
          type="button"
          onClick={handleReset}
          disabled={busy || !startDate}
          className="ml-auto rounded bg-red-600 px-3 py-1 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          리셋
        </button>
      </div>
      {periodStarts.length > 0 && (
        <div>
          <p className="mb-1 text-gray-500">리셋한 날짜</p>
          <ul className="flex flex-wrap gap-1.5">
            {periodStarts.map((d) => (
              <li key={d} className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 ring-1 ring-gray-200">
                {shortDate(d)}부터
                <button
                  type="button"
                  onClick={() => handleUndo(d)}
                  disabled={busy}
                  className="text-gray-400 hover:text-red-600"
                  title="이 리셋 취소"
                  aria-label={`${shortDate(d)} 리셋 취소`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function MonthCalendar({
  month,
  onMonthChange,
  selectedDate,
  todayKey,
  countByDate,
  onSelect,
}: {
  month: Date
  onMonthChange: (d: Date) => void
  selectedDate: string
  todayKey: string
  countByDate: Map<string, number>
  onSelect: (key: string) => void
}) {
  const weeks = getMonthGrid(month.getFullYear(), month.getMonth())
  return (
    <section className="glass-strong rounded-2xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, -1))}
          className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
          aria-label="이전 달"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">{formatMonthLabel(month)}</span>
          <button
            type="button"
            onClick={() => {
              onMonthChange(new Date())
              onSelect(todayKey)
            }}
            className="rounded border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50"
          >
            오늘
          </button>
        </div>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
          aria-label="다음 달"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-gray-400">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={w} className={cn('py-1', i === 0 && 'text-red-400', i === 6 && 'text-blue-400')}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((d) => {
          const key = toDateKey(d)
          const inMonth = d.getMonth() === month.getMonth()
          const count = countByDate.get(key) || 0
          const selected = key === selectedDate
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={cn(
                'flex h-12 flex-col items-center justify-center rounded-md text-sm transition-colors',
                selected ? 'btn-liquid' : 'hover:bg-white/70',
                !selected && !inMonth && 'text-gray-300',
                !selected && key === todayKey && 'ring-1 ring-blue-400'
              )}
            >
              <span>{d.getDate()}</span>
              {count > 0 && (
                <span
                  className={cn(
                    'mt-0.5 rounded-full px-1.5 text-[10px] leading-4',
                    selected ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'
                  )}
                >
                  {count}명
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function PersonalTab({
  students,
  selectedId,
  onSelect,
  stats,
  ranks,
  records,
  periodRows,
  schedule,
  period,
  cleaningScore,
  lastReset,
}: {
  students: Student[]
  selectedId: string
  onSelect: (id: string) => void
  stats: ReturnType<typeof aggregateStats>
  ranks: Record<'late' | 'early' | 'score', Map<string, number>>
  records: AttendanceRecord[]
  periodRows: PeriodRow[]
  schedule: PeriodSchedule
  period: AttendancePeriod
  cleaningScore: number
  lastReset?: string
}) {
  const stat = stats.find((s) => s.student_id === selectedId)
  const inPeriod = (d: string) => (!period.from || d >= period.from) && (!period.to || d <= period.to)
  const recByDate = new Map(records.filter((r) => r.student_id === selectedId && inPeriod(r.date)).map((r) => [r.date, r]))
  const rowByDate = new Map(
    periodRows
      .filter((r) => r.student_id === selectedId && inPeriod(r.date) && (r.marks || r.note))
      .map((r) => [r.date, r])
  )
  const history = [...new Set([...recByDate.keys(), ...rowByDate.keys()])]
    .sort((x, y) => (x < y ? 1 : -1))
    .map((date) => {
      const r = recByDate.get(date)
      const row = rowByDate.get(date)
      const score = r
        ? [r.late && `지각${r.late_doc ? '(서류)' : ''}`, r.early && `조퇴${r.early_doc ? '(서류)' : ''}`]
            .filter(Boolean)
            .join(' · ')
        : ''
      const detail = row ? describeMarks(parseMarks(row.marks), periodsForDate(schedule, date)) : ''
      return { date, score, detail, note: row?.note || '' }
    })

  return (
    <div className="space-y-3">
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
      >
        {students.map((s) => (
          <option key={s.student_id} value={s.student_id}>
            {s.student_id} {s.name}
          </option>
        ))}
      </select>
      {stat ? (
        <>
          <PersonalStatsTable
            stat={stat}
            total={stats.length}
            ranks={{
              late: ranks.late.get(stat.student_id) ?? 0,
              early: ranks.early.get(stat.student_id) ?? 0,
              score: ranks.score.get(stat.student_id) ?? 0,
            }}
          />
          <CleaningNotice score={cleaningScore} lastReset={lastReset} />
          <div>
            <p className="mb-1 text-xs font-semibold text-gray-700">기록 내역</p>
            {history.length === 0 ? (
              <p className="text-xs text-gray-400">출결 기록이 없습니다.</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-auto text-xs">
                {history.map((h) => (
                  <li key={h.date} className="rounded-lg bg-white/60 px-2 py-1 ring-1 ring-white">
                    <div className="flex justify-between gap-2">
                      <span className="shrink-0 text-gray-700">{formatDateLabel(h.date)}</span>
                      <span className="text-right font-medium text-gray-700">{h.score}</span>
                    </div>
                    {h.detail && <p className="text-[11px] text-gray-500">{h.detail}</p>}
                    {h.note && <p className="text-[11px] text-gray-500">비고: {h.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-400">학생을 선택해 주세요.</p>
      )}
    </div>
  )
}

/**
 * 청소 대상자: 주와 상관없이 누적한 청소 점수가 기준 이상인 학생. 청소 완료를 체크하기 전까지 계속 남는다.
 * 완료 체크 = 그 날짜(포함)까지의 청소 점수 초기화. 출결 기록은 지우지 않으므로 ×로 취소하면 원래대로 돌아간다.
 */
function CleaningTab({
  todayKey,
  studentIds,
  scores,
  lastResets,
  resets,
  onResetsChange,
  nameOf,
}: {
  todayKey: string
  studentIds: string[]
  scores: Map<string, number>
  lastResets: Map<string, string>
  resets: CleaningReset[]
  onResetsChange: (resets: CleaningReset[]) => void
  nameOf: Map<string, string>
}) {
  const [doneDate, setDoneDate] = useState(todayKey)
  const [busy, setBusy] = useState(false)

  const withScore = studentIds
    .map((id) => ({ id, score: scores.get(id) ?? 0 }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
  const targets = withScore.filter((s) => s.score >= CLEANING_THRESHOLD)
  const watch = withScore.filter((s) => s.score < CLEANING_THRESHOLD)
  const history = [...resets].reverse().slice(0, 20)
  const label = (id: string) => `${nameOf.get(id) ?? ''} (${id})`

  const handleDone = async (id: string) => {
    if (!doneDate) return
    const prev = lastResets.get(id)
    if (prev && doneDate <= prev) {
      alert(`${label(id)} 학생은 이미 ${shortDate(prev)}에 청소 완료로 체크되어 있습니다. 그 이후 날짜를 골라 주세요.`)
      return
    }
    if (prev && cleaningWeekStart(prev) === cleaningWeekStart(doneDate)) {
      alert(
        `${label(id)} 학생은 이미 같은 주(${shortDate(cleaningWeekStart(prev))}~)에 청소 완료로 체크되어 있습니다. 청소 주 점수는 초기화되지 않으므로 다시 체크할 필요가 없습니다.`
      )
      return
    }
    const countFrom = cleaningCountFrom(doneDate)
    if (
      !confirm(
        `${label(id)} 학생 청소 완료로 체크할까요?\n${shortDate(countFrom)}(청소 주 월요일) 이전의 청소 점수가 초기화됩니다.\n청소 주에 생긴 점수는 그대로 이어집니다.`
      )
    )
      return
    setBusy(true)
    const res = await addCleaningReset(id, doneDate)
    setBusy(false)
    if (res.success && res.data) onResetsChange(res.data)
    else alert(res.error || '청소 완료 체크에 실패했습니다.')
  }

  const handleUndo = async (r: CleaningReset) => {
    if (!confirm(`${label(r.student_id)} 학생의 ${shortDate(r.date)} 청소 완료를 취소할까요? 청소 점수가 다시 계산됩니다.`))
      return
    setBusy(true)
    const res = await deleteCleaningReset(r.student_id, r.date)
    setBusy(false)
    if (res.success && res.data) onResetsChange(res.data)
    else alert(res.error || '취소에 실패했습니다.')
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-amber-800">청소 대상 {targets.length}명</p>
          <label className="flex items-center gap-1.5 text-[11px] text-amber-800">
            완료 날짜
            <input
              type="date"
              value={doneDate}
              onChange={(e) => setDoneDate(e.target.value)}
              className="rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[11px]"
            />
          </label>
        </div>
        {targets.length === 0 ? (
          <p className="mt-1 text-xs text-amber-700">청소 점수 {CLEANING_THRESHOLD}점 이상인 학생이 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {targets.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium text-gray-900">
                  {nameOf.get(s.id)} <span className="text-[11px] text-gray-500">{s.id}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums text-amber-800">{s.score}점</span>
                  <button
                    type="button"
                    onClick={() => handleDone(s.id)}
                    disabled={busy || !doneDate}
                    className="rounded bg-amber-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    청소 완료
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {watch.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-gray-600">청소 점수가 있는 학생 ({CLEANING_THRESHOLD}점 미만)</p>
          <ul className="space-y-1 text-xs">
            {watch.map((s) => (
              <li key={s.id} className="flex justify-between rounded bg-gray-50 px-2 py-1">
                <span className="text-gray-700">
                  {nameOf.get(s.id)} {s.id}
                </span>
                <span className="tabular-nums text-gray-600">{s.score}점</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {history.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-gray-600">청소 완료 기록 (최근 {history.length}건)</p>
          <ul className="max-h-40 space-y-1 overflow-auto text-xs">
            {history.map((r) => (
              <li
                key={`${r.student_id}|${r.date}`}
                className="flex items-center justify-between rounded bg-gray-50 px-2 py-1"
              >
                <span className="text-gray-700">
                  {shortDate(r.date)} · {nameOf.get(r.student_id) ?? ''} {r.student_id}
                </span>
                <button
                  type="button"
                  onClick={() => handleUndo(r)}
                  disabled={busy}
                  className="text-gray-400 hover:text-red-600"
                  title="청소 완료 취소"
                  aria-label={`${r.student_id} ${shortDate(r.date)} 청소 완료 취소`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[11px] text-gray-400">
        청소 점수 = 서류 없는 지각 1점 + 서류 없는 조퇴 2점. 주·집계 기간과 상관없이 누적하고, 청소 완료를 체크하면
        청소한 주(월~일) 이전 주까지의 점수만 초기화됩니다. 청소 주에 생긴 점수는 그대로 남아 다음 청소 점수로 이어집니다.
      </p>
    </div>
  )
}
