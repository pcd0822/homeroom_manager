import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { NavLink } from 'react-router-dom'
import { authStudent } from '@/api/api'

const LOGIN_KEY = 'homeroom_login'
const HUB_TITLE = '학급 학생 대시보드 | 학급 경영'
const HUB_DESC = '급식·과제 보기와 정책 관리 중 선택할 수 있습니다.'

type AuthState = 'idle' | 'loading' | 'success' | 'error'

export function StudentDashboardHubPage() {
  const [studentId, setStudentId] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [authState, setAuthState] = useState<AuthState>('idle')
  const [authError, setAuthError] = useState('')
  const [remember, setRemember] = useState(true)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOGIN_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.student_id) setStudentId(parsed.student_id)
        if (parsed.auth_code) setAuthCode(parsed.auth_code)
      }
    } catch {
      // ignore
    }
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId.trim() || !authCode.trim()) {
      setAuthError('학번과 개인코드를 입력해 주세요.')
      return
    }
    setAuthState('loading')
    setAuthError('')
    const res = await authStudent(studentId.trim(), authCode.trim())
    if (res.success && res.data) {
      setAuthState('success')
      if (remember) {
        try {
          localStorage.setItem(
            LOGIN_KEY,
            JSON.stringify({ student_id: studentId.trim(), auth_code: authCode.trim() })
          )
        } catch {
          // ignore
        }
      }
    } else {
      setAuthState('error')
      setAuthError(res.error || '인증에 실패했습니다.')
    }
  }

  if (authState !== 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white px-4 py-8">
        <Helmet>
          <title>{HUB_TITLE}</title>
          <meta name="description" content={HUB_DESC} />
        </Helmet>
        <div className="mx-auto max-w-sm rounded-3xl border border-sky-100 bg-white p-6 shadow-lg">
          <div className="mb-4 text-center text-4xl">🌱</div>
          <h1 className="mb-1 text-center text-lg font-bold text-gray-900">학급 학생 대시보드</h1>
          <p className="mb-5 text-center text-xs text-gray-500">{HUB_DESC}</p>
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
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              이 기기에서 로그인 정보 저장
            </label>
            {authError && <p className="text-xs text-red-600">{authError}</p>}
            <button
              type="submit"
              disabled={authState === 'loading'}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-60"
            >
              {authState === 'loading' ? '확인 중...' : '입장하기'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-sky-50 px-4 py-8">
      <Helmet>
        <title>{HUB_TITLE}</title>
        <meta name="description" content={HUB_DESC} />
      </Helmet>
      <div className="mx-auto max-w-md space-y-6">
        <header className="text-center">
          <p className="text-3xl">✨</p>
          <h1 className="mt-2 text-xl font-bold text-gray-900">무엇을 할까요?</h1>
          <p className="mt-1 text-xs text-gray-500">아래에서 한 가지를 선택한 뒤 이동해 주세요.</p>
        </header>

        <div className="grid gap-4">
          <NavLink
            to="/student/meal-board"
            className={({ isActive }) =>
              `group flex items-center gap-4 rounded-2xl border-2 p-4 shadow-md transition-all ${
                isActive
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-100 bg-white hover:border-blue-200'
              }`
            }
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-3xl shadow-inner">
              🍱
            </span>
            <div className="min-w-0 flex-1 text-left">
              <p className="font-bold text-gray-900">급식 및 개인별 과제 보기</p>
              <p className="text-[11px] text-gray-500">급식 알림판, 학사일정, 과제, 야자 시간표</p>
            </div>
            <span className="text-gray-300 group-hover:text-blue-400">→</span>
          </NavLink>

          <NavLink
            to="/student/policies"
            className={({ isActive }) =>
              `group flex items-center gap-4 rounded-2xl border-2 p-4 shadow-md transition-all ${
                isActive
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-100 bg-white hover:border-emerald-200'
              }`
            }
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-3xl shadow-inner">
              🌿
            </span>
            <div className="min-w-0 flex-1 text-left">
              <p className="font-bold text-gray-900">정책 관리하기</p>
              <p className="text-[11px] text-gray-500">등록한 정책 보기, 씨앗 뿌리기, 수정</p>
            </div>
            <span className="text-gray-300 group-hover:text-emerald-400">→</span>
          </NavLink>
        </div>

        <p className="text-center text-[11px] text-gray-400">
          정책을 새로 등록하려면 교사가 안내한 <strong>정책 등록하기</strong> 링크를 이용해 주세요.
        </p>
      </div>
    </div>
  )
}
