import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { StudentNavBar } from '@/components/student/StudentNavBar'
import { authStudent, getAttendanceForStudent } from '@/api/api'
import type { StudentAttendanceData } from '@/types'
import {
  CLEANING_THRESHOLD,
  REWARD_RANK_LIMIT,
  SCORE_CUTOFF_DATE,
  aggregateStats,
  friendlyPossessive,
  mondayOf,
  rankBy,
  shortDate,
  weekRange,
} from '@/lib/attendance'
import {
  ClassStatsTable,
  PersonalStatsTable,
  WeeklyCleaningNotice,
} from '@/components/attendance/AttendanceStatsTables'

const LOGIN_KEY = 'homeroom_login'
const TITLE = '개인별 출결 현황 | 학급 경영'
const ME = 'me'

type AuthState = 'loading' | 'idle' | 'success'

export function StudentAttendancePage() {
  const [studentId, setStudentId] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [authError, setAuthError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [data, setData] = useState<StudentAttendanceData | null>(null)
  const [loadError, setLoadError] = useState('')

  // 저장된 로그인으로 자동 인증
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const raw = localStorage.getItem(LOGIN_KEY)
        if (!raw) {
          if (!cancelled) setAuthState('idle')
          return
        }
        const p = JSON.parse(raw) as { student_id?: string; auth_code?: string }
        if (!p.student_id || !p.auth_code) {
          if (!cancelled) setAuthState('idle')
          return
        }
        setStudentId(p.student_id)
        setAuthCode(p.auth_code)
        const res = await authStudent(p.student_id, p.auth_code)
        if (cancelled) return
        setAuthState(res.success && res.data ? 'success' : 'idle')
      } catch {
        if (!cancelled) setAuthState('idle')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 인증되면 출결 데이터 로드 (서버에서 학번+개인코드 재검증)
  useEffect(() => {
    if (authState !== 'success' || !studentId.trim()) return
    let cancelled = false
    ;(async () => {
      const res = await getAttendanceForStudent(studentId.trim(), authCode.trim())
      if (cancelled) return
      if (res.success && res.data) setData(res.data)
      else setLoadError(res.error || '출결 현황을 불러오지 못했습니다.')
    })()
    return () => {
      cancelled = true
    }
  }, [authState, studentId, authCode])

  const stats = useMemo(
    () => (data ? aggregateStats(data.keys, data.records, undefined, SCORE_CUTOFF_DATE) : []),
    [data]
  )
  const myStat = stats.find((s) => s.student_id === ME)
  const myRanks = useMemo(
    () => ({
      late: rankBy(stats, 'late').get(ME) ?? 0,
      early: rankBy(stats, 'early').get(ME) ?? 0,
      score: rankBy(stats, 'score').get(ME) ?? 0,
    }),
    [stats]
  )
  const thisWeek = weekRange(mondayOf(new Date()))
  const myWeekCleaning = useMemo(() => {
    if (!data) return 0
    return aggregateStats([ME], data.records, thisWeek.from, thisWeek.to)[0].cleaning_score
  }, [data, thisWeek.from, thisWeek.to])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId.trim() || !authCode.trim()) {
      setAuthError('학번과 개인코드를 입력해 주세요.')
      return
    }
    setSubmitting(true)
    setAuthError('')
    const res = await authStudent(studentId.trim(), authCode.trim())
    setSubmitting(false)
    if (res.success && res.data) {
      setAuthState('success')
      try {
        localStorage.setItem(
          LOGIN_KEY,
          JSON.stringify({ student_id: studentId.trim(), auth_code: authCode.trim() })
        )
      } catch {
        // ignore
      }
    } else {
      setAuthError(res.error || '인증에 실패했습니다.')
    }
  }

  if (authState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-indigo-50 to-white px-4">
        <Helmet>
          <title>{TITLE}</title>
        </Helmet>
        <p className="text-sm text-gray-500">로그인 확인 중...</p>
      </div>
    )
  }

  if (authState !== 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white px-4 py-8">
        <Helmet>
          <title>{TITLE}</title>
        </Helmet>
        <div className="mx-auto max-w-sm rounded-3xl border border-indigo-100 bg-white p-6 shadow-lg">
          <div className="mb-4 text-center text-4xl">📋</div>
          <h1 className="mb-1 text-center text-lg font-bold text-gray-900">개인별 출결 현황</h1>
          <p className="mb-5 text-center text-xs text-gray-500">
            학번과 개인코드로 로그인하면 내 지각·조퇴 기록과 순위를 볼 수 있어요.
          </p>
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
              disabled={submitting}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? '확인 중...' : '입장하기'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-sky-50 px-4 py-8">
      <Helmet>
        <title>{TITLE}</title>
      </Helmet>
      <div className="mx-auto max-w-md space-y-5">
        <StudentNavBar />
        <header className="text-center">
          <p className="text-3xl">📋</p>
          <h1 className="mt-2 text-xl font-bold text-gray-900">개인별 출결 현황</h1>
          <p className="mt-1 text-xs text-gray-500">
            {shortDate(SCORE_CUTOFF_DATE)}까지 점수가 낮은 순으로 {REWARD_RANK_LIMIT}명에게 문화상품권을 드려요.
          </p>
        </header>

        {loadError && <p className="text-center text-sm text-red-600">{loadError}</p>}
        {!data && !loadError && <p className="py-10 text-center text-sm text-gray-500">불러오는 중...</p>}

        {data && myStat && (
          <>
            {myWeekCleaning >= CLEANING_THRESHOLD && (
              <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-center shadow-sm">
                <p className="text-lg font-bold text-amber-900">🧹 다음주 청소 확정이에요!</p>
                <p className="mt-1 text-xs text-amber-800">
                  이번 주 청소 누적 점수가 {myWeekCleaning}점이에요. ({CLEANING_THRESHOLD}점 이상)
                </p>
              </div>
            )}
            <section className="grid grid-cols-3 gap-2">
              {(
                [
                  ['지각 순위', myRanks.late],
                  ['조퇴 순위', myRanks.early],
                  ['총점 순위', myRanks.score],
                ] as const
              ).map(([label, rank]) => (
                <div key={label} className="rounded-2xl border-2 border-indigo-100 bg-white p-3 text-center shadow-sm">
                  <p className="text-[11px] text-gray-500">{label}</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums text-indigo-700">{rank}위</p>
                  <p className="text-[10px] text-gray-400">/ {stats.length}명</p>
                </div>
              ))}
            </section>

            {myRanks.score <= REWARD_RANK_LIMIT && (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-700">
                🎁 지금 총점 순위로는 문화상품권 대상이에요! (동점자 포함)
              </p>
            )}

            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-gray-800">
                {friendlyPossessive(data.name)} 개인별 통계
              </h2>
              <PersonalStatsTable stat={myStat} ranks={myRanks} total={stats.length} />
              <div className="mt-3">
                <WeeklyCleaningNotice score={myWeekCleaning} from={thisWeek.from} to={thisWeek.to} />
              </div>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="mb-1 text-sm font-semibold text-gray-800">학급별 통계</h2>
              <p className="mb-2 text-[11px] text-gray-400">내 순위와 점수만 보이고, 다른 친구는 가려져 있어요.</p>
              <ClassStatsTable
                rows={stats.map((stat) => ({
                  stat,
                  label: stat.student_id === ME ? `나${data.name ? ` (${data.name})` : ''}` : '비공개',
                }))}
                highlightId={ME}
                blindOthers
              />
            </section>
          </>
        )}
      </div>
    </div>
  )
}
