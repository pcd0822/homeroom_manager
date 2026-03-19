import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getClassGameRanking } from '@/api/api'
import type { ClassGameRankingRow } from '@/types'
import { GAMES_META } from '@/constants/games'

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  const cs = Math.floor((ms % 1000) / 100)
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}.${cs}` : `${r}.${cs}초`
}

export function ClassGameRankingPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const [rows, setRows] = useState<ClassGameRankingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!gameId) {
      setLoading(false)
      return
    }
    setLoading(true)
    getClassGameRanking(gameId, 100).then((res) => {
      setLoading(false)
      if (res.success && Array.isArray(res.data)) {
        setRows(res.data)
        setErr('')
      } else {
        setErr(res.error || '랭킹을 불러오지 못했습니다.')
      }
    })
  }, [gameId])

  const title = gameId ? GAMES_META[gameId]?.title ?? gameId : ''

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <Link to="/admin/class-games" className="text-sm text-blue-600 hover:underline">
          ← 학급 게임
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">플레이어 랭킹</h1>
      {title && <p className="mt-1 text-sm text-gray-600">{title}</p>}

      {loading && <p className="mt-6 text-sm text-gray-500">불러오는 중…</p>}
      {err && <p className="mt-6 text-sm text-red-600">{err}</p>}

      {!loading && !err && (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-600">
              <tr>
                <th className="px-4 py-3">순위</th>
                <th className="px-4 py-3">학번</th>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">최고 생존</th>
                <th className="px-4 py-3">기록 시각</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    아직 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.student_id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{i + 1}</td>
                    <td className="px-4 py-3 text-gray-700">{r.student_id}</td>
                    <td className="px-4 py-3 text-gray-700">{r.student_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-900">{formatDuration(r.duration_ms)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.played_at || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
