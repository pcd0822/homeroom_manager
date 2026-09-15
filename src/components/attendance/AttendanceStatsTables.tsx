import { useMemo, useState, type ReactNode } from 'react'
import {
  RANK_KEY_LABELS,
  REWARD_RANK_LIMIT,
  rankBy,
  type AttendanceStat,
  type RankKey,
} from '@/lib/attendance'
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
    <div className="space-y-3">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-gray-100">
              <th className="py-2 text-left font-medium text-gray-600">{label}</th>
              <td className="py-2 text-right tabular-nums text-gray-900">{value}</td>
            </tr>
          ))}
          <tr className="border-b border-gray-100">
            <th className="py-2 text-left font-semibold text-gray-800">
              누적 점수
              <span className="ml-1 text-[11px] font-normal text-gray-400">(지각 1 · 조퇴 2)</span>
            </th>
            <td className="py-2 text-right text-base font-bold tabular-nums text-blue-700">{stat.score}점</td>
          </tr>
          <tr>
            <th className="py-2 text-left font-medium text-gray-600">
              청소 점수
              <span className="ml-1 text-[11px] font-normal text-gray-400">(서류 제출분 제외)</span>
            </th>
            <td className="py-2 text-right tabular-nums text-gray-900">{stat.cleaning_score}점</td>
          </tr>
        </tbody>
      </table>
      <div className="grid grid-cols-3 gap-2">
        {(['late', 'early', 'score'] as const).map((k) => (
          <div key={k} className="rounded-lg bg-gray-50 px-2 py-2 text-center">
            <p className="text-[11px] text-gray-500">{RANK_KEY_LABELS[k]} 순위</p>
            <p className="text-lg font-bold tabular-nums text-gray-900">
              {ranks[k]}
              <span className="text-xs font-normal text-gray-400"> / {total}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface ClassStatsRow {
  stat: AttendanceStat
  label: ReactNode
}

/** 학급별 통계: 지각·조퇴·총점 열 머리글을 눌러 정렬. 적을수록 높은 순위, 동점은 같은 순위. */
export function ClassStatsTable({
  rows,
  highlightId,
  onSelect,
}: {
  rows: ClassStatsRow[]
  highlightId?: string
  onSelect?: (studentId: string) => void
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
          <tr className="border-b border-gray-200 text-xs text-gray-500">
            <th className="w-12 py-2 text-center font-medium">순위</th>
            <th className="py-2 text-left font-medium">학생</th>
            {(['late', 'early', 'score'] as const).map((k) => (
              <th key={k} className="w-16 py-2 text-right font-medium">
                <button
                  type="button"
                  onClick={() => setSortKey(k)}
                  className={cn(
                    'rounded px-1.5 py-0.5 hover:bg-gray-100',
                    sortKey === k ? 'font-bold text-blue-700' : 'text-gray-500'
                  )}
                  title={`${RANK_KEY_LABELS[k]} 적은 순으로 정렬`}
                >
                  {RANK_KEY_LABELS[k]}
                  {sortKey === k ? ' ▲' : ''}
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
            return (
              <tr
                key={stat.student_id}
                onClick={onSelect ? () => onSelect(stat.student_id) : undefined}
                className={cn(
                  'border-b border-gray-100',
                  mine && 'bg-blue-50 font-semibold',
                  onSelect && 'cursor-pointer hover:bg-gray-50'
                )}
              >
                <td className="py-1.5 text-center tabular-nums text-gray-700">
                  {rank}
                  {rewarded && <span title="문화상품권 대상 순위권"> 🎁</span>}
                </td>
                <td className="py-1.5 text-gray-800">{label}</td>
                {(['late', 'early', 'score'] as const).map((k) => (
                  <td
                    key={k}
                    className={cn(
                      'py-1.5 pr-2 text-right tabular-nums',
                      sortKey === k ? 'font-semibold text-gray-900' : 'text-gray-500'
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
      <p className="mt-2 text-[11px] text-gray-400">
        머리글을 누르면 그 항목이 적은 순으로 정렬됩니다. 동점은 같은 순위입니다. 🎁는 총점 {REWARD_RANK_LIMIT}위
        이내(동점 포함)입니다.
      </p>
    </div>
  )
}
