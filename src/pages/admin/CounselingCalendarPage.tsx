import { useEffect, useMemo, useState } from 'react'
import {
  getStudents,
  getCalendarEvents,
  getCounselingTimetable,
  saveCounselingTimetable,
} from '@/api/api'
import { buildShareUrl } from '@/lib/gasUrl'
import type { CalendarEvent, CounselingTimetable, Student, TimetablePeriod } from '@/types'
import { CalendarBoard, type CalendarStudentInfo } from '@/components/calendar/CalendarBoard'
import { CalendarEventModal } from '@/components/calendar/CalendarEventModal'

let periodIdCounter = 1
function newPeriodId() {
  return `p_${Date.now().toString(36)}_${periodIdCounter++}`
}

const DEFAULT_PERIODS: TimetablePeriod[] = [
  { id: newPeriodId(), label: '1교시', start_time: '09:00', end_time: '09:50' },
  { id: newPeriodId(), label: '2교시', start_time: '10:00', end_time: '10:50' },
  { id: newPeriodId(), label: '3교시', start_time: '11:00', end_time: '11:50' },
  { id: newPeriodId(), label: '4교시', start_time: '12:00', end_time: '12:50' },
]

export function CounselingCalendarPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [periods, setPeriods] = useState<TimetablePeriod[]>([])
  const [timetableSavedAt, setTimetableSavedAt] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [savingTimetable, setSavingTimetable] = useState(false)
  const [showTimetable, setShowTimetable] = useState(false)
  const [copied, setCopied] = useState(false)

  // 모달 상태
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [modalEvent, setModalEvent] = useState<CalendarEvent | null>(null)

  const loadEvents = async () => {
    const res = await getCalendarEvents()
    if (res.success && res.data) setEvents(res.data)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [studentsRes, eventsRes, timetableRes] = await Promise.all([
        getStudents(),
        getCalendarEvents(),
        getCounselingTimetable(),
      ])
      if (cancelled) return
      if (studentsRes.success && studentsRes.data) setStudents(studentsRes.data)
      if (eventsRes.success && eventsRes.data) setEvents(eventsRes.data)
      if (timetableRes.success && timetableRes.data && timetableRes.data.periods?.length) {
        setPeriods(timetableRes.data.periods)
        setTimetableSavedAt(timetableRes.data.updated_at || '')
      } else {
        setPeriods(DEFAULT_PERIODS)
        setShowTimetable(true) // 아직 저장 전이면 세팅 안내를 펼쳐 둔다
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const timetable: CounselingTimetable | null = useMemo(
    () => (periods.length ? { periods, updated_at: timetableSavedAt } : null),
    [periods, timetableSavedAt]
  )

  const studentsById = useMemo(() => {
    const m: Record<string, CalendarStudentInfo> = {}
    for (const s of students) m[s.student_id] = { name: s.name, photo_data: s.photo_data }
    return m
  }, [students])

  // ----- 타임테이블 편집 -----
  const updatePeriod = (id: string, patch: Partial<TimetablePeriod>) => {
    setPeriods((cur) => cur.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }
  const addPeriod = () => {
    const last = periods[periods.length - 1]
    setPeriods((cur) => [
      ...cur,
      {
        id: newPeriodId(),
        label: `${cur.length + 1}교시`,
        start_time: last?.end_time || '09:00',
        end_time: last?.end_time || '09:50',
      },
    ])
  }
  const removePeriod = (id: string) => setPeriods((cur) => cur.filter((p) => p.id !== id))

  const handleSaveTimetable = async () => {
    const cleaned = periods
      .filter((p) => p.label.trim() && p.start_time)
      .map((p) => ({ ...p, label: p.label.trim(), end_time: p.end_time || p.start_time }))
    if (cleaned.length === 0) {
      alert('교시를 1개 이상 입력해 주세요.')
      return
    }
    setSavingTimetable(true)
    const res = await saveCounselingTimetable({ periods: cleaned })
    setSavingTimetable(false)
    if (res.success) {
      setPeriods(cleaned)
      setTimetableSavedAt(res.data?.updated_at || new Date().toISOString())
      alert('교시 타임테이블을 저장했습니다.')
    } else {
      alert(res.error || '저장에 실패했습니다.')
    }
  }

  const handleShare = async () => {
    const url = buildShareUrl('/calendar')
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('아래 링크를 복사해 학생에게 공유하세요.', url)
    }
  }

  const openAdd = (dateKey: string) => {
    setModalEvent(null)
    setModalDate(dateKey)
  }
  const openEdit = (event: CalendarEvent) => {
    setModalEvent(event)
    setModalDate(event.date)
  }
  const closeModal = () => {
    setModalDate(null)
    setModalEvent(null)
  }
  const handleSaved = async () => {
    closeModal()
    await loadEvents()
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="py-20 text-center text-sm text-gray-500">불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">상담 캘린더</h1>
          <p className="mt-1 text-sm text-gray-600">
            날짜를 눌러 수업시간이나 상담 일정을 추가하세요. 링크를 공유하면 학생이 열람할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleShare}
          className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          {copied ? '✓ 링크 복사됨' : '🔗 캘린더 공유 링크'}
        </button>
      </div>

      {/* 교시 타임테이블 세팅 */}
      <div className="mb-4 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowTimetable((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-sm font-semibold text-gray-800">
            ⏱️ 교시 타임테이블 세팅
            <span className="ml-2 font-normal text-gray-400">
              {periods.length}교시 · 모든 날짜(주말 포함) 공통 적용
            </span>
          </span>
          <span className="text-gray-400">{showTimetable ? '▲' : '▼'}</span>
        </button>
        {showTimetable && (
          <div className="border-t border-gray-100 p-4">
            <div className="space-y-2">
              {periods.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={p.label}
                    onChange={(e) => updatePeriod(p.id, { label: e.target.value })}
                    placeholder="교시명"
                    className="w-24 shrink-0 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="time"
                    value={p.start_time}
                    onChange={(e) => updatePeriod(p.id, { start_time: e.target.value })}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  />
                  <span className="text-gray-400">~</span>
                  <input
                    type="time"
                    value={p.end_time}
                    onChange={(e) => updatePeriod(p.id, { end_time: e.target.value })}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removePeriod(p.id)}
                    className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="교시 삭제"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={addPeriod}
                className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
              >
                + 교시 추가
              </button>
              <button
                type="button"
                onClick={handleSaveTimetable}
                disabled={savingTimetable}
                className="ml-auto rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {savingTimetable ? '저장 중...' : '타임테이블 저장'}
              </button>
            </div>
            {timetableSavedAt && (
              <p className="mt-2 text-[11px] text-gray-400">
                마지막 저장: {new Date(timetableSavedAt).toLocaleString('ko-KR')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 캘린더 */}
      <CalendarBoard
        events={events}
        studentsById={studentsById}
        editable
        onDateClick={openAdd}
        onEventClick={openEdit}
      />

      {modalDate && (
        <CalendarEventModal
          dateKey={modalDate}
          existing={modalEvent}
          timetable={timetable}
          students={students}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
