import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { authStudent, getCalendarEvents, getCounselingTimetable } from '@/api/api'
import type { CalendarEvent, CounselingTimetable } from '@/types'
import { CalendarBoard, type CalendarStudentInfo } from '@/components/calendar/CalendarBoard'
import { formatDateLabel, formatTimeRange, toDateKey } from '@/lib/calendar'
import { CalendarEventModal } from '@/components/calendar/CalendarEventModal'

const LOGIN_KEY = 'homeroom_login'
const TITLE = '학급 일정 | 상담 캘린더'
const DESC = '수업시간과 상담 일정을 확인하고, 빈 시간에 상담을 신청하세요.'

interface Requester {
  student_id: string
  auth_code: string
  name?: string
  photo_data?: string
}

/**
 * 학생에게 공유하는 캘린더.
 * 열람은 로그인 없이, 상담 신청은 학번+개인코드 로그인 후에만 가능하다.
 *
 * 개인정보 보호: 공개 링크이므로 상담 카드의 대상 학생 이름과 상담 내용은 감춘다.
 * 단, 로그인한 본인이 대상인 상담은 본인 정보이므로 내용과 대상(본인)을 그대로 보여준다.
 * (본인 상담 목록은 /student/counseling 에서도 확인할 수 있다.)
 */
function maskForPublic(events: CalendarEvent[], myId?: string): CalendarEvent[] {
  return events.map((ev) => {
    if (ev.type !== 'counseling') return ev
    const mine = !!myId && ev.student_ids.indexOf(myId) >= 0
    if (mine) return { ...ev, title: ev.title || '상담', student_ids: [myId as string] }
    return { ...ev, title: ev.title || '상담', content: '', student_ids: [] }
  })
}

