import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFolders, createForm, getStudents, saveAssignments } from '@/api/api'
import type { Folder, FormSchema, FormFieldSchema, FieldType, Student } from '@/types'
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

export function FormBuilderPage() {
  const navigate = useNavigate()
  const [folders, setFolders] = useState<Folder[]>([])
  const [formType, setFormType] = useState<'survey' | 'notice'>('notice')
  const [title, setTitle] = useState('')
  const [folderId, setFolderId] = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState<FormFieldSchema[]>([])
  const [consentEnabled, setConsentEnabled] = useState(false)
  const [consentTitle, setConsentTitle] = useState('')
  const [consentBody, setConsentBody] = useState('')
  const [consentOptions, setConsentOptions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 과제 배당용 상태
  const [students, setStudents] = useState<Student[]>([])
  const [assignedIds, setAssignedIds] = useState<string[]>([])
  const [bulkAssign, setBulkAssign] = useState(false)
  const [assignStart, setAssignStart] = useState('')
  const [assignEnd, setAssignEnd] = useState('')
  const [assignSearch, setAssignSearch] = useState('')

  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatReply, setChatReply] = useState('')

  useEffect(() => {
    getFolders().then((res) => {
      if (res.success && res.data) setFolders(res.data)
    })
    getStudents().then((res) => {
      if (res.success && res.data) setStudents(res.data)
    })
  }, [])

  const addField = () => {
    setFields((prev) => [
      ...prev,
      { id: generateFieldId(), type: 'text', label: '', required: false },
    ])
  }

  const updateField = (id: string, patch: Partial<FormFieldSchema>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id))
  }

  /** 선택형 필드: 선택지 추가 */
  const addOption = (fieldId: string, label?: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f
        const opts = f.options || []
        const newLabel = label ?? `선택지 ${opts.length + 1}`
        return { ...f, options: [...opts, newLabel] }
      })
    )
  }

  /** 선택형 필드: 선택지 내용 변경 */
  const updateOption = (fieldId: string, index: number, value: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId || !f.options) return f
        const next = [...f.options]
        next[index] = value
        return { ...f, options: next }
      })
    )
  }

  /** 선택형 필드: 선택지 삭제 */
  const removeOption = (fieldId: string, index: number) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId || !f.options) return f
        const next = f.options.filter((_, i) => i !== index)
        return { ...f, options: next }
      })
    )
  }

  const handleChat = async () => {
    const msg = chatInput.trim()
    if (!msg) return
    setChatLoading(true)
    setChatReply('')
    try {
      const res = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      if (res.ok && data.reply) {
        setChatReply(data.reply)
      } else {
        setChatReply(data.error || '응답을 불러오지 못했습니다. (Netlify 배포 환경에서 OPENAI_API_KEY를 설정해 주세요.)')
      }
    } catch {
      setChatReply('챗봇 요청에 실패했습니다. Netlify에 배포한 뒤 사용해 주세요.')
    } finally {
      setChatLoading(false)
    }
  }

  const copyReply = () => {
    if (chatReply) {
      navigator.clipboard.writeText(chatReply)
      setDescription((prev) => prev ? prev + '\n\n' + chatReply : chatReply)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
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
    createForm({
      folder_id: folderId || undefined,
      title: title.trim(),
      type: formType,
      schema,
    })
      .then((res) => {
        if (res.success && res.data?.form_id) {
          // 과제 배당 저장 (배당 대상이 있고 기간이 설정된 경우)
          if (
            assignedIds.length > 0 &&
            assignStart.trim() &&
            assignEnd.trim()
          ) {
            const items = assignedIds.map((sid) => ({
              student_id: sid,
              start_date: assignStart,
              end_date: assignEnd,
            }))
            saveAssignments(res.data.form_id, items).finally(() => {
              navigate('/admin')
            })
            return
          }
          navigate('/admin')
        } else {
          setError(res.error || '저장 실패')
        }
      })
      .finally(() => setSaving(false))
  }

  return (
    <div className="min-h-full">
      <div className="mx-auto flex max-w-6xl gap-8">
        {/* 왼쪽: 폼 빌더 */}
        <form onSubmit={handleSubmit} className="min-w-0 flex-1 space-y-6">
          <header className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">새 문서 만들기</h1>
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              ← 목록
            </button>
          </header>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-medium text-gray-700">기본 정보</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">문서 유형</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="formType"
                      checked={formType === 'notice'}
                      onChange={() => setFormType('notice')}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm">공지 (가정통신문 등)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="formType"
                      checked={formType === 'survey'}
                      onChange={() => setFormType('survey')}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm">설문</span>
                  </label>
                </div>
              </div>
              <div>
                <label htmlFor="title" className="mb-1 block text-xs font-medium text-gray-600">제목</label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 2026학년도 1학기 학부모 총회 안내"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="folder" className="mb-1 block text-xs font-medium text-gray-600">폴더</label>
                <select
                  id="folder"
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
                <label htmlFor="description" className="mb-1 block text-xs font-medium text-gray-600">
                  설명 / 본문 (공지는 여기에 안내 문구, 설문은 안내 문구 입력)
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="오른쪽 챗봇으로 문구를 생성한 뒤 복사해 붙여넣기 하세요."
                  rows={8}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              {formType === 'notice' && (
                <div className="mt-2 space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
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
                          placeholder="예: 개인정보 수집·이용 동의"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">동의서 본문</label>
                        <textarea
                          value={consentBody}
                          onChange={(e) => setConsentBody(e.target.value)}
                          rows={4}
                          placeholder="동의서 내용을 입력하세요."
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
            </div>
          </div>

          {(
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-sm font-medium text-gray-700">과제 배당 대상 선택</h2>
              <p className="mb-3 text-xs text-gray-500">
                학생관리에서 등록된 학생들 중 과제를 배당할 대상을 선택하세요. 가정통신문 문구 도우미 아래 영역입니다.
              </p>
              <div className="mb-3 flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={bulkAssign}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setBulkAssign(checked)
                      if (checked) {
                        setAssignedIds(students.map((s) => s.student_id))
                      }
                    }}
                    className="h-4 w-4 text-blue-600"
                  />
                  전체 학생 일괄 배당
                </label>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span>과제 수행 기간</span>
                  <input
                    type="date"
                    value={assignStart}
                    onChange={(e) => setAssignStart(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                  <span>~</span>
                  <input
                    type="date"
                    value={assignEnd}
                    onChange={(e) => setAssignEnd(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                  {assignStart && assignEnd && (
                    <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                      기간 설정 완료
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-gray-700">학생 목록</h3>
                    <input
                      type="text"
                      value={assignSearch}
                      onChange={(e) => setAssignSearch(e.target.value)}
                      placeholder="학번 또는 이름 검색"
                      className="w-40 flex-shrink rounded-md border border-gray-300 px-2 py-1 text-[11px]"
                    />
                  </div>
                  <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-2">
                    {students
                      .filter((s) => {
                        const q = assignSearch.trim()
                        if (!q) return true
                        return s.student_id.includes(q) || s.name.includes(q)
                      })
                      .map((s) => {
                      const selected = assignedIds.includes(s.student_id)
                      return (
                        <button
                          key={s.student_id}
                          type="button"
                          onClick={() => {
                            setAssignedIds((prev) =>
                              prev.includes(s.student_id)
                                ? prev.filter((id) => id !== s.student_id)
                                : [...prev, s.student_id]
                            )
                          }}
                          className={`w-full rounded-lg border px-2 py-1.5 text-left text-xs transition ${
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
                              <p className="truncate text-xs font-medium">{s.name}</p>
                              <p className="text-[11px] text-gray-500">{s.student_id}</p>
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
                      <p className="text-xs text-gray-400">등록된 학생이 없습니다. 먼저 학생관리에서 학생을 추가해 주세요.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold text-gray-700">배당된 학생</h3>
                  <div className="flex max-h-60 flex-col gap-2 overflow-y-auto rounded-lg border border-gray-200 p-2">
                    {assignedIds.length === 0 && (
                      <p className="text-xs text-gray-400">아직 배당된 학생이 없습니다.</p>
                    )}
                    {assignedIds.map((sid) => {
                      const stu = students.find((s) => s.student_id === sid)
                      if (!stu) return null
                      return (
                        <div
                          key={sid}
                          className="group relative"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setAssignedIds((prev) => prev.filter((id) => id !== sid))
                            }
                            className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-0.5 text-white group-hover:block"
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
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-700">설문 항목</h2>
                <button
                  type="button"
                  onClick={addField}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  + 항목 추가
                </button>
              </div>
              <div className="space-y-4">
                {fields.map((field) => (
                  <div key={field.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <select
                      value={field.type}
                      onChange={(e) => {
                        const newType = e.target.value as FieldType
                        const patch: Partial<FormFieldSchema> = { type: newType }
                        if ((newType === 'radio' || newType === 'checkbox') && !(field.options?.length)) {
                          patch.options = ['선택지 1']
                        }
                        updateField(field.id, patch)
                      }}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      {FIELD_TYPES.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      placeholder="질문/항목 이름"
                      className="flex-1 min-w-[120px] rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                      />
                      필수
                    </label>
                    {(field.type === 'radio' || field.type === 'checkbox') && (
                      <div className="w-full space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600">선택지</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => addOption(field.id)}
                              className="rounded border border-blue-600 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                            >
                              + 선택지 추가
                            </button>
                            {!(field.options || []).includes('기타') && (
                              <button
                                type="button"
                                onClick={() => addOption(field.id, '기타')}
                                className="rounded border border-amber-500 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50"
                              >
                                + 기타
                              </button>
                            )}
                          </div>
                        </div>
                        <ul className="space-y-1.5">
                          {(field.options || []).map((opt, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => updateOption(field.id, idx, e.target.value)}
                                placeholder={`선택지 ${idx + 1}`}
                                className="flex-1 min-w-0 rounded border border-gray-300 px-2 py-1.5 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => removeOption(field.id, idx)}
                                className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-600"
                                title="삭제"
                                aria-label="선택지 삭제"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </li>
                          ))}
                        </ul>
                        {(field.options?.length ?? 0) === 0 && (
                          <p className="text-xs text-gray-500">선택지를 추가해 주세요.</p>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeField(field.id)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '문서 저장'}
          </button>
        </form>

        {/* 오른쪽: 가정통신문 챗봇 */}
        <aside className="hidden w-96 shrink-0 lg:block">
          <div className="sticky top-6 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="font-medium text-gray-900">가정통신문 문구 도우미</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                요청을 입력하면 문구 초안을 만들어 드립니다. 생성 후 복사해 왼쪽 설명란에 붙여넣기 하세요.
              </p>
            </div>
            <div className="p-4 space-y-3">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="예: 현장체험학습 동의서 만들어줘"
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                disabled={chatLoading}
              />
              <button
                type="button"
                onClick={handleChat}
                disabled={chatLoading}
                className="w-full rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {chatLoading ? '생성 중...' : '문구 생성'}
              </button>
              {chatReply && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-2 flex justify-end">
                    <button
                      type="button"
                      onClick={copyReply}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      복사 후 설명란에 넣기
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap text-xs text-gray-800 max-h-64 overflow-y-auto font-sans">
                    {chatReply}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
