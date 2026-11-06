import { useId } from 'react'
import { cn } from '@/lib/utils'

/** 도넛 모양 스피너: 옅은 고리 위로 그라데이션 호가 돈다. 앱의 모든 로딩 표시는 이 모양을 쓴다. */
export function DonutSpinner({ size = 44, className }: { size?: number; className?: string }) {
  const gradientId = useId()
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={cn('shrink-0 animate-spin', className)}
      style={{ animationDuration: '0.9s' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="18" stroke="rgba(99, 102, 241, 0.16)" strokeWidth="9" />
      <circle
        cx="24"
        cy="24"
        r="18"
        stroke={`url(#${gradientId})`}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray="75 113"
      />
    </svg>
  )
}

/** 로딩 안내 묶음: 스피너 + 안내 문구. 화면·카드 안 어디에 두어도 가운데 정렬된다. */
export function LoadingSpinner({
  label = '불러오는 중',
  size = 44,
  className,
}: {
  label?: string
  size?: number
  className?: string
}) {
  return (
    <div role="status" className={cn('flex flex-col items-center justify-center gap-3 py-10 text-center', className)}>
      <DonutSpinner size={size} />
      <span className="text-sm font-medium text-gray-500">{label}</span>
    </div>
  )
}
