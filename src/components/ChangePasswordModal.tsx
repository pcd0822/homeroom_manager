import { useState } from 'react'
import { changeAdminPassword } from '@/api/api'
import { getAdminGasUrl } from '@/lib/gasUrl'

/**
 * 관리자 비밀번호 변경 모달.
 * 로그인된(=GAS가 연결된) 상태에서만 열린다. 초기 비밀번호(1234)에서 변경할 때도 사용.
 */
export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const gasUrl = getAdminGasUrl()
    if (!gasUrl) {
      setError('연결된 GAS가 없습니다. 다시 로그인해 주세요.')
      return
    }
    if (newPassword.length < 4) {
      setError('새 비밀번호는 4자 이상이어야 합니다.')
      return
    }
    if (newPassword !== confirm) {
      setError('새 비밀번호 확인이 일치하지 않습니다.')
      return
    }
    setBusy(true)
    try {
      const res = await changeAdminPassword(gasUrl, oldPassword, newPassword)
      if (!res.success) {
        setError(res.error || '비밀번호 변경에 실패했습니다.')
        return
      }
      setDone(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900">관리자 비밀번호 변경</h2>

        {done ? (
          <>
            <p className="mt-3 text-sm text-gray-600">비밀번호가 변경되었습니다.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              확인
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">현재 비밀번호</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="아직 안 바꿨다면 1234"
                autoFocus
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">새 비밀번호 (4자 이상)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">새 비밀번호 확인</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busy ? '변경 중…' : '변경'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
