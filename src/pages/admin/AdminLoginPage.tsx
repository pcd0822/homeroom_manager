import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { verifyAdminPassword } from '@/api/api'
import { isValidGasUrl, setAdminSession, getAdminGasUrl } from '@/lib/gasUrl'

interface LocationState {
  from?: { pathname?: string }
}

export function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as LocationState | null)?.from?.pathname || '/admin'

  // 디바이스에 저장된 GAS URL이 있으면 자동 입력
  const [url, setUrl] = useState(getAdminGasUrl() || '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = url.trim()
    if (!isValidGasUrl(trimmed)) {
      setError('올바른 GAS 웹앱 URL이 아닙니다. (예: https://script.google.com/macros/s/AKfy.../exec)')
      return
    }
    if (!password) {
      setError('비밀번호를 입력해 주세요.')
      return
    }
    setBusy(true)
    try {
      const res = await verifyAdminPassword(trimmed, password)
      if (!res.success) {
        setError(res.error || '로그인에 실패했습니다.')
        return
      }
      setAdminSession(trimmed) // GAS URL을 디바이스에 저장 + 세션 시작
      navigate(redirectTo, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">관리자 로그인</h1>
        <p className="mt-1.5 text-sm text-gray-600">
          내 학급 스프레드시트의 GAS 배포 URL을 연결하고 비밀번호로 로그인하세요.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">GAS 배포 URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              autoFocus={!url}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              스크립트 편집기 → 배포 → 웹 앱(실행: 본인 / 액세스: 모든 사용자)의 URL
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">관리자 비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus={!!url}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              초기 비밀번호는 <span className="font-semibold text-gray-700">1234</span> 입니다. 로그인 후
              메뉴 하단에서 변경하세요.
            </p>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? '로그인 중…' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
