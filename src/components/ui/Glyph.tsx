// 아이콘 타일: 무채색 유리(옅은 흰 면 + 위쪽 하이라이트 + 밝은 테두리 + 약한 그림자) 위에 진회색 선 아이콘.
// 사양은 DESIGN.md 「유리 아이콘 타일」. 메뉴·화면마다 색을 달리하지 않는다(tone 은 예전 호출 호환용으로만 받는다).

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type GlyphTone = 'violet' | 'coral' | 'sky' | 'mint' | 'amber' | 'rose' | 'slate' | 'blue' | 'teal' | 'lime'

function iconSize(size: number) {
  if (size <= 24) return 14
  if (size <= 28) return 16
  if (size <= 36) return 20
  return Math.round(size * 0.5)
}

/** 둥근 사각형 유리 타일 + 아이콘. size 는 한 변 px, active 면 행동 색으로 은은하게. */
export function IconTile({
  icon: Icon,
  size = 36,
  active = false,
  className = '',
}: {
  icon: LucideIcon
  tone?: GlyphTone
  size?: number
  active?: boolean
  className?: string
}) {
  return (
    <span
      className={cn('glass-tile inline-grid shrink-0 place-items-center', active && 'glass-tile-active', className)}
      style={{ width: size, height: size, borderRadius: size <= 28 ? 8 : 10 }}
      aria-hidden
    >
      <Icon size={iconSize(size)} strokeWidth={1.75} />
    </span>
  )
}

/** 화면 제목 위 작은 머리글: 작은 타일 + 글자 */
export function Eyebrow({
  icon,
  children,
  className = '',
}: {
  icon: LucideIcon
  tone?: GlyphTone
  children: ReactNode
  className?: string
}) {
  return (
    <p className={`flex items-center gap-2 text-sm font-medium text-muted ${className}`}>
      <IconTile icon={icon} size={24} />
      {children}
    </p>
  )
}

/** 화면 제목: 타일 + 제목(20/600) + 한 줄 부제 */
export function PageTitle({
  icon,
  title,
  sub,
  right,
}: {
  icon: LucideIcon
  tone?: GlyphTone
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <IconTile icon={icon} size={36} />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-7 text-ink-strong">{title}</h1>
          {sub && <div className="text-sm text-muted">{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  )
}

/** 빈 화면용 그림: 타일 하나 */
export function EmptyArt({ icon }: { icon: LucideIcon; tone?: GlyphTone }) {
  return <IconTile icon={icon} size={48} />
}
