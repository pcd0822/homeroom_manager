import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTeacherQuizRanking } from '@/api/api'
import type { TeacherQuizScoreRow } from '@/types'

function friendlyQuizError(err?: string) {
  if (!err) return '랭킹을 불러오지 못했습니다.'
  if (err.includes('Unknown action')) {
    return 'GAS 백엔드에 들샘 모의고사 기능이 아직 배포되지 않았어요. 스크립트 편집기에서 gas/Code.gs를 새 버전으로 배포해 주세요.'
  }
  return err
}

export function TeacherQuizRankingPage() {
  const [rows, setRows] = useState<TeacherQuizScoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    setLoading(true)
    getTeacherQuizRanking(100).then((res) => {
      setLoading(false)
      if (res.success && res.data) {
        setRows(res.data)
        setErr('')
      } else {
        setErr(friendlyQuizError(res.error))
      }
    })
  }, [])

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <Link to="/admin/class-games" className="text-sm text-blue-600 hover:underline">
          ← 학급 게임
        </Link>
      </div>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
        🏆 들샘 모의고사 랭킹
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        학생별 최고 점수 기준입니다. 동점일 경우 재도전 횟수가 적은 쪽이 더 위.
      </p>

      {loading && <p className="mt-6 text-sm text-gray-500">불러오는 중…</p>}
      {err && <p className="mt-6 text-sm text-rose-600">{err}</p>}

      {!loading && !err && (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-rose-50 text-xs font-medium text-rose-700">
              <tr>
                <th className="px-4 py-3">순위</th>
                <th className="px-4 py-3">학번</th>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">점수</th>
                <th className="px-4 py-3">재도전</th>
                <th className="px-4 py-3">기록 시각</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    아직 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.student_id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-bold text-gray-900">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.student_id}</td>
                    <td className="px-4 py-3 text-gray-700">{r.student_name || '—'}</td>
                    <td className="px-4 py-3 font-bold text-rose-600">{r.total_score}P</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.retries}회</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {r.played_at ? new Date(r.played_at).toLocaleString('ko-KR') : '—'}
                    </td>
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
