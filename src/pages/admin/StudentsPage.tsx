import { useEffect, useState } from 'react'
import { getStudents, addStudent } from '@/api/api'
import type { Student } from '@/types'
import { cn } from '@/lib/utils'

function UserGroupIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
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

  const load = () => {
    setLoading(true)
    getStudents()
      .then((res) => {
        if (res.success && res.data) setStudents(res.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

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
          setMessage({ type: 'success', text: `${res.data.name}님의 인증코드가 발급되었습니다.` })
          setIssuedAuthCode(res.data.auth_code)
          setStudentId('')
          setName('')
          load()
        } else {
          setMessage({ type: 'error', text: res.error || '등록에 실패했습니다.' })
        }
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

          {/* 학생 목록 카드 */}
          <section>
            <h2 className="mb-3 text-sm font-medium text-gray-700">등록된 학생 목록</h2>
            {loading ? (
              <p className="text-gray-500">로딩 중...</p>
            ) : students.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-gray-500 shadow-sm">
                등록된 학생이 없습니다. 위 폼에서 등록해 주세요.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {students.map((s) => (
                  <div
                    key={s.student_id}
                    className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                      <UserGroupIcon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{s.name}</p>
                      <p className="text-sm text-gray-500">학번 {s.student_id}</p>
                      <p className="mt-1 font-mono text-xs text-gray-600">인증코드: {s.auth_code || '-'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