export function CalendarSharedPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [timetable, setTimetable] = useState<CounselingTimetable | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // 상담 신청용 로그인 상태
  const [me, setMe] = useState<Requester | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [studentId, setStudentId] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [authError, setAuthError] = useState('')
  const [authing, setAuthing] = useState(false)

  // 신청 모달(새 신청 / 내 신청 수정) + 안내 메시지
  const [requestDate, setRequestDate] = useState<string | null>(null)
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)
  const [notice, setNotice] = useState('')

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

  // 저장된 학생 로그인이 있으면 자동으로 신청 가능 상태로 만든다.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const raw = localStorage.getItem(LOGIN_KEY)
        if (!raw) return
        const p = JSON.parse(raw) as { student_id?: string; auth_code?: string }
        if (!p.student_id || !p.auth_code) return
        const res = await authStudent(p.student_id, p.auth_code)
        if (cancelled || !res.success || !res.data) return
        setMe({
          student_id: p.student_id,
          auth_code: p.auth_code,
          name: res.data.name,
          photo_data: res.data.photo_data,
        })
        setStudentId(p.student_id)
      } catch {
        // 저장된 로그인이 깨졌으면 그냥 비로그인 상태로 둔다.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const publicEvents = useMemo(() => maskForPublic(events, me?.student_id), [events, me])

  // 내 상담 목록: 내가 신청한 것 + 선생님이 나를 대상으로 등록해 준 것 모두.
  // 수정·취소는 내가 신청한 건(created_by === 나)만 가능하다 — 서버도 같은 규칙으로 막는다.
  const myCounselings = useMemo(() => {
    if (!me) return []
    return events
      .filter(
        (ev) =>
          ev.type === 'counseling' &&
          (ev.created_by === me.student_id || ev.student_ids.indexOf(me.student_id) >= 0)
      )
      .sort((a, b) =>
        a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date < b.date ? -1 : 1
      )
  }, [events, me])

  // 캘린더에 이름·사진을 띄울 수 있는 학생은 로그인한 본인뿐이다.
  const studentsById = useMemo<Record<string, CalendarStudentInfo> | undefined>(
    () =>
      me
        ? { [me.student_id]: { name: me.name || me.student_id, photo_data: me.photo_data } }
        : undefined,
    [me]
  )

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId.trim() || !authCode.trim()) {
      setAuthError('학번과 개인코드를 입력해 주세요.')
      return
    }
    setAuthing(true)
    setAuthError('')
    const res = await authStudent(studentId.trim(), authCode.trim())
    setAuthing(false)
    if (res.success && res.data) {
      setMe({
        student_id: studentId.trim(),
        auth_code: authCode.trim(),
        name: res.data.name,
        photo_data: res.data.photo_data,
      })
      setShowLogin(false)
      setAuthCode('')
      setNotice('로그인했어요. 신청할 날짜의 + 버튼을 눌러 상담을 신청하세요.')
      try {
        localStorage.setItem(
          LOGIN_KEY,
          JSON.stringify({ student_id: studentId.trim(), auth_code: authCode.trim() })
        )
      } catch {
        // 저장 실패해도 이번 세션에서는 신청할 수 있다.
      }
    } else {
      setAuthError(res.error || '인증에 실패했습니다.')
    }
  }

  const handleDateClick = (dateKey: string) => {
    setNotice('')
    if (!me) {
      setShowLogin(true)
      return
    }
    // 서버도 막지만, 눌러 보기 전에 알려 준다.
    if (dateKey < toDateKey(new Date())) {
      setNotice('지난 날짜에는 상담을 신청할 수 없어요.')
      return
    }
    setRequestDate(dateKey)
  }

  const closeModal = () => {
    setRequestDate(null)
    setEditEvent(null)
  }

  /** 신청·수정·취소가 끝난 뒤: 목록을 새로 받아 무엇이 일어났는지 알려 준다. */
  const handleSaved = async () => {
    const editedId = editEvent?.event_id
    closeModal()
    const res = await getCalendarEvents()
    const list = res.success && res.data ? res.data : events
    setEvents(list)
    if (!editedId) setNotice('상담 신청이 등록되었어요. 캘린더에서 확인할 수 있어요.')
    else if (list.some((ev) => ev.event_id === editedId)) setNotice('상담 신청을 수정했어요.')
    else setNotice('상담 신청을 취소했어요.')
  }

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

        {/* 상담 신청 로그인 바 */}
        <div className="mb-3 rounded-2xl border border-rose-100 bg-white/80 p-3 shadow-sm">
          {me ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">
                🙋 {me.name || me.student_id}
                <span className="ml-1 text-xs font-normal text-gray-400">({me.student_id})</span>
              </span>
              <span className="text-xs text-gray-500">
                날짜의 <b>+</b> 버튼을 눌러 상담을 신청할 수 있어요.
              </span>
              <button
                type="button"
                onClick={() => {
                  setMe(null)
                  setNotice('')
                }}
                className="ml-auto rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-50"
              >
                신청 로그아웃
              </button>
            </div>
          ) : showLogin ? (
            <form onSubmit={handleLogin} className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">
                상담을 신청하려면 학번과 개인코드로 로그인하세요.
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="학번"
                  className="w-28 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <input
                  type="password"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  placeholder="개인코드"
                  className="w-32 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={authing}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
                >
                  {authing ? '확인 중...' : '로그인'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogin(false)
                    setAuthError('')
                  }}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
              {authError && <p className="text-xs text-red-600">{authError}</p>}
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">
                비어 있는 시간에 선생님과의 상담을 신청할 수 있어요.
              </span>
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="ml-auto rounded-xl bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
              >
                🙋 상담 신청하기
              </button>
            </div>
          )}
        </div>

        {/* 내 상담 일정 — 내가 신청한 건은 눌러서 수정·취소할 수 있다 */}
        {me && (
          <div className="mb-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="mb-2 px-1 text-xs font-bold text-gray-700">
              🙋 내 상담 일정
              {myCounselings.length > 0 && (
                <span className="ml-1 font-normal text-gray-400">{myCounselings.length}건</span>
              )}
            </p>
            {myCounselings.length === 0 ? (
              <p className="px-1 py-3 text-center text-xs text-gray-400">
                아직 상담 일정이 없어요. 날짜의 + 버튼을 눌러 신청해 보세요.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {myCounselings.map((ev) => {
                  const past = ev.date < toDateKey(new Date())
                  // 내가 신청한 건만 수정·취소할 수 있다. 선생님이 잡아 준 상담은 읽기 전용.
                  const mine = ev.created_by === me.student_id
                  const rowClass = `flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left ${
                    past
                      ? 'border-gray-100 bg-gray-50/70'
                      : mine
                        ? 'border-rose-100 bg-rose-50/50'
                        : 'border-sky-100 bg-sky-50/50'
                  }`
                  const body = (
                    <>
                      <span
                        className={`shrink-0 text-xs font-bold ${past ? 'text-gray-400' : 'text-gray-800'}`}
                      >
                        {formatDateLabel(ev.date)}
                      </span>
                      <span
                        className={`shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium ${
                          past ? 'text-gray-400' : mine ? 'text-rose-600' : 'text-sky-600'
                        }`}
                      >
                        {formatTimeRange(ev.start_time, ev.end_time)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-gray-500">
                        {ev.title || '상담'}
                        {ev.location && ` · ${ev.location}`}
                      </span>
                      <span className="shrink-0 text-[11px] text-gray-400">
                        {!mine ? '선생님 등록' : past ? '지난 상담' : '수정 ›'}
                      </span>
                    </>
                  )
                  return (
                    <li key={ev.event_id}>
                      {mine ? (
                        <button
                          type="button"
                          onClick={() => {
                            setNotice('')
                            setEditEvent(ev)
                          }}
                          className={`${rowClass} transition-colors hover:brightness-95`}
                        >
                          {body}
                        </button>
                      ) : (
                        <div className={rowClass}>{body}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {notice && (
          <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-700">
            {notice}
          </p>
        )}

        {loading ? (
          <p className="py-16 text-center text-sm text-gray-500">불러오는 중...</p>
        ) : err ? (
          <p className="py-16 text-center text-sm text-red-600">{err}</p>
        ) : (
          <>
            <CalendarBoard
              events={publicEvents}
              studentsById={studentsById}
              timetable={timetable}
              addable={!!me}
              onDateClick={handleDateClick}
            />
            <p className="mt-3 text-center text-[11px] text-gray-400">
              다른 사람의 상담 대상과 상세 내용은 개인정보 보호를 위해 표시되지 않습니다. 내 상담
              일정은{' '}
              <Link to="/student/counseling" className="underline hover:text-gray-600">
                내 상담 일정
              </Link>{' '}
              에서 확인하세요.
            </p>
          </>
        )}
      </div>

      {me && (requestDate || editEvent) && (
        <CalendarEventModal
          dateKey={editEvent ? editEvent.date : (requestDate as string)}
          existing={editEvent}
          timetable={timetable}
          requester={me}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
