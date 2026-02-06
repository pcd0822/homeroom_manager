import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFolders, createForm } from '@/api/api'
import type { Folder, FormSchema, FormFieldSchema, FieldType } from '@/types'

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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatReply, setChatReply] = useState('')

  useEffect(() => {
    getFolders().then((res) => {
      if (res.success && res.data) setFolders(res.data)
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
    const schema: FormSchema = {
      fields: formType === 'survey' ? fields : [],
      body: description.trim() || undefined,
    }
    createForm({
      folder_id: folderId || undefined,
      title: title.trim(),
      type: formType,
      schema,
    })
      .then((res) => {
        if (res.success) {
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
            </div>
          </div>

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
