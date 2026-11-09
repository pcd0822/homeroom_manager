import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Armchair,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FilePlus2,
  Gamepad2,
  GraduationCap,
  KeyRound,
  LogOut,
  MoonStar,
  Sprout,
  Table2,
  Users,
  UtensilsCrossed,
  Brush,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { clearAdminSession } from '@/lib/gasUrl'
import { ChangePasswordModal } from '@/components/ChangePasswordModal'
import { IconTile } from '@/components/ui/Glyph'

const SIDEBAR_STORAGE_KEY = 'homeroom_admin_sidebar_open'

/** 왼쪽 메뉴. 아이콘은 하는 일이 바로 떠오르도록 고르고, 타일은 모두 같은 무채색 유리다(DESIGN.md). */
const MENU: Array<{ to: string; icon: LucideIcon; label: string; end?: boolean; prefix?: string }> = [
  { to: '/admin/forms/new', icon: FilePlus2, label: '새 문서 만들기' },
  { to: '/admin', icon: Table2, label: '데이터 관리', end: true },
  { to: '/admin/record-dashboard', icon: GraduationCap, label: '생기부 분석 대시보드' },
  { to: '/admin/students', icon: Users, label: '학생 관리' },
  { to: '/admin/attendance', icon: ClipboardCheck, label: '출석 관리' },
  { to: '/admin/meal-board', icon: UtensilsCrossed, label: '급식 알림판' },
  { to: '/admin/policies', icon: Sprout, label: '학급 정책 · 씨앗' },
  { to: '/admin/cleaning-zones', icon: Brush, label: '청소구역 관리' },
  { to: '/admin/seating', icon: Armchair, label: '자리 배치' },
  { to: '/admin/counseling', icon: CalendarHeart, label: '상담 캘린더' },
  { to: '/admin/night-study', icon: MoonStar, label: '야간 자율학습' },
  { to: '/admin/class-games', icon: Gamepad2, label: '학급 게임', prefix: '/admin/class-games' },
]

export function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)
  const [showChangePw, setShowChangePw] = useState(false)

  const handleLogout = () => {
    if (!confirm('로그아웃하면 이 기기에서 연결이 해제됩니다. 계속할까요?')) return
    clearAdminSession()
    navigate('/admin/login', { replace: true })
  }

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (stored !== null) setOpen(stored === 'true')
  }, [])

  const toggleSidebar = () => {
    const next = !open
    setOpen(next)
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
  }

  // 메뉴 줄·하단 버튼 줄 공통: 높이 36, 좌우 8, 아이콘 상자 28, 아이콘→글자 8 (글자 시작선이 한 줄로 맞는다)
  const rowClass = (active: boolean) =>
    cn(
      'flex h-9 items-center gap-2 rounded-lg px-2 text-sm transition-colors duration-150',
      !open && 'justify-center px-0',
      active ? 'bg-raised font-medium text-ink-strong' : 'text-ink hover:bg-raised hover:text-ink-strong'
    )

  return (
    <div className="flex min-h-screen">
      {/* 좌측 메뉴바: 떠 있는 흰 패널 */}
      <aside className={cn('sticky top-0 flex h-screen shrink-0 flex-col p-3 print:hidden', open ? 'w-64' : 'w-[72px]')}>
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface">
          <div className={cn('flex h-12 shrink-0 items-center px-2', open ? 'justify-between' : 'justify-center')}>
            {open && <span className="pl-2 text-sm font-semibold text-ink-strong">학급 경영</span>}
            <button
              type="button"
              onClick={toggleSidebar}
              className="btn btn-ghost btn-icon"
              title={open ? '메뉴 접기' : '메뉴 펼치기'}
              aria-label={open ? '메뉴 접기' : '메뉴 펼치기'}
            >
              {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2">
            {MENU.map((m) => {
              const prefixActive = m.prefix ? location.pathname.startsWith(m.prefix) : undefined
              return (
                <NavLink
                  key={m.to}
                  to={m.to}
                  end={m.end}
                  title={open ? undefined : m.label}
                  aria-label={m.label}
                  className={({ isActive }) => rowClass(prefixActive ?? isActive)}
                >
                  {({ isActive }) => (
                    <>
                      <IconTile icon={m.icon} size={28} active={prefixActive ?? isActive} />
                      {open && <span className="truncate">{m.label}</span>}
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* 하단: 비밀번호 변경(연결 주소도 여기서 본다) + 로그아웃 */}
          <div className="flex shrink-0 flex-col gap-1 border-t border-line p-2">
            <button
              type="button"
              onClick={() => setShowChangePw(true)}
              title="비밀번호 변경"
              aria-label="비밀번호 변경"
              className={rowClass(false)}
            >
              <span className="grid w-7 shrink-0 place-items-center text-muted">
                <KeyRound className="h-4 w-4" strokeWidth={1.75} />
              </span>
              {open && '비밀번호 변경'}
            </button>
            <button type="button" onClick={handleLogout} title="로그아웃" aria-label="로그아웃" className={rowClass(false)}>
              <span className="grid w-7 shrink-0 place-items-center text-muted">
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
              </span>
              {open && '로그아웃'}
            </button>
          </div>
        </div>
      </aside>

      {/* 메인 영역 (인쇄 시 패딩 제거) */}
      {/* 왼쪽 여백 12 + 메뉴바 바깥 12 = 24, 오른쪽 24 로 화면 양끝이 같다 */}
      <main className="min-w-0 flex-1 py-6 pl-3 pr-6 print:min-w-0 print:p-0">
        <Outlet />
      </main>

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </div>
  )
}
