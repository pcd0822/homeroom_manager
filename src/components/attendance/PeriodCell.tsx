import type { PeriodMark } from '@/types'
import { MARK_COLORS, MARK_LABELS } from '@/lib/attendance'
import { cn } from '@/lib/utils'

/** 출석부 한 칸. 체크되면 종류 색의 빗금(/)이 그어진다. */
export function PeriodCell({
  mark,
  onClick,
  disabled,
  locked,
  highlight,
  label,
  size = 'md',
}: {
  mark?: PeriodMark
  onClick?: () => void
  disabled?: boolean
  /** 눌러도 바뀌지 않는 칸(예: 교과교사 화면의 담임 체크 칸) */
  locked?: boolean
  highlight?: boolean
  label: string
  size?: 'md' | 'lg'
}) {
  const color = mark ? MARK_COLORS[mark] : undefined
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={!!mark}
      aria-label={`${label} ${mark ? MARK_LABELS[mark] : '출석'}`}
      title={mark ? MARK_LABELS[mark] + (locked ? ' (담임 체크)' : '') : '출석'}
      className={cn(
        'relative mx-auto block overflow-hidden rounded-lg border transition-[transform,background-color,border-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]',
        size === 'lg' ? 'h-11 w-11' : 'h-8 w-8',
        mark ? 'border-transparent' : 'border-[#d6d3cc] bg-surface hover:border-accent',
        highlight && !mark && 'bg-[color-mix(in_srgb,var(--accent)_10%,white)] ring-2 ring-accent',
        highlight && mark && 'ring-2 ring-accent',
        disabled && 'cursor-default active:scale-100',
        locked && 'cursor-not-allowed'
      )}
      style={mark ? { backgroundColor: `${color}1f` } : undefined}
    >
      {mark && (
        <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full" aria-hidden>
          <line x1="6" y1="26" x2="26" y2="6" stroke={color} strokeWidth="3.4" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}

/** 색 범례 */
export function MarkLegend({ marks = ['L', 'E', 'A', 'R', 'S'] as PeriodMark[] }: { marks?: PeriodMark[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      {marks.map((m) => (
        <li key={m} className="flex items-center gap-1">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
            <rect x="0.5" y="0.5" width="15" height="15" rx="4" fill={`${MARK_COLORS[m]}1f`} />
            <line x1="3" y1="13" x2="13" y2="3" stroke={MARK_COLORS[m]} strokeWidth="2" strokeLinecap="round" />
          </svg>
          {MARK_LABELS[m]}
        </li>
      ))}
    </ul>
  )
}

export function periodHeader(p: number) {
  return p === 0 ? '조회' : `${p}`
}
