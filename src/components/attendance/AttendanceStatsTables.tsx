import { useMemo, useState, type ReactNode } from 'react'
import {
  CLEANING_THRESHOLD,
  RANK_KEY_LABELS,
  REWARD_RANK_LIMIT,
  cleaningCountFrom,
  rankBy,
  shortDate,
  type AttendanceStat,
  type RankKey,
} from '@/lib/attendance'
import { ChevronUp, Gift, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

/** 개인별 통계: 횟수·점수와 세 가지 순위 */
export function PersonalStatsTable({
  stat,
  ranks,
  total,
}: {
  stat: AttendanceStat
  ranks: Record<RankKey, number>
  total: number
}) {
  const rows: Array<[string, ReactNode]> = [
    ['지각', `${stat.late}회`],
    ['조퇴', `${stat.early}회`],
    ['지각 서류 제출', `${stat.late_doc}회`],
    ['조퇴 서류 제출', `${stat.early_doc}회`],
  ]
  return (
    <div className="space-y-4">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-line">
              <th className="h-9 text-left font-normal text-muted">{label}</th>
              <td className="h-9 text-right tabular-nums text-ink-strong">{value}</td>
            </tr>
          ))}
          <tr>
            <th className="pt-3 text-left align-top font-medium text-ink-strong">
              누적 점수
              <span className="block text-xs font-normal text-muted">지각 1점, 조퇴 2점</span>
            </th>
            <td className="pt-3 text-right">
              <span className="text-2xl font-medium tabular-nums text-ink-strong">{stat.score}점</span>
              <SlashTally late={stat.late} early={stat.early} />
            </td>
          </tr>
        </tbody>
      </table>
      <dl className="grid grid-cols-3 border-t border-line pt-3">
        {(['late', 'early', 'score'] as const).map((k) => (
          <div key={k} className="text-center">
            <dt className="text-xs text-muted">{RANK_KEY_LABELS[k]} 순위</dt>
            <dd className="text-base font-medium tabular-nums text-ink-strong">
              {ranks[k]}
              <span className="text-xs font-normal text-muted"> / {total}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** 출석부에 그은 사선을 기록 수만큼 다시 긋는다: 지각 1회 = 주황 1획, 조퇴 1회 = 보라 1획. 10획을 넘으면 +n */
const TALLY_MAX = 10
function SlashTally({ late, early }: { late: number; early: number }) {
  const marks = [...Array<string>(late).fill('var(--late)'), ...Array<string>(early).fill('var(--early)')]
  if (marks.length === 0) return null
  const shown = marks.slice(0, TALLY_MAX)
  return (
    <span className="mt-1 flex items-center justify-end gap-0.5" aria-label={`지각 ${late}회, 조퇴 ${early}회`}>
      {shown.map((color, i) => (
        <svg key={i} viewBox="0 0 8 12" className="h-3 w-2" aria-hidden>
          <line x1="1" y1="11" x2="7" y2="1" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      ))}
      {marks.length > TALLY_MAX && (
        <span className="ml-1 text-xs tabular-nums text-muted">+{marks.length - TALLY_MAX}</span>
      )}
    </span>
  )
}

/** 순위권 표시: 상품 수령 대상임을 알리는 선물 아이콘 (들샘 지정 유지 요소) */
function RewardSlash() {
  return (
    <span title="문화상품권 대상 순위권" className="ml-1 inline-flex align-middle text-accent-ink">
      <Gift className="h-4 w-4" strokeWidth={1.75} role="img" aria-label="문화상품권 대상 순위권" />
    </span>
  )
}

/**
 * 현재 청소 점수 안내. 집계 기간과 무관하게 마지막 청소 완료 이후로 누적한다.
 * 기준 이상이면 청소 대상 문구를 띄운다. (교사·학생 화면 공용)
 */
export function CleaningNotice({ score, lastReset }: { score: number; lastReset?: string }) {
  const confirmed = score >= CLEANING_THRESHOLD
  return (
    <div className={cn('border-l-2 py-1 pl-3 text-sm', confirmed ? 'border-late' : 'border-line')}>
      {confirmed && <p className="font-semibold text-late-ink">청소 대상입니다</p>}
      <p className="text-ink">
        청소 누적 점수 <span className="font-medium tabular-nums text-ink-strong">{score}점</span>
        {!confirmed && ` / ${CLEANING_THRESHOLD}점이 되면 청소합니다`}
      </p>
      <p className="text-xs text-muted">
        서류 없는 지각 1점, 조퇴 2점 ·{' '}
        {lastReset
          ? `${shortDate(lastReset)} 청소 완료 → 그 주 월요일(${shortDate(cleaningCountFrom(lastReset))})부터`
          : '처음부터'}{' '}
        누적
      </p>
    </div>
  )
}

export interface ClassStatsRow {
  stat: AttendanceStat
  label: ReactNode
}

/**
 * 학급별 통계: 지각·조퇴·총점 열 머리글을 눌러 정렬. 적을수록 높은 순위, 동점은 같은 순위.
 * blindOthers면 highlightId 외 학생의 순위·점수를 가린다(학생 화면).
 */
export function ClassStatsTable({
  rows,
  highlightId,
  onSelect,
  blindOthers = false,
}: {
  rows: ClassStatsRow[]
  highlightId?: string
  onSelect?: (studentId: string) => void
  blindOthers?: boolean
}) {
  const [sortKey, setSortKey] = useState<RankKey>('score')
  const stats = useMemo(() => rows.map((r) => r.stat), [rows])
  const ranks = useMemo(() => rankBy(stats, sortKey), [stats, sortKey])
  const sorted = useMemo(
    () =>
      rows
        .map((r, i) => ({ ...r, order: i }))
        .sort((a, b) => a.stat[sortKey] - b.stat[sortKey] || a.order - b.order),
    [rows, sortKey]
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th className="h-9 w-12 text-center font-normal">순위</th>
            <th className="h-9 text-left font-normal">학생</th>
            {(['late', 'early', 'score'] as const).map((k) => (
              <th key={k} className="h-9 w-16 text-right font-normal">
                <button
                  type="button"
                  onClick={() => setSortKey(k)}
                  className={cn(
                    'inline-flex h-7 items-center gap-0.5 rounded-md px-2 transition-colors duration-150 hover:bg-raised',
                    sortKey === k ? 'font-medium text-accent-ink' : 'text-muted'
                  )}
                  title={`${RANK_KEY_LABELS[k]} 적은 순으로 정렬`}
                >
                  {RANK_KEY_LABELS[k]}
                  {sortKey === k && <ChevronUp className="h-4 w-4" aria-label="적은 순" />}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ stat, label }) => {
            const rank = ranks.get(stat.student_id) ?? 0
            const rewarded = sortKey === 'score' && rank <= REWARD_RANK_LIMIT
            const mine = highlightId === stat.student_id
            if (blindOthers && !mine) {
              return (
                <tr key={stat.student_id} className="h-10 border-b border-line text-faint">
                  <td className="text-center">
                    <Lock className="mx-auto h-4 w-4 text-faint" strokeWidth={1.75} aria-label="비공개" />
                  </td>
                  <td>{label}</td>
                  {(['late', 'early', 'score'] as const).map((k) => (
                    <td key={k} className="select-none pr-2 text-right">
                      ●
                    </td>
                  ))}
                </tr>
              )
            }
            return (
              <tr
                key={stat.student_id}
                onClick={onSelect ? () => onSelect(stat.student_id) : undefined}
                className={cn(
                  'h-10 border-b border-line transition-colors duration-150',
                  mine && 'bg-raised font-medium',
                  onSelect && 'cursor-pointer hover:bg-raised'
                )}
              >
                <td className="whitespace-nowrap text-center tabular-nums text-ink">
                  {rank}
                  {rewarded && <RewardSlash />}
                </td>
                <td className="text-ink-strong">{label}</td>
                {(['late', 'early', 'score'] as const).map((k) => (
                  <td
                    key={k}
                    className={cn(
                      'pr-2 text-right tabular-nums',
                      sortKey === k ? 'font-medium text-ink-strong' : 'text-muted'
                    )}
                  >
                    {stat[k]}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">
        머리글을 누르면 적은 순으로 정렬합니다. 동점은 같은 순위이고, 선물 표시는 총점 {REWARD_RANK_LIMIT}위 이내(동점 포함)입니다.
        {blindOthers && ' 다른 친구의 순위와 점수는 가려져 있습니다.'}
      </p>
    </div>
  )
}
