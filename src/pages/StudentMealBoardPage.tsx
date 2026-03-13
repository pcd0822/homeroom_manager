import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authStudent, getStudents, getAssignmentsByStudent, getForm } from '@/api/api'
import type { AssignmentRow, Student, Form } from '@/types'

const NEIS_BASE = 'https://open.neis.go.kr/hub'
const MEAL_KEY = '1ff34ee414734a8ab3bf67c55492df58'
const SCHEDULE_KEY = '8262772d3934410fae17de7bdf1ae020'
// 속초여자고등학교
const ATPT_OFCDC_SC_CODE = 'K10'
const SD_SCHUL_CODE = '7801153'

type MealItem = {
  mealName: string
  dishes: string[]
}

type ScheduleItem = {
  date: string
  name: string
}

type AuthState = 'idle' | 'loading' | 'success' | 'error'

function formatDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

async function fetchMeals(target: Date): Promise<MealItem[]> {
  const ymd = formatDate(target)
  const url = `${NEIS_BASE}/mealServiceDietInfo?KEY=${MEAL_KEY}&Type=json&pIndex=1&pSize=100&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_YMD=${ymd}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('급식 정보를 불러오지 못했습니다.')
  const json = await res.json()
  const rows: any[] = json?.mealServiceDietInfo?.[1]?.row ?? []
  const map: Record<string, MealItem> = {}
  rows.forEach((row) => {
    const mealName = String(row.MMEAL_SC_NM || '')
    const raw = String(row.DDISH_NM || '')
    const parts = raw.split('<br/>').filter(Boolean)
    const dishes = parts.map((p) => p.replace(/<br\/>/g, '').trim())
    if (!map[mealName]) map[mealName] = { mealName, dishes: [] }
    map[mealName].dishes.push(...dishes)
  })
  return ['조식', '중식', '석식']
    .map((name) => map[name])
    .filter((v): v is MealItem => !!v)
}

async function fetchSchedule(range: 'week' | 'month' | 'year', base: Date): Promise<ScheduleItem[]> {
  const start = new Date(base)
  const end = new Date(base)
  if (range === 'week') {
    const day = base.getDay() || 7
    start.setDate(base.getDate() - (day - 1))
    end.setDate(start.getDate() + 6)
  } else if (range === 'month') {
    start.setDate(1)
    end.setMonth(base.getMonth() + 1, 0)
  } else {
    start.setMonth(0, 1)
    end.setMonth(11, 31)
  }
  const from = formatDate(start)
  const to = formatDate(end)
  const url = `${NEIS_BASE}/SchoolSchedule?KEY=${SCHEDULE_KEY}&Type=json&pIndex=1&pSize=200&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&AA_FROM_YMD=${from}&AA_TO_YMD=${to}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('학사일정을 불러오지 못했습니다.')
  const json = await res.json()
  const rows: any[] = json?.SchoolSchedule?.[1]?.row ?? []
  return rows.map((r) => ({
    date: String(r.AA_YMD || ''),
    name: String(r.EVENT_NM || ''),
  }))
}

