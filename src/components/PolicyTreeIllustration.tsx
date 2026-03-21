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

/** 어떤 이미지 키를 쓸지 (디버그·다른 UI에서 재사용 가능) */
export function getPolicyTreeImageKey(total: number): keyof typeof FILE_NAMES {
  if (total >= MAX_SEEDS) return 'fruit'
  if (total <= 0) return 'seed'
  if (total < 130) return 'sprout'
  if (total < 300) return 'sapling'
  return 'tree'
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

  return (
    <div className="rounded-3xl border-2 border-emerald-200 bg-gradient-to-b from-sky-50 to-emerald-50 p-6 text-center shadow-inner">
      <h3 className="mb-1 text-sm font-bold text-emerald-900">🌳 정책 나무</h3>
      <p className="mb-4 text-[11px] font-medium text-emerald-800/90">
        지금 단계: <span className="text-emerald-700">{label}</span>
        {key === 'fruit' && (
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
      <p className="mt-1 text-[10px] text-emerald-700/85">
        이미지는 <code className="rounded bg-emerald-100/80 px-1">public/policy-tree/</code> 폴더에 넣어 주세요. (
        <a
          className="underline"
          href={`${import.meta.env.BASE_URL}policy-tree/README.txt`}
          target="_blank"
          rel="noreferrer"
        >
          파일명 안내
        </a>
        )
      </p>
    </div>
  )
}
