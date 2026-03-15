import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getForm, authStudent, submitResponse, parseFormSchema, getAssignmentsByForm } from '@/api/api'
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
  const [remember, setRemember] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('homeroom_login')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.student_id) setStudentId(parsed.student_id)
        if (parsed.auth_code) setAuthCode(parsed.auth_code)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!formId) return
    getForm(formId).then((res) => {
      if (res.success && res.data) {
        const parsed = parseFormSchema(res.data)
        setForm({
          title: parsed.title,
          type: parsed.type as 'survey' | 'notice',
          schema: parsed.schema,
          noticeBody: parsed.type === 'notice' ? parsed.schema?.body : undefined,
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
      // 과제 배당 여부 및 응답 기간 확인
      if (formId) {
        const assignRes = await getAssignmentsByForm(formId)
        if (assignRes.success && assignRes.data && assignRes.data.length > 0) {
          const sid = studentId.trim()
          const sameStudentId = (a: string, b: string) => {
            const sa = String(a ?? '').trim()
            const sb = String(b ?? '').trim()
            if (sa === sb) return true
            const na = parseInt(sa, 10)
            const nb = parseInt(sb, 10)
            if (!isNaN(na) && !isNaN(nb) && na === nb) return true
            if (sa.length > 0 && sb.length > 0 && sa.replace(/^0+/, '') === sb.replace(/^0+/, '')) return true
            return false
          }
          const myAssignments = assignRes.data.filter((a) => sameStudentId(a.student_id, sid))
          if (myAssignments.length === 0) {
            setAuthState('error')
            setErrorMessage('이 공지사항/설문은 배정되지 않은 학생입니다.')
            return
          }
          const now = new Date()
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          const parseToLocalDate = (v: string | undefined | null): Date | null => {
            if (v == null) return null
            const s = String(v).trim()
            if (!s) return null
            let datePart: string
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
            if (m) datePart = `${m[1]}-${m[2]}-${m[3]}`
            else if (/^\d{8}$/.test(s)) datePart = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
            else datePart = s
            const d = new Date(datePart)
            if (isNaN(d.getTime())) return null
            return new Date(d.getFullYear(), d.getMonth(), d.getDate())
          }
          const hasActive = myAssignments.some((a) => {
            const startDate = parseToLocalDate(a.start_date) ?? today
            const endDate = parseToLocalDate(a.end_date) ?? today
            return today.getTime() >= startDate.getTime() && today.getTime() <= endDate.getTime()
          })
          if (!hasActive) {
            const hasEnded = myAssignments.every((a) => {
              const endDate = parseToLocalDate(a.end_date) ?? today
              return today.getTime() > endDate.getTime()
            })
            setAuthState('error')
            setErrorMessage(hasEnded ? '응답 기간이 지났습니다.' : '현재는 응답 기간이 아닙니다.')
            return
          }
        }
      }
      setStudentName(res.data.name || '')
      setAuthState('success')
      if (remember) {
        try {
          localStorage.setItem(
            'homeroom_login',
            JSON.stringify({ student_id: studentId.trim(), auth_code: authCode.trim() })
          )
        } catch {
          // ignore
        }
      }
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
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 text-blue-600"
            />
            이 기기에서 로그인 정보 저장
          </label>
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
