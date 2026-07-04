import { useMemo, useState } from 'react'
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
  /** 교사 화면에서만 true: 날짜 클릭으로 추가, 일정 클릭으로 편집 */
  editable?: boolean
  onDateClick?: (dateKey: string) => void
  onEventClick?: (event: CalendarEvent) => void
}

const TYPE_STYLES: Record<CalendarEvent['type'], { chip: string; dot: string; label: string }> = {
  class: { chip: 'bg-sky-100 text-sky-800 border-sky-200', dot: 'bg-sky-500', label: '수업' },
  counseling: { chip: 'bg-rose-100 text-rose-800 border-rose-200', dot: 'bg-rose-500', label: '상담' },
}

function sortEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
}

export function CalendarBoard({
  events,
  studentsById,
  timetable,
  editable = false,
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
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
      {/* 컨트롤 바 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="이전"
          >
            ‹
          </button>
          <span className="min-w-[8rem] text-center text-sm font-bold text-gray-900">{rangeLabel}</span>
          <button
            type="button"
            onClick={goNext}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="다음"
          >
            ›
          </button>
          <button
            type="button"
            onClick={goToday}
            className="ml-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
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
          onDateClick={onDateClick}
          onEventClick={onEventClick}
        />
      ) : (
        <WeekView
          cursor={cursor}
          eventsByDate={eventsByDate}
          studentsById={studentsById}
          editable={editable}
          onDateClick={onDateClick}
          onEventClick={onEventClick}
        />
      )}

      {/* 범례 */}
      <div className="mt-3 flex items-center gap-4 px-1 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> 수업시간
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> 상담
        </span>
        {editable && <span className="ml-auto">날짜를 누르면 일정을 추가할 수 있어요</span>}
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
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
  onDateClick,
  onEventClick,
}: {
  cursor: Date
  eventsByDate: Record<string, CalendarEvent[]>
  editable: boolean
  onDateClick?: (dateKey: string) => void
  onEventClick?: (event: CalendarEvent) => void
}) {
  const weeks = getMonthGrid(cursor.getFullYear(), cursor.getMonth())
  const today = new Date()
  const month0 = cursor.getMonth()

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100">
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
        {WEEKDAY_LABELS.map((w, i) => (
          <div
            key={w}
            className={`py-1.5 text-center text-[11px] font-semibold ${
              i === 0 ? 'text-rose-500' : i === 6 ? 'text-sky-500' : 'text-gray-500'
            }`}
          >
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
              className={`min-h-[84px] border-b border-r border-gray-100 p-1 align-top last:border-r-0 ${
                inMonth ? 'bg-white' : 'bg-gray-50/60'
              }`}
            >
              {/* 상단: 날짜(좌측 코너) + 추가 아이콘 */}
              <div className="mb-0.5 flex items-center gap-1">
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold ${
                    isToday
                      ? 'bg-sky-600 text-white'
                      : day.getDay() === 0
                        ? 'text-rose-500'
                        : day.getDay() === 6
                          ? 'text-sky-500'
                          : inMonth
                            ? 'text-gray-700'
                            : 'text-gray-400'
                  }`}
                >
                  {day.getDate()}
                </span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => onDateClick?.(key)}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-sky-100 hover:text-sky-600"
                    title="일정 추가"
                    aria-label={`${key} 일정 추가`}
                  >
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.event_id}
                    type="button"
                    disabled={!editable}
                    onClick={() => editable && onEventClick?.(ev)}
                    className={`block w-full truncate rounded border px-1 py-0.5 text-left text-[10px] leading-tight ${TYPE_STYLES[ev.type].chip} ${
                      editable ? 'cursor-pointer hover:brightness-95' : 'cursor-default'
                    }`}
                    title={`${ev.start_time} ${ev.title}`}
                  >
                    {ev.start_time && <span className="font-semibold">{ev.start_time.slice(0, 5)} </span>}
                    {ev.title || TYPE_STYLES[ev.type].label}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <span className="block px-1 text-[10px] text-gray-400">+{dayEvents.length - 3}건</span>
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
  onDateClick,
  onEventClick,
}: {
  cursor: Date
  eventsByDate: Record<string, CalendarEvent[]>
  studentsById?: Record<string, CalendarStudentInfo>
  editable: boolean
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
          <div key={key} className="rounded-xl border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-1.5">
              <span
                className={`text-xs font-semibold ${
                  day.getDay() === 0 ? 'text-rose-500' : day.getDay() === 6 ? 'text-sky-500' : 'text-gray-700'
                }`}
              >
                {day.getMonth() + 1}/{day.getDate()} ({WEEKDAY_LABELS[day.getDay()]})
                {isToday && <span className="ml-1 rounded bg-sky-600 px-1 text-[10px] text-white">오늘</span>}
              </span>
              {editable && (
                <button
                  type="button"
                  onClick={() => onDateClick?.(key)}
                  className="rounded-md px-2 py-0.5 text-xs font-medium text-sky-600 hover:bg-sky-50"
                >
                  + 추가
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-50">
              {dayEvents.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-300">일정 없음</p>
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
  onDateClick,
  onEventClick,
}: {
  cursor: Date
  eventsByDate: Record<string, CalendarEvent[]>
  timetable?: CounselingTimetable | null
  studentsById?: Record<string, CalendarStudentInfo>
  editable: boolean
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
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold text-gray-700">{formatDateLabel(key)}</span>
        {editable && (
          <button
            type="button"
            onClick={() => onDateClick?.(key)}
            className="rounded-lg bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700"
          >
            + 일정 추가
          </button>
        )}
      </div>

      {periods.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
          교시 타임테이블을 먼저 저장하면 교시별로 일정을 볼 수 있어요.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100">
          {periods.map((p) => {
            const inPeriod = dayEvents.filter((ev) => eventOverlapsPeriod(ev, p))
            return (
              <div key={p.id} className="flex border-b border-gray-100 last:border-b-0">
                <div className="w-24 shrink-0 border-r border-gray-100 bg-gray-50 px-2 py-2">
                  <p className="text-xs font-semibold text-gray-700">{p.label}</p>
                  <p className="text-[10px] text-gray-400">
                    {p.start_time}~{p.end_time}
                  </p>
                </div>
                <div className="min-w-0 flex-1 divide-y divide-gray-50">
                  {inPeriod.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-gray-300">-</p>
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
        <div className="mt-3">
          <p className="mb-1 px-1 text-xs font-semibold text-gray-400">교시 외 일정</p>
          <div className="divide-y divide-gray-50 rounded-xl border border-gray-100">
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
    return <p className="py-10 text-center text-sm text-gray-400">이 기간에 등록된 일정이 없습니다.</p>
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-3 py-2 font-semibold">날짜</th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold">시간</th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold">구분</th>
            <th className="px-3 py-2 font-semibold">내용</th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold">장소</th>
            <th className="px-3 py-2 font-semibold">대상</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((ev) => (
            <tr
              key={ev.event_id}
              className={editable ? 'cursor-pointer hover:bg-sky-50/50' : ''}
              onClick={() => editable && onEventClick?.(ev)}
            >
              <td className="whitespace-nowrap px-3 py-2 text-gray-700">{formatDateLabel(ev.date)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                {formatTimeRange(ev.start_time, ev.end_time)}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${TYPE_STYLES[ev.type].chip}`}>
                  {TYPE_STYLES[ev.type].label}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-700">
                <span className="font-medium">{ev.title || TYPE_STYLES[ev.type].label}</span>
                {ev.content && <span className="block text-[11px] text-gray-400">{ev.content}</span>}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-gray-500">{ev.location || '-'}</td>
              <td className="px-3 py-2 text-gray-500">
                {ev.type === 'class' ? (
                  <span className="inline-flex items-center gap-1">
                    <img
                      src="/game/teacher-love.png"
                      alt="담임샘"
                      className="h-4 w-4 rounded-full object-cover"
                    />
                    담임샘
                  </span>
                ) : ev.student_ids.length > 0 ? (
                  ev.student_ids.map((id) => studentsById?.[id]?.name || id).join(', ')
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
      className={`flex items-start gap-2 px-3 py-2 ${editable ? 'cursor-pointer hover:bg-sky-50/50' : ''}`}
    >
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${TYPE_STYLES[ev.type].dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-800">
            {formatTimeRange(ev.start_time, ev.end_time)}
          </span>
          <span className="truncate text-xs text-gray-700">{ev.title || TYPE_STYLES[ev.type].label}</span>
        </div>
        {ev.location && <p className="text-[11px] text-gray-400">📍 {ev.location}</p>}
        {ev.content && <p className="text-[11px] text-gray-500">{ev.content}</p>}
        {ev.type === 'class' && (
          <div className="mt-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 py-0.5 pl-0.5 pr-2 text-[10px] text-sky-700">
              <img
                src="/game/teacher-love.png"
                alt="담임샘"
                className="h-4 w-4 rounded-full object-cover"
              />
              담임샘
            </span>
          </div>
        )}
        {ev.type === 'counseling' && ev.student_ids.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {ev.student_ids.map((id) => {
              const s = studentsById?.[id]
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-0.5 pr-2 text-[10px] text-gray-600"
                >
                  {s?.photo_data ? (
                    <img src={s.photo_data} alt="" className="h-4 w-4 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-300 text-[8px] text-white">
                      {(s?.name || id).slice(0, 1)}
                    </span>
                  )}
                  {s?.name || id}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
