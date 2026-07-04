import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { getAdminGasUrl, clearAdminSession } from '@/lib/gasUrl'
import { ChangePasswordModal } from '@/components/ChangePasswordModal'

const SIDEBAR_STORAGE_KEY = 'homeroom_admin_sidebar_open'

export function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const classGamesActive = location.pathname.startsWith('/admin/class-games')
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
    <div className="flex min-h-screen bg-gray-50">
      {/* 좌측 메뉴바 */}
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-200 ease-out print:hidden',
          open ? 'w-52' : 'w-14'
        )}
      >
        <div className="flex h-14 shrink-0 items-center border-b border-gray-200 px-2">
          {open ? (
            <>
              <span className="flex-1 text-sm font-semibold text-gray-800">메뉴</span>
              <button
                type="button"
                onClick={toggleSidebar}
                className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                title="메뉴 숨기기"
                aria-label="메뉴 숨기기"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              title="메뉴 펼치기"
              aria-label="메뉴 펼치기"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
        {open && (
          <nav className="flex flex-col gap-1 p-2">
            <NavLink
              to="/admin/forms/new"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )
              }
            >
              <DocumentPlusIcon className="h-5 w-5 shrink-0" />
              새 문서 만들기
            </NavLink>
            <NavLink
              to="/admin"
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )
              }
            >
              <TableIcon className="h-5 w-5 shrink-0" />
              데이터 관리하기
            </NavLink>
            <NavLink
              to="/admin/record-dashboard"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )
              }
            >
              <ChartBarIcon className="h-5 w-5 shrink-0" />
              생기부 분석 대시보드
            </NavLink>
            <NavLink
              to="/admin/students"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )
              }
            >
              <UserGroupIcon className="h-5 w-5 shrink-0" />
              학생관리
            </NavLink>
            <NavLink
              to="/admin/meal-board"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )
              }
            >
              <MealIcon className="h-5 w-5 shrink-0" />
              급식알림판
            </NavLink>
            <NavLink
              to="/admin/policies"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )
              }
            >
              <SproutIcon className="h-5 w-5 shrink-0" />
              학급 정책 · 씨앗
            </NavLink>
            <NavLink
              to="/admin/cleaning-zones"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )
              }
            >
              <BroomIcon className="h-5 w-5 shrink-0" />
              청소구역 관리
            </NavLink>
            <NavLink
              to="/admin/seating"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )
              }
            >
              <SeatIcon className="h-5 w-5 shrink-0" />
              자리 배치
            </NavLink>
            <NavLink
              to="/admin/counseling"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )
              }
            >
              <CalendarIcon className="h-5 w-5 shrink-0" />
              상담 캘린더
            </NavLink>
            <NavLink
              to="/admin/night-study"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )
              }
            >
              <NightStudyIcon className="h-5 w-5 shrink-0" />
              야간 자율학습
            </NavLink>
            <NavLink
              to="/admin/class-games"
              className={() =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  classGamesActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )
              }
            >
              <GamepadIcon className="h-5 w-5 shrink-0" />
              학급 게임
            </NavLink>
          </nav>
        )}

        {/* 하단: 연결 정보 + 로그아웃 */}
        <div className="mt-auto border-t border-gray-200 p-2 print:hidden">
          {open ? (
            <div className="space-y-1.5">
              {gasUrl && (
                <p className="truncate px-1 text-[10px] text-gray-400" title={gasUrl}>
                  연결됨: {gasUrl.replace(/^https:\/\/script\.google\.com\/macros\/s\//, '…/')}
                </p>
              )}
              <button
                type="button"
                onClick={() => setShowChangePw(true)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800"
              >
                <KeyIcon className="h-5 w-5 shrink-0" />
                비밀번호 변경
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800"
              >
                <LogoutIcon className="h-5 w-5 shrink-0" />
                로그아웃
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              title="로그아웃"
              aria-label="로그아웃"
              className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <LogoutIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </aside>

      {/* 메인 영역 - 사이드바와 여백 (인쇄 시 패딩 제거) */}
      <main className="min-w-0 flex-1 pl-6 pr-6 pt-6 pb-8 print:min-w-0 print:p-0">
        <Outlet />
      </main>

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </div>
  )
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  )
}

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function DocumentPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  )
}

function TableIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
}

function UserGroupIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function ChartBarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function SeatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 의자 등받이 */}
      <path d="M8 14V6a2 2 0 012-2h4a2 2 0 012 2v8" />
      {/* 좌석 */}
      <path d="M6 19v-3a2 2 0 012-2h8a2 2 0 012 2v3" />
      {/* 바닥 라인 */}
      <path d="M5 19h14" />
    </svg>
  )
}

function BroomIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 손잡이 */}
      <path d="M13 2.5c-.6-.6-1.4-.6-2 0l-1 1c-.6.6-.6 1.4 0 2l1.5 1.5 3-3L13 2.5z" />
      <path d="M12 7l-4 4" />
      {/* 빗자루 머리 */}
      <path d="M5 13h10l1.5 6.5a1.5 1.5 0 01-1.47 1.8H4.97A1.5 1.5 0 013.5 19.5L5 13z" />
      <path d="M7 13v8" />
      <path d="M11 13v8" />
    </svg>
  )
}

function MealIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 게시판 틀 */}
      <rect x="4" y="6" width="16" height="12" rx="2" ry="2" />
      {/* 상단 고정 핀 */}
      <circle cx="12" cy="4" r="1.5" />
      <path d="M12 5.5V6" />
      {/* 게시판 내용 라인 */}
      <path d="M8 10h8" />
      <path d="M8 13h5" />
    </svg>
  )
}

function SproutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 22v-6m0 0c-2-3-6-4-6-9a6 6 0 0112 0c0 5-4 6-6 9z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 10h.01M15 10h.01" />
    </svg>
  )
}

function GamepadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h2m-1-1v2M6 8h.01M18 8h.01M14 12h2m1-1v2M6 16h2m4 0h2M8 5l-2.5 2.5a4 4 0 00-1 3.2v3.4a2 2 0 002 2h11a2 2 0 002-2v-3.4a4 4 0 00-1-3.2L16 5"
      />
    </svg>
  )
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 3v4M16 3v4" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
    </svg>
  )
}

function NightStudyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 연필 몸통 */}
      <path d="M7 4l8 8" />
      {/* 연필 끝 (심) */}
      <path d="M15 12l1.8 3.6L13.2 14z" />
      {/* 연필 지우개 부분 */}
      <rect x="5.5" y="2.5" width="3" height="3.5" rx="1.2" />
      {/* 연필 아래 그림자 느낌의 둥근 선 */}
      <path d="M5 19c1.5 1 3.5 1.5 5.5 1.5S14.5 20 16 19" />
    </svg>
  )
}
