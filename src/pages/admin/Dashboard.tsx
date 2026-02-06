import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getForms, getFolders } from '@/api/api'
import type { Form, Folder } from '@/types'
import { cn } from '@/lib/utils'

export function AdminDashboard() {
  const [forms, setForms] = useState<Form[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getForms(), getFolders()])
      .then(([formsRes, foldersRes]) => {
        if (formsRes.success && formsRes.data) setForms(formsRes.data)
        if (foldersRes.success && foldersRes.data) setFolders(foldersRes.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredForms = selectedFolderId
    ? forms.filter((f) => f.folder_id === selectedFolderId)
    : forms

  const baseUrl = window.location.origin

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">학급 경영 올인원</h1>
        <p className="mt-1 text-sm text-gray-600">관리자 대시보드</p>
      </header>

      {loading ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-medium text-gray-700">폴더</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedFolderId(null)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium',
                  selectedFolderId === null
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 shadow ring-1 ring-gray-300 hover:bg-gray-50'
                )}
              >
                전체
              </button>
              {folders.map((f) => (
                <button
                  key={f.folder_id}
                  type="button"
                  onClick={() => setSelectedFolderId(f.folder_id)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium',
                    selectedFolderId === f.folder_id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 shadow ring-1 ring-gray-300 hover:bg-gray-50'
                  )}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium text-gray-700">문서 목록</h2>
            <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
              {filteredForms.length === 0 ? (
                <li className="px-4 py-8 text-center text-gray-500">문서가 없습니다.</li>
              ) : (
                filteredForms.map((form) => (
                  <li key={form.form_id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <span className="font-medium text-gray-900">{form.title}</span>
                      <span className="ml-2 text-xs text-gray-500">({form.type})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        공유 링크: {baseUrl}/view/{form.form_id}
                      </span>
                      <Link
                        to={`/admin/forms/${form.form_id}/responses`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        응답 보기
                      </Link>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
