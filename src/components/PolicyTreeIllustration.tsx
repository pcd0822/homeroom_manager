const MAX_SEEDS = 500

const STAGE_META = [
  { label: '씨앗', file: 'policy-tree-seed.svg', motion: 'policy-tree-motion-seed' },
  { label: '새싹', file: 'policy-tree-sprout.svg', motion: 'policy-tree-motion-sprout' },
  { label: '묘목', file: 'policy-tree-sapling.svg', motion: 'policy-tree-motion-sapling' },
  { label: '나무', file: 'policy-tree-full.svg', motion: 'policy-tree-motion-tree' },
] as const

/** 학급 총 씨앗 개수로 성장 단계 (0~3) */
export function getPolicyTreeStage(total: number): number {
  if (total <= 0) return 0
  if (total < 130) return 1
  if (total < 300) return 2
  return 3
}

type Props = { total: number }

export function PolicyTreeIllustration({ total }: Props) {
  const ratio = Math.min(1, Math.max(0, total / MAX_SEEDS))
  const fillPercent = Math.round(ratio * 100)
  const stage = getPolicyTreeStage(total)
  const meta = STAGE_META[stage]
  const src = `${import.meta.env.BASE_URL}${meta.file}`

  return (
    <div className="rounded-3xl border-2 border-emerald-200 bg-gradient-to-b from-sky-50 to-emerald-50 p-6 text-center shadow-inner">
      <h3 className="mb-1 text-sm font-bold text-emerald-900">🌳 정책 나무</h3>
      <p className="mb-4 text-[11px] font-medium text-emerald-800/90">
        지금 단계: <span className="text-emerald-700">{meta.label}</span>
      </p>
      <div className={`relative mx-auto flex max-w-sm justify-center ${meta.motion}`}>
        <img src={src} alt="" className="mx-auto h-56 w-full max-w-xs object-contain drop-shadow-lg" />
      </div>
      <div className="mx-auto mt-4 h-3 max-w-xs overflow-hidden rounded-full bg-emerald-100/90 ring-1 ring-emerald-200/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-green-500 to-lime-400 transition-[width] duration-700 ease-out"
          style={{ width: `${fillPercent}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-emerald-800">
        나무 성장도 <span className="font-semibold">{fillPercent}%</span> (목표 {MAX_SEEDS}개 중 {total}개)
      </p>
      <p className="mt-1 text-[10px] text-emerald-700/85">
        씨앗 → 새싹 → 묘목 → 나무로 자라며, 학급 씨앗이 모일수록 단계가 올라가요 🌱
      </p>
    </div>
  )
}
