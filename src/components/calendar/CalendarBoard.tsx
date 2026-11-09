import { useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, MapPin, Plus, Users } from 'lucide-react'
import type { CalendarEvent, CounselingTimetable, TimetablePeriod } from '@/types'
import {
  WEEKDAY_LABELS,
  toDateKey,
  addDays,
  addMonths,
  isSameDay,
  getWeekDays,
  getMonthGrid,
  startOfWeek,
  formatMonthLabel,
  formatDateLabel,
  formatTimeRange,
  timeToMinutes,
} from '@/lib/calendar'

export interface CalendarStudentInfo {
  name: string
  photo_data?: string
}

type ViewMode = 'calendar' | 'table'
type RangeMode = 'month' | 'week' | 'day'

interface CalendarBoardProps {
  events: CalendarEvent[]
  /** 학번 → 학생 정보 (상담 대상 이름/사진 표시용) */
  studentsById?: Record<string, CalendarStudentInfo>
  /** 교시 타임테이블 — '일(day)' 뷰에서 교시별로 일정을 묶어 보여줄 때 사용 */
  timetable?: CounselingTimetable | null
  /** 교사 화면에서만 true: 일정 클릭으로 편집 */
  editable?: boolean
  /** 날짜 클릭(+)으로 새 일정을 추가할 수 있는지. 미지정이면 editable을 따른다. */
  addable?: boolean
  onDateClick?: (dateKey: string) => void
  onEventClick?: (event: CalendarEvent) => void
}

/** 일정 구분: 칩은 모두 흰 면 + 1px 선이고, 구분은 작은 점 색으로만 한다(수업 회색, 상담 진회색) */
const TYPE_STYLES: Record<CalendarEvent['type'], { chip: string; dot: string; label: string }> = {
  class: { chip: 'border-line bg-surface text-ink', dot: 'bg-muted', label: '수업' },
  counseling: { chip: 'border-line bg-surface text-ink-strong', dot: 'bg-ink', label: '상담' },
}

