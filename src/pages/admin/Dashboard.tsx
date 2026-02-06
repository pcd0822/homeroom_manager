import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getForms, getFolders, createFolder, updateForm } from '@/api/api'
import type { Form, Folder } from '@/types'
import { cn } from '@/lib/utils'

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function FolderPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m-3-3h6" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export function AdminDashboard() {
  const [forms, setForms] = useState<Form[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [addingFolder, setAddingFolder] = useState(false)
  const [showAddFolder, setShowAddFolder] = useState(false)
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null)
  const [folderModalForm, setFolderModalForm] = useState<Form | null>(null)
  const [folderModalNewName, setFolderModalNewName] = useState('')
  const [folderModalAdding, setFolderModalAdding] = useState(false)
  const [folderModalUpdating, setFolderModalUpdating] = useState(false)

  const copyShareLink = (formId: string) => {
    const url = `${window.location.origin}/view/${formId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedFormId(formId)
      setTimeout(() => setCopiedFormId(null), 2000)
    })
  }

  const load = () => {
    setLoading(true)
    Promise.all([getForms(), getFolders()])
      .then(([formsRes, foldersRes]) => {
        if (formsRes.success && formsRes.data) setForms(formsRes.data)
        if (foldersRes.success && foldersRes.data) setFolders(foldersRes.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreateFolder = () => {
    const name = newFolderName.trim()
    if (!name) return
    setAddingFolder(true)
    createFolder({ name })
      .then((res) => {
        if (res.success) {
          setNewFolderName('')
          setShowAddFolder(false)
          load()
        } else {
          alert(res.error || '폴더 생성 실패')
        }
      })
      .finally(() => setAddingFolder(false))
  }

  const handleFolderModalSelect = (folderId: string) => {
    if (!folderModalForm) return
    setFolderModalUpdating(true)
    updateForm({ form_id: folderModalForm.form_id, folder_id: folderId || undefined })
      .then((res) => {
        if (res.success) {
          setFolderModalForm(null)
          load()
        } else {
          alert(res.error || '폴더 변경 실패')
        }
      })
      .finally(() => setFolderModalUpdating(false))
  }

  const handleFolderModalCreate = () => {
    const name = folderModalNewName.trim()
    if (!name || !folderModalForm) return
    setFolderModalAdding(true)
    createFolder({ name })
      .then((res) => {
        if (res.success && res.data) {
          setFolderModalNewName('')
          return updateForm({ form_id: folderModalForm.form_id, folder_id: res.data!.folder_id })
        } else {
          alert(res.error || '폴더 생성 실패')
        }
      })
      .then((updateRes) => {
        if (updateRes?.success) {
          setFolderModalForm(null)
          load()
        }
      })
      .finally(() => setFolderModalAdding(false))
  }

  const filteredForms = selectedFolderId
    ? forms.filter((f) => f.folder_id === selectedFolderId)
    : forms

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">학급 경영 올인원</h1>
          <p className="mt-1 text-sm text-gray-600">데이터 관리 · 문서 목록</p>
        </header>

        {loading ? (
          <p className="text-gray-500">로딩 중...</p>
        ) : (
          <div className="space-y-8">
            {/* 폴더 섹션 - 카드 그리드 */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-700">폴더</h2>
                <button
                  type="button"
                  onClick={() => setShowAddFolder(true)}
                  className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  <PlusIcon className="h-4 w-4" />
                  폴더
                </button>
              </div>
              {showAddFolder && (
                <div className="mb-4 flex gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="새 폴더 이름"
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  />
                  <button
                    type="button"
                    onClick={handleCreateFolder}
                    disabled={addingFolder || !newFolderName.trim()}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addingFolder ? '만드는 중...' : '만들기'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddFolder(false); setNewFolderName('') }}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(null)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm transition hover:shadow',
                    selectedFolderId === null
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-200'
                  )}
                >
                  <div className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-lg',
                    selectedFolderId === null ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                  )}>
                    <FolderIcon className="h-6 w-6" />
                  </div>
                  <span className="font-medium text-gray-900">전체</span>
                </button>
                {folders.map((f) => (
                  <button
                    key={f.folder_id}
                    type="button"
                    onClick={() => setSelectedFolderId(f.folder_id)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm transition hover:shadow',
                      selectedFolderId === f.folder_id
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200'
                    )}
                  >
                    <div className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-lg',
                      selectedFolderId === f.folder_id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    )}>
                      <FolderIcon className="h-6 w-6" />
                    </div>
                    <span className="font-medium text-gray-900">{f.name}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* 문서 목록 - 카드 그리드 */}
            <section>
              <h2 className="mb-3 text-sm font-medium text-gray-700">문서</h2>
              {filteredForms.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-gray-500 shadow-sm">
                  문서가 없습니다.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredForms.map((form) => (
                    <div
                      key={form.form_id}
                      className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                          <DocumentIcon className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-gray-900 truncate">{form.title}</h3>
                          <span className={cn(
                            'mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium',
                            form.type === 'notice' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'
                          )}>
                            {form.type === 'notice' ? '공지' : '설문'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                        <Link
                          to={`/admin/forms/${form.form_id}/responses`}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          응답 보기
                        </Link>
                        <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={() => copyShareLink(form.form_id)}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          {copiedFormId === form.form_id ? '복사됨' : '공유하기'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFolderModalForm(form)}
                          className="ml-auto rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                          title="폴더에 넣기"
                          aria-label="폴더에 넣기"
                        >
                          <FolderPlusIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* 폴더 선택 모달 */}
        {folderModalForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="folder-modal-title"
          >
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h2 id="folder-modal-title" className="text-lg font-semibold text-gray-900">
                  폴더에 넣기
                </h2>
                <button
                  type="button"
                  onClick={() => setFolderModalForm(null)}
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="닫기"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-4">
                <p className="mb-3 text-sm text-gray-600">
                  <span className="font-medium text-gray-900">{folderModalForm.title}</span> 문서를 넣을 폴더를 선택하세요.
                </p>
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 py-1">
                  <li>
                    <button
                      type="button"
                      onClick={() => handleFolderModalSelect('')}
                      disabled={folderModalUpdating}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                        !folderModalForm.folder_id
                          ? 'bg-blue-50 font-medium text-blue-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      폴더 없음
                    </button>
                  </li>
                  {folders.map((f) => (
                    <li key={f.folder_id}>
                      <button
                        type="button"
                        onClick={() => handleFolderModalSelect(f.folder_id)}
                        disabled={folderModalUpdating}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                          folderModalForm.folder_id === f.folder_id
                            ? 'bg-blue-50 font-medium text-blue-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        <FolderIcon className="h-4 w-4 shrink-0" />
                        {f.name}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="mb-2 text-xs font-medium text-gray-500">새 폴더 만들기</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={folderModalNewName}
                      onChange={(e) => setFolderModalNewName(e.target.value)}
                      placeholder="폴더 이름"
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && handleFolderModalCreate()}
                    />
                    <button
                      type="button"
                      onClick={handleFolderModalCreate}
                      disabled={folderModalAdding || !folderModalNewName.trim()}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {folderModalAdding ? '만드는 중...' : '만들기'}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    새 폴더를 만들면 이 문서가 해당 폴더에 들어갑니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
