import { useEffect, useMemo, useState } from 'react'
import { getAttendanceRecords, getStudents, saveAttendanceDay } from '@/api/api'
import type { AttendanceRecord, Student } from '@/types'
import {
  CLEANING_THRESHOLD,
  EMPTY_FLAGS,
  SCORE_CUTOFF_DATE,
  aggregateStats,
  invalidDocFields,
  mondayOf,
  rankBy,
  shortDate,
  weekRange,
  type AttendanceField,
  type AttendanceFlags,
} from '@/lib/attendance'
import {
  WEEKDAY_LABELS,
  addDays,
  addMonths,
  formatDateLabel,
  formatMonthLabel,
  getMonthGrid,
  toDateKey,
} from '@/lib/calendar'
import {
  ClassStatsTable,
  PersonalStatsTable,
  WeeklyCleaningNotice,
} from '@/components/attendance/AttendanceStatsTables'
import { cn } from '@/lib/utils'

const CHECK_COLUMNS: Array<{ field: AttendanceField; label: string }> = [
  { field: 'late', label: '지각' },
  { field: 'early', label: '조퇴' },
  { field: 'late_doc', label: '지각 서류 제출' },
  { field: 'early_doc', label: '조퇴 서류 제출' },
]

type StatsTab = 'personal' | 'class' | 'cleaning'
type Draft = Record<string, AttendanceFlags>

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
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [month, setMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [draft, setDraft] = useState<Draft>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const [tab, setTab] = useState<StatsTab>('class')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [weekMonday, setWeekMonday] = useState(() => mondayOf(new Date()))

  useEffect(() => {
    Promise.all([getStudents(), getAttendanceRecords()])
      .then(([stuRes, attRes]) => {
        if (stuRes.success && stuRes.data) {
          setStudents(stuRes.data)
          if (stuRes.data[0]) setSelectedStudentId(stuRes.data[0].student_id)
        } else {
          setLoadError(stuRes.error || '학생 목록을 불러오지 못했습니다.')
        }
        if (attRes.success && attRes.data) {
          setRecords(attRes.data)
          setDraft(buildDraft(attRes.data, todayKey))
        } else {
          setLoadError(attRes.error || '출결 기록을 불러오지 못했습니다.')
        }
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 날짜별로 지각·조퇴가 기록된 학생 수 (캘린더 표시용)
  const countByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of records) m.set(r.date, (m.get(r.date) || 0) + 1)
    return m
  }, [records])

  const savedCount = countByDate.get(selectedDate) || 0
  const nameOf = useMemo(() => new Map(students.map((s) => [s.student_id, s.name])), [students])

  const invalidStudents = useMemo(
    () => students.filter((s) => draft[s.student_id] && invalidDocFields(draft[s.student_id]).length > 0),
    [students, draft]
  )

  const studentIds = useMemo(() => students.map((s) => s.student_id), [students])
  const stats = useMemo(
    () => aggregateStats(studentIds, records, undefined, SCORE_CUTOFF_DATE),
    [studentIds, records]
  )
  const statRanks = useMemo(
    () => ({ late: rankBy(stats, 'late'), early: rankBy(stats, 'early'), score: rankBy(stats, 'score') }),
    [stats]
  )

  const selectDate = (key: string) => {
    if (key === selectedDate) return
    if (dirty && !confirm('저장하지 않은 변경 사항이 있습니다. 버리고 다른 날짜로 이동할까요?')) return
    setSelectedDate(key)
    setDraft(buildDraft(records, key))
    setDirty(false)
  }

  const toggle = (studentId: string, field: AttendanceField) => {
    setDraft((prev) => {
      const cur = prev[studentId] || EMPTY_FLAGS
      return { ...prev, [studentId]: { ...cur, [field]: !cur[field] } }
    })
    setDirty(true)
  }

  const resetDraft = () => {
    setDraft(buildDraft(records, selectedDate))
    setDirty(false)
  }

  const handleSave = async () => {
    if (invalidStudents.length > 0) {
      alert(
        '서류 제출만 체크되고 지각/조퇴가 체크되지 않은 학생이 있습니다.\n\n' +
          invalidStudents.map((s) => `· ${s.name} (${s.student_id})`).join('\n') +
          '\n\n지각 서류 제출은 지각이, 조퇴 서류 제출은 조퇴가 함께 체크되어 있어야 저장됩니다.'
      )
      return
    }
    const dayRecords: AttendanceRecord[] = students
      .map((s) => ({ student_id: s.student_id, date: selectedDate, ...(draft[s.student_id] || EMPTY_FLAGS) }))
      .filter((r) => r.late || r.early)
    setSaving(true)
    const res = await saveAttendanceDay(selectedDate, dayRecords)
    setSaving(false)
    if (!res.success) {
      alert(res.error || '저장에 실패했습니다.')
      return
    }
    setRecords((prev) => prev.filter((r) => r.date !== selectedDate).concat(dayRecords))
    setDraft(buildDraft(dayRecords, selectedDate))
    setDirty(false)
  }

  const selectStudentForStats = (id: string) => {
    setSelectedStudentId(id)
    setTab('personal')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">출석 관리</h1>
          <p className="mt-1 text-xs text-gray-500">
            지각 1점 · 조퇴 2점 누적. 서류 제출분은 점수는 누적하되 청소 점수에서는 빠집니다. 한 주 청소 점수{' '}
            {CLEANING_THRESHOLD}점 이상이면 다음 주 청소.
          </p>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">불러오는 중...</p>}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* 왼쪽 단: 캘린더 + 일자별 체크 */}
        <div className="space-y-4">
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            selectedDate={selectedDate}
            todayKey={todayKey}
            countByDate={countByDate}
            onSelect={selectDate}
          />

          <section className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">{formatDateLabel(selectedDate)} 출결</h2>
                <p className="text-[11px] text-gray-500">
                  {savedCount > 0 ? `저장된 기록 ${savedCount}명 — 체크를 바꾸고 수정 저장하세요.` : '저장된 기록 없음'}
                  {dirty && <span className="ml-1 font-semibold text-amber-600">· 저장 안 된 변경 있음</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {dirty && (
                  <button
                    type="button"
                    onClick={resetDraft}
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                  >
                    되돌리기
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !dirty || students.length === 0}
                  className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : savedCount > 0 ? '수정 저장' : '저장'}
                </button>
              </div>
            </div>

            {invalidStudents.length > 0 && (
              <p className="mb-2 rounded bg-red-50 px-3 py-2 text-xs text-red-700">
                서류 제출은 지각/조퇴가 함께 체크되어야 저장됩니다: {invalidStudents.map((s) => s.name).join(', ')}
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-500">
                    <th className="py-2 text-left font-medium">학생</th>
                    {CHECK_COLUMNS.map((c) => (
                      <th key={c.field} className="w-20 py-2 text-center font-medium">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const flags = draft[s.student_id] || EMPTY_FLAGS
                    const invalid = invalidDocFields(flags)
                    return (
                      <tr
                        key={s.student_id}
                        className={cn(
                          'border-b border-gray-100',
                          invalid.length > 0 ? 'bg-red-50' : (flags.late || flags.early) && 'bg-amber-50/60'
                        )}
                      >
                        <td className="py-1.5">
                          <button
                            type="button"
                            onClick={() => selectStudentForStats(s.student_id)}
                            className="flex items-center gap-2 text-left"
                            title="개인별 통계 보기"
                          >
                            <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-100">
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
                        {CHECK_COLUMNS.map((c) => (
                          <td key={c.field} className="py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={flags[c.field]}
                              onChange={() => toggle(s.student_id, c.field)}
                              aria-label={`${s.name} ${c.label}`}
                              className={cn(
                                'h-5 w-5 cursor-pointer accent-blue-600',
                                invalid.includes(c.field) && 'outline outline-2 outline-red-500'
                              )}
                            />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                  {!loading && students.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-gray-400">
                        등록된 학생이 없습니다. 학생관리에서 먼저 학생을 등록해 주세요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* 오른쪽 단: 점수 통계 */}
        <section className="h-fit rounded-xl bg-white p-4 shadow-sm xl:sticky xl:top-6">
          <h2 className="text-sm font-semibold text-gray-800">점수 통계</h2>
          <p className="mb-3 text-[11px] text-gray-500">
            {shortDate(SCORE_CUTOFF_DATE)}까지의 기록으로 집계 · 점수 낮은 순 10명 문화상품권
          </p>
          <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1 text-sm">
            {(
              [
                ['personal', '개인별'],
                ['class', '학급별'],
                ['cleaning', '주간 청소'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  'flex-1 rounded-md py-1.5 font-medium',
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
              records={records}
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
              weekMonday={weekMonday}
              onWeekChange={setWeekMonday}
              studentIds={studentIds}
              records={records}
              nameOf={nameOf}
            />
          )}
        </section>
      </div>
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
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, -1))}
          className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
          aria-label="이전 달"
        >
          ‹
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
          ›
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
                selected ? 'bg-blue-600 text-white' : 'hover:bg-gray-100',
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
}: {
  students: Student[]
  selectedId: string
  onSelect: (id: string) => void
  stats: ReturnType<typeof aggregateStats>
  ranks: Record<'late' | 'early' | 'score', Map<string, number>>
  records: AttendanceRecord[]
}) {
  const stat = stats.find((s) => s.student_id === selectedId)
  const thisWeek = weekRange(mondayOf(new Date()))
  const weekCleaning = selectedId
    ? aggregateStats([selectedId], records, thisWeek.from, thisWeek.to)[0].cleaning_score
    : 0
  const history = records
    .filter((r) => r.student_id === selectedId && r.date <= SCORE_CUTOFF_DATE)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

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
          <WeeklyCleaningNotice score={weekCleaning} from={thisWeek.from} to={thisWeek.to} />
          <div>
            <p className="mb-1 text-xs font-semibold text-gray-700">기록 내역</p>
            {history.length === 0 ? (
              <p className="text-xs text-gray-400">지각·조퇴 기록이 없습니다.</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-auto text-xs">
                {history.map((r) => (
                  <li key={r.date} className="flex justify-between rounded bg-gray-50 px-2 py-1">
                    <span className="text-gray-700">{formatDateLabel(r.date)}</span>
                    <span className="text-gray-600">
                      {[r.late && `지각${r.late_doc ? '(서류)' : ''}`, r.early && `조퇴${r.early_doc ? '(서류)' : ''}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
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

function CleaningTab({
  weekMonday,
  onWeekChange,
  studentIds,
  records,
  nameOf,
}: {
  weekMonday: Date
  onWeekChange: (d: Date) => void
  studentIds: string[]
  records: AttendanceRecord[]
  nameOf: Map<string, string>
}) {
  const { from, to } = weekRange(weekMonday)
  const next = weekRange(addDays(weekMonday, 7))
  const weekStats = aggregateStats(studentIds, records, from, to)
    .filter((s) => s.cleaning_score > 0)
    .sort((a, b) => b.cleaning_score - a.cleaning_score)
  const targets = weekStats.filter((s) => s.cleaning_score >= CLEANING_THRESHOLD)
  const watch = weekStats.filter((s) => s.cleaning_score < CLEANING_THRESHOLD)

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onWeekChange(addDays(weekMonday, -7))}
          className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
          aria-label="이전 주"
        >
          ‹
        </button>
        <span className="font-semibold text-gray-800">
          {shortDate(from)}(월) ~ {shortDate(to)}(일)
        </span>
        <button
          type="button"
          onClick={() => onWeekChange(addDays(weekMonday, 7))}
          className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
          aria-label="다음 주"
        >
          ›
        </button>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-xs font-semibold text-amber-800">
          다음 주({shortDate(next.from)} ~ {shortDate(next.to)}) 청소 대상 {targets.length}명
        </p>
        {targets.length === 0 ? (
          <p className="mt-1 text-xs text-amber-700">이 주에 청소 점수 {CLEANING_THRESHOLD}점 이상인 학생이 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {targets.map((s) => (
              <li key={s.student_id} className="flex justify-between text-sm">
                <span className="font-medium text-gray-900">
                  {nameOf.get(s.student_id)} <span className="text-[11px] text-gray-500">{s.student_id}</span>
                </span>
                <span className="tabular-nums text-amber-800">
                  {s.cleaning_score}점
                  <span className="ml-1.5 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold">
                    다음주 청소 확정
                  </span>
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
              <li key={s.student_id} className="flex justify-between rounded bg-gray-50 px-2 py-1">
                <span className="text-gray-700">
                  {nameOf.get(s.student_id)} {s.student_id}
                </span>
                <span className="tabular-nums text-gray-600">{s.cleaning_score}점</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[11px] text-gray-400">
        청소 점수 = 서류 없는 지각 1점 + 서류 없는 조퇴 2점. 월~일 한 주 단위로 집계합니다.
      </p>
    </div>
  )
}