function TypeDot({ type }: { type: CalendarEvent['type'] }) {
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_STYLES[type].dot}`} aria-hidden />
}

const weekdayColor = (day: number, fallback: string) =>
  day === 0 ? 'text-[color:var(--sun)]' : day === 6 ? 'text-[color:var(--sat)]' : fallback

function sortEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
}

export function CalendarBoard({
  events,
  studentsById,
  timetable,
  editable = false,
  addable = editable,
  onDateClick,
  onEventClick,
}: CalendarBoardProps) {
  const [view, setView] = useState<ViewMode>('calendar')
  const [range, setRange] = useState<RangeMode>('month')
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  // 날짜 키 → 그날의 일정들 (시간순)
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const ev of events) {
      if (!ev.date) continue
      ;(map[ev.date] ||= []).push(ev)
    }
    for (const k of Object.keys(map)) map[k].sort(sortEvents)
    return map
  }, [events])

  const stepDays = range === 'week' ? 7 : 1
  const goPrev = () => setCursor((c) => (range === 'month' ? addMonths(c, -1) : addDays(c, -stepDays)))
  const goNext = () => setCursor((c) => (range === 'month' ? addMonths(c, 1) : addDays(c, stepDays)))
  const goToday = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    setCursor(d)
  }

  const rangeLabel =
    range === 'month'
      ? formatMonthLabel(cursor)
      : range === 'day'
        ? formatDateLabel(toDateKey(cursor))
        : (() => {
            const days = getWeekDays(cursor)
            return `${toDateKey(days[0]).slice(5)} ~ ${toDateKey(days[6]).slice(5)}`
          })()

  // 테이블 뷰에서 보여줄 날짜 범위
  const rangeDates = useMemo(() => {
    if (range === 'day') return [toDateKey(cursor)]
    if (range === 'week') return getWeekDays(cursor).map(toDateKey)
    const grid = getMonthGrid(cursor.getFullYear(), cursor.getMonth())
    return grid.flat().map(toDateKey)
  }, [range, cursor])

  return (
    <div className="card p-4 sm:p-5">
      {/* 컨트롤 바 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={goPrev} className="btn btn-ghost btn-icon" aria-label="이전">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[8rem] text-center text-base font-semibold tabular-nums text-ink-strong">{rangeLabel}</span>
          <button type="button" onClick={goNext} className="btn btn-ghost btn-icon" aria-label="다음">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={goToday} className="btn btn-secondary btn-sm ml-2">
            오늘
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Segmented
            value={range}
            onChange={(v) => setRange(v as RangeMode)}
            options={[
              { value: 'month', label: '월' },
              { value: 'week', label: '주' },
              { value: 'day', label: '일' },
            ]}
          />
          <Segmented
            value={view}
            onChange={(v) => setView(v as ViewMode)}
            options={[
              { value: 'calendar', label: '캘린더' },
              { value: 'table', label: '테이블' },
            ]}
          />
        </div>
      </div>

      {view === 'table' ? (
        <TableView
          dates={rangeDates}
          eventsByDate={eventsByDate}
          studentsById={studentsById}
          editable={editable}
          onEventClick={onEventClick}
        />
      ) : range === 'month' ? (
        <MonthView
          cursor={cursor}
          eventsByDate={eventsByDate}
          editable={editable}
          addable={addable}
          onDateClick={onDateClick}
          onEventClick={onEventClick}
        />
      ) : range === 'day' ? (
        <DayView
          cursor={cursor}
          eventsByDate={eventsByDate}
          timetable={timetable}
          studentsById={studentsById}
          editable={editable}
          addable={addable}
          onDateClick={onDateClick}
          onEventClick={onEventClick}
        />
      ) : (
        <WeekView
          cursor={cursor}
          eventsByDate={eventsByDate}
          studentsById={studentsById}
          editable={editable}
          addable={addable}
          onDateClick={onDateClick}
          onEventClick={onEventClick}
        />
      )}

      {/* 범례 */}
      <div className="mt-4 flex items-center gap-4 px-1 text-xs text-muted">
        <span className="flex items-center gap-2">
          <TypeDot type="class" /> 수업시간
        </span>
        <span className="flex items-center gap-2">
          <TypeDot type="counseling" /> 상담
        </span>
        {addable && (
          <span className="ml-auto">
            {editable ? '날짜를 누르면 일정을 추가합니다' : '날짜를 누르면 상담을 신청합니다'}
          </span>
        )}
      </div>
    </div>
  )
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`h-7 rounded-md px-3 text-xs font-medium transition-colors duration-150 ${
            value === o.value ? 'bg-raised text-ink-strong' : 'text-muted hover:text-ink-strong'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function MonthView({
  cursor,
  eventsByDate,
  editable,
  addable,
  onDateClick,
  onEventClick,
}: {
  cursor: Date
  eventsByDate: Record<string, CalendarEvent[]>
  editable: boolean
  addable: boolean
  onDateClick?: (dateKey: string) => void
  onEventClick?: (event: CalendarEvent) => void
}) {
  const weeks = getMonthGrid(cursor.getFullYear(), cursor.getMonth())
  const today = new Date()
  const month0 = cursor.getMonth()
  // 칸이 좁아 기본 3건까지만 보여주고, '+n건'을 누른 날짜만 전부 펼친다.
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({})
  const toggleDay = (key: string) =>
    setExpandedDays((cur) => ({ ...cur, [key]: !cur[key] }))

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="grid grid-cols-7 border-b border-line bg-raised">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={w} className={`py-2 text-center text-xs font-medium ${weekdayColor(i, 'text-muted')}`}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((day) => {
          const key = toDateKey(day)
          const inMonth = day.getMonth() === month0
          const isToday = isSameDay(day, today)
          const dayEvents = eventsByDate[key] || []
          return (
            <div
              key={key}
              className={`min-h-[88px] border-b border-r border-line p-1 align-top last:border-r-0 ${
                inMonth ? 'bg-surface' : 'bg-paper'
              }`}
            >
              {/* 상단: 날짜(좌측 코너) + 추가 버튼 */}
              <div className="mb-1 flex items-center gap-1">
                <span
                  className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium tabular-nums ${
                    isToday
                      ? 'bg-accent-ink text-white'
                      : inMonth
                        ? weekdayColor(day.getDay(), 'text-ink-strong')
                        : 'text-faint'
                  }`}
                >
                  {day.getDate()}
                </span>
                {addable && (
                  <button
                    type="button"
                    onClick={() => onDateClick?.(key)}
                    className="grid h-6 w-6 place-items-center rounded-md text-faint transition-colors duration-150 hover:bg-raised hover:text-accent-ink"
                    title="일정 추가"
                    aria-label={`${key} 일정 추가`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {(expandedDays[key] ? dayEvents : dayEvents.slice(0, 3)).map((ev) => (
                  <button
                    key={ev.event_id}
                    type="button"
                    disabled={!editable}
                    onClick={() => editable && onEventClick?.(ev)}
                    className={`flex h-5 w-full items-center gap-1 overflow-hidden rounded border px-1 text-left text-xs ${TYPE_STYLES[ev.type].chip} ${
                      editable ? 'cursor-pointer transition-colors duration-150 hover:bg-raised' : 'cursor-default'
                    }`}
                    title={`${ev.start_time} ${ev.title}`}
                  >
                    <TypeDot type={ev.type} />
                    {ev.start_time && <span className="shrink-0 font-medium tabular-nums">{ev.start_time.slice(0, 5)}</span>}
                    {ev.requester_role === 'parent' && (
                      <span title="학부모 신청" className="shrink-0 text-muted">
                        <Users className="h-3 w-3" />
                      </span>
                    )}
                    <span className="min-w-0 truncate">{ev.title || TYPE_STYLES[ev.type].label}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <button
                    type="button"
                    onClick={() => toggleDay(key)}
                    className="flex h-5 w-full items-center gap-1 rounded px-1 text-left text-xs font-medium text-muted hover:bg-raised hover:text-ink-strong"
                  >
                    {expandedDays[key] ? '접기' : `+${dayEvents.length - 3}건`}
                    {expandedDays[key] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({
  cursor,
  eventsByDate,
  studentsById,
  editable,
  addable,
  onDateClick,
  onEventClick,
}: {
  cursor: Date
  eventsByDate: Record<string, CalendarEvent[]>
  studentsById?: Record<string, CalendarStudentInfo>
  editable: boolean
  addable: boolean
  onDateClick?: (dateKey: string) => void
  onEventClick?: (event: CalendarEvent) => void
}) {
  const days = getWeekDays(startOfWeek(cursor))
  const today = new Date()
  return (
    <div className="space-y-2">
      {days.map((day) => {
        const key = toDateKey(day)
        const dayEvents = eventsByDate[key] || []
        const isToday = isSameDay(day, today)
        return (
          <div key={key} className="overflow-hidden rounded-lg border border-line">
            <div className="flex h-9 items-center justify-between border-b border-line bg-raised px-3">
              <span className={`text-xs font-medium tabular-nums ${weekdayColor(day.getDay(), 'text-ink-strong')}`}>
                {day.getMonth() + 1}/{day.getDate()} ({WEEKDAY_LABELS[day.getDay()]})
                {isToday && <span className="ml-2 text-accent-ink">오늘</span>}
              </span>
              {addable && (
                <button type="button" onClick={() => onDateClick?.(key)} className="btn btn-ghost btn-sm">
                  <Plus className="h-4 w-4" /> 추가
                </button>
              )}
            </div>
            <div className="divide-y divide-line">
              {dayEvents.length === 0 ? (
                <p className="px-3 py-2 text-xs text-faint">일정 없음</p>
              ) : (
                dayEvents.map((ev) => (
                  <EventRow
                    key={ev.event_id}
                    event={ev}
                    studentsById={studentsById}
                    editable={editable}
                    onEventClick={onEventClick}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function eventOverlapsPeriod(ev: CalendarEvent, p: TimetablePeriod): boolean {
  const evStart = timeToMinutes(ev.start_time)
  const evEnd = Math.max(timeToMinutes(ev.end_time || ev.start_time), evStart + 1)
  const pStart = timeToMinutes(p.start_time)
  const pEnd = timeToMinutes(p.end_time || p.start_time)
  return evStart < pEnd && evEnd > pStart
}

function DayView({
  cursor,
  eventsByDate,
  timetable,
  studentsById,
  editable,
  addable,
  onDateClick,
  onEventClick,
}: {
  cursor: Date
  eventsByDate: Record<string, CalendarEvent[]>
  timetable?: CounselingTimetable | null
  studentsById?: Record<string, CalendarStudentInfo>
  editable: boolean
  addable: boolean
  onDateClick?: (dateKey: string) => void
  onEventClick?: (event: CalendarEvent) => void
}) {
  const key = toDateKey(cursor)
  const dayEvents = eventsByDate[key] || []
  const periods = timetable?.periods || []

  // 어떤 교시에도 걸치지 않는 일정(교시 외)
  const matched = new Set<string>()
  for (const p of periods) {
    for (const ev of dayEvents) {
      if (eventOverlapsPeriod(ev, p)) matched.add(ev.event_id)
    }
  }
  const otherEvents = dayEvents.filter((ev) => !matched.has(ev.event_id))

  return (
    <div>
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-sm font-semibold tabular-nums text-ink-strong">{formatDateLabel(key)}</span>
        {addable && (
          <button type="button" onClick={() => onDateClick?.(key)} className="btn btn-secondary btn-sm">
            <Plus className="h-4 w-4" /> 일정 추가
          </button>
        )}
      </div>

      {periods.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line py-6 text-center text-xs text-muted">
          교시 타임테이블을 먼저 저장하면 교시별로 일정을 볼 수 있습니다
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          {periods.map((p) => {
            const inPeriod = dayEvents.filter((ev) => eventOverlapsPeriod(ev, p))
            return (
              <div key={p.id} className="flex border-b border-line last:border-b-0">
                <div className="w-24 shrink-0 border-r border-line bg-raised px-3 py-2">
                  <p className="text-xs font-medium text-ink">{p.label}</p>
                  <p className="text-xs tabular-nums text-muted">
                    {p.start_time}~{p.end_time}
                  </p>
                </div>
                <div className="min-w-0 flex-1 divide-y divide-line">
                  {inPeriod.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-faint">-</p>
                  ) : (
                    inPeriod.map((ev) => (
                      <EventRow
                        key={ev.event_id}
                        event={ev}
                        studentsById={studentsById}
                        editable={editable}
                        onEventClick={onEventClick}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {otherEvents.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 px-1 text-xs font-medium text-muted">교시 외 일정</p>
          <div className="divide-y divide-line rounded-lg border border-line">
            {otherEvents.map((ev) => (
              <EventRow
                key={ev.event_id}
                event={ev}
                studentsById={studentsById}
                editable={editable}
                onEventClick={onEventClick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TableView({
  dates,
  eventsByDate,
  studentsById,
  editable,
  onEventClick,
}: {
  dates: string[]
  eventsByDate: Record<string, CalendarEvent[]>
  studentsById?: Record<string, CalendarStudentInfo>
  editable: boolean
  onEventClick?: (event: CalendarEvent) => void
}) {
  const rows = dates.flatMap((key) => eventsByDate[key] || [])
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">이 기간에 등록된 일정이 없습니다</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-left text-xs">
        <thead className="bg-raised text-muted">
          <tr>
            <th className="h-9 whitespace-nowrap px-3 font-medium">날짜</th>
            <th className="h-9 whitespace-nowrap px-3 font-medium">시간</th>
            <th className="h-9 whitespace-nowrap px-3 font-medium">구분</th>
            <th className="h-9 px-3 font-medium">내용</th>
            <th className="h-9 whitespace-nowrap px-3 font-medium">장소</th>
            <th className="h-9 px-3 font-medium">대상</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((ev) => (
            <tr
              key={ev.event_id}
              className={editable ? 'cursor-pointer transition-colors duration-150 hover:bg-raised' : ''}
              onClick={() => editable && onEventClick?.(ev)}
            >
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink">{formatDateLabel(ev.date)}</td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink">
                {formatTimeRange(ev.start_time, ev.end_time)}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <span className="inline-flex items-center gap-2 text-ink">
                  <TypeDot type={ev.type} />
                  {TYPE_STYLES[ev.type].label}
                </span>
              </td>
              <td className="px-3 py-2 text-ink">
                <span className="font-medium text-ink-strong">{ev.title || TYPE_STYLES[ev.type].label}</span>
                {ev.content && <span className="block text-xs text-muted">{ev.content}</span>}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-muted">{ev.location || '-'}</td>
              <td className="px-3 py-2 text-muted">
                {ev.type === 'class' ? (
                  <span className="text-ink">담임</span>
                ) : ev.student_ids.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {ev.student_ids.map((id) => (
                      <StudentChip
                        key={id}
                        id={id}
                        info={studentsById?.[id]}
                        byParent={ev.requester_role === 'parent'}
                      />
                    ))}
                  </div>
                ) : (
                  '-'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 사진 값이 data: URI가 아니면 base64로 간주해 접두사를 붙인다(다른 화면과 동일 규칙). */
function photoSrc(photo?: string): string {
  if (!photo) return ''
  return photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`
}

/**
 * 상담 대상 학생 칩 (사진 + 이름). 사진이 없으면 이름 첫 글자 아바타로 대체.
 * byParent면 학부모가 자녀 이름으로 신청한 상담이므로 '학부모' 배지를 덧붙인다.
 */
function StudentChip({
  id,
  info,
  byParent,
}: {
  id: string
  info?: CalendarStudentInfo
  byParent?: boolean
}) {
  const src = photoSrc(info?.photo_data)
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-md border border-line pl-0.5 pr-2 text-xs text-ink">
      {src ? (
        <img src={src} alt="" className="h-5 w-5 rounded-full object-cover" />
      ) : (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-raised text-xs text-muted">
          {(info?.name || id).slice(0, 1)}
        </span>
      )}
      {info?.name || id}
      {byParent && <span className="text-muted">· 학부모</span>}
    </span>
  )
}

function EventRow({
  event: ev,
  studentsById,
  editable,
  onEventClick,
}: {
  event: CalendarEvent
  studentsById?: Record<string, CalendarStudentInfo>
  editable: boolean
  onEventClick?: (event: CalendarEvent) => void
}) {
  return (
    <div
      role={editable ? 'button' : undefined}
      onClick={() => editable && onEventClick?.(ev)}
      className={`flex items-start gap-2 px-3 py-2 ${editable ? 'cursor-pointer transition-colors duration-150 hover:bg-raised' : ''}`}
    >
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TYPE_STYLES[ev.type].dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium tabular-nums text-ink-strong">
            {formatTimeRange(ev.start_time, ev.end_time)}
          </span>
          <span className="truncate text-sm text-ink">{ev.title || TYPE_STYLES[ev.type].label}</span>
        </div>
        {ev.location && (
          <p className="flex items-center gap-1 text-xs text-muted">
            <MapPin className="h-4 w-4 shrink-0" />
            {ev.location}
          </p>
        )}
        {ev.content && <p className="text-xs text-muted">{ev.content}</p>}
        {ev.type === 'class' && <p className="mt-1 text-xs text-muted">담임</p>}
        {ev.type === 'counseling' && ev.student_ids.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {ev.student_ids.map((id) => (
              <StudentChip
                key={id}
                id={id}
                info={studentsById?.[id]}
                byParent={ev.requester_role === 'parent'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
