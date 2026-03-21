const MAX_SEEDS = 500

/** public/policy-tree/ 안의 파일명 (확장자만 바꿀 경우 여기 수정) */
const FILE_NAMES = {
  seed: 'seed.png',
  sprout: 'sprout.png',
  sapling: 'sapling.png',
  tree: 'tree.png',
  fruit: 'tree-fruit.png',
} as const

const STAGE_LABELS: Record<'seed' | 'sprout' | 'sapling' | 'tree' | 'fruit', string> = {
  seed: '씨앗',
  sprout: '새싹',
  sapling: '묘목',
  tree: '나무',
  fruit: '열매 나무',
}

const MOTION: Record<keyof typeof FILE_NAMES, string> = {
  seed: 'policy-tree-motion-seed',
  sprout: 'policy-tree-motion-sprout',
  sapling: 'policy-tree-motion-sapling',
  tree: 'policy-tree-motion-tree',
  fruit: 'policy-tree-motion-fruit',
}

function policyTreeAssetUrl(file: string) {
  return `${import.meta.env.BASE_URL}policy-tree/${file}`
}

/** 구간: 0~50 씨앗, 51~100 새싹, 101~250 묘목, 251~450 나무, 451~ 열매 나무 */
export function getPolicyTreeImageKey(total: number): keyof typeof FILE_NAMES {
  const t = Math.max(0, total)
  if (t <= 50) return 'seed'
  if (t <= 100) return 'sprout'
  if (t <= 250) return 'sapling'
  if (t <= 450) return 'tree'
  return 'fruit'
}

/** 500개 달성 배지 표시 여부 */
export function showPolicyTree500Badge(total: number): boolean {
  return total >= MAX_SEEDS
}

/** @deprecated 이미지 키 기준으로 단계 번호만 필요할 때 */
export function getPolicyTreeStage(total: number): number {
  const k = getPolicyTreeImageKey(total)
  const order: (keyof typeof FILE_NAMES)[] = ['seed', 'sprout', 'sapling', 'tree', 'fruit']
  return order.indexOf(k)
}

type Props = { total: number }

export function PolicyTreeIllustration({ total }: Props) {
  const ratio = Math.min(1, Math.max(0, total / MAX_SEEDS))
  const fillPercent = Math.round(ratio * 100)
  const key = getPolicyTreeImageKey(total)
  const src = policyTreeAssetUrl(FILE_NAMES[key])
  const label = STAGE_LABELS[key]
  const motionClass = MOTION[key]
  const show500Badge = showPolicyTree500Badge(total)

  return (
    <div className="rounded-3xl border-2 border-emerald-200 bg-gradient-to-b from-sky-50 to-emerald-50 p-6 text-center shadow-inner">
      <h3 className="mb-1 text-sm font-bold text-emerald-900">🌳 정책 나무</h3>
      <p className="mb-4 text-[11px] font-medium text-emerald-800/90">
        지금 단계: <span className="text-emerald-700">{label}</span>
        {show500Badge && (
          <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 ring-1 ring-amber-200">
            500개 달성
          </span>
        )}
      </p>
      <div className={`relative mx-auto flex max-w-sm justify-center ${motionClass}`}>
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
    </div>
  )
}
