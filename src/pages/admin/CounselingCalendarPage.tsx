import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Link2, Plus, Timer, CalendarHeart, X } from 'lucide-react'
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
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { PageTitle } from '@/components/ui/Glyph'

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
        <LoadingSpinner label="불러오는 중" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          icon={CalendarHeart}
          title="상담 캘린더"
          sub="날짜를 눌러 수업시간이나 상담 일정을 추가하고, 공유 링크로 학생에게 보여 줍니다"
        />
        <button
          type="button"
          onClick={handleShare}
          className="btn btn-primary shrink-0"
        >
          {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {copied ? '링크 복사됨' : '캘린더 공유 링크'}
        </button>
      </div>

      {/* 교시 타임테이블 세팅 */}
      <div className="card mb-4">
        <button
          type="button"
          onClick={() => setShowTimetable((v) => !v)}
          aria-expanded={showTimetable}
          className="flex h-12 w-full items-center justify-between px-5 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-ink-strong">
            <Timer className="h-4 w-4 text-muted" />
            교시 타임테이블 세팅
            <span className="font-normal tabular-nums text-muted">{periods.length}교시 · 모든 날짜에 같게 적용</span>
          </span>
          <span className="text-muted">{showTimetable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
        </button>
        {showTimetable && (
          <div className="border-t border-line p-5">
            <div className="space-y-2">
              {periods.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={p.label}
                    onChange={(e) => updatePeriod(p.id, { label: e.target.value })}
                    placeholder="교시명"
                    className="field w-24 shrink-0"
                  />
                  <input
                    type="time"
                    value={p.start_time}
                    onChange={(e) => updatePeriod(p.id, { start_time: e.target.value })}
                    className="field tabular-nums"
                  />
                  <span className="text-muted">~</span>
                  <input
                    type="time"
                    value={p.end_time}
                    onChange={(e) => updatePeriod(p.id, { end_time: e.target.value })}
                    className="field tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => removePeriod(p.id)}
                    className="btn btn-ghost btn-icon ml-auto hover:text-absent"
                    aria-label="교시 삭제"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={addPeriod}
                className="btn btn-secondary btn-sm"
              >
                <Plus className="h-4 w-4" /> 교시 추가
              </button>
              <button
                type="button"
                onClick={handleSaveTimetable}
                disabled={savingTimetable}
                className="btn btn-secondary ml-auto"
              >
                {savingTimetable ? '저장 중…' : '타임테이블 저장'}
              </button>
            </div>
            {timetableSavedAt && (
              <p className="mt-2 text-xs tabular-nums text-muted">
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
        timetable={timetable}
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
