import { useEffect, useState } from 'react'
import { getForm, updateForm, parseFormSchema } from '@/api/api'
import type { Form, Folder, FormSchema, FormFieldSchema, FieldType } from '@/types'

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: '한 줄 텍스트' },
  { value: 'textarea', label: '여러 줄 텍스트' },
  { value: 'number', label: '숫자' },
  { value: 'date', label: '날짜' },
  { value: 'radio', label: '객관식(라디오)' },
  { value: 'checkbox', label: '체크박스' },
]

function generateFieldId() {
  return 'f_' + Math.random().toString(36).slice(2, 10)
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export function FormEditSlidePanel({
  form,
  folders,
  onClose,
  onSaved,
  className,
}: {
  form: Form
  folders: Folder[]
  onClose: () => void
  onSaved: () => void
  className?: string
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [formType, setFormType] = useState<'survey' | 'notice'>('notice')
  const [folderId, setFolderId] = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState<FormFieldSchema[]>([])

  useEffect(() => {
    getForm(form.form_id).then((res) => {
      if (res.success && res.data) {
        const f = res.data
        const parsed = parseFormSchema(f)
        setTitle(f.title)
        setFormType((f.type as 'survey' | 'notice') || 'notice')
        setFolderId(f.folder_id || '')
        setDescription(parsed.schema?.body ?? '')
        setFields(parsed.schema?.fields ?? [])
      }
      setLoading(false)
    })
  }, [form.form_id])

  const updateField = (id: string, patch: Partial<FormFieldSchema>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }
  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id))
  }
  const addField = () => {
    setFields((prev) => [...prev, { id: generateFieldId(), type: 'text', label: '', required: false }])
  }
  const addOption = (fieldId: string, label?: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f
        const opts = f.options || []
        return { ...f, options: [...opts, label ?? `선택지 ${opts.length + 1}`] }
      })
    )
  }
  const updateOption = (fieldId: string, idx: number, value: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId || !f.options) return f
        const next = [...f.options]
        next[idx] = value
        return { ...f, options: next }
      })
    )
  }
  const removeOption = (fieldId: string, idx: number) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId || !f.options) return f
        return { ...f, options: f.options.filter((_, i) => i !== idx) }
      })
    )
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('제목을 입력해 주세요.')
      return
    }
    setError('')
    setSaving(true)
    const schema: FormSchema = {
      fields: formType === 'survey' ? fields : [],
      body: description.trim() || undefined,
    }
    updateForm({
      form_id: form.form_id,
      title: title.trim(),
      type: formType,
      folder_id: folderId || undefined,
      schema,
    })
      .then((res) => {
        if (res.success) {
          onSaved()
          onClose()
        } else {
          setError(res.error || '저장 실패')
        }
      })
      .finally(() => setSaving(false))
  }

  return (
    <div className={`fixed inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-2xl sm:max-w-xl ${className ?? ''}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-900">문서 수정</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="닫기"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-gray-500">불러오는 중...</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-600">문서 유형</label>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    checked={formType === 'notice'}
                    onChange={() => setFormType('notice')}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm">공지</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    checked={formType === 'survey'}
                    onChange={() => setFormType('survey')}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm">설문</span>
                </label>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">폴더</label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">선택 안 함</option>
                {folders.map((f) => (
                  <option key={f.folder_id} value={f.folder_id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">설명 / 본문</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            {formType === 'survey' && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-600">설문 항목</label>
                  <button type="button" onClick={addField} className="text-sm font-medium text-blue-600 hover:underline">
                    + 항목 추가
                  </button>
                </div>
                <div className="space-y-3">
                  {fields.map((field) => (
                    <div key={field.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <select
                          value={field.type}
                          onChange={(e) => {
                            const t = e.target.value as FieldType
                            updateField(field.id, { type: t })
                            if ((t === 'radio' || t === 'checkbox') && !field.options?.length) {
                              updateField(field.id, { options: ['선택지 1'] })
                            }
                          }}
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                        >
                          {FIELD_TYPES.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateField(field.id, { label: e.target.value })}
                          placeholder="질문"
                          className="min-w-[100px] flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                        <label className="flex items-center gap-1 text-sm">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(field.id, { required: e.target.checked })}
                          />
                          필수
                        </label>
                        <button type="button" onClick={() => removeField(field.id)} className="text-sm text-red-600 hover:underline">
                          삭제
                        </button>
                      </div>
                      {(field.type === 'radio' || field.type === 'checkbox') && (
                        <div className="mt-2 space-y-1">
                          <div className="flex gap-1">
                            <button type="button" onClick={() => addOption(field.id)} className="text-xs text-blue-600 hover:underline">
                              + 선택지
                            </button>
                            {!(field.options || []).includes('기타') && (
                              <button type="button" onClick={() => addOption(field.id, '기타')} className="text-xs text-amber-600 hover:underline">
                                + 기타
                              </button>
                            )}
                          </div>
                          <ul className="space-y-1">
                            {(field.options || []).map((opt, i) => (
                              <li key={i} className="flex gap-2">
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => updateOption(field.id, i, e.target.value)}
                                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                                />
                                <button type="button" onClick={() => removeOption(field.id, i)} className="text-gray-400 hover:text-red-600">
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {error && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800">{error}</p>}
            <div className="flex gap-2 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
