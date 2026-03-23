import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { authStudent, getPolicies, getPolicyDetail, hypePolicy } from '@/api/api'
import type { Policy } from '@/types'
import { policyLogoSrc } from '@/lib/policyImage'

const LOGIN_KEY = 'homeroom_login'

function formatCooldownMinutes(msRemaining: number) {
  const min = Math.ceil(msRemaining / 60000)
  return Math.max(1, min)
}

export function PolicyBoardSharedPage() {
  const [studentId, setStudentId] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)

  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const [detail, setDetail] = useState<Policy | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [hypeCooldownUntil, setHypeCooldownUntil] = useState<number | null>(null)
  const [hypeErr, setHypeErr] = useState('')
  const cooldownRemainingMs = hypeCooldownUntil ? Math.max(0, hypeCooldownUntil - Date.now()) : 0

  const shareHeaderTitle = useMemo(() => {
    return '정책 게시판'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    const res = await getPolicies()
    setLoading(false)
    if (res.success && res.data) setPolicies(res.data)
    else setErr(res.error || '정책 목록을 불러오지 못했습니다.')
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const raw = localStorage.getItem(LOGIN_KEY)
        if (!raw) {
          if (!cancelled) setSessionChecked(true)
          return
        }
        const p = JSON.parse(raw) as { student_id?: string; auth_code?: string }
        if (!p.student_id || !p.auth_code) {
          if (!cancelled) setSessionChecked(true)
          return
        }
        setStudentId(p.student_id)
        const r = await authStudent(p.student_id, p.auth_code)
        if (cancelled) return
        if (r.success && r.data) {
          setLoggedIn(true)
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setSessionChecked(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (loggedIn) void load()
  }, [loggedIn, load])

  const openDetail = useCallback(async (pid: string) => {
    setHypeErr('')
    setHypeCooldownUntil(null)
    setDetailLoading(true)
    const d = await getPolicyDetail(pid)
    if (d.success && d.data) setDetail(d.data)
    else setErr(d.error || '정책 정보를 불러오지 못했습니다.')
    setDetailLoading(false)
  }, [])

  const doHype = useCallback(async () => {
    if (!detail) return
    setHypeErr('')
    if (cooldownRemainingMs > 0) {
      setHypeErr(`이미 하입하셨습니다. ${formatCooldownMinutes(cooldownRemainingMs)}분 후 다시 해주세요.`)
      return
    }
    const res = await hypePolicy({ policy_id: detail.policy_id, actor_student_id: studentId })
    if (res.success) {
      const hypeCount = (res as any)?.data?.hype_count ?? 0
      // 정책별 하입 카운트만 갱신
      setDetail((prev) => (prev ? { ...prev, hype_count: hypeCount } : prev))
      setPolicies((prev) =>
        prev.map((p) => (p.policy_id === detail.policy_id ? { ...p, hype_count: hypeCount } : p))
      )
    } else {
      const retryMs = (res as any)?.data?.retry_in_ms
      if (typeof retryMs === 'number' && retryMs > 0) {
        setHypeCooldownUntil(Date.now() + retryMs)
        setHypeErr(`하입은 30분마다 가능합니다. ${formatCooldownMinutes(retryMs)}분 후 다시 해주세요.`)
      } else {
        setHypeErr(res.error || '하입에 실패했습니다.')
      }
    }
  }, [cooldownRemainingMs, detail, studentId])

  const participationLinks = useMemo(() => detail?.participation_links || [], [detail])

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Helmet>
          <title>정책 게시판</title>
        </Helmet>
        <p className="text-sm text-gray-500">로그인 확인 중...</p>
      </div>
    )
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8">
        <Helmet>
          <title>{shareHeaderTitle}</title>
        </Helmet>
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-5 shadow">
          <h1 className="mb-3 text-lg font-semibold">{shareHeaderTitle}</h1>
          <p className="text-xs text-gray-500">학생 로그인 후 이용할 수 있습니다.</p>
          <Link to="/student/dashboard" className="mt-4 block text-center text-xs text-blue-600">
            학생 대시보드로
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white px-4 py-6 pb-24">
      <Helmet>
        <title>정책 게시판</title>
      </Helmet>
      <div className="mx-auto max-w-lg space-y-4">
        <header className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              to="/student/dashboard"
              title="홈"
              aria-label="학생 대시보드 홈"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-lg text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100"
            >
              🏠
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900">🔥 정책 게시판</h1>
              <p className="text-xs text-gray-500">카드를 눌러 제안서를 읽고, Hype!로 순위를 올리세요.</p>
            </div>
          </div>
        </header>

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}

        {loading ? (
          <p className="text-sm text-gray-500">불러오는 중...</p>
        ) : policies.length === 0 ? (
          <p className="text-sm text-gray-600">등록된 정책이 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {policies.map((p) => (
              <li key={p.policy_id}>
                <button
                  type="button"
                  onClick={() => openDetail(p.policy_id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white bg-white p-3 text-left shadow-md transition hover:ring-2 hover:ring-emerald-200"
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                    {policyLogoSrc(p.logo_data) ? (
                      <img
                        src={policyLogoSrc(p.logo_data)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl">🌱</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{p.title}</p>
                    <p className="truncate text-[11px] text-gray-500">{p.goal}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-amber-600">
                      🔥 {p.hype_count ?? 0}
                    </p>
                  </div>
                  <span className="text-gray-300">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {detail && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center">
            <div className="max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-base font-bold text-gray-900">{detail.title}</h2>
                  <p className="mt-0.5 break-words text-[11px] text-gray-500">목표: {detail.goal}</p>
                  <p className="mt-1 text-[11px] font-semibold text-amber-600">🔥 하입 횟수: {detail.hype_count ?? 0}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="rounded p-2 text-gray-500 hover:bg-gray-100"
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <h3 className="mb-1 text-xs font-bold text-gray-800">세부 설명</h3>
                  <p className="whitespace-pre-wrap text-xs text-gray-700">{detail.description}</p>
                  {detail.expected_effect && (
                    <>
                      <h3 className="mt-3 mb-1 text-xs font-bold text-gray-800">정책 기대효과</h3>
                      <p className="whitespace-pre-wrap text-xs text-gray-700">{detail.expected_effect}</p>
                    </>
                  )}
                  <p className="mt-3 text-xs text-gray-700">
                    1회 참여 시 지급 씨앗: <span className="font-semibold text-emerald-700">{detail.seeds_per_participation}</span>개
                  </p>
                </div>

                {participationLinks.length > 0 && (
                  <div className="rounded-xl border border-gray-100 bg-white p-3">
                    <h3 className="mb-2 text-xs font-bold text-gray-800">정책 참여 링크</h3>
                    <div className="flex flex-col gap-2">
                      {participationLinks.map((lnk, idx) => (
                        <a
                          key={`${idx}-${lnk}`}
                          href={lnk}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                        >
                          링크 {idx + 1} 열기
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                  <h3 className="mb-2 text-xs font-bold text-amber-900">Hype!로 순위 올리기</h3>
                  {hypeErr && <p className="mb-2 text-xs text-red-700">{hypeErr}</p>}
                  <button
                    type="button"
                    disabled={detailLoading || cooldownRemainingMs > 0}
                    onClick={() => void doHype()}
                    className="w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60"
                  >
                    {cooldownRemainingMs > 0
                      ? `${formatCooldownMinutes(cooldownRemainingMs)}분 뒤에 다시 Hype!`
                      : '🔥 Hype!'}
                  </button>
                  <p className="mt-2 text-[10px] text-amber-900/80">
                    Hype!는 정책마다 30분마다 한 번씩 가능합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

