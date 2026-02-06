import { useEffect, useState, useCallback } from 'react'
import { getStudents, addStudent, updateStudent } from '@/api/api'
import type { Student } from '@/types'
import { cn } from '@/lib/utils'

const PROFILE_PHOTO_KEY = 'homeroom_student_photo_'

function getProfilePhotoUrl(studentId: string): string | null {
  try {
    return localStorage.getItem(PROFILE_PHOTO_KEY + studentId)
  } catch {
    return null
  }
}

function setProfilePhoto(studentId: string, dataUrl: string) {
  try {
    localStorage.setItem(PROFILE_PHOTO_KEY + studentId, dataUrl)
  } catch {
    // ignore
  }
}

function UserGroupIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
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

export function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [issuedAuthCode, setIssuedAuthCode] = useState<string | null>(null)

  const [modalStudent, setModalStudent] = useState<Student | null>(null)
  const [editForm, setEditForm] = useState({
    student_id: '',
    name: '',
    auth_code: '',
    phone_student: '',
    phone_parent: '',
  })
  const [editProfileDataUrl, setEditProfileDataUrl] = useState<string | null>(null)
  const [savingModal, setSavingModal] = useState(false)
  const [modalError, setModalError] = useState('')

  const [listViewMode, setListViewMode] = useState<'card' | 'row'>('card')

  const load = useCallback(() => {
    setLoading(true)
    getStudents()
      .then((res) => {
        if (res.success && res.data) setStudents(res.data)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openModal = (s: Student) => {
    setModalStudent(s)
    setEditForm({
      student_id: String(s.student_id ?? ''),
      name: String(s.name ?? ''),
      auth_code: String(s.auth_code ?? ''),
      phone_student: String(s.phone_student ?? ''),
      phone_parent: String(s.phone_parent ?? ''),
    })
    setEditProfileDataUrl(getProfilePhotoUrl(String(s.student_id)))
    setModalError('')
  }

  const closeModal = () => {
    setModalStudent(null)
    setEditProfileDataUrl(null)
  }

  const handleProfileFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      setEditProfileDataUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveModal = () => {
    if (!modalStudent) return
    const sid = String(editForm.student_id ?? '').trim()
    const n = String(editForm.name ?? '').trim()
    if (!sid || !n) {
      setModalError('학번과 이름은 필수입니다.')
      return
    }
    setSavingModal(true)
    setModalError('')
    const oldId = String(modalStudent.student_id)
    const newId = sid
    updateStudent({
      find_by_student_id: oldId,
      student_id: newId,
      name: n,
      auth_code: String(editForm.auth_code ?? '').trim() || undefined,
      phone_student: String(editForm.phone_student ?? '').trim() || undefined,
      phone_parent: String(editForm.phone_parent ?? '').trim() || undefined,
    })
      .then((res) => {
        if (res.success) {
          if (editProfileDataUrl) {
            setProfilePhoto(newId, editProfileDataUrl)
            if (oldId !== newId) {
              try {
                localStorage.removeItem(PROFILE_PHOTO_KEY + oldId)
              } catch {
                // ignore
              }
            }
          }
          closeModal()
          load()
        } else {
          setModalError(res.error || '저장에 실패했습니다.')
        }
      })
      .catch(() => setModalError('서버 연결에 실패했습니다.'))
      .finally(() => setSavingModal(false))
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId.trim() || !name.trim()) {
      setMessage({ type: 'error', text: '학번과 이름을 모두 입력해 주세요.' })
      return
    }
    setSubmitting(true)
    setMessage(null)
    setIssuedAuthCode(null)
    addStudent({ student_id: studentId.trim(), name: name.trim() })
      .then((res) => {
        if (res.success && res.data) {
          setMessage({ type: 'success', text: `${res.data.name}님의 인증코드가 발급되었습니다. 구글 시트 'Students' 탭에 저장되었습니다.` })
          setIssuedAuthCode(res.data.auth_code)
          setStudentId('')
          setName('')
          load()
        } else {
          setMessage({ type: 'error', text: res.error || '등록에 실패했습니다.' })
        }
      })
      .catch(() => {
        setMessage({ type: 'error', text: '서버 연결에 실패했습니다. GAS URL과 배포를 확인해 주세요.' })
      })
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">학생관리</h1>
          <p className="mt-1 text-sm text-gray-600">
            학번과 이름을 등록하면 인증코드(auth_code)가 자동 발급됩니다. 학생에게 전달해 폼 제출 시 사용하세요.
          </p>
          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
            <strong>데이터 저장·조회 안내</strong>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li><strong>웹에서 등록</strong> → 구글 스프레드시트 &apos;Students&apos; 탭에 바로 저장됩니다.</li>
              <li><strong>시트에 직접 입력</strong> → 같은 시트이므로 웹에서 조회할 수 있습니다. (학번, 이름, auth_code, phone_student, phone_parent 열 순서 유지)</li>
              <li><strong>프로필 사진</strong> → 웹에서만 보이며 DB에는 저장되지 않습니다.</li>
            </ul>
          </div>
        </header>

        <div className="space-y-8">
          {/* 등록 폼 */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-700">
              <UserGroupIcon className="h-5 w-5" />
              학생 등록 및 인증코드 발급
            </h2>
            <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-4">
              <div>
                <label htmlFor="student_id" className="mb-1 block text-xs font-medium text-gray-600">학번</label>
                <input
                  id="student_id"
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="예: 10101"
                  className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="name" className="mb-1 block text-xs font-medium text-gray-600">이름</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 홍길동"
                  className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? '등록 중...' : '등록 및 인증코드 발급'}
              </button>
            </form>
            {message && (
              <div className={cn(
                'mt-4 rounded-lg border p-3 text-sm',
                message.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
              )}>
                {message.text}
                {issuedAuthCode && (
                  <p className="mt-2 font-mono font-semibold">
                    발급된 인증코드: <span className="text-lg">{issuedAuthCode}</span>
                  </p>
                )}
              </div>
            )}
          </section>

          {/* 학생 목록 - 보기 방식 선택 */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-700">등록된 학생 목록</h2>
              <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setListViewMode('card')}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition',
                    listViewMode === 'card'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  카드처럼 보기
                </button>
                <button
                  type="button"
                  onClick={() => setListViewMode('row')}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition',
                    listViewMode === 'row'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  로우 데이터로 보기
                </button>
              </div>
            </div>
            {loading ? (
              <p className="text-gray-500">로딩 중...</p>
            ) : students.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-gray-500 shadow-sm">
                등록된 학생이 없습니다. 위 폼에서 등록해 주세요.
              </div>
            ) : listViewMode === 'card' ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {students.map((s) => {
                  const photoUrl = getProfilePhotoUrl(String(s.student_id))
                  return (
                    <button
                      key={s.student_id}
                      type="button"
                      onClick={() => openModal(s)}
                      className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-600">
                        {photoUrl ? (
                          <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <UserGroupIcon className="h-8 w-8" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">{s.name}</p>
                        <p className="text-sm text-gray-500">학번 {s.student_id}</p>
                        <p className="mt-1 font-mono text-xs text-gray-600">인증코드: {s.auth_code || '-'}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">프로필</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">이름</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">학번</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">인증코드</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">학생 번호</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">부모님 번호</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {students.map((s) => {
                      const photoUrl = getProfilePhotoUrl(String(s.student_id))
                      return (
                        <tr key={s.student_id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                              {photoUrl ? (
                                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <UserGroupIcon className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <button
                              type="button"
                              onClick={() => openModal(s)}
                              className="font-medium text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 rounded"
                            >
                              {s.name}
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{s.student_id}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-gray-700">{s.auth_code || '-'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{s.phone_student || '-'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{s.phone_parent || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* 수정 모달 - X 버튼 또는 저장 완료 시에만 닫힘 */}
      {modalStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 id="modal-title" className="text-lg font-semibold text-gray-900">학생 정보 수정</h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="닫기"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-4">
              {/* 프로필 사진 (웹에서만) */}
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-600">프로필 사진 (웹에서만 표시)</label>
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                    {editProfileDataUrl ? (
                      <img src={editProfileDataUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <UserGroupIcon className="h-10 w-10 text-gray-400" />
                    )}
                  </div>
                  <label className="cursor-pointer rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    사진 선택
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleProfileFile}
                    />
                  </label>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">학번</label>
                <input
                  type="text"
                  value={editForm.student_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, student_id: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">이름</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">인증코드</label>
                <input
                  type="text"
                  value={editForm.auth_code}
                  onChange={(e) => setEditForm((f) => ({ ...f, auth_code: e.target.value }))}
                  placeholder="비워두면 기존 유지"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">학생 번호</label>
                <input
                  type="tel"
                  value={editForm.phone_student}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone_student: e.target.value }))}
                  placeholder="예: 010-1234-5678"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">부모님 번호</label>
                <input
                  type="tel"
                  value={editForm.phone_parent}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone_parent: e.target.value }))}
                  placeholder="예: 010-9876-5432"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              {modalError && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800">{modalError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                disabled={savingModal}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingModal ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
