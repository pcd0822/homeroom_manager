import { useEffect, useId, useMemo, useState } from 'react'
import {
  getPolicies,
  getPolicyDetail,
  getPolicyParticipants,
  getPolicyTreeDashboard,
  getStudents,
  savePolicy,
  setPolicySeeds,
} from '@/api/api'
import type { Policy, PolicyParticipant, PolicyTreeDashboard, Student } from '@/types'

const TEACHER_ACTOR = '__teacher__'

function photoSrc(photo?: string | null) {
  if (!photo) return ''
  return photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`
}

export function PoliciesAdminPage() {
  const [tab, setTab] = useState<'cards' | 'tree'>('cards')
  const [policies, setPolicies] = useState<Policy[]>([])
  const [tree, setTree] = useState<PolicyTreeDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const [detail, setDetail] = useState<Policy | null>(null)
  const [parts, setParts] = useState<PolicyParticipant[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [eTitle, setETitle] = useState('')
  const [eGoal, setEGoal] = useState('')
  const [eDesc, setEDesc] = useState('')
  const [eExp, setEExp] = useState('')
  const [eSeeds, setESeeds] = useState(0)
  const [eLogo, setELogo] = useState('')
  const [saving, setSaving] = useState(false)
  const [classStudents, setClassStudents] = useState<Student[]>([])
  const [paySearch, setPaySearch] = useState('')

  const loadPolicies = async () => {
    setLoading(true)
    const res = await getPolicies()
    setLoading(false)
    if (res.success && res.data) setPolicies(res.data)
    else setErr(res.error || '불러오기 실패')
  }

  const loadTree = async () => {
    const res = await getPolicyTreeDashboard()
    if (res.success && res.data) setTree(res.data)
  }

  useEffect(() => {
    loadPolicies()
    loadTree()
    getStudents().then((r) => {
      if (r.success && r.data) setClassStudents(r.data)
    })
  }, [])

  const payAddCandidates = useMemo(() => {
    const q = paySearch.trim().toLowerCase()
    const ids = new Set(Object.keys(draft))
    let list = classStudents.filter((s) => !ids.has(s.student_id))
    if (q) {
      list = list.filter(
        (s) => s.student_id.toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q)
      )
    }
    return list.slice(0, 25)
  }, [classStudents, draft, paySearch])

  const openCard = async (pid: string) => {
    setErr('')
    const d = await getPolicyDetail(pid)
    const p = await getPolicyParticipants(pid)
    if (d.success && d.data) {
      setDetail(d.data)
      const list = p.success && p.data ? p.data : []
      setParts(list)
      const dr: Record<string, number> = {}
      list.forEach((x) => {
        dr[x.student_id] = x.seeds_count
      })
      setDraft(dr)
      setETitle(d.data.title)
      setEGoal(d.data.goal || '')
      setEDesc(d.data.description || '')
      setEExp(d.data.expected_effect || '')
      setESeeds(Number(d.data.seeds_per_participation) || 0)
      setELogo(d.data.logo_data || '')
    }
  }

  const saveTeacherEdit = async () => {
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
      actor_student_id: TEACHER_ACTOR,
      is_teacher: true,
    })
    setSaving(false)
    if (res.success) {
      setEditOpen(false)
      await loadPolicies()
      await loadTree()
      await openCard(detail.policy_id)
    } else setErr(res.error || '저장 실패')
  }

  const applySeeds = async () => {
    if (!detail) return
    setSaving(true)
    for (const sid of Object.keys(draft)) {
      const r = await setPolicySeeds({
        policy_id: detail.policy_id,
        student_id: sid,
        seeds_count: draft[sid],
        actor_student_id: TEACHER_ACTOR,
        is_teacher: true,
      })
      if (!r.success) {
        setErr(r.error || '저장 실패')
        setSaving(false)
        return
      }
    }
    setSaving(false)
    setPayOpen(false)
    await loadTree()
    await openCard(detail.policy_id)
  }

  const logoOf = (p: { logo_data?: string; policy_logo_data?: string }) =>
    p.logo_data || p.policy_logo_data || ''

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">학급 정책 · 씨앗</h1>
        <p className="text-xs text-gray-500">학생이 등록한 정책을 관리하고, 정책 나무 대시보드를 확인합니다.</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setTab('cards')}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === 'cards' ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 ring-1 ring-gray-200'
            }`}
          >
            정책 카드 보기
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('tree')
              loadTree()
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === 'tree' ? 'bg-emerald-600 text-white shadow' : 'bg-white text-gray-600 ring-1 ring-gray-200'
            }`}
          >
            정책 나무 보기
          </button>
        </div>
      </header>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      {tab === 'cards' && (
        <section>
          {loading ? (
            <p className="text-sm text-gray-500">불러오는 중...</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {policies.map((p) => (
                <div
                  key={p.policy_id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => openCard(p.policy_id)}
                    className="flex flex-1 flex-col items-start p-4 text-left"
                  >
                    <div className="mb-2 h-16 w-16 overflow-hidden rounded-xl bg-gray-50">
                      {p.logo_data ? (
                        <img src={p.logo_data} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl">🌱</div>
                      )}
                    </div>
                    <p className="line-clamp-2 font-bold text-gray-900">{p.title}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-gray-500">{p.goal}</p>
                  </button>
                  <div className="border-t border-gray-100 p-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openCard(p.policy_id).then(() => setEditOpen(true))
                      }}
                      className="w-full rounded-lg bg-gray-100 py-2 text-xs font-medium text-gray-800 hover:bg-gray-200"
                    >
                      정책 수정하기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {policies.length === 0 && !loading && (
            <p className="text-sm text-gray-500">등록된 정책이 없습니다.</p>
          )}
        </section>
      )}

      {tab === 'tree' && tree && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-inner">
            <h2 className="mb-2 text-sm font-bold text-emerald-900">학급 씨앗 총합</h2>
            <p className="text-4xl font-black text-emerald-700">{tree.total_seeds_class}</p>
            <p className="mt-1 text-xs text-emerald-800/80">모든 정책에서 지급·기록된 씨앗의 합계입니다.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <RankBox
              title="가장 참여가 많은 학생 Top5"
              items={tree.top_students.map((s) => ({
                id: s.student_id,
                name: s.student_name,
                value: s.total_seeds,
                photo: s.photo_data,
              }))}
            />
            <RankBox
              title="가장 참여가 적은 학생 Top5"
              items={tree.lowest_students.map((s) => ({
                id: s.student_id,
                name: s.student_name,
                value: s.total_seeds,
                photo: s.photo_data,
              }))}
            />
            <PolicyRankBox title="참여도가 가장 높은 정책 Top5" policies={tree.top_policies} logoOf={logoOf} />
            <PolicyRankBox title="참여도가 가장 낮은 정책 Top5" policies={tree.lowest_policies} logoOf={logoOf} />
          </div>

          <PolicyTreeIllustration total={tree.total_seeds_class} />
        </section>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-4 py-3">
              <h2 className="font-bold text-gray-900">{detail.title}</h2>
              <button
                type="button"
                onClick={() => {
                  setDetail(null)
                  setParts([])
                }}
                className="rounded p-2 text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  정책 수정하기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPayOpen(true)
                    setPaySearch('')
                  }}
                  className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white"
                >
                  씨앗 지급 / 회수
                </button>
              </div>
              <p className="text-xs text-gray-600 whitespace-pre-wrap">{detail.description}</p>
              <h3 className="text-sm font-bold">참여 학생</h3>
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2">학생</th>
                      <th className="px-2 py-2">씨앗</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((row) => (
                      <tr key={row.student_id} className="border-t">
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 overflow-hidden rounded-full bg-gray-100">
                              {row.photo_data ? (
                                <img src={photoSrc(row.photo_data)} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px]">
                                  {(row.student_name || '?').charAt(0)}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{row.student_name}</p>
                              <p className="text-[10px] text-gray-500">{row.student_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2 font-semibold text-emerald-700">{row.seeds_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parts.length === 0 && <p className="p-3 text-xs text-gray-400">기록된 학생이 없습니다.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {editOpen && detail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4">
            <h3 className="mb-3 font-bold">정책 수정 (교사)</h3>
            <div className="space-y-2 text-sm">
              <input value={eTitle} onChange={(e) => setETitle(e.target.value)} className="w-full rounded border px-2 py-1.5" />
              <textarea value={eGoal} onChange={(e) => setEGoal(e.target.value)} rows={2} className="w-full rounded border px-2 py-1.5" />
              <textarea value={eDesc} onChange={(e) => setEDesc(e.target.value)} rows={3} className="w-full rounded border px-2 py-1.5" />
              <textarea value={eExp} onChange={(e) => setEExp(e.target.value)} rows={2} className="w-full rounded border px-2 py-1.5" />
              <input
                type="number"
                min={0}
                value={eSeeds}
                onChange={(e) => setESeeds(Number(e.target.value))}
                className="w-full rounded border px-2 py-1.5"
              />
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
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setEditOpen(false)} className="flex-1 rounded border py-2">
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveTeacherEdit}
                className="flex-1 rounded bg-blue-600 py-2 font-semibold text-white"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {payOpen && detail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4">
            <h3 className="mb-2 font-bold">씨앗 지급 · 회수</h3>
            <p className="mb-3 text-[11px] text-gray-500">학생별 씨앗 수를 숫자로 수정한 뒤 저장합니다. 새 학생을 아래에서 추가할 수 있습니다.</p>
            <input
              type="search"
              placeholder="학생 검색 후 추가"
              value={paySearch}
              onChange={(e) => setPaySearch(e.target.value)}
              className="mb-2 w-full rounded border px-2 py-1.5 text-xs"
            />
            <div className="mb-3 max-h-28 space-y-1 overflow-y-auto rounded border border-dashed border-gray-200 p-2">
              {payAddCandidates.map((s) => (
                <button
                  key={s.student_id}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      [s.student_id]: Math.max(0, Number(detail.seeds_per_participation) || 0),
                    }))
                  }
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] hover:bg-amber-50"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-gray-400">{s.student_id}</span>
                  <span className="ml-auto text-amber-600">+</span>
                </button>
              ))}
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {Object.keys(draft).map((sid) => {
                const row = parts.find((p) => p.student_id === sid)
                const st = classStudents.find((x) => x.student_id === sid)
                return (
                  <div key={sid} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate">{row?.student_name || st?.name || sid}</span>
                    <input
                      type="number"
                      min={0}
                      className="w-24 rounded border px-2 py-1"
                      value={draft[sid]}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [sid]: Math.max(0, Number(e.target.value) || 0) }))
                      }
                    />
                  </div>
                )
              })}
            </div>
            {Object.keys(draft).length === 0 && (
              <p className="text-xs text-gray-400">씨앗 기록이 있는 학생이 없습니다. 학생 화면에서 먼저 씨앗이 지급되면 표시됩니다.</p>
            )}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setPayOpen(false)} className="flex-1 rounded border py-2">
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={applySeeds}
                className="flex-1 rounded bg-amber-500 py-2 font-semibold text-white"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RankBox({
  title,
  items,
}: {
  title: string
  items: Array<{ id: string; name: string; value: number; photo?: string }>
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-xs font-bold text-gray-800">{title}</h3>
      <ul className="space-y-2">
        {items.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5">
            <span className="w-5 text-center text-[11px] font-bold text-amber-600">{i + 1}</span>
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white">
              {s.photo ? (
                <img src={photoSrc(s.photo)} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                  {(s.name || '?').charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-900">{s.name}</p>
              <p className="text-[10px] text-gray-500">{s.id}</p>
            </div>
            <span className="text-sm font-bold text-emerald-600">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PolicyRankBox({
  title,
  policies,
  logoOf,
}: {
  title: string
  policies: Array<{ policy_id: string; title: string; total_seeds: number; logo_data?: string; policy_logo_data?: string }>
  logoOf: (p: { logo_data?: string; policy_logo_data?: string }) => string
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-xs font-bold text-gray-800">{title}</h3>
      <ul className="space-y-2">
        {policies.map((p, i) => (
          <li key={p.policy_id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5">
            <span className="w-5 text-center text-[11px] font-bold text-sky-600">{i + 1}</span>
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white">
              {logoOf(p) ? (
                <img src={logoOf(p)} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg">🌱</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-900">{p.title}</p>
            </div>
            <span className="text-sm font-bold text-emerald-600">{p.total_seeds}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 총 씨앗 500일 때 나무가 가득 차도록, 아래에서 위로 채움 */
function PolicyTreeIllustration({ total }: { total: number }) {
  const uid = useId().replace(/:/g, '')
  const max = 500
  const ratio = Math.min(1, Math.max(0, total / max))
  const fillPercent = Math.round(ratio * 100)
  return (
    <div className="rounded-3xl border-2 border-emerald-200 bg-gradient-to-b from-sky-50 to-emerald-50 p-8 text-center shadow-inner">
      <h3 className="mb-4 text-sm font-bold text-emerald-900">🌳 정책 나무</h3>
      <div className="relative mx-auto w-52">
        <svg viewBox="0 0 200 240" className="h-64 w-full drop-shadow-md">
          <defs>
            <linearGradient id={`${uid}-treeFill`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#6ee7b7" />
            </linearGradient>
            <clipPath id={`${uid}-foliageClip`}>
              <rect x="0" y={200 - 165 * ratio} width="200" height="200" />
            </clipPath>
            <clipPath id={`${uid}-trunkClip`}>
              <rect x="86" y={200 - 62 * ratio} width="28" height={62 * ratio} />
            </clipPath>
          </defs>
          <ellipse cx="100" cy="228" rx="70" ry="12" fill="#bbf7d0" opacity="0.8" />
          {/* 줄기 테두리 */}
          <rect x="86" y="138" width="28" height="62" rx="6" fill="none" stroke="#065f46" strokeWidth="3" />
          {/* 줄기 채움 */}
          <rect x="86" y="138" width="28" height="62" rx="6" fill="#10b981" clipPath={`url(#${uid}-trunkClip)`} />
          {/* 수관 테두리 */}
          <path
            d="M100 38 C38 38 18 98 48 128 C28 148 38 188 100 200 C162 188 172 148 152 128 C182 98 162 38 100 38 Z"
            fill="none"
            stroke="#047857"
            strokeWidth="3"
          />
          {/* 수관 채움 */}
          <path
            d="M100 38 C38 38 18 98 48 128 C28 148 38 188 100 200 C162 188 172 148 152 128 C182 98 162 38 100 38 Z"
            fill={`url(#${uid}-treeFill)`}
            fillOpacity="0.9"
            clipPath={`url(#${uid}-foliageClip)`}
          />
          <circle cx="100" cy="108" r="9" fill="#fef3c7" />
          <circle cx="96" cy="106" r="1.5" fill="#1f2937" />
          <circle cx="104" cy="106" r="1.5" fill="#1f2937" />
          <path d="M96 112 Q100 116 104 112" fill="none" stroke="#1f2937" strokeWidth="1" />
        </svg>
      </div>
      <p className="mt-2 text-xs text-emerald-800">
        나무 성장도 <strong>{fillPercent}%</strong> (목표 {max}개 중 {total}개)
      </p>
      <p className="mt-1 text-[10px] text-emerald-700/80">씨앗이 모일수록 나무가 아래에서 위로 푸르게 자라요 🌱</p>
    </div>
  )
}
