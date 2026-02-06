import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getForm, authStudent, submitResponse, parseFormSchema } from '@/api/api'
import type { FormSchema } from '@/types'
import { FormRenderer } from '@/components/FormRenderer'

type AuthState = 'idle' | 'loading' | 'success' | 'error'
type SubmitState = 'idle' | 'submitting' | 'done' | 'error'

export function FormView() {
  const { formId } = useParams<{ formId: string }>()
  const [form, setForm] = useState<{ title: string; type: 'survey' | 'notice'; schema: FormSchema | null; noticeBody?: string } | null>(null)
  const [authState, setAuthState] = useState<AuthState>('idle')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [studentId, setStudentId] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [studentName, setStudentName] = useState('')

  useEffect(() => {
    if (!formId) return
    getForm(formId).then((res) => {
      if (res.success && res.data) {
        const parsed = parseFormSchema(res.data)
        setForm({
          title: parsed.title,
          type: parsed.type as 'survey' | 'notice',
          schema: parsed.schema,
          noticeBody: parsed.type === 'notice' ? (parsed.schema as unknown as { body?: string })?.body : undefined,
        })
      } else {
        setErrorMessage(res.error || '폼을 불러올 수 없습니다.')
      }
    })
  }, [formId])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId.trim() || !authCode.trim()) {
      setErrorMessage('학번과 인증코드를 입력해 주세요.')
      return
    }
    setAuthState('loading')
    setErrorMessage('')
    const res = await authStudent(studentId.trim(), authCode.trim())
    if (res.success && res.data) {
      setStudentName(res.data.name || '')
      setAuthState('success')
    } else {
      setAuthState('error')
      setErrorMessage(res.error || '인증에 실패했습니다.')
    }
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!formId || !studentId) return
    setSubmitState('submitting')
    setErrorMessage('')
    const res = await submitResponse({
      form_id: formId,
      student_id: studentId,
      student_name: studentName,
      answer_data: values,
    })
    if (res.success) {
      setSubmitState('done')
    } else {
      setSubmitState('error')
      setErrorMessage(res.error || '제출에 실패했습니다.')
    }
  }

  if (!formId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-gray-600">잘못된 링크입니다.</p>
      </div>
    )
  }

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        {errorMessage ? (
          <p className="text-red-600">{errorMessage}</p>
        ) : (
          <p className="text-gray-600">로딩 중...</p>
        )}
      </div>
    )
  }

  if (authState !== 'success') {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="mb-4 text-xl font-semibold text-gray-900">{form.title}</h1>
        <p className="mb-4 text-sm text-gray-600">제출을 위해 학번과 인증코드를 입력해 주세요.</p>
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label htmlFor="student_id" className="mb-1 block text-sm font-medium text-gray-700">
              학번
            </label>
            <input
              id="student_id"
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="auth_code" className="mb-1 block text-sm font-medium text-gray-700">
              인증코드
            </label>
            <input
              id="auth_code"
              type="password"
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoComplete="off"
            />
          </div>
          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
          <button
            type="submit"
            disabled={authState === 'loading'}
            className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {authState === 'loading' ? '확인 중...' : '확인'}
          </button>
        </form>
      </div>
    )
  }

  if (submitState === 'done') {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-lg font-medium text-green-700">제출이 완료되었습니다.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">{form.title}</h1>
      {submitState === 'error' && (
        <p className="mb-4 text-sm text-red-600">{errorMessage}</p>
      )}
      <FormRenderer
        type={form.type}
        schema={form.schema}
        onSubmit={handleSubmit}
        isSubmitting={submitState === 'submitting'}
        noticeTitle={form.title}
        noticeBody={form.noticeBody}
      />
    </div>
  )
}
