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
import { getAdminGasUrl, clearAdminSession } from '@/lib/gasUrl'
import { ChangePasswordModal } from '@/components/ChangePasswordModal'
import { IconTile, type GlyphTone } from '@/components/ui/Glyph'

const SIDEBAR_STORAGE_KEY = 'homeroom_admin_sidebar_open'

/** 왼쪽 메뉴. 아이콘은 하는 일이 바로 떠오르도록 고르고, 메뉴마다 색을 다르게 둔다. */
const MENU: Array<{ to: string; icon: LucideIcon; tone: GlyphTone; label: string; end?: boolean; prefix?: string }> = [
  { to: '/admin/forms/new', icon: FilePlus2, tone: 'blue', label: '새 문서 만들기' },
  { to: '/admin', icon: Table2, tone: 'sky', label: '데이터 관리하기', end: true },
  { to: '/admin/record-dashboard', icon: GraduationCap, tone: 'violet', label: '생기부 분석 대시보드' },
  { to: '/admin/students', icon: Users, tone: 'teal', label: '학생관리' },
  { to: '/admin/attendance', icon: ClipboardCheck, tone: 'mint', label: '출석 관리' },
  { to: '/admin/meal-board', icon: UtensilsCrossed, tone: 'amber', label: '급식알림판' },
  { to: '/admin/policies', icon: Sprout, tone: 'lime', label: '학급 정책 · 씨앗' },
  { to: '/admin/cleaning-zones', icon: Brush, tone: 'coral', label: '청소구역 관리' },
  { to: '/admin/seating', icon: Armchair, tone: 'slate', label: '자리 배치' },
  { to: '/admin/counseling', icon: CalendarHeart, tone: 'rose', label: '상담 캘린더' },
  { to: '/admin/night-study', icon: MoonStar, tone: 'violet', label: '야간 자율학습' },
  { to: '/admin/class-games', icon: Gamepad2, tone: 'coral', label: '학급 게임', prefix: '/admin/class-games' },
]

export function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)
  const [showChangePw, setShowChangePw] = useState(false)
  const gasUrl = getAdminGasUrl()

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

  return (
    <div className="flex min-h-screen">
      {/* 좌측 메뉴바: 떠 있는 유리 패널 */}
      <aside
        className={cn(
          'sticky top-0 flex h-screen shrink-0 flex-col p-3 transition-[width] duration-200 ease-out print:hidden',
          open ? 'w-64' : 'w-[76px]'
        )}
      >
        <div className="glass flex h-full flex-col overflow-hidden rounded-3xl">
          <div className={cn('flex h-14 shrink-0 items-center px-3', open ? 'justify-between' : 'justify-center')}>
            {open && <span className="pl-1 text-sm font-extrabold tracking-tight text-gray-800">학급 경영</span>}
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-white/70 hover:text-gray-800"
              title={open ? '메뉴 접기' : '메뉴 펼치기'}
              aria-label={open ? '메뉴 접기' : '메뉴 펼치기'}
            >
              {open ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
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
                  className={({ isActive }) => {
                    const active = prefixActive ?? isActive
                    return cn(
                      'flex items-center gap-3 rounded-2xl text-sm font-semibold transition-all',
                      open ? 'px-2 py-1.5' : 'justify-center py-1.5',
                      active
                        ? 'bg-white/85 text-gray-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_16px_-8px_rgba(30,41,99,0.35)] ring-1 ring-white'
                        : 'text-gray-600 hover:bg-white/55 hover:text-gray-900'
                    )
                  }}
                >
                  <IconTile icon={m.icon} tone={m.tone} size={32} />
                  {open && <span className="truncate">{m.label}</span>}
                </NavLink>
              )
            })}
          </nav>

          {/* 하단: 연결 정보 + 로그아웃 */}
          <div className="shrink-0 border-t border-white/70 p-2">
            {open && gasUrl && (
              <p className="truncate px-2 pb-1 text-[10px] text-gray-400" title={gasUrl}>
                연결됨: {gasUrl.replace(/^https:\/\/script\.google\.com\/macros\/s\//, '…/')}
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowChangePw(true)}
              title="비밀번호 변경"
              aria-label="비밀번호 변경"
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl text-sm font-medium text-gray-600 hover:bg-white/55 hover:text-gray-900',
                open ? 'px-3 py-2' : 'justify-center py-2'
              )}
            >
              <KeyRound className="h-5 w-5 shrink-0" />
              {open && '비밀번호 변경'}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              title="로그아웃"
              aria-label="로그아웃"
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl text-sm font-medium text-gray-600 hover:bg-white/55 hover:text-gray-900',
                open ? 'px-3 py-2' : 'justify-center py-2'
              )}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {open && '로그아웃'}
            </button>
          </div>
        </div>
      </aside>

      {/* 메인 영역 (인쇄 시 패딩 제거) */}
      <main className="min-w-0 flex-1 pb-8 pl-3 pr-6 pt-6 print:min-w-0 print:p-0">
        <Outlet />
      </main>

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </div>
  )
}
