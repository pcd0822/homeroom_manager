import { useCallback, useEffect, useRef, useState } from 'react'
import { authStudent, getStudents, saveClassGameScore, getClassGameRanking } from '@/api/api'
import type { ClassGameRankingRow, Student } from '@/types'
import { HomeRunCanvas, type HomeRunGameStats } from '@/components/game/HomeRunCanvas'
import { GAME_ID_HOME_SEND_ME } from '@/constants/games'

const LOGIN_KEY = 'homeroom_login'

type AuthState = 'idle' | 'loading' | 'success' | 'error'

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  const z = String(r).padStart(2, '0')
  return m > 0 ? `${m}:${z}` : `0:${z}`
}

function photoSrc(stu: Student | undefined): string | null {
  if (!stu?.photo_data) return null
  const p = stu.photo_data
  return p.startsWith('data:') ? p : `data:image/jpeg;base64,${p}`
}

export function HomeRunGamePage() {
  const [studentId, setStudentId] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [remember, setRemember] = useState(true)
  const [authState, setAuthState] = useState<AuthState>('idle')
  const [authError, setAuthError] = useState('')
  const [studentName, setStudentName] = useState('')
  const [students, setStudents] = useState<Student[]>([])

  const [running, setRunning] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [lastStats, setLastStats] = useState<HomeRunGameStats | null>(null)
  const [ranking, setRanking] = useState<ClassGameRankingRow[]>([])
  const [teacherImg, setTeacherImg] = useState<HTMLImageElement | null>(null)

  const jumpRef = useRef(false)
  const slideRef = useRef(false)

  useEffect(() => {
    getStudents().then((res) => {
      if (res.success && res.data) setStudents(res.data)
    })
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOGIN_KEY)
      if (raw) {
        const j = JSON.parse(raw) as { student_id?: string; auth_code?: string }
        if (j.student_id && j.auth_code) {
          setStudentId(j.student_id)
          setAuthCode(j.auth_code)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const img = new Image()
    img.onload = () => setTeacherImg(img)
    img.onerror = () => setTeacherImg(null)
    const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
    img.src = `${base}game/teacher-chase.png`
  }, [])

  const refreshRanking = useCallback(() => {
    getClassGameRanking(GAME_ID_HOME_SEND_ME, 20).then((res) => {
      if (res.success && Array.isArray(res.data)) setRanking(res.data)
    })
  }, [])

  useEffect(() => {
    if (authState === 'success') refreshRanking()
  }, [authState, refreshRanking])

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
          localStorage.setItem(
            LOGIN_KEY,
            JSON.stringify({ student_id: studentId.trim(), auth_code: authCode.trim() })
          )
        } catch {
          // ignore
        }
      }
    } else {
      setAuthState('error')
      setAuthError(res.error || '인증에 실패했습니다.')
    }
  }

  const stu = students.find((s) => s.student_id === studentId)
  const playerPhoto = photoSrc(stu)

  const onGameOver = useCallback(
    (stats: HomeRunGameStats) => {
      setRunning(false)
      setGameOver(true)
      setLastStats(stats)
      const name = stu?.name || studentName || ''
      saveClassGameScore({
        game_id: GAME_ID_HOME_SEND_ME,
        student_id: studentId.trim(),
        student_name: name,
        duration_ms: stats.duration_ms,
        timers_collected: stats.timers_collected,
        hits_total: stats.hits_total,
      }).then(() => refreshRanking())
    },
    [studentId, studentName, stu?.name, refreshRanking]
  )

  const top5 = ranking.slice(0, 5)
  const myRank =
    ranking.findIndex((r) => r.student_id === studentId.trim()) + 1 || null
  const myBest = ranking.find((r) => r.student_id === studentId.trim())

  if (authState !== 'success') {
    return (
      <div className="min-h-screen bg-sky-100 px-4 py-8">
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-5 shadow-md">
          <h1 className="text-lg font-semibold text-gray-900">집 보내주세요!</h1>
          <p className="mb-4 text-xs text-gray-500">
            학번과 개인코드로 입장하면 프로필 사진으로 달립니다.
          </p>
          <form onSubmit={handleAuth} className="space-y-3 text-sm">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">학번</label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">개인코드</label>
              <input
                type="password"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4"
              />
              이 기기에서 로그인 저장
            </label>
            {authError && <p className="text-xs text-red-600">{authError}</p>}
            <button
              type="submit"
              disabled={authState === 'loading'}
              className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {authState === 'loading' ? '확인 중…' : '입장하기'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-200 to-sky-100 px-3 pb-8 pt-4">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <div className="mb-2 w-full text-center">
          <p className="text-xs text-sky-900/80">{studentName || stu?.name} · 생존 시간</p>
          <p className="text-2xl font-bold tabular-nums text-sky-950">{formatTime(elapsedMs)}</p>
        </div>

        <HomeRunCanvas
          running={running}
          playerPhotoSrc={playerPhoto}
          teacherImage={teacherImg}
          onGameOver={onGameOver}
          onTimeUpdate={setElapsedMs}
          jumpPressedRef={jumpRef}
          slidePressedRef={slideRef}
        />

        {!running && !gameOver && (
          <button
            type="button"
            className="mt-4 w-full max-w-xs rounded-xl bg-emerald-600 py-3 text-lg font-bold text-white shadow-lg hover:bg-emerald-700"
            onClick={() => {
              setGameOver(false)
              setLastStats(null)
              setElapsedMs(0)
              setRunning(true)
            }}
          >
            스타트
          </button>
        )}

        {gameOver && lastStats && (
          <div className="mt-4 w-full max-w-xs rounded-xl border border-amber-200 bg-amber-50 p-4 text-center shadow">
            <p className="text-lg font-bold text-amber-900">게임 오버</p>
            <p className="mt-1 text-sm text-amber-800">
              생존 {formatTime(lastStats.duration_ms)} · 타이머 {lastStats.timers_collected}개 · 충돌{' '}
              {lastStats.hits_total}회
            </p>
            <button
              type="button"
              className="mt-3 w-full rounded-lg bg-sky-600 py-2 text-sm font-medium text-white"
              onClick={() => {
                setGameOver(false)
                setLastStats(null)
                setElapsedMs(0)
                setRunning(true)
              }}
            >
              다시 하기
            </button>
          </div>
        )}

        <div className="mt-6 grid w-full max-w-xs grid-cols-2 gap-3">
          <button
            type="button"
            className="rounded-xl bg-white py-4 text-lg font-bold text-gray-800 shadow-md active:scale-[0.98]"
            onPointerDown={(e) => {
              e.preventDefault()
              jumpRef.current = true
            }}
          >
            점프
          </button>
          <button
            type="button"
            className="rounded-xl bg-indigo-100 py-4 text-lg font-bold text-indigo-900 shadow-md active:scale-[0.98]"
            onPointerDown={(e) => {
              e.preventDefault()
              slideRef.current = true
            }}
          >
            슬라이드
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-sky-900/70">
          점프 두 번으로 높은 책상(3단)을 넘을 수 있어요. 하늘 책상은 슬라이드로 피하세요.
        </p>

        <section className="mt-6 w-full max-w-xs rounded-xl bg-white/90 p-3 shadow">
          <h2 className="text-center text-sm font-semibold text-gray-800">랭킹 TOP 5</h2>
          {myRank != null && myRank > 0 && (
            <p className="mt-1 text-center text-xs text-sky-700">
              내 순위: {myRank}위
              {myBest && ` · 최고 ${formatTime(myBest.duration_ms)}`}
            </p>
          )}
          <ol className="mt-2 space-y-1 text-sm">
            {top5.length === 0 ? (
              <li className="text-center text-gray-500">기록 없음</li>
            ) : (
              top5.map((r, i) => (
                <li
                  key={r.student_id}
                  className={`flex justify-between rounded px-2 py-1 ${
                    r.student_id === studentId.trim() ? 'bg-sky-100 font-medium' : ''
                  }`}
                >
                  <span>
                    {i + 1}. {r.student_name || r.student_id}
                  </span>
                  <span className="tabular-nums text-gray-700">{formatTime(r.duration_ms)}</span>
                </li>
              ))
            )}
          </ol>
        </section>
      </div>
    </div>
  )
}