function computeAssignmentStatus(a: AssignmentRow): 'upcoming' | 'in_progress' | 'closed' {
  const parse = (v: string | undefined | null) => {
    if (!v) return null
    const s = String(v).trim()
    if (!s) return null
    const normalized = s.includes('-') ? s : `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
    const d = new Date(normalized)
    return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }
  const today = (() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })()
  const startDate = parse(a.start_date) || today
  const endDate = parse(a.end_date) || today
  if (today.getTime() < startDate.getTime()) return 'upcoming'
  if (today.getTime() > endDate.getTime()) return 'closed'
  return 'in_progress'
}

const LOGIN_KEY = 'homeroom_login'

export function StudentMealBoardPage() {
  const navigate = useNavigate()
  const [studentId, setStudentId] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [studentName, setStudentName] = useState('')
  const [authState, setAuthState] = useState<AuthState>('idle')
  const [authError, setAuthError] = useState('')
  const [remember, setRemember] = useState(true)

  const [date, setDate] = useState(() => new Date())
  const [meals, setMeals] = useState<MealItem[] | null>(null)
  const [mealError, setMealError] = useState('')
  const [scheduleRange, setScheduleRange] = useState<'week' | 'month' | 'year'>('week')
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[] | null>(null)
  const [scheduleError, setScheduleError] = useState('')

  const [allAssignments, setAllAssignments] = useState<AssignmentRow[]>([])
  const [showClosed, setShowClosed] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [formMap, setFormMap] = useState<Record<string, Form>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOGIN_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.student_id) setStudentId(parsed.student_id)
        if (parsed.auth_code) setAuthCode(parsed.auth_code)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchMeals(date)
      .then((items) => setMeals(items))
      .catch((e) => setMealError(e.message || '급식 정보를 불러오지 못했습니다.'))
    fetchSchedule(scheduleRange, date)
      .then((items) => setScheduleItems(items))
      .catch((e) => setScheduleError(e.message || '학사일정을 불러오지 못했습니다.'))
  }, [date, scheduleRange])

  useEffect(() => {
    getStudents().then((res) => {
      if (res.success && res.data) setStudents(res.data)
    })
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId.trim() || !authCode.trim()) {
      setAuthError('학번과 개인코드를 입력해 주세요.')
      return
    }
    setAuthState('loading')
    setAuthError('')
    const res = await authStudent(studentId.trim(), authCode.trim())
    if (res.success && res.data) {
      setStudentName(res.data.name || '')
      setAuthState('success')
      if (remember) {
        try {
          localStorage.setItem(LOGIN_KEY, JSON.stringify({ student_id: studentId.trim(), auth_code: authCode.trim() }))
        } catch {
          // ignore
        }
      }
      const assignRes = await getAssignmentsByStudent(studentId.trim())
      if (assignRes.success && assignRes.data) {
        setAllAssignments(assignRes.data)
        const ids = Array.from(new Set(assignRes.data.map((a) => a.form_id)))
        Promise.all(ids.map((id) => getForm(id))).then((results) => {
          const map: Record<string, Form> = {}
          results.forEach((res, idx) => {
            if (res.success && res.data) {
              map[ids[idx]] = res.data
            }
          })
          setFormMap(map)
        })
      }
    } else {
      setAuthState('error')
      setAuthError(res.error || '인증에 실패했습니다.')
    }
  }

  const visibleAssignments = allAssignments.filter((a) => {
    const status = computeAssignmentStatus(a)
    if (!showClosed && status === 'closed') return false
    return true
  })

  const getStatusBadge = (a: AssignmentRow) => {
    const status = computeAssignmentStatus(a)
    if (status === 'closed')
      return (
        <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700">
          마감
        </span>
      )
    if (status === 'upcoming')
      return (
        <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700">
          예정
        </span>
      )
    return (
      <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700">
        진행중
      </span>
    )
  }

  const getStudent = () => students.find((s) => s.student_id === studentId)

  if (authState !== 'success') {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6">
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-5 shadow-sm">
          <h1 className="mb-2 text-lg font-semibold text-gray-900">학급 급식·과제 보드</h1>
          <p className="mb-4 text-xs text-gray-500">학번과 개인코드를 입력하면 오늘의 급식, 학사일정, 나에게 배당된 과제를 볼 수 있습니다.</p>
          <form onSubmit={handleAuth} className="space-y-3 text-sm">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">학번</label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">개인코드</label>
              <input
                type="password"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 text-blue-600"
              />
              이 기기에서 로그인 정보 저장
            </label>
            {authError && <p className="text-xs text-red-600">{authError}</p>}
            <button
              type="submit"
              disabled={authState === 'loading'}
              className="mt-1 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {authState === 'loading' ? '확인 중...' : '입장하기'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const stu = getStudent()

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <header className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
          {stu && (
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-100">
              {stu.photo_data ? (
                <img
                  src={
                    stu.photo_data.startsWith('data:')
                      ? stu.photo_data
                      : `data:image/jpeg;base64,${stu.photo_data}`
                  }
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-medium text-gray-400">
                  {stu.name.charAt(0) || '?'}
                </div>
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500">안녕하세요</p>
            <p className="truncate text-sm font-semibold text-gray-900">
              {studentName || stu?.name || ''} ({studentId})
            </p>
          </div>
        </header>

        {/* 오늘의 메뉴 */}
        <section className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs">
            <p className="font-semibold text-gray-800">급식 메뉴</p>
            <div className="flex items-center gap-1 text-[11px] text-gray-600">
              <button
                type="button"
                onClick={() =>
                  setDate((prev) => {
                    const d = new Date(prev)
                    d.setDate(d.getDate() - 1)
                    return d
                  })
                }
                className="rounded border border-gray-300 px-1.5 py-0.5"
              >
                ◀
              </button>
              <span>
                {date.getFullYear()}-{String(date.getMonth() + 1).padStart(2, '0')}-
                {String(date.getDate()).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={() =>
                  setDate((prev) => {
                    const d = new Date(prev)
                    d.setDate(d.getDate() + 1)
                    return d
                  })
                }
                className="rounded border border-gray-300 px-1.5 py-0.5"
              >
                ▶
              </button>
            </div>
          </div>
          {mealError && <p className="text-xs text-red-600">{mealError}</p>}
          <div className="space-y-2">
            {meals?.map((m) => (
              <div key={m.mealName} className="rounded-lg bg-gray-50 p-2">
                <p className="mb-1 text-xs font-semibold text-gray-800">{m.mealName}</p>
                <ul className="list-disc pl-4 text-[11px] text-gray-700">
                  {m.dishes.map((d, idx) => (
                    <li key={idx}>{d}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 학사일정 */}
        <section className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs">
            <p className="font-semibold text-gray-800">학사일정</p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setScheduleRange('week')}
                className={`rounded-full px-2 py-0.5 ${scheduleRange === 'week' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
              >
                주
              </button>
              <button
                type="button"
                onClick={() => setScheduleRange('month')}
                className={`rounded-full px-2 py-0.5 ${scheduleRange === 'month' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
              >
                월
              </button>
              <button
                type="button"
                onClick={() => setScheduleRange('year')}
                className={`rounded-full px-2 py-0.5 ${scheduleRange === 'year' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
              >
                연
              </button>
            </div>
          </div>
          {scheduleError && <p className="text-xs text-red-600">{scheduleError}</p>}
          <div className="mb-1 flex items-center justify-between text-[11px] text-gray-600">
            <span>
              기준일: {date.getFullYear()}-{String(date.getMonth() + 1).padStart(2, '0')}-
              {String(date.getDate()).padStart(2, '0')}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() =>
                  setDate((prev) => {
                    const d = new Date(prev)
                    if (scheduleRange === 'week') d.setDate(d.getDate() - 7)
                    else if (scheduleRange === 'month') d.setMonth(d.getMonth() - 1)
                    else d.setFullYear(d.getFullYear() - 1)
                    return d
                  })
                }
                className="rounded border border-gray-300 px-1.5 py-0.5"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() =>
                  setDate((prev) => {
                    const d = new Date(prev)
                    if (scheduleRange === 'week') d.setDate(d.getDate() + 7)
                    else if (scheduleRange === 'month') d.setMonth(d.getMonth() + 1)
                    else d.setFullYear(d.getFullYear() + 1)
                    return d
                  })
                }
                className="rounded border border-gray-300 px-1.5 py-0.5"
              >
                ▶
              </button>
            </div>
          </div>
          <ul className="space-y-1 text-[11px]">
            {scheduleRange === 'year'
              ? Object.values(
                  (scheduleItems || []).reduce((acc, cur) => {
                    const key = cur.name
                    if (!acc[key]) {
                      acc[key] = { name: cur.name, start: cur.date, end: cur.date }
                    } else {
                      if (cur.date < acc[key].start) acc[key].start = cur.date
                      if (cur.date > acc[key].end) acc[key].end = cur.date
                    }
                    return acc
                  }, {} as Record<string, { name: string; start: string; end: string }>)
                ).map((item) => (
                  <li key={item.name} className="flex items-center justify-between">
                    <span className="text-gray-500">
                      {item.start.slice(0, 4)}-{item.start.slice(4, 6)}-{item.start.slice(6, 8)} ~{' '}
                      {item.end.slice(0, 4)}-{item.end.slice(4, 6)}-{item.end.slice(6, 8)}
                    </span>
                    <span className="ml-2 flex-1 truncate text-gray-800">{item.name}</span>
                  </li>
                ))
              : scheduleItems?.map((s) => (
                  <li key={`${s.date}-${s.name}`} className="flex items-center justify-between">
                    <span className="text-gray-500">
                      {s.date.slice(0, 4)}-{s.date.slice(4, 6)}-{s.date.slice(6, 8)}
                    </span>
                    <span className="ml-2 flex-1 truncate text-gray-800">{s.name}</span>
                  </li>
                ))}
          </ul>
        </section>

        {/* 나의 과제 */}
        <section className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs">
            <p className="font-semibold text-gray-800">나의 과제</p>
            <label className="flex items-center gap-1 text-[11px] text-gray-600">
              <input
                type="checkbox"
                checked={showClosed}
                onChange={(e) => setShowClosed(e.target.checked)}
              />
              마감된 과제 보기
            </label>
          </div>
          {visibleAssignments.length === 0 && (
            <p className="text-[11px] text-gray-500">현재 진행 중인 과제가 없습니다.</p>
          )}
          <div className="space-y-2">
            {visibleAssignments.map((a) => {
              const form = formMap[a.form_id]
              return (
                <button
                  key={`${a.form_id}-${a.student_id}-${a.assigned_at}`}
                  type="button"
                  onClick={() => navigate(`/view/${a.form_id}`)}
                  className="w-full rounded-lg border border-gray-200 p-2 text-left text-[11px] hover:border-blue-400 hover:bg-blue-50"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="truncate font-semibold text-gray-800">
                      {form?.title || '과제'}
                    </span>
                    {getStatusBadge(a)}
                  </div>
                  <p className="text-gray-600">
                    기간: {a.start_date} ~ {a.end_date}
                  </p>
                  <p className="text-gray-400">배당일: {a.assigned_at.slice(0, 10)}</p>
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

