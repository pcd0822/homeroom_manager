import { useEffect, useState, useCallback } from 'react'
import { getStudents, sendSms } from '@/api/api'
import type { Student } from '@/types'
import { cn } from '@/lib/utils'

type RecipientType = 'student' | 'parent'

const STEPS = [
  { id: 1, title: '수신 대상 선택' },
  { id: 2, title: '학생/학부모 선택' },
  { id: 3, title: '내용 입력 및 발송' },
] as const

export function SmsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [recipientType, setRecipientType] = useState<RecipientType>('parent')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    getStudents().then((res) => {
      if (res.success && res.data) setStudents(res.data)
      setLoading(false)
    })
  }, [])

  const selectedStudents = students.filter((s) => selectedIds.has(s.student_id))
  const receivers = selectedStudents
    .map((s) => ({
      phone: (recipientType === 'student' ? (s.phone_student || '').trim() : (s.phone_parent || '').trim()),
      name: s.name,
    }))
    .filter((r) => r.phone.length > 0)

  const allSelected = students.length > 0 && selectedIds.size === students.length
  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(students.map((s) => s.student_id)))
    }
  }, [allSelected, students])

  const toggleStudent = useCallback((studentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }, [])

  const canGoNextFromStep1 = selectedIds.size > 0
  const canSend = receivers.length > 0 && message.trim().length > 0

  const handleSend = async () => {
    if (!canSend) return
    setSending(true)
    setResult(null)
    const res = await sendSms({
      receivers,
      message: message.trim(),
    })
    setSending(false)
    if (res.success) {
      setResult({
        success: true,
        message: `${res.data?.receiver_count ?? receivers.length}명에게 발송 요청이 완료되었습니다.`,
      })
      setMessage('')
      setStep(1)
      setSelectedIds(new Set())
    } else {
      setResult({ success: false, message: res.error || '발송에 실패했습니다.' })
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-gray-500">학생 목록을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">문자 발송</h1>
          <p className="mt-1 text-sm text-gray-600">
            전송 대상을 선택한 뒤, 수신자 유형(학생/학부모)을 정하고 내용을 입력해 발송합니다.
          </p>
        </header>

        {/* 스텝 인디케이터 */}
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium transition',
                  step === s.id
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : step > s.id
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 bg-white text-gray-500'
                )}
              >
                {s.id}
              </div>
              <span
                className={cn(
                  'hidden text-sm font-medium sm:inline',
                  step >= s.id ? 'text-gray-900' : 'text-gray-400'
                )}
              >
                {s.title}
              </span>
              {i < STEPS.length - 1 && (
                <div className="mx-1 h-0.5 w-4 bg-gray-200 sm:mx-2 sm:w-6" aria-hidden />
              )}
            </div>
          ))}
        </div>

        {/* 스텝 1: 수신 대상 선택 (학생 목록 체크박스) */}
        {step === 1 && (
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-medium text-gray-700">수신 대상 선택</h2>
            <p className="mb-4 text-xs text-gray-500">
              문자를 받을 학생을 선택하세요. 선택한 학생의 연락처는 다음 단계에서 학생/학부모 중 정할 수 있습니다.
            </p>
            <div className="mb-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                {allSelected ? '전체선택 해제' : '전체선택'}
              </button>
              <span className="text-sm text-gray-600">
                <span className="font-medium text-blue-600">{selectedIds.size}</span>명 선택
              </span>
            </div>
            <ul className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-2">
              {students.length === 0 ? (
                <li className="py-4 text-center text-sm text-gray-500">등록된 학생이 없습니다.</li>
              ) : (
                students.map((s) => (
                  <li key={s.student_id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-white">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.student_id)}
                        onChange={() => toggleStudent(s.student_id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-900">{s.name}</span>
                      <span className="text-sm text-gray-500">학번 {s.student_id}</span>
                    </label>
                  </li>
                ))
              )}
            </ul>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canGoNextFromStep1}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                다음: 학생/학부모 선택
              </button>
            </div>
          </section>
        )}

        {/* 스텝 2: 수신자 유형 (학생 번호 / 학부모 번호) */}
        {step === 2 && (
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-medium text-gray-700">수신자 유형 선택</h2>
            <p className="mb-4 text-sm text-gray-600">
              선택한 <span className="font-semibold text-blue-600">{selectedStudents.length}명</span>에게
              어떤 번호로 발송할지 선택하세요.
            </p>
            <div className="mb-6 flex gap-6">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="recipientType"
                  checked={recipientType === 'student'}
                  onChange={() => setRecipientType('student')}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-900">학생 번호</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="recipientType"
                  checked={recipientType === 'parent'}
                  onChange={() => setRecipientType('parent')}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-900">학부모 번호</span>
              </label>
            </div>
            <p className="mb-6 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              발송 가능: <span className="font-semibold">{receivers.length}명</span>
              {selectedStudents.length > receivers.length && (
                <span className="ml-2 text-amber-700">
                  (번호 미등록 {selectedStudents.length - receivers.length}명 제외)
                </span>
              )}
            </p>
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                이전
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={receivers.length === 0}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                다음: 내용 입력 및 발송
              </button>
            </div>
          </section>
        )}

        {/* 스텝 3: 내용 입력 및 발송 */}
        {step === 3 && (
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-medium text-gray-700">발송 내용</h2>
            <p className="mb-3 text-sm text-gray-600">
              <span className="font-semibold text-blue-600">{receivers.length}명</span>에게 발송됩니다.
              {recipientType === 'student' ? ' (학생 번호)' : ' (학부모 번호)'}
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="발송할 메시지를 입력하세요.&#10;예: 안녕하세요. 내일 등교 안내입니다."
              rows={5}
              className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mb-6 text-xs text-gray-500">
              메시지에 &#123;name&#125; 을 넣으면 수신자 이름으로 치환됩니다.
            </p>

            {result && (
              <div
                className={cn(
                  'mb-6 rounded-lg border p-4 text-sm',
                  result.success
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                )}
              >
                {result.message}
              </div>
            )}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={sending}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
              >
                이전
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend || sending}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? '발송 중...' : `${receivers.length}명에게 문자 발송`}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
