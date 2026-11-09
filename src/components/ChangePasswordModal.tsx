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
  const connectedUrl = getAdminGasUrl()

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
        className="w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 연결된 GAS 주소: 사이드바에서 옮겨 온 읽기 전용 표시 */}
        {connectedUrl && (
          <p className="mb-3 truncate text-xs text-muted" title={connectedUrl}>
            연결된 주소 {connectedUrl.replace(/^https:\/\/script\.google\.com\/macros\/s\//, '…/')}
          </p>
        )}
        <h2 className="text-base font-semibold text-ink-strong">관리자 비밀번호 변경</h2>

        {done ? (
          <>
            <p className="mt-3 text-sm text-ink">비밀번호가 변경되었습니다.</p>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-primary mt-4 w-full"
            >
              확인
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            {error && (
              <div className="border-l-2 border-absent pl-3 text-sm text-absent">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-ink">현재 비밀번호</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="아직 안 바꿨다면 1234"
                autoFocus
                className="field mt-2 w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink">새 비밀번호 (4자 이상)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="field mt-2 w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink">새 비밀번호 확인</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="field mt-2 w-full"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary flex-1"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={busy}
                className="btn btn-primary flex-1"
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
