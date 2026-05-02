import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import {
  deletePolicy,
  getPolicies,
  getPolicyDetail,
  getPolicyParticipants,
  getPolicyTreeDashboard,
  getStudents,
  getClassSeedSummary,
  getSeedProducts,
  savePolicy,
  saveSeedProduct,
  spendSeeds,
  setPolicySeeds,
} from '@/api/api'
import type { Policy, PolicyParticipant, PolicyTreeDashboard, Student } from '@/types'
import { policyLogoSrc } from '@/lib/policyImage'
import { compressImageFileToPolicyLogoDataUrl } from '@/lib/compressPolicyLogo'
import { cn } from '@/lib/utils'
import { existingSeedsFor } from '@/lib/policySeeds'
import { PolicyTreeIllustration } from '@/components/PolicyTreeIllustration'

const TEACHER_ACTOR = '__teacher__'

function photoSrc(photo?: string | null) {
  if (!photo) return ''
  return photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`
}

/** 폴링 시 정책 목록의 표시용 필드만 비교해 동일하면 setState 생략 (깜빡임 방지) */
function samePolicies(a: Policy[], b: Policy[]) {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (x.policy_id !== y.policy_id) return false
    if (x.title !== y.title) return false
    if ((x.hype_count ?? 0) !== (y.hype_count ?? 0)) return false
    if ((x.logo_data || '') !== (y.logo_data || '')) return false
    if ((x.creator_student_id || '') !== (y.creator_student_id || '')) return false
    if ((x.goal || '') !== (y.goal || '')) return false
    const xc = x.co_registrants || []
    const yc = y.co_registrants || []
    if (xc.length !== yc.length) return false
    for (let j = 0; j < xc.length; j++) if (xc[j] !== yc[j]) return false
  }
  return true
}

/** 폴링 시 트리 대시보드의 하이프 Top4 부분만 비교 (cards 탭에서 쓰는 부분) */
function sameTreeHype(a: PolicyTreeDashboard | null, b: PolicyTreeDashboard) {
  if (!a) return false
  const xa = a.top_hype_policies ?? []
  const xb = b.top_hype_policies ?? []
  if (xa.length !== xb.length) return false
  for (let i = 0; i < xa.length; i++) {
    if (xa[i].policy_id !== xb[i].policy_id) return false
    if ((xa[i].hype_count ?? 0) !== (xb[i].hype_count ?? 0)) return false
  }
  return true
}

export function PoliciesAdminPage() {
  const [tab, setTab] = useState<'cards' | 'seed' | 'tree'>('cards')
  const [policies, setPolicies] = useState<Policy[]>([])
  const [tree, setTree] = useState<PolicyTreeDashboard | null>(null)
  const [treeAllStudentsOpen, setTreeAllStudentsOpen] = useState(false)
  const [treeAllPoliciesOpen, setTreeAllPoliciesOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [shareCopied, setShareCopied] = useState(false)

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
  const [eLinks, setELinks] = useState<string[]>([''])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteSuccess, setDeleteSuccess] = useState('')
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
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
  /** 학급 씨앗 관리하기(교환/지출) */
  const [seedProducts, setSeedProducts] = useState<Array<{ product_id: string; product_name: string; seeds_required: number }>>([])
  const [seedProductsLoading, setSeedProductsLoading] = useState(false)
  const [seedAdminErr, setSeedAdminErr] = useState('')
  const [seedAdminNotice, setSeedAdminNotice] = useState('')
  const [seedAdminTimedOut, setSeedAdminTimedOut] = useState(false)
  const [seedClassSummary, setSeedClassSummary] = useState<
    Array<{
      student_id: string
      student_name: string
      photo_data?: string
      total_gained: number
      total_spent: number
      balance: number
    }>
  >([])
  const [seedAdminLoading, setSeedAdminLoading] = useState(false)
  const [spendOpen, setSpendOpen] = useState(false)
  const [spendStudentId, setSpendStudentId] = useState('')
  const [spendSeedsUsed, setSpendSeedsUsed] = useState<number>(0)
  const [spendProductId, setSpendProductId] = useState('')
  const [spendMemo, setSpendMemo] = useState('')
  const [spending, setSpending] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [newProductSeedsRequired, setNewProductSeedsRequired] = useState<number>(0)
  const [seedSaveBusy, setSeedSaveBusy] = useState(false)

  const loadPolicies = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    const res = await getPolicies()
    if (!silent) setLoading(false)
    if (res.success && res.data) {
      // 폴링 시 데이터가 동일하면 setState를 건너뛰어 불필요한 리렌더(=깜빡임) 방지
      setPolicies((prev) => (samePolicies(prev, res.data!) ? prev : res.data!))
    } else if (!silent) {
      setErr(res.error || '불러오기 실패')
    }
  }

  const loadTree = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    const res = await getPolicyTreeDashboard()
    if (res.success && res.data) {
      setTree((prev) => (silent && sameTreeHype(prev, res.data!) ? prev : res.data!))
    }
  }

  useEffect(() => {
    loadPolicies()
    loadTree()
    getStudents().then((r) => {
      if (r.success && r.data) setClassStudents(r.data)
    })
  }, [])

  // 🔥 하이프 순위는 학생 액션에 의해 바뀌므로, cards 탭일 때 주기적으로 갱신
  // (깜빡임 방지: silent 모드로 로딩 표시 없이 백그라운드 갱신)
  useEffect(() => {
    if (tab !== 'cards') return
    const t = setInterval(() => {
      void loadPolicies({ silent: true })
      void loadTree({ silent: true })
    }, 15000)
    return () => clearInterval(t)
  }, [tab])

  useEffect(() => {
    if (tab !== 'seed') return
    setSeedAdminErr('')
    setSeedAdminNotice('')
    setSeedAdminTimedOut(false)
    setSeedAdminLoading(true)
    setSeedProductsLoading(true)

    const timeout = setTimeout(() => setSeedAdminTimedOut(true), 12000)

    // 상품 로딩과 학생 누적집계 로딩을 분리해서,
    // 누적집계가 오래 걸리거나 실패해도 상품 목록/저장 UX는 멈추지 않게 합니다.
    void (async () => {
      try {
        const pRes = await getSeedProducts()
        if (pRes.success && pRes.data) {
          const products = pRes.data as any
          setSeedProducts(products)
          if (products.length > 0) {
            setSpendProductId((prev) => (prev ? prev : products[0].product_id))
          }
        }
      } catch {
        // 상품 로딩 실패는 별도 표시(현재는 상단 seedAdminErr에 덮지 않음)
      } finally {
        setSeedProductsLoading(false)
      }
    })()

    void (async () => {
      try {
        const cRes = await getClassSeedSummary()
        if (cRes.success && cRes.data) {
          const summary = cRes.data as any
          setSeedClassSummary(summary)
          if (summary.length > 0) {
            setSpendStudentId((prev) => (prev ? prev : summary[0].student_id))
          }
        } else {
          setSeedAdminErr(cRes.error || '학생 누적집계 불러오기에 실패했습니다.')
        }
      } catch {
        setSeedAdminErr('학생 누적집계를 불러오지 못했습니다.')
      } finally {
        setSeedAdminLoading(false)
      }
    })()
    return () => clearTimeout(timeout)
  }, [tab])

  const topHypePolicies = useMemo(() => {
    const ids = tree?.top_hype_policies?.map((p) => p.policy_id) ?? []
    // 하입된 정책(hype_count > 0)만 Top4에 표시. 메인 목록에서는 제외하지 않음.
    return ids
      .map((id) => policies.find((p) => p.policy_id === id))
      .filter((x): x is Policy => Boolean(x))
      .filter((p) => (p.hype_count ?? 0) > 0)
  }, [tree, policies])

  /** 이번 회차 목록에 아직 넣지 않은 학생만 (이미 지급 이력이 있어도 다시 추가 가능 — 독립 시행) */
  const payAddCandidates = useMemo(() => {
    const q = paySearch.trim().toLowerCase()
    const draftIds = new Set(Object.keys(draft).map(String))
    let list = classStudents.filter((s) => {
      const sid = String(s.student_id).trim()
      return !draftIds.has(sid)
    })
    if (q) {
      list = list.filter(
        (s) =>
          String(s.student_id).toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q)
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
      const list = (p.success && p.data ? p.data : []).filter((x) => Number(x.seeds_count) > 0)
      setParts(list)
      /* 씨앗 지급 모달은 '이번에 추가하는 학생'만 다룸 — openCard 시 빈 초기화 (저장된 내역은 목록에 안 띄움) */
      setDraft({})
      setETitle(d.data.title)
      setEGoal(d.data.goal || '')
      setEDesc(d.data.description || '')
      setEExp(d.data.expected_effect || '')
      setESeeds(Number(d.data.seeds_per_participation) || 0)
      setELogo(d.data.logo_data || '')
      const links = d.data.participation_links && d.data.participation_links.length > 0 ? d.data.participation_links : ['']
      setELinks(links)
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
    const cleanedLinks = eLinks.map((l) => l.trim()).filter(Boolean)
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
      participation_links: cleanedLinks,
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
    if (Object.keys(draft).length === 0) {
      setErr('이번에 지급할 학생을 한 명 이상 추가해 주세요.')
      return
    }
    setErr('')
    setSaving(true)
    for (const sid of Object.keys(draft)) {
      const increment = Math.max(0, Number(draft[sid]) || 0)
      const prev = existingSeedsFor(sid, parts)
      const r = await setPolicySeeds({
        policy_id: detail.policy_id,
        student_id: sid,
        seeds_count: prev + increment,
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

  const handleDeletePolicy = async () => {
    if (!detail) return
    const targetId = detail.policy_id
    setDeleting(true)
    setErr('')
    const res = await deletePolicy(targetId)
    if (!res.success) {
      setDeleting(false)
      setErr(res.error || '정책 삭제 실패')
      return
    }
    await loadPolicies()
    await loadTree()
    setDeleting(false)
    setDeleteSuccess('정책이 삭제되었습니다.')
    setConfirmDeleteOpen(false)
    setManageChoiceOpen(false)
    setEditOpen(false)
    setPayOpen(false)
    setDetail(null)
    setParts([])
    setDetailPanelOpen(false)
    setManagedPolicyId(null)
    setManageOpenedFromDetail(false)
    setTimeout(() => setDeleteSuccess(''), 2400)
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
            onClick={() => setTab('seed')}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === 'seed' ? 'bg-amber-600 text-white shadow' : 'bg-white text-gray-600 ring-1 ring-gray-200'
            }`}
          >
            학급 씨앗 관리하기
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
      {deleteSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-6 z-[80] -translate-x-1/2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg ring-1 ring-emerald-700"
        >
          ✅ {deleteSuccess}
        </div>
      )}

      {tab === 'cards' && (
        <section>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">정책 게시판</h2>
              <p className="text-xs text-gray-500">학생 공유 링크로 접속한 정책을 읽고, 🔥 Hype!로 순위를 올릴 수 있어요.</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  const url = `${window.location.origin}/student/policy-board`
                  await navigator.clipboard.writeText(url)
                  setShareCopied(true)
                  setTimeout(() => setShareCopied(false), 1800)
                } catch {
                  // 복사 실패 시 새 탭 열기(또는 브라우저 정책 상 clipboard 불가)
                  window.open(`${window.location.origin}/student/policy-board`, '_blank', 'noopener')
                }
              }}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition active:scale-[0.99] sm:whitespace-nowrap"
            >
              {shareCopied ? '공유 링크 복사됨!' : '정책 게시판 링크 공유하기'}
            </button>
          </div>

          {topHypePolicies.length > 0 && (
            <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-900">
                <span className="inline-block">🔥</span> Hype! 실시간 Top4
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {topHypePolicies.map((p, idx) => (
                  <button
                    key={p.policy_id}
                    type="button"
                    onClick={() => openCard(p.policy_id)}
                    className="group rounded-xl border border-amber-100 bg-white p-2 text-left shadow-sm transition hover:ring-2 hover:ring-amber-200 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                        {policyLogoSrc(p.logo_data) ? (
                          <img src={policyLogoSrc(p.logo_data)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-base">🌱</div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[10px] font-bold text-amber-700">{idx + 1}등</div>
                        <div className="text-[11px] font-semibold text-amber-600">🔥 {p.hype_count ?? 0}</div>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[11px] font-semibold text-gray-900">{p.title}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

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

      {tab === 'seed' && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-amber-900">🌱 학급 씨앗 관리하기</h2>
            <p className="mt-1 text-xs text-amber-900/70">상품(교환 대상)을 등록하고, 씨앗 지출 내역을 학생 가계부에 연결합니다.</p>
          </div>

          {seedAdminNotice && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              {seedAdminNotice}
            </p>
          )}
          {seedAdminErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{seedAdminErr}</p>}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-amber-900">씨앗 개수와 상품 입력</h3>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-800">상품 이름</label>
                  <input
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="예: 간식 교환권"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-800">해당 상품 교환 씨앗(개수)</label>
                  <input
                    type="number"
                    min={0}
                    value={newProductSeedsRequired}
                    onChange={(e) => setNewProductSeedsRequired(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  disabled={seedSaveBusy}
                  onClick={async () => {
                    setSeedSaveBusy(true)
                    setSeedAdminErr('')
                    setSeedAdminNotice('')
                    try {
                      const r = await saveSeedProduct({ product_name: newProductName, seeds_required: Math.max(0, newProductSeedsRequired) })
                      if (r.success) {
                        setNewProductName('')
                        setNewProductSeedsRequired(0)
                        const pRes = await getSeedProducts()
                        if (pRes.success && pRes.data) {
                          const products = pRes.data as any
                          setSeedProducts(products)
                          if (products.length > 0) {
                            setSpendProductId((prev) => (prev ? prev : products[0].product_id))
                          }
                        }
                        setSeedAdminNotice('저장되었습니다!')
                        setTimeout(() => setSeedAdminNotice(''), 2000)
                      } else {
                        setSeedAdminErr(r.error || '상품 저장 실패')
                      }
                    } finally {
                      setSeedSaveBusy(false)
                    }
                  }}
                  className="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60"
                >
                  {seedSaveBusy ? '저장 중...' : '저장'}
                </button>
              </div>

              <div className="mt-4">
                <h4 className="mb-2 text-xs font-bold text-gray-800">등록된 상품</h4>
                {seedProductsLoading ? (
                  <p className="text-xs text-gray-500">불러오는 중...</p>
                ) : seedProducts.length === 0 ? (
                  <p className="text-xs text-gray-500">아직 등록된 상품이 없습니다.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {seedProducts.map((p) => (
                      <span key={p.product_id} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-900">
                        {p.product_name} · {p.seeds_required}개
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-amber-900">등록된 학생들의 씨앗 누적 집계 현황</h3>
              {seedAdminLoading ? (
                !seedAdminTimedOut ? (
                  <p className="text-sm text-gray-500">불러오는 중...</p>
                ) : (
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <p>누적 집계 불러오기가 오래 걸리고 있어요.</p>
                    <button
                      type="button"
                      onClick={async () => {
                        setSeedAdminTimedOut(false)
                        setSeedAdminLoading(true)
                        setSeedAdminErr('')
                        setSeedAdminNotice('')
                        try {
                          const cRes = await getClassSeedSummary()
                          if (cRes.success && cRes.data) {
                            const summary = cRes.data as any
                            setSeedClassSummary(summary)
                            if (summary.length > 0) setSpendStudentId((prev) => (prev ? prev : summary[0].student_id))
                          } else {
                            setSeedAdminErr(cRes.error || '학생 누적집계 불러오기에 실패했습니다.')
                          }
                        } catch {
                          setSeedAdminErr('학생 누적집계를 불러오지 못했습니다.')
                        } finally {
                          setSeedAdminLoading(false)
                        }
                      }}
                      className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      다시 시도
                    </button>
                  </div>
                )
              ) : seedClassSummary.length === 0 ? (
                <p className="text-sm text-gray-500">학생 씨앗 데이터가 없습니다.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2">학생</th>
                        <th className="px-3 py-2">누적 획득</th>
                        <th className="px-3 py-2">누적 지출</th>
                        <th className="px-3 py-2">남은 씨앗</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {seedClassSummary.map((s) => (
                        <tr key={s.student_id} className="border-t">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 overflow-hidden rounded-full bg-gray-100 ring-1 ring-white">
                                {s.photo_data ? (
                                  <img src={photoSrc(s.photo_data)} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-gray-500">
                                    {s.student_name?.charAt(0) || '?'}
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">{s.student_name}</div>
                                <div className="text-[10px] text-gray-500">{s.student_id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 font-semibold text-emerald-700">{s.total_gained}</td>
                          <td className="px-3 py-2 font-semibold text-rose-700">{s.total_spent}</td>
                          <td className="px-3 py-2 font-semibold text-amber-700">🌱 {s.balance}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              disabled={seedProducts.length === 0}
                              onClick={() => {
                                setSpendStudentId(s.student_id)
                                setSpendSeedsUsed(0)
                                setSpendMemo('')
                                setSpendOpen(true)
                              }}
                              className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60"
                            >
                              씨앗 지출하기
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {spendOpen && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center">
              <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b p-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">씨앗 지출하기</h3>
                    <p className="mt-1 text-xs text-gray-500">입력한 지출 내역이 학생 가계부에 기록됩니다.</p>
                  </div>
                  <button type="button" onClick={() => setSpendOpen(false)} className="rounded p-2 text-gray-500 hover:bg-gray-100" aria-label="닫기">
                    ✕
                  </button>
                </div>
                <div className="space-y-4 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-800">학생</label>
                      <select value={spendStudentId} onChange={(e) => setSpendStudentId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                        {seedClassSummary.map((s) => (
                          <option key={s.student_id} value={s.student_id}>
                            {s.student_name} ({s.student_id})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-800">상품</label>
                      <select value={spendProductId} onChange={(e) => setSpendProductId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                        {seedProducts.map((p) => (
                          <option key={p.product_id} value={p.product_id}>
                            {p.product_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-800">지출할 씨앗 개수</label>
                    <input
                      type="number"
                      min={1}
                      value={spendSeedsUsed}
                      onChange={(e) => setSpendSeedsUsed(Number(e.target.value))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">
                      현재 잔여: {seedClassSummary.find((s) => s.student_id === spendStudentId)?.balance ?? 0}개
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-800">지출 내역 작성</label>
                    <textarea
                      value={spendMemo}
                      onChange={(e) => setSpendMemo(e.target.value)}
                      rows={3}
                      placeholder="예: 교환권으로 간식 구매"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={spending || spendSeedsUsed <= 0 || !spendStudentId || !spendProductId}
                    onClick={async () => {
                      setSpending(true)
                      setSeedAdminErr('')
                      setSeedAdminNotice('')
                      try {
                        const r = await spendSeeds({
                          student_id: spendStudentId,
                          seeds_used: Math.max(0, spendSeedsUsed),
                          product_id: spendProductId,
                          memo: spendMemo,
                          actor_student_id: TEACHER_ACTOR,
                        })
                        if (r.success) {
                          setSpendOpen(false)
                          setSeedAdminNotice('지출이 저장되었습니다!')
                          setTimeout(() => setSeedAdminNotice(''), 2000)
                          // 지출 후 즉시 요약 갱신
                          const cRes = await getClassSeedSummary()
                          if (cRes.success && cRes.data) setSeedClassSummary(cRes.data as any)
                        } else setSeedAdminErr(r.error || '지출 저장 실패')
                      } finally {
                        setSpending(false)
                      }
                    }}
                    className="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60"
                  >
                    {spending ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'tree' && tree && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-inner">
            <h2 className="mb-2 text-sm font-bold text-emerald-900">🌱 학급 씨앗 총합</h2>
            <p className="text-4xl font-black text-emerald-700">{tree.total_seeds_class}</p>
            <p className="mt-1 text-xs text-emerald-800/80">모든 정책에서 지급·기록된 씨앗의 합계입니다.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <RankBox
              title="가장 참여가 많은 학생 Top5"
              onViewAll={
                tree.all_students && tree.all_students.length > 0
                  ? () => setTreeAllStudentsOpen(true)
                  : undefined
              }
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
            <PolicyRankBox
              title="참여도가 가장 높은 정책 Top5"
              onViewAll={
                tree.all_policies && tree.all_policies.length > 0
                  ? () => setTreeAllPoliciesOpen(true)
                  : undefined
              }
              policies={tree.top_policies}
            />
            <PolicyRankBox title="참여도가 가장 낮은 정책 Top5" policies={tree.lowest_policies} />
          </div>

          <PolicyTreeIllustration total={tree.total_seeds_class} />
        </section>
      )}

      {treeAllStudentsOpen && tree && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-bold text-gray-900">학생별 씨앗 누적 (전체)</h3>
              <button
                type="button"
                onClick={() => setTreeAllStudentsOpen(false)}
                className="rounded p-2 text-gray-500 hover:bg-gray-100"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <p className="mb-3 text-[11px] text-gray-500">
                모든 정책에서 받은 씨앗을 합산한 누적 개수입니다. (많은 순)
              </p>
              <ul className="space-y-2">
                {(tree.all_students ?? []).map((s, i) => (
                  <li key={s.student_id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5">
                    <span className="w-6 shrink-0 text-center text-[11px] font-bold text-amber-600">{i + 1}</span>
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white">
                      {s.photo_data ? (
                        <img src={photoSrc(s.photo_data)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                          {(s.student_name || '?').charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-gray-900">{s.student_name}</p>
                      <p className="text-[10px] text-gray-500">{s.student_id}</p>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">{s.total_seeds}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-gray-100 p-3">
              <button
                type="button"
                onClick={() => setTreeAllStudentsOpen(false)}
                className="w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {treeAllPoliciesOpen && tree && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-bold text-gray-900">정책별 누적 씨앗 (전체)</h3>
              <button
                type="button"
                onClick={() => setTreeAllPoliciesOpen(false)}
                className="rounded p-2 text-gray-500 hover:bg-gray-100"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <p className="mb-3 text-[11px] text-gray-500">
                각 정책에 기록된 씨앗 합계입니다. (많은 순)
              </p>
              <ul className="space-y-2">
                {(tree.all_policies ?? []).map((p, i) => {
                  const src = policyLogoSrc(p.logo_data || p.policy_logo_data)
                  return (
                    <li key={p.policy_id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5">
                      <span className="w-6 shrink-0 text-center text-[11px] font-bold text-sky-600">{i + 1}</span>
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
            <div className="border-t border-gray-100 p-3">
              <button
                type="button"
                onClick={() => setTreeAllPoliciesOpen(false)}
                className="w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
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
              {detail.participation_links && detail.participation_links.length > 0 && (
                <div className="rounded-xl border border-emerald-100 bg-white p-3">
                  <h4 className="mb-2 text-xs font-bold text-gray-800">정책 참여 링크</h4>
                  <div className="flex flex-col gap-2">
                    {detail.participation_links.map((lnk, idx) => (
                      <a
                        key={`${idx}-${lnk}`}
                        href={lnk}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100"
                      >
                        링크 {idx + 1} 열기
                      </a>
                    ))}
                  </div>
                </div>
              )}
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
                      setDraft({})
                      setPayOpen(true)
                      setPaySearch('')
                    }}
                    className="rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white shadow transition hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    씨앗 지급 / 회수
                  </button>
                  <button
                    type="button"
                    disabled={manageLoading || deleting}
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white shadow transition hover:bg-rose-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    정책 삭제하기
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
                <label className="mb-1 block text-xs font-medium text-gray-700">정책 참여 링크</label>
                <p className="mb-2 text-[10px] text-gray-500">학생이 등록한 링크를 수정·추가·삭제할 수 있습니다.</p>
                <div className="space-y-2">
                  {eLinks.map((lnk, idx) => (
                    <div key={`edit-link-${idx}`} className="flex items-center gap-2">
                      <span className="shrink-0 text-[11px] font-semibold text-sky-700">{`링크${idx + 1}`}</span>
                      <input
                        value={lnk}
                        onChange={(e) => {
                          const v = e.target.value
                          setELinks((prev) => prev.map((x, i) => (i === idx ? v : x)))
                        }}
                        placeholder="https://..."
                        className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1.5 text-xs"
                      />
                      {eLinks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setELinks((prev) => prev.filter((_, i) => i !== idx))}
                          className="shrink-0 rounded border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setELinks((prev) => [...prev, ''])}
                  className="mt-2 text-[11px] font-semibold text-sky-700 hover:text-sky-900"
                >
                  + 링크 추가
                </button>
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
            <p className="mb-3 text-[11px] text-gray-500">
              회차마다 독립적으로 지급합니다. 학생을 추가한 뒤{' '}
              <span className="font-semibold text-gray-700">이번에 더할 씨앗 수</span>를 입력하면, 저장 시{' '}
              <span className="font-semibold text-emerald-800">기존 누적에 더해집니다</span>.
            </p>
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
                  onClick={() => {
                    const sid = String(s.student_id).trim()
                    setDraft((d) => ({
                      ...d,
                      [sid]: Math.max(0, Number(detail.seeds_per_participation) || 0),
                    }))
                  }}
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
                const row = parts.find((p) => String(p.student_id).trim() === String(sid).trim())
                const st = classStudents.find((x) => String(x.student_id).trim() === String(sid).trim())
                const prev = existingSeedsFor(sid, parts)
                return (
                  <div key={sid} className="rounded-lg border border-amber-100 bg-amber-50/50 px-2 py-1.5 text-xs">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-gray-900">{row?.student_name || st?.name || sid}</span>
                      {prev > 0 && (
                        <span className="shrink-0 text-[10px] text-gray-600">누적 {prev}개</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-[10px] text-gray-600">이번 지급</span>
                      <input
                        type="number"
                        min={0}
                        className="w-24 rounded border border-amber-200 bg-white px-2 py-1"
                        value={draft[sid]}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [sid]: Math.max(0, Number(e.target.value) || 0) }))
                        }
                      />
                      <span className="text-[10px] text-gray-500">→ 저장 후 {prev + (Number(draft[sid]) || 0)}개</span>
                    </div>
                  </div>
                )
              })}
            </div>
            {Object.keys(draft).length === 0 && (
              <p className="text-xs text-gray-400">학생을 검색해 추가하세요. (기존에 지급한 학생도 다시 추가할 수 있습니다.)</p>
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
                disabled={saving || Object.keys(draft).length === 0}
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

      {confirmDeleteOpen && detail && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">정책을 삭제할까요?</h3>
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-semibold text-rose-700">{detail.title}</span> 정책과 해당 정책의 참여
              · 하입 기록이 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteOpen(false)}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition active:scale-[0.99] disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDeletePolicy()}
                className="flex-1 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 active:scale-[0.98] disabled:opacity-70"
              >
                {deleting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    삭제 중…
                  </span>
                ) : (
                  '삭제'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-7 shadow-2xl">
            <span className="relative inline-flex h-16 w-16">
              <span className="absolute inset-0 animate-ping rounded-full bg-rose-200 opacity-60" aria-hidden />
              <span
                className="relative inline-block h-16 w-16 animate-spin rounded-full border-[6px] border-rose-500 border-t-transparent"
                aria-hidden
              />
            </span>
            <p className="text-sm font-semibold text-gray-800">정책을 삭제하는 중…</p>
            <p className="text-[11px] text-gray-500">잠시만 기다려 주세요.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function RankBox({
  title,
  items,
  onViewAll,
}: {
  title: string
  items: Array<{ id: string; name: string; value: number; photo?: string }>
  onViewAll?: () => void
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-xs font-bold leading-snug text-gray-800">{title}</h3>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="shrink-0 text-[10px] font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
          >
            전체보기
          </button>
        )}
      </div>
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
  onViewAll,
}: {
  title: string
  policies: Array<{ policy_id: string; title: string; total_seeds: number; logo_data?: string; policy_logo_data?: string }>
  onViewAll?: () => void
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-xs font-bold leading-snug text-gray-800">{title}</h3>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="shrink-0 text-[10px] font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
          >
            전체보기
          </button>
        )}
      </div>
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
    <div className="h-full w-full">
      <div className="flex h-full flex-col rounded-xl border border-gray-100 bg-white p-2.5 shadow-sm">
        <button type="button" onClick={onOpen} className="flex flex-1 gap-2 text-left">
          <div className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl bg-gray-50">
            {logo ? (
              <img src={logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl">🌱</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold leading-tight text-gray-900" title={policy.title}>{policy.title}</p>
            <p className="truncate text-[10px] leading-tight text-gray-500" title={policy.goal || ''}>{policy.goal || '\u00A0'}</p>
            <p className="mt-1 text-[11px] font-semibold text-amber-600">🔥 {policy.hype_count ?? 0}</p>
            <div className="mt-1.5 flex flex-nowrap items-center gap-1 overflow-hidden">
              {/* 등록자 사진은 classStudents 로딩 여부와 무관하게 항상 동일한 슬롯을 차지하도록 렌더해 깜빡임을 막는다 */}
              <span
                className="inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-100 ring-2 ring-emerald-200"
                title={creatorTooltip}
              >
                {creator && creator.photo_data ? (
                  <img
                    src={photoSrc(creator.photo_data)}
                    alt=""
                    title={creatorTooltip}
                    loading="eager"
                    decoding="sync"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[11px] font-medium text-gray-500">
                    {(creator?.name || cid || '?').charAt(0)}
                  </span>
                )}
              </span>
              {co.length > 0 &&
                co.map((s) => {
                  const tip = `${s.name} (${String(s.student_id)})`
                  return (
                    <span
                      key={s.student_id}
                      className="inline-flex h-7 w-7 shrink-0 overflow-hidden rounded-full bg-gray-100 ring-2 ring-white"
                      title={tip}
                    >
                      {s.photo_data ? (
                        <img
                          src={photoSrc(s.photo_data)}
                          alt=""
                          title={tip}
                          loading="eager"
                          decoding="sync"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[10px] font-medium text-gray-500">
                          {(s.name || '?').charAt(0)}
                        </span>
                      )}
                    </span>
                  )
                })}
            </div>
          </div>
        </button>
        <button
          type="button"
          disabled={isManageLoading}
          onClick={onManageClick}
          className={cn(
            'mt-2 w-full rounded-lg py-2 text-[11px] font-semibold transition active:scale-[0.97] disabled:cursor-wait',
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

