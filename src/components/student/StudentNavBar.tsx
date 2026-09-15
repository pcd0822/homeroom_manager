import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

/** 학생 화면 햄버거 메뉴 항목. 대시보드 허브의 메뉴와 같은 순서로 맞춘다. */
export const STUDENT_MENU = [
  { to: '/student/meal-board', emoji: '🍱', label: '급식 및 개인별 과제' },
  { to: '/student/policies', emoji: '🌿', label: '정책 관리하기' },
  { to: '/student/counseling', emoji: '💗', label: '내 상담 일정' },
  { to: '/student/attendance', emoji: '📋', label: '개인별 출결 현황' },
  { to: '/student/seed-ledger', emoji: '📓', label: '씨앗 가계부' },
  { to: '/student/policy/register', emoji: '📝', label: '정책 새로 등록하기' },
] as const

/** 학생 화면 상단 바: 왼쪽 홈(대시보드), 오른쪽 햄버거 메뉴 */
export function StudentNavBar({ title }: { title?: string }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <nav className="sticky top-0 z-30 -mx-4 flex items-center justify-between gap-2 bg-white/80 px-4 py-2 backdrop-blur">
      <Link
        to="/student/dashboard"
        title="홈"
        aria-label="학생 대시보드 홈"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-lg text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100"
      >
        🏠
      </Link>
      {title && <p className="min-w-0 truncate text-sm font-semibold text-gray-800">{title}</p>}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="메뉴 열기"
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-gray-100 bg-white py-1 shadow-xl">
            <NavLink
              to="/student/dashboard"
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <span className="text-lg">🏠</span>
              대시보드 홈
            </NavLink>
            <div className="my-1 border-t border-gray-100" />
            {STUDENT_MENU.map((m) => (
              <NavLink
                key={m.to}
                to={m.to}
                end
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-2.5 text-sm',
                    isActive ? 'bg-sky-50 font-semibold text-sky-800' : 'text-gray-700 hover:bg-gray-50'
                  )
                }
              >
                <span className="text-lg">{m.emoji}</span>
                {m.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
