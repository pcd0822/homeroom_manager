import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useSearchParams } from 'react-router-dom'
import {
  authStudent,
  getPoliciesForStudent,
  getPolicyDetail,
  getPolicyParticipants,
  getStudents,
  savePolicy,
  batchSetPolicySeeds,
} from '@/api/api'
import type { Policy, PolicyParticipant, Student } from '@/types'
import { policyLogoSrc } from '@/lib/policyImage'

const LOGIN_KEY = 'homeroom_login'

function photoSrc(photo?: string | null) {
  if (!photo) return ''
  return photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`
}

export function StudentPoliciesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const openId = searchParams.get('open') || ''

  const [studentId, setStudentId] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [name, setName] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [policies, setPolicies] = useState<Policy[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const [detail, setDetail] = useState<Policy | null>(null)
  const [parts, setParts] = useState<PolicyParticipant[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [scatterOpen, setScatterOpen] = useState(false)
  const [seedSearch, setSeedSearch] = useState('')
  const [seedDraft, setSeedDraft] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  const [eTitle, setETitle] = useState('')
  const [eGoal, setEGoal] = useState('')
  const [eDesc, setEDesc] = useState('')
  const [eExp, setEExp] = useState('')
  const [eSeeds, setESeeds] = useState(0)
  const [eLogo, setELogo] = useState('')

  const load = useCallback(async () => {
    if (!studentId) return
    setLoading(true)
    const res = await getPoliciesForStudent(studentId)
    setLoading(false)
    if (res.success && res.data) setPolicies(res.data)
    else setErr(res.error || '목록을 불러오지 못했습니다.')
  }, [studentId])

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
        setAuthCode(p.auth_code)
        const r = await authStudent(p.student_id, p.auth_code)
        if (cancelled) return
        if (r.success && r.data) {
          setName(r.data.name || '')
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
    getStudents().then((r) => {
      if (r.success && r.data) setStudents(r.data)
    })
  }, [])

  useEffect(() => {
    if (loggedIn && studentId) load()
  }, [loggedIn, studentId, load])

  const openDetail = useCallback(async (pid: string) => {
    setErr('')
    const d = await getPolicyDetail(pid)
    const p = await getPolicyParticipants(pid)
    if (d.success && d.data) {
      setDetail(d.data)
      setParts(p.success && p.data ? p.data : [])
      const draft: Record<string, number> = {}
      ;(p.data || []).forEach((x) => {
        draft[x.student_id] = x.seeds_count
      })
      setSeedDraft(draft)
      setETitle(d.data.title)
      setEGoal(d.data.goal || '')
      setEDesc(d.data.description || '')
      setEExp(d.data.expected_effect || '')
      setESeeds(Number(d.data.seeds_per_participation) || 0)
      setELogo(d.data.logo_data || '')
    }
  }, [])

  const openHandledRef = useRef<string | null>(null)
  useEffect(() => {
    if (!openId) {
      openHandledRef.current = null
      return
    }
    if (!loggedIn || !studentId) return
    if (openHandledRef.current === openId) return
    openHandledRef.current = openId
    void openDetail(openId).then(() => setSearchParams({}, { replace: true }))
  }, [openId, loggedIn, studentId, openDetail, setSearchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    const res = await authStudent(studentId.trim(), authCode.trim())
    if (res.success && res.data) {
      setName(res.data.name || '')
      setLoggedIn(true)
      localStorage.setItem(
        LOGIN_KEY,
        JSON.stringify({ student_id: studentId.trim(), auth_code: authCode.trim() })
      )
    } else setErr(res.error || '인증 실패')
  }

  const canManage = (p: Policy) =>
    p.creator_student_id === studentId || (p.co_registrants || []).includes(studentId)

  const saveEdit = async () => {
    if (!detail) return
    setSaving(true)
    const res = await savePolicy({
      policy_id: detail.policy_id,
      title: eTitle.trim(),
      goal: eGoal.trim(),
      description: eDesc.trim(),
      expected_effect: eExp.trim(),
      seeds_per_participation: Math.max(0, eSeeds),
      logo_data: eLogo,
      creator_student_id: detail.creator_student_id,
      co_registrants: detail.co_registrants || [],
      actor_student_id: studentId,
    })
    setSaving(false)
    if (res.success) {
      setEditOpen(false)
      await load()
      await openDetail(detail.policy_id)
    } else setErr(res.error || '저장 실패')
  }

  const saveScatter = async () => {
    if (!detail) return
    setSaving(true)
    const items = Object.entries(seedDraft).map(([sid, seeds_count]) => ({ student_id: sid, seeds_count }))
    const res = await batchSetPolicySeeds({
      policy_id: detail.policy_id,
      items,
      actor_student_id: studentId,
    })
    setSaving(false)
    if (res.success) {
      setScatterOpen(false)
      await openDetail(detail.policy_id)
    } else setErr(res.error || '저장 실패')
  }

  const addStudentToSeeds = (sid: string) => {
    if (!seedDraft[sid]) setSeedDraft((d) => ({ ...d, [sid]: detail?.seeds_per_participation || 0 }))
  }

  const filteredForScatter = useMemo(() => {
    const q = seedSearch.trim().toLowerCase()
    const base = students.filter((s) => !(s.student_id in seedDraft))
    if (!q) return base
    return base.filter(
      (s) => s.student_id.toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q)
    )
  }, [students, seedDraft, seedSearch])

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Helmet>
          <title>정책 관리</title>
        </Helmet>
        <p className="text-sm text-gray-500">로그인 확인 중...</p>
      </div>
    )
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8">
        <Helmet>
          <title>정책 관리</title>
        </Helmet>
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-5 shadow">
          <h1 className="mb-3 text-lg font-semibold">정책 관리 — 로그인</h1>
          <form onSubmit={handleLogin} className="space-y-2 text-sm">
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="학번"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
            <input
              type="password"
              className="w-full rounded border px-3 py-2"
              placeholder="개인코드"
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
            />
            {err && <p className="text-xs text-red-600">{err}</p>}
            <button type="submit" className="w-full rounded-lg bg-blue-600 py-2 text-white">
              입장
            </button>
          </form>
          <Link to="/student/dashboard" className="mt-3 block text-center text-xs text-blue-600">
            ← 학생 대시보드
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white px-4 py-6">
      <Helmet>
        <title>정책 관리 | {name}</title>
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
              <h1 className="text-lg font-bold text-gray-900">🌿 정책 관리하기</h1>
              <p className="text-xs text-gray-500">
                {name} ({studentId})
              </p>
            </div>
          </div>
          <Link to="/student/policy/register" className="shrink-0 text-[11px] font-medium text-emerald-700">
            + 정책 등록
          </Link>
        </header>

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}

        {!detail && (
          <>
            {loading ? (
              <p className="text-sm text-gray-500">불러오는 중...</p>
            ) : policies.length === 0 ? (
              <p className="text-sm text-gray-600">등록된 정책이 없습니다. 정책 등록 링크로 새로 등록해 보세요.</p>
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
                          <img src={policyLogoSrc(p.logo_data)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl">🌱</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-900">{p.title}</p>
                        <p className="truncate text-[11px] text-gray-500">{p.goal}</p>
                      </div>
                      <span className="text-gray-300">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {detail && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setDetail(null)
                setParts([])
              }}
              className="text-xs text-blue-600"
            >
              ← 목록으로
            </button>

            <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow">
              {/* 데스크톱에서 제목이 길면 가로 배치 시 버튼이 화면 밖으로 밀리므로, 로고+제목과 버튼 행을 분리 */}
              <div className="flex gap-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-50">
                  {policyLogoSrc(detail.logo_data) ? (
                    <img src={policyLogoSrc(detail.logo_data)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">🌱</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-base font-bold text-gray-900">{detail.title}</h2>
                  <p className="mt-0.5 break-words text-[11px] text-gray-500">목표: {detail.goal}</p>
                </div>
              </div>
              {canManage(detail) && (
                <div className="mt-3 flex w-full flex-wrap gap-2 border-t border-emerald-100/80 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm"
                  >
                    정책 수정하기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScatterOpen(true)
                      setSeedSearch('')
                    }}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm"
                  >
                    씨앗 뿌리기
                  </button>
                </div>
              )}
              <dl className="mt-4 space-y-2 text-xs text-gray-700">
                <div>
                  <dt className="font-semibold text-gray-800">세부 설명</dt>
                  <dd className="whitespace-pre-wrap">{detail.description}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-800">기대효과</dt>
                  <dd className="whitespace-pre-wrap">{detail.expected_effect}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-800">1회 참여 시 씨앗</dt>
                  <dd>{detail.seeds_per_participation}개</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow">
              <h3 className="mb-2 text-sm font-bold text-gray-800">참여자 · 씨앗</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="py-1 pr-2">학생</th>
                      <th className="py-1">씨앗(누적)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((row) => (
                      <tr key={row.student_id} className="border-b border-gray-50">
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-100">
                              {row.photo_data ? (
                                <img src={photoSrc(row.photo_data)} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                                  {(row.student_name || '?').charAt(0)}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{row.student_name}</p>
                              <p className="text-[10px] text-gray-500">{row.student_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="font-semibold text-emerald-700">{row.seeds_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parts.length === 0 && <p className="text-xs text-gray-400">아직 씨앗이 기록된 학생이 없습니다.</p>}
              </div>
            </div>
          </div>
        )}

        {editOpen && detail && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
            <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6">
              <h3 className="mb-4 text-lg font-bold text-gray-900">정책 수정</h3>
              <div className="space-y-4 text-sm">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">정책명</label>
                  <input
                    value={eTitle}
                    onChange={(e) => setETitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">정책의 목표</label>
                  <textarea
                    value={eGoal}
                    onChange={(e) => setEGoal(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">세부 설명 (참여 방법 등)</label>
                  <textarea
                    value={eDesc}
                    onChange={(e) => setEDesc(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                    rows={4}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">정책 기대효과</label>
                  <textarea
                    value={eExp}
                    onChange={(e) => setEExp(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">1회 참여 시 지급 씨앗</label>
                  <input
                    type="number"
                    min={0}
                    value={eSeeds}
                    onChange={(e) => setESeeds(Number(e.target.value))}
                    className="w-40 rounded-lg border border-gray-200 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">정책 로고 (이미지 변경)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      const r = new FileReader()
                      r.onload = () => setELogo(String(r.result || '').slice(0, 45000))
                      r.readAsDataURL(f)
                    }}
                    className="text-xs"
                  />
                  {policyLogoSrc(eLogo) && (
                    <img src={policyLogoSrc(eLogo)} alt="" className="mt-2 h-16 w-16 rounded-lg border object-cover" />
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setEditOpen(false)} className="flex-1 rounded border py-2 text-sm">
                  취소
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveEdit}
                  className="flex-1 rounded bg-blue-600 py-2 text-sm font-semibold text-white"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}

        {scatterOpen && detail && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
              <h3 className="mb-2 font-bold">씨앗 뿌리기</h3>
              <p className="mb-3 text-[11px] text-gray-500">
                학생별 누적 씨앗 수를 입력하고 저장합니다. 새 학생을 추가하려면 아래에서 선택하세요.
              </p>
              <input
                type="search"
                placeholder="추가할 학생 검색"
                value={seedSearch}
                onChange={(e) => setSeedSearch(e.target.value)}
                className="mb-2 w-full rounded border px-2 py-1.5 text-xs"
              />
              <div className="mb-3 max-h-32 space-y-1 overflow-y-auto rounded border p-2">
                {filteredForScatter.slice(0, 20).map((s) => (
                  <button
                    key={s.student_id}
                    type="button"
                    onClick={() => addStudentToSeeds(s.student_id)}
                    className="flex w-full items-center gap-2 rounded border border-dashed px-2 py-1 text-left text-[11px] hover:bg-emerald-50"
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="text-gray-400">{s.student_id}</span>
                    <span className="ml-auto text-emerald-600">+ 추가</span>
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {Object.keys(seedDraft).map((sid) => {
                  const st = students.find((x) => x.student_id === sid)
                  return (
                    <div key={sid} className="flex items-center gap-2 text-xs">
                      <span className="w-24 truncate font-medium">{st?.name || sid}</span>
                      <input
                        type="number"
                        min={0}
                        className="w-24 rounded border px-2 py-1"
                        value={seedDraft[sid]}
                        onChange={(e) =>
                          setSeedDraft((d) => ({ ...d, [sid]: Math.max(0, Number(e.target.value) || 0) }))
                        }
                      />
                      <span className="text-gray-400">씨앗</span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setScatterOpen(false)} className="flex-1 rounded border py-2 text-sm">
                  취소
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveScatter}
                  className="flex-1 rounded bg-emerald-600 py-2 text-sm font-semibold text-white"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
