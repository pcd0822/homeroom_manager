// 이모지 대신 쓰는 그림 부품: 그라데이션 유리 타일 위에 흰 선 아이콘(lucide-react).
// 기준: sghs_program-app src/ui/Glyph.tsx (사용자 확정 스타일). 아이콘은 필요한 것만 불러온다.

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type GlyphTone = 'violet' | 'coral' | 'sky' | 'mint' | 'amber' | 'rose' | 'slate' | 'blue' | 'teal' | 'lime'

export const TONE_BG: Record<GlyphTone, string> = {
  violet: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
  coral: 'linear-gradient(135deg, #fda4af, #fb7185 45%, #fb923c)',
  sky: 'linear-gradient(135deg, #7dd3fc, #6366f1)',
  mint: 'linear-gradient(135deg, #6ee7b7, #0ea5a4)',
  amber: 'linear-gradient(135deg, #fcd34d, #f97316)',
  rose: 'linear-gradient(135deg, #fda4af, #e11d48)',
  slate: 'linear-gradient(135deg, #a1a1aa, #3f3f46)',
  blue: 'linear-gradient(135deg, #93c5fd, #2563eb)',
  teal: 'linear-gradient(135deg, #5eead4, #0891b2)',
  lime: 'linear-gradient(135deg, #bef264, #16a34a)',
}

/** 둥근 사각형 타일 + 아이콘. size 는 한 변 px. */
export function IconTile({
  icon: Icon,
  tone = 'violet',
  size = 40,
  className = '',
}: {
  icon: LucideIcon
  tone?: GlyphTone
  size?: number
  className?: string
}) {
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden text-white shadow-[0_6px_16px_-6px_rgba(76,29,149,0.45)] ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.32, backgroundImage: TONE_BG[tone] }}
      aria-hidden
    >
      {/* 위쪽 빛 반사 */}
      <span className="absolute -left-1/4 -top-1/3 h-[90%] w-[90%] rounded-full bg-white/25 blur-[2px]" />
      <Icon className="relative" size={Math.round(size * 0.52)} strokeWidth={2.2} />
    </span>
  )
}

/** 화면 제목 위 작은 머리글: 작은 타일 + 글자 */
export function Eyebrow({
  icon,
  tone,
  children,
  className = '',
}: {
  icon: LucideIcon
  tone?: GlyphTone
  children: ReactNode
  className?: string
}) {
  return (
    <p className={`flex items-center gap-2 text-sm font-semibold text-gray-600 ${className}`}>
      <IconTile icon={icon} tone={tone} size={24} />
      {children}
    </p>
  )
}

/** 화면 제목: 타일 + 큰 글자 */
export function PageTitle({
  icon,
  tone,
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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <IconTile icon={icon} tone={tone} size={40} />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

/** 빈 화면용 큰 그림: 겹친 원 + 타일 */
export function EmptyArt({ icon, tone = 'violet' }: { icon: LucideIcon; tone?: GlyphTone }) {
  return (
    <span className="relative inline-grid h-24 w-24 place-items-center" aria-hidden>
      <span className="absolute inset-0 rounded-full bg-white/60" />
      <span className="absolute right-0 top-1 h-5 w-5 rounded-full bg-orange-100" />
      <span className="absolute bottom-2 left-0 h-3 w-3 rounded-full bg-sky-100" />
      <IconTile icon={icon} tone={tone} size={52} />
    </span>
  )
}
