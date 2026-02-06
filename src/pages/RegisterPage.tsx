import { useState } from 'react'
import { addStudent } from '@/api/api'
import { formatPhoneKorean } from '@/lib/utils'

export function RegisterPage() {
  const [studentId, setStudentId] = useState('')
  const [name, setName] = useState('')
  const [phoneStudent, setPhoneStudent] = useState('')
  const [phoneParent, setPhoneParent] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; authCode?: string } | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!String(studentId).trim() || !String(name).trim()) {
      setResult({ success: false, message: '학번과 이름을 입력해 주세요.' })
      return
    }
    setSubmitting(true)
    setResult(null)
    const ps = String(phoneStudent ?? '').trim()
    const pp = String(phoneParent ?? '').trim()
    addStudent({
      student_id: String(studentId).trim(),
      name: String(name).trim(),
      phone_student: ps ? formatPhoneKorean(ps) : undefined,
      phone_parent: pp ? formatPhoneKorean(pp) : undefined,
      email: String(email ?? '').trim() || undefined,
    })
      .then((res) => {
        if (res.success && res.data) {
          setResult({
            success: true,
            message: '등록되었습니다. 폼 제출 시 사용할 인증코드를 확인하세요.',
            authCode: res.data.auth_code,
          })
          setStudentId('')
          setName('')
          setPhoneStudent('')
          setPhoneParent('')
          setEmail('')
        } else {
          setResult({ success: false, message: res.error || '등록에 실패했습니다.' })
        }
      })
      .catch(() => setResult({ success: false, message: '서버 연결에 실패했습니다.' }))
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-md">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">학생 정보 등록</h1>
          <p className="mt-1 text-sm text-gray-600">
            학번, 이름, 연락처, 이메일을 입력하면 인증코드가 발급됩니다. 폼 제출 시 인증코드가 필요합니다.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="student_id" className="mb-1 block text-sm font-medium text-gray-700">학번</label>
              <input
                id="student_id"
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="예: 10101"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">이름</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 홍길동"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="phone_student" className="mb-1 block text-sm font-medium text-gray-700">학생 번호</label>
              <input
                id="phone_student"
                type="tel"
                value={phoneStudent}
                onChange={(e) => setPhoneStudent(e.target.value)}
                placeholder="예: 010-1234-5678"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="phone_parent" className="mb-1 block text-sm font-medium text-gray-700">부모님 번호</label>
              <input
                id="phone_parent"
                type="tel"
                value={phoneParent}
                onChange={(e) => setPhoneParent(e.target.value)}
                placeholder="예: 010-9876-5432"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">이메일</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="예: student@school.kr"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            {result && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  result.success ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {result.message}
                {result.authCode && (
                  <p className="mt-2 font-mono font-semibold">인증코드: {result.authCode}</p>
                )}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? '등록 중...' : '등록하기'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
