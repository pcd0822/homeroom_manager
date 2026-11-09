import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFolders, createForm, getStudents, saveAssignments } from '@/api/api'
import type { Folder, FormSchema, FormFieldSchema, FieldType, Student } from '@/types'
import { StudentAssignmentCard } from '@/components/cleaning/StudentAssignmentCard'
import { ArrowLeft, Check, FilePlus2, Plus, Trash2, X } from 'lucide-react'
import { PageTitle } from '@/components/ui/Glyph'

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
      <div className="mx-auto flex max-w-6xl gap-6">
        {/* 왼쪽: 폼 빌더 */}
        <form onSubmit={handleSubmit} className="min-w-0 flex-1 space-y-6">
          <PageTitle
            icon={FilePlus2}
            title="새 문서 만들기"
            right={
              <button type="button" onClick={() => navigate('/admin')} className="btn btn-secondary">
                <ArrowLeft className="h-4 w-4" /> 목록
              </button>
            }
          />

          <div className="card p-5">
            <h2 className="mb-4 text-base font-semibold text-ink-strong">기본 정보</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium text-ink">문서 유형</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="formType"
                      checked={formType === 'notice'}
                      onChange={() => setFormType('notice')}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-ink">공지 (가정통신문 등)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="formType"
                      checked={formType === 'survey'}
                      onChange={() => setFormType('survey')}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-ink">설문</span>
                  </label>
                </div>
              </div>
              <div>
                <label htmlFor="title" className="mb-2 block text-xs font-medium text-ink">제목</label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 2026학년도 1학기 학부모 총회 안내"
                  className="field w-full"
                />
              </div>
              <div>
                <label htmlFor="folder" className="mb-2 block text-xs font-medium text-ink">폴더</label>
                <select
                  id="folder"
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="field w-full"
                >
                  <option value="">선택 안 함</option>
                  {folders.map((f) => (
                    <option key={f.folder_id} value={f.folder_id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="description" className="mb-2 block text-xs font-medium text-ink">
                  본문 (안내 문구)
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="오른쪽 문구 도우미로 만든 문구를 넣을 수 있습니다"
                  rows={8}
                  className="field w-full"
                />
              </div>
              {formType === 'notice' && (
                <div className="space-y-3 border-t border-line pt-4">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={consentEnabled}
                      onChange={(e) => setConsentEnabled(e.target.checked)}
                      className="h-4 w-4"
                    />
                    가정통신문 하단에 동의서 작성 영역 추가
                  </label>
                  {consentEnabled && (
                    <div className="space-y-3 pl-6">
                      <div>
                        <label className="mb-2 block text-xs font-medium text-ink">동의서 제목</label>
                        <input
                          type="text"
                          value={consentTitle}
                          onChange={(e) => setConsentTitle(e.target.value)}
                          placeholder="예: 개인정보 수집·이용 동의"
                          className="field w-full"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-medium text-ink">동의서 본문</label>
                        <textarea
                          value={consentBody}
                          onChange={(e) => setConsentBody(e.target.value)}
                          rows={4}
                          placeholder="동의서 내용을 입력하세요"
                          className="field w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-ink">동의 선택지 (체크박스)</span>
                          <button
                            type="button"
                            onClick={() => setConsentOptions((prev) => [...prev, ''])}
                            className="btn btn-secondary btn-sm"
                          >
                            <Plus className="h-4 w-4" /> 선택지 추가
                          </button>
                        </div>
                        {consentOptions.length === 0 && (
                          <p className="text-xs text-muted">선택지를 추가하면 학생이 체크박스로 동의 여부를 고를 수 있습니다</p>
                        )}
                        <ul className="space-y-2">
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
                                className="field field-sm flex-1"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setConsentOptions((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-raised hover:text-absent"
                                aria-label="선택지 삭제"
                              >
                                <Trash2 className="h-4 w-4" />
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
            <section className="card p-5">
              <h2 className="mb-1 text-base font-semibold text-ink-strong">과제 배당 대상 선택</h2>
              <p className="mb-4 text-sm text-muted">학생 관리에 등록된 학생 중 과제를 배당할 대상을 고릅니다</p>
              <div className="mb-4 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-ink">
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
                    className="h-4 w-4"
                  />
                  전체 학생 일괄 배당
                </label>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>과제 수행 기간</span>
                  <input
                    type="date"
                    value={assignStart}
                    onChange={(e) => setAssignStart(e.target.value)}
                    className="field field-sm"
                  />
                  <span>~</span>
                  <input
                    type="date"
                    value={assignEnd}
                    onChange={(e) => setAssignEnd(e.target.value)}
                    className="field field-sm"
                  />
                  {assignStart && assignEnd && (
                    <span className="ml-2 flex items-center gap-1 text-accent-ink">
                      <Check className="h-4 w-4" /> 기간 설정됨
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-medium text-ink">학생 목록</h3>
                    <input
                      type="text"
                      value={assignSearch}
                      onChange={(e) => setAssignSearch(e.target.value)}
                      placeholder="학번 또는 이름 검색"
                      className="field field-sm w-40 flex-shrink"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-line">
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
                          className={`w-full border-b border-line px-3 py-2 text-left text-sm transition-colors duration-150 last:border-b-0 ${
                            selected ? 'bg-[color-mix(in_srgb,var(--accent)_8%,white)]' : 'hover:bg-raised'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-raised">
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
                                <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                                  {s.name.charAt(0) || '?'}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-ink-strong">{s.name}</p>
                              <p className="text-xs tabular-nums text-muted">{s.student_id}</p>
                            </div>
                            {selected && (
                              <span className="flex items-center gap-1 text-xs font-medium text-accent-ink">
                                <Check className="h-4 w-4" /> 배당
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                    {students.length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted">등록된 학생이 없습니다. 먼저 학생 관리에서 학생을 추가해 주세요</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-medium text-ink">배당된 학생</h3>
                  <div className="flex max-h-60 flex-col gap-2 overflow-y-auto">
                    {assignedIds.length === 0 && (
                      <p className="py-2 text-sm text-muted">아직 배당된 학생이 없습니다</p>
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
                            className="absolute right-2 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-md bg-surface text-muted hover:text-absent group-focus-within:grid group-hover:grid"
                            aria-label="배당 취소"
                          >
                            <X className="h-4 w-4" />
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
            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink-strong">설문 항목</h2>
                <button
                  type="button"
                  onClick={addField}
                  className="btn btn-secondary btn-sm"
                >
                  <Plus className="h-4 w-4" /> 항목 추가
                </button>
              </div>
              <div className="space-y-4">
                {fields.map((field) => (
                  <div key={field.id} className="flex flex-wrap items-start gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
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
                      className="field"
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
                      className="field min-w-[120px] flex-1"
                    />
                    <label className="flex h-9 items-center gap-2 text-sm text-ink">
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
                          <span className="text-xs font-medium text-ink">선택지</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => addOption(field.id)}
                              className="btn btn-secondary btn-sm"
                            >
                              <Plus className="h-4 w-4" /> 선택지 추가
                            </button>
                            {!(field.options || []).includes('기타') && (
                              <button
                                type="button"
                                onClick={() => addOption(field.id, '기타')}
                                className="btn btn-secondary btn-sm"
                              >
                                <Plus className="h-4 w-4" /> 기타
                              </button>
                            )}
                          </div>
                        </div>
                        <ul className="space-y-2">
                          {(field.options || []).map((opt, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => updateOption(field.id, idx, e.target.value)}
                                placeholder={`선택지 ${idx + 1}`}
                                className="field min-w-0 flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => removeOption(field.id, idx)}
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-raised hover:text-absent"
                                title="삭제"
                                aria-label="선택지 삭제"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                        {(field.options?.length ?? 0) === 0 && (
                          <p className="text-xs text-muted">선택지를 추가해 주세요</p>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeField(field.id)}
                      className="btn btn-danger btn-sm"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="border-l-2 border-absent pl-3 text-sm text-absent">{error}</p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary w-full"
          >
            {saving ? '저장 중…' : '문서 저장'}
          </button>
        </form>

        {/* 오른쪽: 가정통신문 챗봇 */}
        <aside className="hidden w-96 shrink-0 lg:block">
          <div className="card sticky top-6">
            <div className="border-b border-line px-5 py-4">
              <h3 className="text-base font-semibold text-ink-strong">가정통신문 문구 도우미</h3>
              <p className="mt-1 text-xs text-muted">요청을 쓰면 문구 초안을 만들고, 버튼 하나로 본문에 넣습니다</p>
            </div>
            <div className="space-y-3 p-5">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="예: 현장체험학습 동의서 만들어줘"
                rows={3}
                className="field w-full"
                disabled={chatLoading}
              />
              <button
                type="button"
                onClick={handleChat}
                disabled={chatLoading}
                className="btn btn-secondary w-full"
              >
                {chatLoading ? '생성 중…' : '문구 생성'}
              </button>
              {chatReply && (
                <div className="border-t border-line pt-3">
                  <div className="mb-2 flex justify-end">
                    <button
                      type="button"
                      onClick={copyReply}
                      className="btn btn-ghost btn-sm text-accent-ink"
                    >
                      복사하고 본문에 넣기
                    </button>
                  </div>
                  <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap font-sans text-sm text-ink">
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
