import { useEffect, useId, useMemo, useState, type MouseEvent } from 'react'
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
import { policyLogoSrc } from '@/lib/policyImage'
import { compressImageFileToPolicyLogoDataUrl } from '@/lib/compressPolicyLogo'
import { cn } from '@/lib/utils'

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
  const [manageChoiceOpen, setManageChoiceOpen] = useState(false)
  const [managedPolicyId, setManagedPolicyId] = useState<string | null>(null)
  const [manageLoading, setManageLoading] = useState(false)
  /** 상세 슬라이드 패널 표시 (카드 본문 클릭 시 true, '정책 관리하기'만 열 때는 false로 중복 모달 방지) */
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  /** 상세 패널에서 '정책 관리하기'를 연 경우 닫기 시 패널 복귀 */
  const [manageOpenedFromDetail, setManageOpenedFromDetail] = useState(false)
  const [logoCompressing, setLogoCompressing] = useState(false)

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

  const openPolicyManage = async (pid: string) => {
    setErr('')
    setManagedPolicyId(pid)
    setManageOpenedFromDetail(false)
    setManageLoading(true)
    setManageChoiceOpen(true)
    const ok = await openCard(pid, { showPanel: false })
    setManageLoading(false)
    if (!ok) {
      setManageChoiceOpen(false)
      setManagedPolicyId(null)
    }
  }

  const openCard = async (pid: string, opts?: { showPanel?: boolean }): Promise<boolean> => {
    setErr('')
    const showPanel = opts?.showPanel !== false
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
      setDetailPanelOpen(showPanel)
      return true
    }
    setErr(d.error || '불러오기 실패')
    return false
  }

  const saveTeacherEdit = async () => {
    if (!detail) return
    setSaving(true)
    const logoPayload = (eLogo && String(eLogo).trim()) || detail.logo_data || ''
    const res = await savePolicy({
      policy_id: detail.policy_id,
      title: eTitle.trim(),
      goal: eGoal.trim(),
      description: eDesc.trim(),
      expected_effect: eExp.trim(),
      seeds_per_participation: Math.max(0, eSeeds),
      logo_data: logoPayload,
      creator_student_id: detail.creator_student_id,
      co_registrants: detail.co_registrants || [],
      actor_student_id: TEACHER_ACTOR,
      is_teacher: true,
    })
    setSaving(false)
    if (res.success) {
      setEditOpen(false)
      setManagedPolicyId(null)
      setManageOpenedFromDetail(false)
      await loadPolicies()
      await loadTree()
      await openCard(detail.policy_id, { showPanel: true })
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
    setManagedPolicyId(null)
    setManageOpenedFromDetail(false)
    await loadTree()
    await openCard(detail.policy_id, { showPanel: true })
  }

  const closeDetail = () => {
    setDetail(null)
    setParts([])
    setManageChoiceOpen(false)
    setManagedPolicyId(null)
    setDetailPanelOpen(false)
    setManageOpenedFromDetail(false)
    setManageLoading(false)
  }

  const closeManageChoice = () => {
    setManageChoiceOpen(false)
    if (manageOpenedFromDetail) {
      setDetailPanelOpen(true)
    } else {
      setDetail(null)
      setParts([])
      setManagedPolicyId(null)
    }
    setManageOpenedFromDetail(false)
  }

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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {policies.map((p) => (
                <PolicyCompactCard
                  key={p.policy_id}
                  policy={p}
                  classStudents={classStudents}
                  onOpen={() => openCard(p.policy_id)}
                  onManageClick={(e) => {
                    e.stopPropagation()
                    void openPolicyManage(p.policy_id)
                  }}
                  isManageActive={
                    managedPolicyId === p.policy_id &&
                    (manageChoiceOpen || editOpen || payOpen || manageLoading)
                  }
                  isManageLoading={managedPolicyId === p.policy_id && manageLoading}
                />
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
            <PolicyRankBox title="참여도가 가장 높은 정책 Top5" policies={tree.top_policies} />
            <PolicyRankBox title="참여도가 가장 낮은 정책 Top5" policies={tree.lowest_policies} />
          </div>

          <PolicyTreeIllustration total={tree.total_seeds_class} />
        </section>
      )}

      {detail && detailPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center gap-3 border-b bg-white px-4 py-3">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                {policyLogoSrc(detail.logo_data) ? (
                  <img src={policyLogoSrc(detail.logo_data)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl">🌱</div>
                )}
              </div>
              <h2 className="min-w-0 flex-1 truncate text-base font-bold text-gray-900">{detail.title}</h2>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded p-2 text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 p-4">
              <button
                type="button"
                onClick={() => {
                  if (detail) {
                    setManagedPolicyId(detail.policy_id)
                    setManageOpenedFromDetail(true)
                    setDetailPanelOpen(false)
                    setManageChoiceOpen(true)
                  }
                }}
                className={cn(
                  'w-full rounded-lg px-3 py-2.5 text-xs font-semibold shadow-sm transition active:scale-[0.98] sm:w-auto',
                  manageChoiceOpen && managedPolicyId === detail?.policy_id
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                    : 'bg-slate-700 text-white hover:bg-slate-800'
                )}
              >
                정책 관리하기
              </button>
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

      {manageChoiceOpen && (
        <div className="fixed inset-0 z-[58] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            {manageLoading && !detail ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10">
                <span
                  className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"
                  aria-hidden
                />
                <p className="text-sm font-medium text-gray-700">정책을 불러오는 중…</p>
              </div>
            ) : detail ? (
              <>
                <h3 className="mb-1 text-lg font-bold text-gray-900">정책 관리</h3>
                <p className="mb-5 line-clamp-2 text-sm text-gray-600">{detail.title}</p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={manageLoading}
                    onClick={() => {
                      setManageChoiceOpen(false)
                      setEditOpen(true)
                    }}
                    className="rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    정책 수정하기
                  </button>
                  <button
                    type="button"
                    disabled={manageLoading}
                    onClick={() => {
                      setManageChoiceOpen(false)
                      setPayOpen(true)
                      setPaySearch('')
                    }}
                    className="rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white shadow transition hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    씨앗 지급 / 회수
                  </button>
                  <button
                    type="button"
                    onClick={closeManageChoice}
                    className="rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.99]"
                  >
                    닫기
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {editOpen && detail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6">
            <h3 className="mb-4 text-lg font-bold text-gray-900">정책 수정 (교사)</h3>
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
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">세부 설명 (참여 방법 등)</label>
                <textarea
                  value={eDesc}
                  onChange={(e) => setEDesc(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">정책 기대효과</label>
                <textarea
                  value={eExp}
                  onChange={(e) => setEExp(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2"
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
                <p className="mb-1 text-[10px] text-gray-500">큰 사진은 자동으로 압축됩니다.</p>
                <input
                  type="file"
                  accept="image/*"
                  disabled={logoCompressing}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setLogoCompressing(true)
                    try {
                      const dataUrl = await compressImageFileToPolicyLogoDataUrl(f)
                      setELogo(dataUrl)
                    } catch {
                      setErr('이미지 처리에 실패했습니다.')
                    } finally {
                      setLogoCompressing(false)
                      e.target.value = ''
                    }
                  }}
                  className="text-xs"
                />
                {logoCompressing && <p className="text-[10px] text-gray-500">압축 중...</p>}
                {policyLogoSrc(eLogo) && (
                  <img src={policyLogoSrc(eLogo)} alt="" className="mt-2 h-16 w-16 rounded-lg border object-cover" />
                )}
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditOpen(false)
                  setManagedPolicyId(null)
                  if (manageOpenedFromDetail) {
                    setDetailPanelOpen(true)
                    setManageOpenedFromDetail(false)
                  } else {
                    setDetail(null)
                    setParts([])
                  }
                }}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium transition active:scale-[0.99]"
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveTeacherEdit}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-70"
              >
                {saving ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    저장 중…
                  </span>
                ) : (
                  '저장'
                )}
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
              <button
                type="button"
                onClick={() => {
                  setPayOpen(false)
                  setManagedPolicyId(null)
                  if (manageOpenedFromDetail) {
                    setDetailPanelOpen(true)
                    setManageOpenedFromDetail(false)
                  } else {
                    setDetail(null)
                    setParts([])
                  }
                }}
                className="flex-1 rounded border py-2 transition active:scale-[0.99]"
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={applySeeds}
                className="flex-1 rounded bg-amber-500 py-2 font-semibold text-white transition active:scale-[0.98] disabled:opacity-70"
              >
                {saving ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    저장 중…
                  </span>
                ) : (
                  '저장'
                )}
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
}: {
  title: string
  policies: Array<{ policy_id: string; title: string; total_seeds: number; logo_data?: string; policy_logo_data?: string }>
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-xs font-bold text-gray-800">{title}</h3>
      <ul className="space-y-2">
        {policies.map((p, i) => {
          const src = policyLogoSrc(p.logo_data || p.policy_logo_data)
          return (
            <li key={p.policy_id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5">
              <span className="w-5 text-center text-[11px] font-bold text-sky-600">{i + 1}</span>
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white">
                {src ? (
                  <img src={src} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg">🌱</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-gray-900">{p.title}</p>
              </div>
              <span className="text-sm font-bold text-emerald-600">{p.total_seeds}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function PolicyCompactCard({
  policy,
  classStudents,
  onOpen,
  onManageClick,
  isManageActive,
  isManageLoading,
}: {
  policy: Policy
  classStudents: Student[]
  onOpen: () => void
  onManageClick: (e: MouseEvent) => void
  isManageActive: boolean
  isManageLoading?: boolean
}) {
  const cid = String(policy.creator_student_id ?? '').trim()
  const creator = classStudents.find((s) => String(s.student_id).trim() === cid)
  const co = (policy.co_registrants || [])
    .map((id) => classStudents.find((s) => String(s.student_id).trim() === String(id).trim()))
    .filter((x): x is Student => Boolean(x))
  const logo = policyLogoSrc(policy.logo_data)
  const creatorTooltip = creator
    ? `${creator.name} (${String(creator.student_id)})`
    : cid
    ? `학번 ${cid} (학생 목록에 없음)`
    : ''

  return (
    <div className="w-full max-w-[220px] justify-self-start">
      <div className="flex flex-col rounded-xl border border-gray-100 bg-white p-1.5 shadow-sm">
        <button type="button" onClick={onOpen} className="flex gap-1.5 text-left">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-50">
            {logo ? (
              <img src={logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-base">🌱</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[11px] font-bold leading-tight text-gray-900">{policy.title}</p>
            <p className="line-clamp-2 text-[9px] leading-tight text-gray-500">{policy.goal || '\u00A0'}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5">
              <span className="shrink-0 text-[9px] text-gray-400">등록</span>
              {creator ? (
                <span
                  className="inline-flex h-6 w-6 shrink-0 cursor-default overflow-hidden rounded-full bg-gray-100 ring-1 ring-gray-200"
                  title={creatorTooltip}
                >
                  {creator.photo_data ? (
                    <img
                      src={photoSrc(creator.photo_data)}
                      alt=""
                      title={creatorTooltip}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-full w-full items-center justify-center text-[8px] font-medium text-gray-500"
                      title={creatorTooltip}
                    >
                      {(creator.name || '?').charAt(0)}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-[9px] text-gray-500" title={creatorTooltip}>
                  {cid || '?'}
                </span>
              )}
              {co.length > 0 && (
                <>
                  <span className="shrink-0 text-[9px] text-gray-400">·공동</span>
                  {co.map((s) => {
                    const tip = `${s.name} (${String(s.student_id)})`
                    return (
                      <span
                        key={s.student_id}
                        className="inline-flex h-6 w-6 shrink-0 cursor-default overflow-hidden rounded-full bg-gray-100 ring-1 ring-white"
                        title={tip}
                      >
                        {s.photo_data ? (
                          <img src={photoSrc(s.photo_data)} alt="" title={tip} className="h-full w-full object-cover" />
                        ) : (
                          <span
                            className="flex h-full w-full items-center justify-center text-[8px] font-medium text-gray-500"
                            title={tip}
                          >
                            {(s.name || '?').charAt(0)}
                          </span>
                        )}
                      </span>
                    )
                  })}
                </>
              )}
            </div>
          </div>
        </button>
        <button
          type="button"
          disabled={isManageLoading}
          onClick={onManageClick}
          className={cn(
            'mt-1.5 w-full rounded-md py-1.5 text-[10px] font-semibold transition active:scale-[0.97] disabled:cursor-wait',
            isManageActive
              ? 'bg-emerald-600 text-white shadow ring-2 ring-emerald-300 ring-offset-1'
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200',
            isManageLoading && 'opacity-80'
          )}
        >
          {isManageLoading ? (
            <span className="inline-flex items-center justify-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              불러오는 중
            </span>
          ) : (
            '정책 관리하기'
          )}
        </button>
      </div>
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
