import { useEffect, useState } from 'react'
import { getForm, updateForm, parseFormSchema, getStudents, getAssignmentsByForm, saveAssignments } from '@/api/api'
import type { Form, Folder, FormSchema, FormFieldSchema, FieldType, Student } from '@/types'
import { StudentAssignmentCard } from '@/components/cleaning/StudentAssignmentCard'

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
  const [consentEnabled, setConsentEnabled] = useState(false)
  const [consentTitle, setConsentTitle] = useState('')
  const [consentBody, setConsentBody] = useState('')
  const [consentOptions, setConsentOptions] = useState<string[]>([])

  // 과제 배당 상태
  const [students, setStudents] = useState<Student[]>([])
  const [assignedIds, setAssignedIds] = useState<string[]>([])
  const [assignStart, setAssignStart] = useState('')
  const [assignEnd, setAssignEnd] = useState('')

  useEffect(() => {
    Promise.all([getForm(form.form_id), getStudents(), getAssignmentsByForm(form.form_id)]).then(
      ([res, stuRes, assignRes]) => {
        if (res.success && res.data) {
          const f = res.data
          const parsed = parseFormSchema(f)
          setTitle(f.title)
          setFormType((f.type as 'survey' | 'notice') || 'notice')
          setFolderId(f.folder_id || '')
          setDescription(parsed.schema?.body ?? '')
          setFields(parsed.schema?.fields ?? [])
          if (parsed.schema?.consent) {
            setConsentEnabled(true)
            setConsentTitle(parsed.schema.consent.title)
            setConsentBody(parsed.schema.consent.body)
            setConsentOptions(parsed.schema.consent.options || [])
          } else {
            setConsentEnabled(false)
            setConsentTitle('')
            setConsentBody('')
            setConsentOptions([])
          }
        }
        if (stuRes.success && stuRes.data) {
          setStudents(stuRes.data)
        }
        if (assignRes.success && assignRes.data) {
          const ids = Array.from(new Set(assignRes.data.map((a) => a.student_id)))
          setAssignedIds(ids)
          if (assignRes.data.length > 0) {
            setAssignStart(assignRes.data[0].start_date || '')
            setAssignEnd(assignRes.data[0].end_date || '')
          }
        }
        setLoading(false)
      }
    )
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
    const trimmedConsentOptions = consentOptions.map((o) => o.trim()).filter(Boolean)
    const schema: FormSchema = {
      fields: formType === 'survey' ? fields : [],
      body: description.trim() || undefined,
      consent:
        formType === 'notice' && consentEnabled && consentTitle.trim()
          ? {
              title: consentTitle.trim(),
              body: consentBody.trim(),
              options: trimmedConsentOptions.length ? trimmedConsentOptions : undefined,
            }
          : undefined,
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
          // 과제 배당 저장 (공지 + 기간과 대상이 있을 때)
          if (
            formType === 'notice' &&
            assignedIds.length > 0 &&
            assignStart.trim() &&
            assignEnd.trim()
          ) {
            const items = assignedIds.map((sid) => ({
              student_id: sid,
              start_date: assignStart,
              end_date: assignEnd,
            }))
            saveAssignments(form.form_id, items).finally(() => {
              onSaved()
              onClose()
            })
          } else {
            onSaved()
            onClose()
          }
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
            {formType === 'notice' && (
              <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={consentEnabled}
                    onChange={(e) => setConsentEnabled(e.target.checked)}
                    className="h-4 w-4 text-blue-600"
                  />
                  가정통신문 하단에 동의서 작성 영역 추가
                </label>
                {consentEnabled && (
                  <div className="space-y-2 pl-5">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">동의서 제목</label>
                      <input
                        type="text"
                        value={consentTitle}
                        onChange={(e) => setConsentTitle(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">동의서 본문</label>
                      <textarea
                        value={consentBody}
                        onChange={(e) => setConsentBody(e.target.value)}
                        rows={4}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">동의 선택지 (체크박스)</span>
                        <button
                          type="button"
                          onClick={() => setConsentOptions((prev) => [...prev, ''])}
                          className="rounded border border-blue-500 px-2 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50"
                        >
                          + 선택지 추가
                        </button>
                      </div>
                      {consentOptions.length === 0 && (
                        <p className="text-[11px] text-gray-500">선택지를 추가하면 학생이 체크박스로 동의 여부를 선택할 수 있습니다.</p>
                      )}
                      <ul className="space-y-1.5">
                        {consentOptions.map((opt, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) =>
                                setConsentOptions((prev) =>
                                  prev.map((v, i) => (i === idx ? e.target.value : v))
                                )
                              }
                              placeholder={`선택지 ${idx + 1}`}
                              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setConsentOptions((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-600"
                              aria-label="선택지 삭제"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
            {formType === 'notice' && (
              <section className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <h3 className="text-xs font-semibold text-gray-700">과제 배당 대상 선택</h3>
                <p className="text-[11px] text-gray-500">
                  이 문서를 과제로 사용할 경우, 학생 카드로 배당 대상을 선택하고 과제 수행 기간을 설정할 수 있습니다.
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                  <span>과제 수행 기간</span>
                  <input
                    type="date"
                    value={assignStart}
                    onChange={(e) => setAssignStart(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-[11px]"
                  />
                  <span>~</span>
                  <input
                    type="date"
                    value={assignEnd}
                    onChange={(e) => setAssignEnd(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-[11px]"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-gray-700">학생 목록</p>
                    <div className="max-h-52 space-y-1.5 overflow-y-auto rounded border border-gray-200 p-2">
                      {students.map((s) => {
                        const selected = assignedIds.includes(s.student_id)
                        return (
                          <button
                            key={s.student_id}
                            type="button"
                            onClick={() =>
                              setAssignedIds((prev) =>
                                prev.includes(s.student_id)
                                  ? prev.filter((id) => id !== s.student_id)
                                  : [...prev, s.student_id]
                              )
                            }
                            className={`w-full rounded border px-2 py-1 text-left text-[11px] ${
                              selected
                                ? 'border-blue-500 bg-blue-50 text-blue-800'
                                : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-gray-100">
                                {s.photo_data ? (
                                  <img
                                    src={
                                      s.photo_data.startsWith('data:')
                                        ? s.photo_data
                                        : `data:image/jpeg;base64,${s.photo_data}`
                                    }
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[11px] text-gray-400">
                                    {s.name.charAt(0) || '?'}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{s.name}</p>
                                <p className="text-[10px] text-gray-500">{s.student_id}</p>
                              </div>
                              {selected && (
                                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                                  배당
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                      {students.length === 0 && (
                        <p className="text-[11px] text-gray-400">
                          등록된 학생이 없습니다. 학생관리에서 학생을 먼저 등록해 주세요.
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-gray-700">배당된 학생</p>
                    <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto rounded border border-gray-200 p-2">
                      {assignedIds.length === 0 && (
                        <p className="text-[11px] text-gray-400">배당된 학생이 없습니다.</p>
                      )}
                      {assignedIds.map((sid) => {
                        const stu = students.find((s) => s.student_id === sid)
                        if (!stu) return null
                        return (
                          <div key={sid} className="group relative">
                            <button
                              type="button"
                              onClick={() =>
                                setAssignedIds((prev) => prev.filter((id) => id !== sid))
                              }
                              className="absolute right-1 top-1 hidden rounded-full bg-black/60 px-1 text-[10px] text-white group-hover:block"
                              aria-label="배당 취소"
                            >
                              ×
                            </button>
                            <StudentAssignmentCard
                              studentId={stu.student_id}
                              name={stu.name}
                              photoData={stu.photo_data}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </section>
            )}
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
