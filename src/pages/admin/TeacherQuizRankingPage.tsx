import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTeacherQuizRanking, getTeacherQuizSurveys } from '@/api/api'
import type { TeacherQuizScoreRow, TeacherQuizSurveyRow } from '@/types'

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
  const [selected, setSelected] = useState<TeacherQuizScoreRow | null>(null)
  const [surveyRows, setSurveyRows] = useState<TeacherQuizSurveyRow[]>([])
  const [surveyLoading, setSurveyLoading] = useState(false)
  const [surveyErr, setSurveyErr] = useState('')

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

  const openSurvey = async (row: TeacherQuizScoreRow) => {
    setSelected(row)
    setSurveyRows([])
    setSurveyErr('')
    setSurveyLoading(true)
    const res = await getTeacherQuizSurveys(row.student_id, row.played_at)
    setSurveyLoading(false)
    if (res.success && res.data) {
      setSurveyRows(res.data)
    } else {
      setSurveyErr(friendlyQuizError(res.error))
    }
  }

  const closeSurvey = () => {
    setSelected(null)
    setSurveyRows([])
    setSurveyErr('')
  }

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
        <br />
        <span className="text-xs text-gray-500">행을 클릭하면 해당 학생의 설문형 응답을 볼 수 있어요.</span>
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
                  <tr
                    key={r.student_id}
                    onClick={() => openSurvey(r)}
                    className="cursor-pointer border-t border-gray-100 transition-colors hover:bg-rose-50/60"
                  >
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

      {selected && (
        <SurveyModal
          row={selected}
          loading={surveyLoading}
          error={surveyErr}
          surveys={surveyRows}
          onClose={closeSurvey}
        />
      )}
    </div>
  )
}

function SurveyModal({
  row,
  loading,
  error,
  surveys,
  onClose,
}: {
  row: TeacherQuizScoreRow
  loading: boolean
  error: string
  surveys: TeacherQuizSurveyRow[]
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              📝 {row.student_name || row.student_id}님의 설문 응답
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              학번 {row.student_id} · {row.total_score}P · 기록 시각{' '}
              {row.played_at ? new Date(row.played_at).toLocaleString('ko-KR') : '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            닫기
          </button>
        </div>

        {loading && <p className="text-sm text-gray-500">응답을 불러오는 중…</p>}
        {error && <p className="text-sm text-rose-600">{error}</p>}

        {!loading && !error && (
          surveys.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
              이 학생은 설문형 문항에 응답한 기록이 없어요.
            </p>
          ) : (
            <ul className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {surveys.map((s, i) => (
                <li
                  key={`${s.question_id || 'q'}-${i}`}
                  className="rounded-xl border border-sky-200 bg-sky-50 p-3"
                >
                  <p className="text-xs font-semibold text-sky-700">Q{i + 1}. {s.question || '(질문 없음)'}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{s.answer || '(빈 응답)'}</p>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  )
}
