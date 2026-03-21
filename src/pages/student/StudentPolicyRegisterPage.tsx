import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import { authStudent, getStudents, savePolicy } from '@/api/api'
import type { Student } from '@/types'

const LOGIN_KEY = 'homeroom_login'

export function StudentPolicyRegisterPage() {
  const navigate = useNavigate()
  const [studentId, setStudentId] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [coIds, setCoIds] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [description, setDescription] = useState('')
  const [expectedEffect, setExpectedEffect] = useState('')
  const [seedsPer, setSeedsPer] = useState(1)
  const [logoData, setLogoData] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOGIN_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (p.student_id && p.auth_code) {
          setStudentId(p.student_id)
          setAuthCode(p.auth_code)
          setLoggedIn(true)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    getStudents().then((res) => {
      if (res.success && res.data) setStudents(res.data)
    })
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter(
      (s) =>
        s.student_id.toLowerCase().includes(q) ||
        (s.name || '').toLowerCase().includes(q)
    )
  }, [students, search])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    const res = await authStudent(studentId.trim(), authCode.trim())
    if (res.success && res.data) {
      setLoggedIn(true)
      try {
        localStorage.setItem(
          LOGIN_KEY,
          JSON.stringify({ student_id: studentId.trim(), auth_code: authCode.trim() })
        )
      } catch {
        // ignore
      }
    } else setErr(res.error || '인증 실패')
  }

  const toggleCo = (id: string) => {
    if (id === studentId) return
    setCoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f || !f.type.startsWith('image/')) return
    const r = new FileReader()
    r.onload = () => {
      const s = String(r.result || '')
      setLogoData(s.length > 45000 ? s.slice(0, 45000) : s)
    }
    r.readAsDataURL(f)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErr('정책명을 입력해 주세요.')
      return
    }
    setSaving(true)
    setErr('')
    const res = await savePolicy({
      title: title.trim(),
      goal: goal.trim(),
      description: description.trim(),
      expected_effect: expectedEffect.trim(),
      seeds_per_participation: Math.max(0, seedsPer),
      logo_data: logoData,
      creator_student_id: studentId.trim(),
      co_registrants: coIds,
      actor_student_id: studentId.trim(),
    })
    setSaving(false)
    if (res.success && res.data?.policy_id) {
      navigate(`/student/policies?open=${encodeURIComponent(res.data.policy_id)}`)
    } else setErr(res.error || '저장 실패')
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8">
        <Helmet>
          <title>정책 등록하기</title>
        </Helmet>
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-5 shadow">
          <h1 className="mb-3 text-lg font-semibold">정책 등록 — 로그인</h1>
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
              확인
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
        <title>정책 등록하기</title>
      </Helmet>
      <div className="mx-auto max-w-lg space-y-5">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">🌱 정책 등록하기</h1>
          <Link to="/student/policies" className="text-xs text-blue-600">
            내 정책 목록
          </Link>
        </header>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">정책 로고</label>
            <input type="file" accept="image/*" onChange={onLogo} className="text-xs" />
            {logoData && (
              <img src={logoData} alt="" className="mt-2 h-20 w-20 rounded-lg border object-cover" />
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">정책명</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">정책의 목표</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">1회 참여 시 지급 씨앗 개수</label>
            <input
              type="number"
              min={0}
              value={seedsPer}
              onChange={(e) => setSeedsPer(Number(e.target.value))}
              className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">세부 설명 (참여 방법 등)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">정책 기대효과</label>
            <textarea
              value={expectedEffect}
              onChange={(e) => setExpectedEffect(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>

          <section className="rounded-xl border border-emerald-100 bg-white p-3">
            <h2 className="mb-2 text-xs font-bold text-gray-800">공동 등록자 (선택)</h2>
            <p className="mb-2 text-[11px] text-gray-500">
              문서 과제 배당과 같이 카드를 눌러 선택합니다. 학번·이름으로 검색할 수 있어요.
            </p>
            <input
              type="search"
              placeholder="학번 또는 이름 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-2 w-full rounded border px-2 py-1.5 text-xs"
            />
            <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-gray-100 p-2">
              {filtered.map((s) => {
                const sel = coIds.includes(s.student_id)
                const isSelf = s.student_id === studentId
                return (
                  <button
                    key={s.student_id}
                    type="button"
                    disabled={isSelf}
                    onClick={() => toggleCo(s.student_id)}
                    className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-[11px] ${
                      isSelf
                        ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-60'
                        : sel
                          ? 'border-blue-500 bg-blue-50 text-blue-900'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-100">
                      {s.photo_data ? (
                        <img
                          src={
                            s.photo_data.startsWith('data:')
                              ? s.photo_data
                              : `data:image/jpeg;base64,${s.photo_data}`
                          }
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                          {(s.name || '?').charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="text-[10px] text-gray-500">{s.student_id}</p>
                    </div>
                    {sel && <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">공동</span>}
                    {isSelf && <span className="text-[10px] text-gray-400">등록자(본인)</span>}
                  </button>
                )
              })}
            </div>
          </section>

          {err && <p className="text-xs text-red-600">{err}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow disabled:opacity-60"
          >
            {saving ? '저장 중...' : '정책 등록하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
