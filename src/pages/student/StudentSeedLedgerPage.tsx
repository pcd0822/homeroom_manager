import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { authStudent, getStudentSeedLedger } from '@/api/api'

const LOGIN_KEY = 'homeroom_login'

type LedgerTx = {
  created_at: string
  tx_type: string
  policy_title: string
  product_name: string
  memo: string
  amount: number
  remaining_after: number
}

export function StudentSeedLedgerPage() {
  const [studentId, setStudentId] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [authState, setAuthState] = useState<'idle' | 'loading' | 'success' | 'error'>('loading')
  const [authError, setAuthError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)

  const [balance, setBalance] = useState<number | null>(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerErr, setLedgerErr] = useState('')

  const [tab, setTab] = useState<'gain' | 'spend'>('gain')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const raw = localStorage.getItem(LOGIN_KEY)
        if (!raw) {
          if (!cancelled) setAuthState('idle')
          return
        }
        const parsed = JSON.parse(raw) as { student_id?: string; auth_code?: string }
        if (!parsed.student_id || !parsed.auth_code) {
          if (!cancelled) setAuthState('idle')
          return
        }
        setStudentId(parsed.student_id)
        setAuthCode(parsed.auth_code)
        const res = await authStudent(parsed.student_id, parsed.auth_code)
        if (cancelled) return
        if (res.success && res.data) {
          setAuthState('success')
        } else {
          setAuthState('idle')
        }
      } catch {
        if (!cancelled) setAuthState('idle')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const [transactions, setTransactions] = useState<LedgerTx[]>([])

  useEffect(() => {
    if (authState !== 'success') return
    if (!studentId.trim()) return
    void (async () => {
      setLedgerLoading(true)
      setLedgerErr('')
      try {
        const res = await getStudentSeedLedger(studentId.trim())
        if (res.success && res.data) {
          setBalance(res.data.balance ?? 0)
          setTransactions(res.data.transactions as LedgerTx[])
        } else {
          setLedgerErr(res.error || '가계부를 불러오지 못했습니다.')
        }
      } finally {
        setLedgerLoading(false)
      }
    })()
  }, [authState, studentId])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId.trim() || !authCode.trim()) {
      setAuthError('학번과 개인코드를 입력해 주세요.')
      return
    }
    setAuthSubmitting(true)
    setAuthError('')
    const res = await authStudent(studentId.trim(), authCode.trim())
    setAuthSubmitting(false)
    if (res.success && res.data) {
      setAuthState('success')
      try {
        localStorage.setItem(LOGIN_KEY, JSON.stringify({ student_id: studentId.trim(), auth_code: authCode.trim() }))
      } catch {
        // ignore
      }
    } else {
      setAuthState('error')
      setAuthError(res.error || '인증에 실패했습니다.')
    }
  }

  const txForTab = useMemo(() => {
    const wanted = tab === 'gain' ? 'GAIN' : 'SPEND'
    return transactions.filter((t) => t.tx_type === wanted)
  }, [transactions, tab])

  if (authState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white px-4">
        <Helmet>
          <title>씨앗 가계부</title>
        </Helmet>
        <p className="text-sm text-gray-500">로그인 확인 중...</p>
      </div>
    )
  }

  if (authState !== 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white px-4 py-8">
        <Helmet>
          <title>씨앗 가계부</title>
        </Helmet>
        <div className="mx-auto max-w-sm rounded-3xl border border-sky-100 bg-white p-6 shadow-lg">
          <h1 className="mb-3 text-center text-xl font-bold text-gray-900">🌱 씨앗 가계부</h1>
          <p className="mb-5 text-center text-[11px] text-gray-500">학번·개인코드로 로그인 후 내 씨앗 사용 내역을 확인합니다.</p>
          <form onSubmit={handleAuth} className="space-y-3 text-sm">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">학번</label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-inner"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">개인코드</label>
              <input
                type="password"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-inner"
              />
            </div>
            {authError && <p className="text-xs text-red-600">{authError}</p>}
            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-60"
            >
              {authSubmitting ? '확인 중...' : '입장하기'}
            </button>
          </form>
          <Link to="/student/dashboard" className="mt-3 block text-center text-xs text-blue-600">
            학생 대시보드로
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white px-4 py-6 pb-24">
      <Helmet>
        <title>씨앗 가계부</title>
      </Helmet>
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">🌱 씨앗 가계부</h1>
            <p className="mt-1 text-xs text-gray-500">획득(정책 참여)과 지출(교환/사용) 내역을 기록합니다.</p>
          </div>
          <Link
            to="/student/dashboard"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            ← 대시보드
          </Link>
        </header>

        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-emerald-800">현재 잔여 씨앗</p>
              <p className="text-3xl font-black text-emerald-700">{balance ?? '...'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">입출금 내역</p>
              <p className="text-xs font-semibold text-gray-700">{transactions.length}건</p>
            </div>
          </div>
        </div>

        {ledgerErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{ledgerErr}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('gain')}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${
              tab === 'gain' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            씨앗 획득 내역
          </button>
          <button
            type="button"
            onClick={() => setTab('spend')}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${
              tab === 'spend' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            씨앗 사용/교환 내역
          </button>
        </div>

        {ledgerLoading ? (
          <p className="text-sm text-gray-500">불러오는 중...</p>
        ) : txForTab.length === 0 ? (
          <p className="text-sm text-gray-500">표시할 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2">일자</th>
                  <th className="px-3 py-2">{tab === 'gain' ? '획득 내역' : '교환/지출 내역'}</th>
                  <th className="px-3 py-2 text-right">개수</th>
                  <th className="px-3 py-2 text-right">남은 씨앗</th>
                </tr>
              </thead>
              <tbody>
                {txForTab.map((t, idx) => (
                  <tr key={`${t.created_at}-${idx}`} className="border-t">
                    <td className="px-3 py-2">{String(t.created_at).slice(0, 10)}</td>
                    <td className="px-3 py-2">
                      {tab === 'gain' ? (
                        <div>
                          <div className="font-semibold text-gray-900">{t.policy_title || '정책'}</div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-semibold text-gray-900">{t.product_name || '상품'}</div>
                          {t.memo && <div className="mt-0.5 text-[10px] text-gray-500">{t.memo}</div>}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">{t.amount}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{t.remaining_after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

