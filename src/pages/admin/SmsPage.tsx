import { useEffect, useState } from 'react'
import { getStudents, sendSms } from '@/api/api'
import type { Student } from '@/types'

type RecipientType = 'student' | 'parent'

export function SmsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
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

  const receivers = students
    .map((s) => ({
      phone: recipientType === 'student' ? (s.phone_student || '').trim() : (s.phone_parent || '').trim(),
      name: s.name,
    }))
    .filter((r) => r.phone.length > 0)

  const handleSend = async () => {
    if (receivers.length === 0) {
      setResult({ success: false, message: '발송할 수신자가 없습니다. 학생/학부모 번호를 확인해 주세요.' })
      return
    }
    if (!message.trim()) {
      setResult({ success: false, message: '발송할 내용을 입력해 주세요.' })
      return
    }
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
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">문자 발송</h1>
          <p className="mt-1 text-sm text-gray-600">
            스프레드시트에 등록된 학생/학부모 번호로 발송합니다.
          </p>
        </header>

        <div className="space-y-6">
          {/* 수신 대상 선택 */}
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-medium text-gray-700">수신 대상</h2>
            <div className="flex gap-4">
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
            <p className="mt-2 text-xs text-gray-500">
              {recipientType === 'student'
                ? 'Students 시트의 학생 연락처(phone_student)로 발송합니다.'
                : 'Students 시트의 학부모 연락처(phone_parent)로 발송합니다.'}
            </p>
            <p className="mt-1 text-sm font-medium text-gray-700">
              발송 예정: <span className="text-blue-600">{receivers.length}명</span>
              {students.length > 0 && receivers.length < students.length && (
                <span className="ml-2 text-amber-600">
                  (번호 미등록 {students.length - receivers.length}명 제외)
                </span>
              )}
            </p>
          </section>

          {/* 발송 내용 */}
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-medium text-gray-700">발송 내용</h2>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="발송할 메시지를 입력하세요.&#10;예: 안녕하세요. 내일 등교 안내입니다."
              rows={5}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-2 text-xs text-gray-500">
              메시지에 &#123;name&#125; 을 넣으면 수신자 이름으로 치환됩니다. (GAS에서 템플릿 처리 시)
            </p>
          </section>

          {/* 결과 메시지 */}
          {result && (
            <div
              className={`rounded-lg border p-4 text-sm ${
                result.success
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {result.message}
            </div>
          )}

          <button
            type="button"
            onClick={handleSend}
            disabled={sending || receivers.length === 0}
            className="w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? '발송 중...' : `${receivers.length}명에게 문자 발송`}
          </button>
        </div>
      </div>
    </div>
  )
}
