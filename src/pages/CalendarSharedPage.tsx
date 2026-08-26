import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import {
  authStudent,
  getCalendarEvents,
  getCounselingRoster,
  getCounselingTimetable,
} from '@/api/api'
import type { CalendarEvent, CounselingRosterStudent, CounselingTimetable } from '@/types'
import { CalendarBoard, type CalendarStudentInfo } from '@/components/calendar/CalendarBoard'
import { formatDateLabel, formatTimeRange, toDateKey } from '@/lib/calendar'
import {
  CalendarEventModal,
  type CalendarRequester,
  type CalendarSaveResult,
} from '@/components/calendar/CalendarEventModal'

const LOGIN_KEY = 'homeroom_login'
/** 학부모가 신청한 상담의 수정·취소 열쇠. 신청한 브라우저에만 남는다. */
const PARENT_TICKETS_KEY = 'homeroom_parent_counseling'
/** 학부모가 마지막으로 고른 자녀 — 다시 들어왔을 때 자동 선택 */
const PARENT_CHILD_KEY = 'homeroom_parent_child'
const TITLE = '학급 일정 | 상담 캘린더'
const DESC = '수업시간과 상담 일정을 확인하고, 빈 시간에 상담을 신청하세요.'

type Role = 'student' | 'parent'

interface Requester {
  student_id: string
  auth_code: string
  name?: string
  photo_data?: string
}

/** 학부모가 신청한 상담 1건 — 이 브라우저에서만 수정·취소할 수 있다 */
interface ParentTicket {
  event_id: string
  request_token: string
  student_id: string
}

