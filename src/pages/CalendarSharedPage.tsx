import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { getCalendarEvents, getCounselingTimetable } from '@/api/api'
import type { CalendarEvent, CounselingTimetable } from '@/types'
import { CalendarBoard } from '@/components/calendar/CalendarBoard'

const TITLE = '학급 일정 | 상담 캘린더'
const DESC = '수업시간과 상담 일정을 주/월 단위로 확인하세요.'

/**
 * 학생에게 공유하는 읽기 전용 캘린더.
 * 개인정보 보호: 공개 링크이므로 상담 카드의 대상 학생 이름과 상담 내용은 감춘다.
 * (본인 상담 상세는 로그인이 필요한 /student/counseling 에서만 볼 수 있다.)
 */
function maskForPublic(events: CalendarEvent[]): CalendarEvent[] {
  return events.map((ev) =>
    ev.type === 'counseling'
      ? { ...ev, title: ev.title || '상담', content: '', student_ids: [] }
      : ev
  )
}

export function CalendarSharedPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [timetable, setTimetable] = useState<CounselingTimetable | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [eventsRes, timetableRes] = await Promise.all([
        getCalendarEvents(),
        getCounselingTimetable(),
      ])
      if (cancelled) return
      setLoading(false)
      if (eventsRes.success && eventsRes.data) setEvents(eventsRes.data)
      else setErr(eventsRes.error || '일정을 불러오지 못했습니다.')
      if (timetableRes.success && timetableRes.data) setTimetable(timetableRes.data)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const publicEvents = useMemo(() => maskForPublic(events), [events])

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white px-4 py-6">
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESC} />
      </Helmet>
      <div className="mx-auto max-w-3xl">
        <header className="mb-4 text-center">
          <p className="text-3xl">🗓️</p>
          <h1 className="mt-1 text-xl font-bold text-gray-900">학급 일정</h1>
          <p className="mt-1 text-xs text-gray-500">
            수업시간과 상담 일정을 주/월, 캘린더/테이블로 볼 수 있어요.
          </p>
        </header>

        {loading ? (
          <p className="py-16 text-center text-sm text-gray-500">불러오는 중...</p>
        ) : err ? (
          <p className="py-16 text-center text-sm text-red-600">{err}</p>
        ) : (
          <>
            <CalendarBoard events={publicEvents} timetable={timetable} />
            <p className="mt-3 text-center text-[11px] text-gray-400">
              상담 대상과 상세 내용은 개인정보 보호를 위해 표시되지 않습니다. 내 상담 일정은 학생
              대시보드에서 로그인 후 확인하세요.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
