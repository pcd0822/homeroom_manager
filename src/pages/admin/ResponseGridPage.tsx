import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getForm, getResponses, parseFormSchema, updateResponse, deleteResponse } from '@/api/api'
import type { Form, ResponseRow, FormSchema, FormFieldSchema } from '@/types'

const META_KEYS = ['response_id', 'student_id', 'student_name', 'submitted_at']

function pickAnswerData(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (META_KEYS.includes(k)) continue
    out[k] = v
  }
  return out
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/** 응답 로우 데이터를 HTML로 띄우고 인쇄 (PDF 저장 가능) */
function printResponsesAsPdf(
  title: string,
  columns: { key: string; label: string }[],
  rows: Record<string, unknown>[]
) {
  const docTitle = `${title} — 응답 데이터`
  const thCells = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')
  const bodyRows =
    rows.length === 0
      ? '<tr><td colspan="' + columns.length + '" class="empty">제출된 응답이 없습니다.</td></tr>'
      : rows
          .map((row) => {
            const cells = columns
              .map((col) => {
                const val = row[col.key]
                let text = ''
                if (col.key === 'submitted_at' && val) {
                  text = new Date(String(val)).toLocaleString('ko-KR')
                } else if (Array.isArray(val)) {
                  text = (val as string[]).join(', ')
                } else {
                  text = String(val ?? '')
                }
                return `<td>${escapeHtml(text)}</td>`
              })
              .join('')
            return `<tr>${cells}</tr>`
          })
          .join('')

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(docTitle)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
  <style>
    body { font-family: 'Pretendard', sans-serif; padding: 20px; font-size: 12px; color: #111; }
    h1 { font-size: 18px; margin: 0 0 16px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; }
    th { background: #2563eb; color: #fff; font-weight: 600; }
    .no-print { display: none !important; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(docTitle)}</h1>
  <table>
    <thead><tr>${thCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <p class="no-print" style="margin-top: 20px; font-size: 11px; color: #6b7280;">
    인쇄 대화상자에서 「대상: PDF로 저장」을 선택하면 PDF로 저장할 수 있습니다.
  </p>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    alert('팝업이 차단되었을 수 있습니다. 팝업을 허용한 뒤 다시 시도해 주세요.')
    return
  }
  win.document.write(html)
  win.document.close()
}

/** 응답 데이터 그리드 — 수정/삭제 지원 */
export function ResponseGridPage() {
  const { formId } = useParams<{ formId: string }>()
  const [form, setForm] = useState<Form | null>(null)
  const [responses, setResponses] = useState<ResponseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null)
  const [editAnswer, setEditAnswer] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadResponses = useCallback(() => {
    if (!formId) return
    getResponses(formId).then((res) => {
      if (res.success && res.data) setResponses(res.data)
    })
  }, [formId])

  useEffect(() => {
    if (!formId) return
    setLoading(true)
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

  const handleDelete = (responseId: string, studentName: string) => {
    if (!confirm(`"${studentName}"님의 응답을 삭제할까요?`)) return
    setDeletingId(responseId)
    deleteResponse(responseId)
      .then((res) => {
        if (res.success) loadResponses()
        else alert(res.error || '삭제에 실패했습니다.')
      })
      .finally(() => setDeletingId(null))
  }

  const openEdit = (row: Record<string, unknown>) => {
    setEditRow(row)
    setEditAnswer(pickAnswerData(row))
  }

  const handleSaveEdit = () => {
    if (!editRow?.response_id) return
    setSaving(true)
    updateResponse({
      response_id: String(editRow.response_id),
      answer_data: editAnswer,
    })
      .then((res) => {
        if (res.success) {
          setEditRow(null)
          loadResponses()
        } else {
          alert(res.error || '저장에 실패했습니다.')
        }
      })
      .finally(() => setSaving(false))
  }

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="text-sm font-medium text-blue-600 hover:underline">
            ← 대시보드
          </Link>
          <h1 className="text-xl font-bold text-gray-900">
            {form ? form.title : '로딩 중...'} — 응답 데이터
          </h1>
        </div>
        {!loading && (
          <button
            type="button"
            onClick={() => printResponsesAsPdf(form?.title ?? '문서', columns, rows)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            PDF 인쇄
          </button>
        )}
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
                        onClick={() => openEdit(row)}
                      >
                        수정
                      </button>
                      <span className="mx-2 text-gray-300">|</span>
                      <button
                        type="button"
                        className="text-red-600 hover:underline disabled:opacity-50"
                        onClick={() => handleDelete(String(row.response_id), String(row.student_name ?? ''))}
                        disabled={deletingId === row.response_id}
                      >
                        {deletingId === row.response_id ? '삭제 중...' : '삭제'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

        {/* 응답 수정 모달 */}
        {editRow && schema?.fields && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-response-title"
          >
            <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <h2 id="edit-response-title" className="text-lg font-semibold text-gray-900">
                  응답 수정 — {String(editRow.student_name)} ({String(editRow.student_id)})
                </h2>
                <button
                  type="button"
                  onClick={() => setEditRow(null)}
                  className="rounded p-2 text-gray-500 hover:bg-gray-100"
                  aria-label="닫기"
                >
                  <span className="text-xl leading-none">×</span>
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
                <div className="space-y-3">
                  {schema.fields.map((f: FormFieldSchema) => {
                    const raw = editAnswer[f.id]
                    const display = Array.isArray(raw) ? (raw as string[]).join(', ') : String(raw ?? '')
                    return (
                      <div key={f.id}>
                        <label className="mb-1 block text-sm font-medium text-gray-700">{f.label}</label>
                        {f.type === 'textarea' ? (
                          <textarea
                            value={display}
                            onChange={(e) => setEditAnswer((prev) => ({ ...prev, [f.id]: e.target.value }))}
                            rows={3}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          />
                        ) : (
                          <input
                            type="text"
                            value={display}
                            onChange={(e) => {
                              const v = e.target.value
                              setEditAnswer((prev) => ({
                                ...prev,
                                [f.id]: f.type === 'checkbox' && v ? v.split(',').map((s) => s.trim()).filter(Boolean) : v,
                              }))
                            }}
                            placeholder={f.type === 'checkbox' ? '쉼표로 구분' : undefined}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setEditRow(null)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