function readParentTickets(): ParentTicket[] {
  try {
    const raw = localStorage.getItem(PARENT_TICKETS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as ParentTicket[]
    if (!Array.isArray(list)) return []
    return list.filter((t) => t && t.event_id && t.request_token)
  } catch {
    return []
  }
}

function writeParentTickets(list: ParentTicket[]) {
  try {
    localStorage.setItem(PARENT_TICKETS_KEY, JSON.stringify(list))
  } catch {
    // 저장 실패해도 이번 세션에서는 수정·취소할 수 있다.
  }
}

/**
 * 학생·학부모에게 공유하는 캘린더.
 * 열람은 로그인 없이, 신청은 학생(학번+개인코드) 또는 학부모(자녀 선택)로 한다.
 *
 * 개인정보 보호: 공개 링크이므로 상담 카드의 대상 학생 이름과 상담 내용은 감춘다.
 * 단, 본인(로그인한 학생) 상담과 이 브라우저에서 신청한 학부모 상담은 그대로 보여준다.
 * (본인 상담 목록은 /student/counseling 에서도 확인할 수 있다.)
 */
function maskForPublic(
  events: CalendarEvent[],
  myId: string | undefined,
  myEventIds: Set<string>
): CalendarEvent[] {
  return events.map((ev) => {
    if (ev.type !== 'counseling') return ev
    const mine = !!myId && ev.student_ids.indexOf(myId) >= 0
    if (mine) return { ...ev, title: ev.title || '상담', student_ids: [myId as string] }
    if (myEventIds.has(ev.event_id)) return { ...ev, title: ev.title || '상담' }
    // 남의 상담은 '누가 신청했는지'(학부모 여부)도 알릴 필요가 없다.
    return { ...ev, title: ev.title || '상담', content: '', student_ids: [], requester_role: '' }
  })
}

export function CalendarSharedPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [timetable, setTimetable] = useState<CounselingTimetable | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // 신청 주체: 학생(로그인) / 학부모(자녀 선택)
  const [role, setRole] = useState<Role | null>(null)

  // 학생 로그인 상태
  const [me, setMe] = useState<Requester | null>(null)
  const [studentId, setStudentId] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [authError, setAuthError] = useState('')
  const [authing, setAuthing] = useState(false)

  // 학부모: 자녀 선택 + 이 브라우저의 신청 목록
  const [roster, setRoster] = useState<CounselingRosterStudent[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)
  /** 명단을 한 번이라도 받아 봤는지. 빈 반·오류일 때 재요청이 반복되지 않게 막는다. */
  const [rosterFetched, setRosterFetched] = useState(false)
  const [rosterError, setRosterError] = useState('')
  const [child, setChild] = useState<CounselingRosterStudent | null>(null)
  const [tickets, setTickets] = useState<ParentTicket[]>(() => readParentTickets())

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

  // 저장된 상태로 첫 화면을 정한다.
  // 학생 로그인이 남아 있으면 학생 모드로, 학부모로 쓴 적 있으면 학부모 모드로 이어 준다.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const raw = localStorage.getItem(LOGIN_KEY)
        if (raw) {
          const p = JSON.parse(raw) as { student_id?: string; auth_code?: string }
          if (p.student_id && p.auth_code) {
            const res = await authStudent(p.student_id, p.auth_code)
            if (cancelled) return
            if (res.success && res.data) {
              setMe({
                student_id: p.student_id,
                auth_code: p.auth_code,
                name: res.data.name,
                photo_data: res.data.photo_data,
              })
              setStudentId(p.student_id)
              setRole('student')
              return
            }
          }
        }
      } catch {
        // 저장된 로그인이 깨졌으면 그냥 역할 선택 화면으로 둔다.
      }
      if (cancelled) return
      try {
        if (localStorage.getItem(PARENT_CHILD_KEY)) setRole('parent')
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 학부모 모드가 되면 자녀 선택용 명단을 불러온다.
  useEffect(() => {
    if (role !== 'parent' || rosterFetched || rosterLoading) return
    let cancelled = false
    ;(async () => {
      setRosterLoading(true)
      setRosterError('')
      const res = await getCounselingRoster()
      if (cancelled) return
      setRosterLoading(false)
      setRosterFetched(true)
      if (res.success && res.data) {
        setRoster(res.data)
        try {
          const savedId = localStorage.getItem(PARENT_CHILD_KEY)
          const found = savedId ? res.data.find((s) => s.student_id === savedId) : undefined
          if (found) setChild(found)
        } catch {
          // ignore
        }
      } else {
        setRosterError(res.error || '학생 명단을 불러오지 못했습니다.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [role, rosterFetched, rosterLoading])

  const isParent = role === 'parent'
  /** 이 브라우저에서 학부모로 신청한 일정 id */
  const myTicketIds = useMemo(() => new Set(tickets.map((t) => t.event_id)), [tickets])

  const publicEvents = useMemo(
    () => maskForPublic(events, role === 'student' ? me?.student_id : undefined, myTicketIds),
    [events, role, me, myTicketIds]
  )

  // 학생: 내가 신청한 것 + 선생님이 나를 대상으로 등록해 준 것 모두.
  // 수정·취소는 내가 신청한 건(created_by === 나)만 가능하다 — 서버도 같은 규칙으로 막는다.
  // 학부모: 이 브라우저에서 신청한 건만.
  const myCounselings = useMemo(() => {
    const byDateTime = (a: CalendarEvent, b: CalendarEvent) =>
      a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date < b.date ? -1 : 1
    if (isParent) {
      return events.filter((ev) => myTicketIds.has(ev.event_id)).sort(byDateTime)
    }
    if (!me) return []
    return events
      .filter(
        (ev) =>
          ev.type === 'counseling' &&
          (ev.created_by === me.student_id || ev.student_ids.indexOf(me.student_id) >= 0)
      )
      .sort(byDateTime)
  }, [events, me, isParent, myTicketIds])

  // 캘린더에 이름·사진을 띄울 수 있는 학생은 로그인한 본인(또는 학부모가 고른 자녀)뿐이다.
  const studentsById = useMemo<Record<string, CalendarStudentInfo> | undefined>(() => {
    if (isParent) {
      return child
        ? {
            [child.student_id]: {
              name: child.name || child.student_id,
              photo_data: child.photo_data,
            },
          }
        : undefined
    }
    return me
      ? { [me.student_id]: { name: me.name || me.student_id, photo_data: me.photo_data } }
      : undefined
  }, [isParent, child, me])

  /** 수정 중인 학부모 신청의 토큰 */
  const editTicket = useMemo(
    () => (editEvent ? tickets.find((t) => t.event_id === editEvent.event_id) : undefined),
    [editEvent, tickets]
  )

  const requester = useMemo<CalendarRequester | null>(() => {
    if (isParent) {
      if (!child) return null
      return {
        student_id: child.student_id,
        name: child.name,
        photo_data: child.photo_data,
        role: 'parent',
        request_token: editTicket?.request_token,
      }
    }
    if (!me) return null
    return {
      student_id: me.student_id,
      auth_code: me.auth_code,
      name: me.name,
      photo_data: me.photo_data,
      role: 'student',
    }
  }, [isParent, child, me, editTicket])

  const canRequest = !!requester

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

  const chooseRole = (next: Role) => {
    setNotice('')
    setAuthError('')
    setRole(next)
  }

  /** 역할 선택 화면으로 되돌아간다(로그인/자녀 선택 해제). */
  const resetRole = () => {
    setRole(null)
    setMe(null)
    setChild(null)
    setAuthCode('')
    setAuthError('')
    setNotice('')
    try {
      localStorage.removeItem(PARENT_CHILD_KEY)
    } catch {
      // ignore
    }
  }

  const selectChild = (s: CounselingRosterStudent) => {
    setChild(s)
    setNotice(`${s.name || s.student_id} 학생의 학부모로 신청해요. 날짜의 + 버튼을 눌러 주세요.`)
    try {
      localStorage.setItem(PARENT_CHILD_KEY, s.student_id)
    } catch {
      // ignore
    }
  }

  const handleDateClick = (dateKey: string) => {
    setNotice('')
    if (!canRequest) return
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
  const handleSaved = async (result?: CalendarSaveResult) => {
    const editedId = editEvent?.event_id
    closeModal()
    // 학부모 신규 신청이면 수정·취소용 토큰을 이 브라우저에 저장해 둔다.
    if (isParent && !editedId && result?.event_id && result?.request_token) {
      const newId = result.event_id
      const next = [
        ...readParentTickets().filter((t) => t.event_id !== newId),
        {
          event_id: newId,
          request_token: result.request_token,
          student_id: result.student_id || child?.student_id || '',
        },
      ]
      setTickets(next)
      writeParentTickets(next)
    }
    const res = await getCalendarEvents()
    const list = res.success && res.data ? res.data : events
    setEvents(list)
    if (!editedId) setNotice('상담 신청이 등록되었어요. 캘린더에서 확인할 수 있어요.')
    else if (list.some((ev) => ev.event_id === editedId)) setNotice('상담 신청을 수정했어요.')
    else {
      // 취소된 신청의 토큰은 더 이상 쓸모가 없으니 지운다.
      if (isParent) {
        const next = readParentTickets().filter((t) => t.event_id !== editedId)
        setTickets(next)
        writeParentTickets(next)
      }
      setNotice('상담 신청을 취소했어요.')
    }
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

        {/* 신청 주체 선택 → 학생 로그인 / 학부모 자녀 선택 */}
        <div className="mb-3 rounded-2xl border border-rose-100 bg-white/80 p-3 shadow-sm">
          {role === null ? (
            <div>
              <p className="mb-2 text-center text-xs font-semibold text-gray-700">
                상담을 신청하시려면 먼저 선택해 주세요.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => chooseRole('student')}
                  className="rounded-xl border-2 border-rose-200 bg-rose-50/60 px-3 py-3 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-100"
                >
                  🙋 학생
                  <span className="mt-0.5 block text-[11px] font-normal text-rose-500">
                    학번 + 개인코드로 로그인
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => chooseRole('parent')}
                  className="rounded-xl border-2 border-violet-200 bg-violet-50/60 px-3 py-3 text-sm font-bold text-violet-700 transition-colors hover:bg-violet-100"
                >
                  👪 학부모
                  <span className="mt-0.5 block text-[11px] font-normal text-violet-500">
                    로그인 없이 자녀만 선택
                  </span>
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-gray-400">
                일정 열람은 선택하지 않아도 됩니다.
              </p>
            </div>
          ) : isParent ? (
            child ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                  <RosterAvatar student={child} size="md" />
                  {child.name || child.student_id}
                  <span className="text-xs font-normal text-gray-400">({child.student_id})</span>
                  <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    학부모
                  </span>
                </span>
                <span className="text-xs text-gray-500">
                  날짜의 <b>+</b> 버튼을 눌러 상담을 신청할 수 있어요.
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setChild(null)
                      setNotice('')
                    }}
                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-50"
                  >
                    자녀 변경
                  </button>
                  <button
                    type="button"
                    onClick={resetRole}
                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-50"
                  >
                    처음으로
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700">
                  👪 자녀(학생)를 선택하면 로그인 없이 상담을 신청할 수 있어요.
                </p>
                {rosterLoading ? (
                  <p className="py-3 text-center text-xs text-gray-400">
                    학생 명단을 불러오는 중...
                  </p>
                ) : rosterError ? (
                  <p className="text-xs text-red-600">{rosterError}</p>
                ) : (
                  <ChildPicker students={roster} onSelect={selectChild} />
                )}
                <button
                  type="button"
                  onClick={resetRole}
                  className="text-[11px] text-gray-400 underline hover:text-gray-600"
                >
                  ← 처음으로
                </button>
              </div>
            )
          ) : me ? (
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
                onClick={resetRole}
                className="ml-auto rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-50"
              >
                신청 로그아웃
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">
                🙋 학생 본인은 학번과 개인코드로 로그인하세요.
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
                  onClick={resetRole}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
                >
                  처음으로
                </button>
              </div>
              {authError && <p className="text-xs text-red-600">{authError}</p>}
            </form>
          )}
        </div>

        {/* 내 상담 일정 — 내가 신청한 건은 눌러서 수정·취소할 수 있다 */}
        {canRequest && (
          <div className="mb-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="mb-2 px-1 text-xs font-bold text-gray-700">
              {isParent ? '👪 이 기기에서 신청한 상담' : '🙋 내 상담 일정'}
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
                  const mine = isParent
                    ? myTicketIds.has(ev.event_id)
                    : ev.created_by === me?.student_id
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
                        {!mine
                          ? ev.requester_role === 'parent'
                            ? '학부모 신청'
                            : '선생님 등록'
                          : past
                            ? '지난 상담'
                            : '수정 ›'}
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
            {isParent && (
              <p className="mt-2 px-1 text-[11px] text-gray-400">
                학부모 신청은 로그인이 없어 <b>신청한 기기(브라우저)</b>에서만 수정·취소할 수 있어요.
                다른 기기에서 바꾸려면 선생님께 말씀해 주세요.
              </p>
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
              addable={canRequest}
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

      {requester && (requestDate || editEvent) && (
        <CalendarEventModal
          dateKey={editEvent ? editEvent.date : (requestDate as string)}
          existing={editEvent}
          timetable={timetable}
          requester={requester}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

/** 사진 값이 data: URI가 아니면 base64로 간주해 접두사를 붙인다(다른 화면과 동일 규칙). */
function photoSrc(photo?: string): string {
  if (!photo) return ''
  return photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`
}

function RosterAvatar({ student, size }: { student: CounselingRosterStudent; size: 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-9 w-9' : 'h-7 w-7'
  const src = photoSrc(student.photo_data)
  if (src) return <img src={src} alt="" className={`${cls} shrink-0 rounded-full object-cover`} />
  return (
    <span
      className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-gray-300 text-xs font-semibold text-white`}
    >
      {(student.name || student.student_id).slice(0, 1)}
    </span>
  )
}

/**
 * 자녀 선택 드롭다운. 사진을 함께 보여줘야 해서 <select> 대신 목록 버튼으로 만든다.
 * 학생 수가 많을 수 있으므로 학번·이름 검색을 함께 둔다.
 */
function ChildPicker({
  students,
  onSelect,
}: {
  students: CounselingRosterStudent[]
  onSelect: (s: CounselingRosterStudent) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return students
    return students.filter(
      (s) => s.student_id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    )
  }, [students, query])

  if (students.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400">
        등록된 학생이 없습니다. 선생님께 문의해 주세요.
      </p>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border-2 border-violet-200 bg-white px-3 py-2.5 text-sm text-gray-600 hover:bg-violet-50"
        aria-expanded={open}
      >
        <span>자녀(학생)를 선택하세요</span>
        <span className="text-violet-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="p-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="학번 또는 이름 검색"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-gray-400">찾는 학생이 없습니다.</p>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.student_id}
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setQuery('')
                    onSelect(s)
                  }}
                  className="flex w-full items-center gap-2.5 border-b border-gray-50 px-3 py-2 text-left last:border-b-0 hover:bg-violet-50"
                >
                  <RosterAvatar student={s} size="lg" />
                  <span className="w-14 shrink-0 text-xs font-semibold text-gray-500">
                    {s.student_id}
                  </span>
                  <span className="flex-1 text-sm text-gray-800">{s.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
