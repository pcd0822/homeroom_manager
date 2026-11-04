import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ClipboardCheck, HeartHandshake, House, Leaf, Menu, NotebookPen, Sprout, UtensilsCrossed, X, type LucideIcon } from 'lucide-react'
import { IconTile, type GlyphTone } from '@/components/ui/Glyph'
import { cn } from '@/lib/utils'

/** 학생 화면 햄버거 메뉴 항목. 대시보드 허브의 메뉴와 같은 순서로 맞춘다. */
export const STUDENT_MENU: ReadonlyArray<{ to: string; icon: LucideIcon; tone: GlyphTone; label: string }> = [
  { to: '/student/meal-board', icon: UtensilsCrossed, tone: 'amber', label: '급식 및 개인별 과제' },
  { to: '/student/policies', icon: Leaf, tone: 'mint', label: '정책 관리하기' },
  { to: '/student/counseling', icon: HeartHandshake, tone: 'rose', label: '내 상담 일정' },
  { to: '/student/attendance', icon: ClipboardCheck, tone: 'sky', label: '개인별 출결 현황' },
  { to: '/student/seed-ledger', icon: Sprout, tone: 'lime', label: '씨앗 가계부' },
  { to: '/student/policy/register', icon: NotebookPen, tone: 'violet', label: '정책 새로 등록하기' },
]

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
    // 바 자체는 투명하고 클릭도 통과시킨다. 버튼만 배경 위에 떠 있다.
    <nav className="pointer-events-none sticky top-2 z-30 flex items-center justify-between gap-2 [&>*]:pointer-events-auto">
      <Link
        to="/student/dashboard"
        title="홈"
        aria-label="학생 대시보드 홈"
        className="glass-pill flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sky-800"
      >
        <House className="h-5 w-5" />
      </Link>
      {title && <p className="min-w-0 truncate text-sm font-semibold text-gray-800">{title}</p>}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="메뉴 열기"
          aria-expanded={open}
          className="glass-pill flex h-10 w-10 items-center justify-center rounded-full text-gray-700"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        {open && (
          <div className="glass-strong absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl py-1">
            <NavLink
              to="/student/dashboard"
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-white/60"
            >
              <IconTile icon={House} tone="blue" size={28} />
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
                    isActive ? 'bg-white/70 font-semibold text-sky-800' : 'text-gray-700 hover:bg-white/60'
                  )
                }
              >
                <IconTile icon={m.icon} tone={m.tone} size={28} />
                {m.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
