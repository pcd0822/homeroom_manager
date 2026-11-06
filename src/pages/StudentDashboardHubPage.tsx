import { useEffect, useState } from 'react'
import { ChevronRight, ClipboardCheck, HeartHandshake, Leaf, LogOut, NotebookPen, Sparkles, Sprout, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { IconTile, type GlyphTone } from '@/components/ui/Glyph'
import { Helmet } from 'react-helmet-async'
import { NavLink } from 'react-router-dom'
import { authStudent, getStudentSeedLedger } from '@/api/api'
import { DonutSpinner, LoadingSpinner } from '@/components/ui/LoadingSpinner'

const LOGIN_KEY = 'homeroom_login'
const HUB_TITLE = '학급 학생 대시보드 | 학급 경영'
const HUB_DESC = '급식·과제 보기와 정책 관리 중 선택할 수 있습니다.'

type AuthState = 'idle' | 'loading' | 'success' | 'error'

const HUB_MENU: ReadonlyArray<{ to: string; icon: LucideIcon; tone: GlyphTone; title: string; desc: string }> = [
  { to: '/student/meal-board', icon: UtensilsCrossed, tone: 'amber', title: '급식 및 개인별 과제 보기', desc: '급식 알림판, 학사일정, 과제, 야자 시간표' },
  { to: '/student/policies', icon: Leaf, tone: 'mint', title: '정책 관리하기', desc: '등록한 정책 보기, 씨앗 뿌리기, 수정' },
  { to: '/student/counseling', icon: HeartHandshake, tone: 'rose', title: '내 상담 일정', desc: '나에게 등록된 상담 일정 확인' },
  { to: '/student/attendance', icon: ClipboardCheck, tone: 'sky', title: '개인별 출결 현황', desc: '내 지각·조퇴 기록, 점수와 순위 확인' },
]

const HUB_CARD =
  'glass group flex items-center gap-4 rounded-3xl p-4 transition-all hover:-translate-y-0.5 hover:bg-white/75 active:translate-y-0'

export function StudentDashboardHubPage() {
  const [studentId, setStudentId] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [authError, setAuthError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [seedBalance, setSeedBalance] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const raw = localStorage.getItem(LOGIN_KEY)
        if (!raw) {
          if (!cancelled) setAuthState('idle')
          return
        }
        const parsed = JSON.parse(raw) as { student_id?: string; auth_code?: string }
        if (!parsed.student_id || !parsed.auth_code) {
          if (!cancelled) setAuthState('idle')
          return
        }
        setStudentId(parsed.student_id)
        setAuthCode(parsed.auth_code)
        const res = await authStudent(parsed.student_id, parsed.auth_code)
        if (cancelled) return
        if (res.success && res.data) {
          setAuthState('success')
        } else {
          setAuthState('idle')
        }
      } catch {
        if (!cancelled) setAuthState('idle')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (authState !== 'success') return
    if (!studentId.trim()) return
    void (async () => {
      const res = await getStudentSeedLedger(studentId.trim())
      if (res.success && res.data) setSeedBalance(res.data.balance ?? 0)
    })()
  }, [authState, studentId])

  const handleLogout = () => {
    if (!confirm('이 기기에서 로그아웃할까요? 다음에 다시 학번·개인코드로 로그인해야 합니다.')) return
    try {
      localStorage.removeItem(LOGIN_KEY)
    } catch {
      // ignore
    }
    setStudentId('')
    setAuthCode('')
    setSeedBalance(null)
    setAuthError('')
    setAuthState('idle')
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId.trim() || !authCode.trim()) {
      setAuthError('학번과 개인코드를 입력해 주세요.')
      return
    }
    setAuthSubmitting(true)
    setAuthError('')
    const res = await authStudent(studentId.trim(), authCode.trim())
    setAuthSubmitting(false)
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
      setAuthState('error')
      setAuthError(res.error || '인증에 실패했습니다.')
    }
  }

  if (authState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Helmet>
          <title>{HUB_TITLE}</title>
        </Helmet>
        <LoadingSpinner label="로그인 확인 중" />
      </div>
    )
  }

  if (authState !== 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <Helmet>
          <title>{HUB_TITLE}</title>
          <meta name="description" content={HUB_DESC} />
        </Helmet>
        <div className="glass w-full max-w-sm rounded-3xl p-6">
          <div className="mb-4 flex justify-center">
            <IconTile icon={Sprout} tone="mint" size={56} />
          </div>
          <h1 className="mb-1 text-center text-lg font-bold text-gray-900">학급 학생 대시보드</h1>
          <p className="mb-5 text-center text-xs text-gray-500">{HUB_DESC}</p>
          <form onSubmit={handleAuth} className="space-y-3 text-sm">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">학번</label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">개인코드</label>
              <input
                type="password"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>
            {authError && <p className="text-xs text-red-600">{authError}</p>}
            <button
              type="submit"
              disabled={authSubmitting}
              className="btn-liquid w-full rounded-full py-3 text-sm font-semibold disabled:opacity-60"
            >
              {authSubmitting ? '확인 중...' : '입장하기'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <Helmet>
        <title>{HUB_TITLE}</title>
        <meta name="description" content={HUB_DESC} />
      </Helmet>
      <div className="mx-auto max-w-md space-y-5">
        <header className="text-center">
          <div className="flex justify-center">
            <IconTile icon={Sparkles} tone="sky" size={48} />
          </div>
          <h1 className="mt-2 text-xl font-bold text-gray-900">무엇을 할까요?</h1>
          <p className="mt-1 text-xs text-gray-500">아래에서 한 가지를 선택한 뒤 이동해 주세요.</p>
        </header>

        <div className="grid gap-3">
          {HUB_MENU.map((m) => (
            <NavLink key={m.to} to={m.to} className={HUB_CARD}>
              <IconTile icon={m.icon} tone={m.tone} size={52} />
              <div className="min-w-0 flex-1 text-left">
                <p className="font-bold text-gray-900">{m.title}</p>
                <p className="text-[11px] text-gray-500">{m.desc}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-0.5" />
            </NavLink>
          ))}

          <NavLink to="/student/seed-ledger" className={HUB_CARD}>
            <IconTile icon={Sprout} tone="lime" size={52} />
            <div className="min-w-0 flex-1 text-left">
              <p className="font-bold text-gray-900">씨앗 가계부</p>
              <p className="flex items-center gap-1 text-[11px] text-gray-500">
                <Sprout className="h-3 w-3 text-emerald-600" />
                현재{' '}
                {seedBalance === null ? (
                  <DonutSpinner size={12} />
                ) : (
                  `${seedBalance}개`
                )}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-0.5" />
          </NavLink>
        </div>

        <NavLink
          to="/student/policy/register"
          className="btn-liquid flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
        >
          <NotebookPen className="h-4 w-4" /> 정책 새로 등록하기
        </NavLink>
        <p className="text-center text-[11px] text-gray-500">
          급식·과제·정책 등록·관리 모두 이 대시보드에서 한 번 로그인하면 이용할 수 있어요.
        </p>

        <button
          type="button"
          onClick={handleLogout}
          className="glass-pill mx-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900"
        >
          <LogOut className="h-4 w-4" />
          이 기기에서 로그아웃
        </button>
      </div>
    </div>
  )
}
