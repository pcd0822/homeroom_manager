/** 게임오버 타이틀 그래픽 (SVG) */
export function GameOverGraphic({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 100"
      role="img"
      aria-label="게임 오버"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="goFill" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="40%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
        <filter id="goDrop" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.5" />
        </filter>
      </defs>
      <text
        x="160"
        y="62"
        textAnchor="middle"
        fontFamily="system-ui, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"
        fontSize="48"
        fontWeight="900"
        fill="#1c1917"
        stroke="#1c1917"
        strokeWidth="10"
        strokeLinejoin="round"
        paintOrder="stroke fill"
      >
        게임오버!
      </text>
      <text
        x="160"
        y="62"
        textAnchor="middle"
        fontFamily="system-ui, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"
        fontSize="48"
        fontWeight="900"
        fill="url(#goFill)"
        filter="url(#goDrop)"
      >
        게임오버!
      </text>
      <rect x="48" y="82" width="224" height="5" rx="2.5" fill="#0f172a" opacity="0.2" />
      <rect x="56" y="83.5" width="208" height="2" rx="1" fill="#fbbf24" opacity="0.85" />
    </svg>
  )
}
