import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getForm, getResponses, parseFormSchema } from '@/api/api'
import type { Form, ResponseRow, FormSchema } from '@/types'

/** TanStack Table 활용한 응답 데이터 그리드 (초안) */
export function ResponseGridPage() {
  const { formId } = useParams<{ formId: string }>()
  const [form, setForm] = useState<Form | null>(null)
  const [responses, setResponses] = useState<ResponseRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!formId) return
    Promise.all([getForm(formId), getResponses(formId)]).then(([formRes, respRes]) => {
      if (formRes.success && formRes.data) setForm(formRes.data)
      if (respRes.success && respRes.data) setResponses(respRes.data)
      setLoading(false)
    })
  }, [formId])

  if (!formId) {
    return (
      <div className="p-6">
        <p className="text-gray-600">formId가 없습니다.</p>
      </div>
    )
  }

  const parsed = form ? parseFormSchema(form) : null
  const schema = parsed?.schema as FormSchema | null
  const fields = schema?.fields || []

  // answer_data JSON 파싱하여 컬럼 구성
  const rows: Record<string, unknown>[] = responses.map((r) => {
    let data: Record<string, unknown> = {}
    try {
      data = typeof r.answer_data === 'string' ? JSON.parse(r.answer_data) : r.answer_data
    } catch {
      data = {}
    }
    return {
      response_id: r.response_id,
      student_id: r.student_id,
      student_name: r.student_name,
      submitted_at: r.submitted_at,
      ...data,
    } as Record<string, unknown>
  })

  const columns = [
    { key: 'student_id', label: '학번' },
    { key: 'student_name', label: '이름' },
    { key: 'submitted_at', label: '제출일시' },
    ...fields.map((f) => ({ key: f.id, label: f.label })),
  ]

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center gap-4">
        <Link to="/admin" className="text-sm font-medium text-blue-600 hover:underline">
          ← 대시보드
        </Link>
        <h1 className="text-xl font-bold text-gray-900">
          {form ? form.title : '로딩 중...'} — 응답 데이터
        </h1>
      </div>

      {loading ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-gray-500">
                    제출된 응답이 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={String(row.response_id)} className="hover:bg-gray-50">
                    {columns.map((col) => (
                      <td key={col.key} className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {col.key === 'submitted_at' && row[col.key]
                          ? new Date(String(row[col.key])).toLocaleString('ko-KR')
                          : String(row[col.key] ?? '')}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right text-sm">
                      <button
                        type="button"
                        className="text-blue-600 hover:underline"
                        onClick={() => {
                          /* TODO: 수정 모달 */
                        }}
                      >
                        수정
                      </button>
                      <span className="mx-2 text-gray-300">|</span>
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() => {
                          /* TODO: 삭제 확인 후 deleteResponse */
                        }}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  )
}
