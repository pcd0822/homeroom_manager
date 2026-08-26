import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { authStudent, getCalendarEventsForStudent } from '@/api/api'
import type { CalendarEvent } from '@/types'
import { formatDateLabel, formatTimeRange, parseDateKey } from '@/lib/calendar'

const LOGIN_KEY = 'homeroom_login'
const TITLE = '내 상담 일정 | 학급 경영'

type AuthState = 'loading' | 'idle' | 'success'

function sortByDateTime(a: CalendarEvent, b: CalendarEvent) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0
}

export function StudentCounselingPage() {
  const [studentId, setStudentId] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [authError, setAuthError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)

  // 저장된 로그인으로 자동 인증
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const raw = localStorage.getItem(LOGIN_KEY)
        if (!raw) {
          if (!cancelled) setAuthState('idle')
          return
        }
        const p = JSON.parse(raw) as { student_id?: string; auth_code?: string }
        if (!p.student_id || !p.auth_code) {
          if (!cancelled) setAuthState('idle')
          return
        }
        setStudentId(p.student_id)
        setAuthCode(p.auth_code)
        const res = await authStudent(p.student_id, p.auth_code)
        if (cancelled) return
        setAuthState(res.success && res.data ? 'success' : 'idle')
      } catch {
        if (!cancelled) setAuthState('idle')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 인증되면 내 상담 일정 로드
  useEffect(() => {
    if (authState !== 'success' || !studentId.trim()) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const res = await getCalendarEventsForStudent(studentId.trim())
      if (cancelled) return
      setLoading(false)
      if (res.success && res.data) setEvents([...res.data].sort(sortByDateTime))
    })()
    return () => {
      cancelled = true
    }
  }, [authState, studentId])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId.trim() || !authCode.trim()) {
      setAuthError('학번과 개인코드를 입력해 주세요.')
      return
    }
    setSubmitting(true)
    setAuthError('')
    const res = await authStudent(studentId.trim(), authCode.trim())
    setSubmitting(false)
    if (res.success && res.data) {
      setAuthState('success')
      try {
        localStorage.setItem(
          LOGIN_KEY,
          JSON.stringify({ student_id: studentId.trim(), auth_code: authCode.trim() })
        )
      } catch {
        // ignore
      }
    } else {
      setAuthError(res.error || '인증에 실패했습니다.')
    }
  }

  if (authState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-rose-50 to-white px-4">
        <Helmet>
          <title>{TITLE}</title>
        </Helmet>
        <p className="text-sm text-gray-500">로그인 확인 중...</p>
      </div>
    )
  }

  if (authState !== 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white px-4 py-8">
        <Helmet>
          <title>{TITLE}</title>
        </Helmet>
        <div className="mx-auto max-w-sm rounded-3xl border border-rose-100 bg-white p-6 shadow-lg">
          <div className="mb-4 text-center text-4xl">💗</div>
          <h1 className="mb-1 text-center text-lg font-bold text-gray-900">내 상담 일정</h1>
          <p className="mb-5 text-center text-xs text-gray-500">
            학번과 개인코드로 로그인하면 나에게 등록된 상담 일정을 볼 수 있어요.
          </p>
          <form onSubmit={handleAuth} className="space-y-3 text-sm">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">학번</label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-inner"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">개인코드</label>
              <input
                type="password"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-inner"
              />
            </div>
            {authError && <p className="text-xs text-red-600">{authError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white shadow-md hover:bg-rose-700 disabled:opacity-60"
            >
              {submitting ? '확인 중...' : '입장하기'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const upcoming = events.filter((ev) => parseDateKey(ev.date) >= now)
  const past = events.filter((ev) => parseDateKey(ev.date) < now)

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-sky-50 px-4 py-8">
      <Helmet>
        <title>{TITLE}</title>
      </Helmet>
      <div className="mx-auto max-w-md space-y-5">
        <header className="text-center">
          <p className="text-3xl">💗</p>
          <h1 className="mt-2 text-xl font-bold text-gray-900">내 상담 일정</h1>
          <p className="mt-1 text-xs text-gray-500">
            선생님이 등록했거나 학부모님이 신청한 내 상담 일정이에요.
          </p>
        </header>

        <Link
          to="/calendar"
          className="flex items-center gap-3 rounded-2xl border-2 border-sky-100 bg-white p-3.5 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-2xl shadow-inner">
            🗓️
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">학급 전체 일정 보기</p>
            <p className="text-[11px] text-gray-500">수업시간·상담 일정을 주/월/일로 확인해요</p>
          </div>
          <span className="text-sky-300">→</span>
        </Link>

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-500">불러오는 중...</p>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 py-12 text-center">
            <p className="text-3xl">🌿</p>
            <p className="mt-2 text-sm text-gray-500">아직 등록된 상담 일정이 없어요.</p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="space-y-2">
                <h2 className="px-1 text-sm font-semibold text-gray-700">다가오는 상담</h2>
                {upcoming.map((ev) => (
                  <CounselingCard key={ev.event_id} event={ev} highlight />
                ))}
              </section>
            )}
            {past.length > 0 && (
              <section className="space-y-2">
                <h2 className="px-1 text-sm font-semibold text-gray-400">지난 상담</h2>
                {past.map((ev) => (
                  <CounselingCard key={ev.event_id} event={ev} />
                ))}
              </section>
            )}
          </>
        )}

        <Link
          to="/student/dashboard"
          className="block text-center text-xs text-gray-400 underline hover:text-gray-600"
        >
          ← 학생 대시보드로 돌아가기
        </Link>
      </div>
    </div>
  )
}

function CounselingCard({ event: ev, highlight }: { event: CalendarEvent; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border-2 p-4 shadow-sm ${
        highlight ? 'border-rose-200 bg-white' : 'border-gray-100 bg-white/70'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
          {formatDateLabel(ev.date)}
          {ev.requester_role === 'parent' && (
            <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
              👪 학부모 신청
            </span>
          )}
        </span>
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700">
          {formatTimeRange(ev.start_time, ev.end_time)}
        </span>
      </div>
      {ev.title && ev.title !== '상담' && (
        <p className="mt-1.5 text-sm font-medium text-gray-800">{ev.title}</p>
      )}
      {ev.location && <p className="mt-1 text-xs text-gray-500">📍 {ev.location}</p>}
      {ev.content && (
        <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
          {ev.content}
        </p>
      )}
    </div>
  )
}
