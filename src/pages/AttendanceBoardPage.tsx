/**
 * QR 출석부 (교과교사·교실 화면). /attendance-board?api=…&k=…
 * - 일자별 조회~N교시 출결과 비고를 실시간으로 보여 준다(폴링).
 * - 오늘 날짜에 한해 1~N교시 칸에 빗금(교과 체크)을 넣고 뺄 수 있다. 출결 구분은 없다.
 * - 담임이 구분(결석·지각·조퇴·결과)으로 체크한 칸은 바꿀 수 없다.
 * - 지각·조퇴 서류, 청소 점수, 점수 통계는 보여 주지 않는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ClipboardCheck, RefreshCw, TriangleAlert } from 'lucide-react'
import { getAttendanceBoard, saveAttendanceBoardMark } from '@/api/api'
import type { PeriodRow } from '@/types'
import { KIND_OPTIONS, MARK_LABELS, deriveEarly, parseMarks, type MarkMap } from '@/lib/attendance'
import { addDays, formatDateLabel, parseDateKey, toDateKey } from '@/lib/calendar'
import { MarkLegend, PeriodCell, periodHeader } from '@/components/attendance/PeriodCell'
import { EmptyArt, IconTile } from '@/components/ui/Glyph'
import { cn } from '@/lib/utils'

const POLL_MS = 10000
const kindLabel = (k: string) => KIND_OPTIONS.find((o) => o.value === k)?.label || ''

export function AttendanceBoardPage() {
  const [params] = useSearchParams()
  const shareKey = params.get('k') || ''
  const [roster, setRoster] = useState<Array<{ student_id: string; name: string; photo_data?: string }>>([])
  const [rows, setRows] = useState<PeriodRow[]>([])
  const [date, setDate] = useState('')
  const [today, setToday] = useState('')
  const [periods, setPeriods] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncedAt, setSyncedAt] = useState<number | null>(null)
  const [focusPeriod, setFocusPeriod] = useState<number | null>(null)
  const saving = useRef(0)
  const dateRef = useRef('')
  dateRef.current = date

  const load = useCallback(
    async (target: string | undefined, withRoster: boolean) => {
      if (!shareKey) {
        setError('출석부 링크가 올바르지 않습니다. 담임 선생님께 QR을 다시 받아 주세요.')
        setLoading(false)
        return
      }
      const res = await getAttendanceBoard(shareKey, target, withRoster)
      setLoading(false)
      if (!res.success || !res.data) {
        setError(res.error || '출석부를 불러오지 못했습니다.')
        return
      }
      // 저장 중이거나 그새 다른 날짜로 옮겼으면 이 응답은 버린다
      if (saving.current > 0 || (target && dateRef.current && target !== dateRef.current)) return
      setError('')
      if (res.data.roster) setRoster(res.data.roster)
      setRows(res.data.rows)
      setDate(res.data.date)
      setToday(res.data.today)
      setPeriods(res.data.periods)
      setSyncedAt(Date.now())
    },
    [shareKey]
  )

  useEffect(() => {
    void load(undefined, true)
  }, [load])

  useEffect(() => {
    if (!date) return
    const tick = () => {
      if (!document.hidden) void load(dateRef.current, false)
    }
    const id = window.setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [date, load])

  const editable = !!date && date === today
  const rowOf = useMemo(() => new Map(rows.map((r) => [r.student_id, r])), [rows])

  const moveDate = (delta: number) => {
    const next = toDateKey(addDays(parseDateKey(date), delta))
    setDate(next)
    setFocusPeriod(null)
    void load(next, false)
  }

  const toggle = async (studentId: string, p: number) => {
    if (!editable || p < 1 || p > periods) return
    const row = rowOf.get(studentId)
    const marks = parseMarks(row?.marks)
    const cur = marks[p]
    if (cur && cur !== 'S') {
      setNotice(`담임 선생님이 ${MARK_LABELS[cur]}(으)로 체크한 칸이라 바꿀 수 없습니다.`)
      return
    }
    const on = !cur
    // 화면에 먼저 반영
    const nextMarks: MarkMap = { ...marks }
    if (on) nextMarks[p] = 'S'
    else delete nextMarks[p]
    const nextRow: PeriodRow = {
      date,
      student_id: studentId,
      kind: row?.kind || '',
      note: row?.note || '',
      marks: Object.keys(nextMarks)
        .map(Number)
        .sort((a, b) => a - b)
        .map((k) => `${k}:${nextMarks[k]}`)
        .join(','),
    }
    const prevRows = rows
    setRows((rs) => rs.filter((r) => r.student_id !== studentId).concat(nextRow))
    setNotice('')
    saving.current += 1
    const res = await saveAttendanceBoardMark(shareKey, date, studentId, p, on)
    saving.current -= 1
    if (res.success && res.data) {
      if (saving.current === 0) setRows(res.data.rows)
      setSyncedAt(Date.now())
    } else {
      setRows(prevRows)
      setNotice(res.error || '저장에 실패했습니다. 다시 눌러 주세요.')
    }
  }

  const cols = Array.from({ length: periods + 1 }, (_, i) => i)

  // 요약: 구분별 인원 + 교시 체크로 판정한 조퇴
  const summary = useMemo(() => {
    const count = { A: 0, L: 0, E: 0, R: 0 } as Record<'A' | 'L' | 'E' | 'R', number>
    const marked = new Set<string>()
    for (const r of rows) {
      const m = parseMarks(r.marks)
      const has = Object.keys(m).length > 0
      if (has) marked.add(r.student_id)
      if (r.kind) count[r.kind as 'A' | 'L' | 'E' | 'R'] += 1
      else if (deriveEarly(m, periods)) count.E += 1
    }
    return { count, marked: marked.size }
  }, [rows, periods])

  return (
    <div className="min-h-screen px-3 pb-16 pt-4 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-3">
        <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-3xl px-4 py-3">
          <div className="flex items-center gap-3">
            <IconTile icon={ClipboardCheck} tone="mint" size={44} />
            <div>
              <h1 className="text-lg font-extrabold text-gray-900">출석부</h1>
              <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                실시간 · {syncedAt ? `${new Date(syncedAt).toLocaleTimeString('ko-KR')} 갱신` : '불러오는 중'}
              </p>
            </div>
          </div>
          {date && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => moveDate(-1)}
                className="glass-pill grid h-10 w-10 place-items-center rounded-full text-gray-600"
                aria-label="이전 날"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="min-w-[9.5rem] text-center">
                <p className="text-base font-bold text-gray-900">
                  {formatDateLabel(date)}
                </p>
                <p className="text-[11px] text-gray-500">
                  {periods === 0 ? '수업 없음' : `${periods}교시까지`}
                  {date !== today && ' · 지난 날짜는 보기만'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => moveDate(1)}
                className="glass-pill grid h-10 w-10 place-items-center rounded-full text-gray-600"
                aria-label="다음 날"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              {date !== today && (
                <button
                  type="button"
                  onClick={() => {
                    setDate(today)
                    void load(today, false)
                  }}
                  className="btn-liquid rounded-full px-3 py-2 text-xs font-semibold"
                >
                  오늘
                </button>
              )}
              <button
                type="button"
                onClick={() => void load(date, false)}
                className="glass-pill grid h-10 w-10 place-items-center rounded-full text-gray-600"
                aria-label="새로 고침"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          )}
        </header>

        {loading && <div className="glass h-64 animate-pulse rounded-3xl" />}

        {!loading && error && (
          <div className="glass flex flex-col items-center gap-3 rounded-3xl px-4 py-12 text-center">
            <EmptyArt icon={TriangleAlert} tone="amber" />
            <p className="text-sm font-semibold text-gray-700">{error}</p>
          </div>
        )}

        {!loading && !error && date && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {(['A', 'L', 'E', 'R'] as const).map((k) => (
                <span key={k} className="glass-pill rounded-full px-3 py-1 text-xs font-semibold text-gray-700">
                  {MARK_LABELS[k]} <span className="tabular-nums">{summary.count[k]}</span>명
                </span>
              ))}
              <span className="glass-pill rounded-full px-3 py-1 text-xs text-gray-600">
                체크된 학생 <span className="tabular-nums font-semibold">{summary.marked}</span> / {roster.length}명
              </span>
              <span className="ml-auto">
                <MarkLegend />
              </span>
            </div>

            {editable && periods > 0 && (
              <div className="glass flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2 text-xs text-gray-600">
                <span className="font-semibold text-gray-800">지금 수업 교시</span>
                {cols
                  .filter((p) => p > 0)
                  .map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFocusPeriod((f) => (f === p ? null : p))}
                      className={cn(
                        'h-8 min-w-8 rounded-full px-2.5 font-bold',
                        focusPeriod === p ? 'btn-liquid' : 'glass-pill text-gray-700'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                <span className="text-gray-500">
                  교시를 고르면 그 줄이 강조됩니다. 수업에 없는 학생 칸을 누르면 빗금이 그어지고, 다시 누르면 지워집니다.
                </span>
              </div>
            )}

            {notice && (
              <p className="glass rounded-2xl px-3 py-2 text-sm font-medium text-amber-700">{notice}</p>
            )}

            <section className="glass-strong overflow-hidden rounded-3xl">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="sticky left-0 z-10 bg-white/80 px-3 py-2.5 text-left font-semibold backdrop-blur">
                        학생
                      </th>
                      <th className="w-16 py-2.5 text-center font-semibold">구분</th>
                      {cols.map((p) => (
                        <th
                          key={p}
                          className={cn(
                            'w-12 py-2.5 text-center font-semibold',
                            focusPeriod === p && 'bg-sky-100/70 text-sky-700'
                          )}
                        >
                          {periodHeader(p)}
                        </th>
                      ))}
                      <th className="min-w-[180px] px-3 py-2.5 text-left font-semibold">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((s) => {
                      const row = rowOf.get(s.student_id)
                      const marks = parseMarks(row?.marks)
                      const autoEarly = !row?.kind && deriveEarly(marks, periods)
                      return (
                        <tr key={s.student_id} className={cn(row?.marks && 'bg-amber-50/40')}>
                          <td className="sticky left-0 z-10 border-t border-white/70 bg-white/80 px-3 py-1.5 backdrop-blur">
                            <span className="flex items-center gap-2.5">
                              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/80 ring-2 ring-white">
                                {s.photo_data ? (
                                  <img
                                    src={s.photo_data.startsWith('data:') ? s.photo_data : `data:image/jpeg;base64,${s.photo_data}`}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-400">
                                    {s.name.charAt(0) || '?'}
                                  </span>
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-gray-900">{s.name}</span>
                                <span className="block text-[11px] text-gray-500">{s.student_id}</span>
                              </span>
                            </span>
                          </td>
                          <td className="border-t border-white/70 py-1.5 text-center text-xs font-semibold text-gray-700">
                            {row?.kind ? kindLabel(row.kind) : autoEarly ? '조퇴' : ''}
                          </td>
                          {cols.map((p) => {
                            const m = marks[p]
                            const locked = !!m && m !== 'S'
                            const canEdit = editable && p >= 1 && !locked
                            return (
                              <td
                                key={p}
                                className={cn('border-t border-white/70 py-1.5 text-center', focusPeriod === p && 'bg-sky-50/70')}
                              >
                                <PeriodCell
                                  mark={m}
                                  size="lg"
                                  label={`${s.name} ${p === 0 ? '조회' : `${p}교시`}`}
                                  highlight={focusPeriod === p}
                                  locked={editable && p >= 1 && locked}
                                  disabled={!editable || p === 0}
                                  onClick={() => (canEdit || locked ? void toggle(s.student_id, p) : undefined)}
                                />
                              </td>
                            )
                          })}
                          <td className="border-t border-white/70 px-3 py-1.5 text-xs text-gray-600">{row?.note || ''}</td>
                        </tr>
                      )
                    })}
                    {roster.length === 0 && (
                      <tr>
                        <td colSpan={periods + 3} className="py-10 text-center text-sm text-gray-400">
                          등록된 학생이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            <p className="text-center text-[11px] text-gray-400">
              조회 칸과 지난 날짜는 담임 선생님만 바꿀 수 있습니다. 체크는 담임 선생님 출석부에 바로 공유됩니다.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
