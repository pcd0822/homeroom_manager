import { useCallback, useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { authStudent, getStudents, saveClassGameScore, getClassGameRanking } from '@/api/api'
import type { ClassGameRankingRow, Student } from '@/types'
import { HomeRunCanvas, type HomeRunGameStats } from '@/components/game/HomeRunCanvas'
import { GameOverGraphic } from '@/components/game/GameOverGraphic'
import { GAME_ID_HOME_SEND_ME, GAMES_META } from '@/constants/games'

const LOGIN_KEY = 'homeroom_login'
const GAME_SHARE_TITLE = `${GAMES_META[GAME_ID_HOME_SEND_ME].title} | 학급 게임`
const GAME_SHARE_DESC = GAMES_META[GAME_ID_HOME_SEND_ME].description

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
  const [saveHint, setSaveHint] = useState<string | null>(null)

  const jumpQueueRef = useRef(0)
  const slideRef = useRef(false)
  /** 게임 종료 시점의 저장용 (클로저/비동기 타이밍 오류 방지) */
  const saveCtxRef = useRef({
    studentId: '',
    studentName: '',
  })

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
    if (authState !== 'success') return
    refreshRanking()
    const id = window.setInterval(() => {
      refreshRanking()
    }, running ? 2000 : 5000)
    return () => window.clearInterval(id)
  }, [authState, refreshRanking, running])

  const stu = students.find((s) => s.student_id === studentId)

  useEffect(() => {
    saveCtxRef.current = {
      studentId: studentId.trim(),
      studentName: (stu?.name || studentName || '').trim(),
    }
  }, [studentId, studentName, stu?.name])

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

  const playerPhoto = photoSrc(stu)

  const onGameOver = useCallback(
    (stats: HomeRunGameStats) => {
      setRunning(false)
      setGameOver(true)
      setLastStats(stats)
      setSaveHint(null)

      const ctx = saveCtxRef.current
      const sid = ctx.studentId
      if (!sid) {
        setSaveHint('학번을 확인할 수 없어 기록이 저장되지 않았습니다.')
        return
      }

      saveClassGameScore({
        game_id: GAME_ID_HOME_SEND_ME,
        student_id: sid,
        student_name: ctx.studentName,
        duration_ms: stats.duration_ms,
        timers_collected: stats.timers_collected,
        hits_total: stats.hits_total,
      }).then((res) => {
        if (res.success) {
          refreshRanking()
          const d = res.data as { updated?: boolean; reason?: string } | undefined
          if (d?.reason === 'not_best') {
            setSaveHint('이전 최고 기록보다 짧아 랭킹은 갱신되지 않았습니다.')
          } else {
            setSaveHint(null)
          }
        } else {
          setSaveHint(res.error || '서버에 기록을 저장하지 못했습니다. 네트워크·GAS 배포를 확인해 주세요.')
        }
      })
    },
    [refreshRanking]
  )

  const top5 = ranking.slice(0, 5)
  const myRank =
    ranking.findIndex((r) => r.student_id === studentId.trim()) + 1 || null
  const myBest = ranking.find((r) => r.student_id === studentId.trim())

  const startRun = () => {
    jumpQueueRef.current = 0
    setGameOver(false)
    setLastStats(null)
    setElapsedMs(0)
    setSaveHint(null)
    setRunning(true)
  }

  if (authState !== 'success') {
    return (
      <div className="min-h-screen bg-sky-100 px-4 py-8">
        <Helmet>
          <title>{GAME_SHARE_TITLE}</title>
          <meta property="og:title" content={GAME_SHARE_TITLE} />
          <meta name="description" content={GAME_SHARE_DESC} />
          <meta property="og:description" content={GAME_SHARE_DESC} />
        </Helmet>
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
    <div className="min-h-[100dvh] min-h-screen bg-gradient-to-b from-sky-200 via-sky-100 to-sky-200 px-3 pb-10 pt-4">
      <Helmet>
        <title>{GAME_SHARE_TITLE}</title>
        <meta property="og:title" content={GAME_SHARE_TITLE} />
        <meta name="description" content={GAME_SHARE_DESC} />
        <meta property="og:description" content={GAME_SHARE_DESC} />
      </Helmet>
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-md flex-col items-stretch">
        <div className="mb-2 w-full shrink-0 text-center">
          <p className="text-xs text-sky-900/80">{studentName || stu?.name} · 생존 시간</p>
          <p className="text-2xl font-bold tabular-nums text-sky-950">{formatTime(elapsedMs)}</p>
        </div>

        <div className="flex shrink-0 justify-center">
          <HomeRunCanvas
            running={running}
            playerPhotoSrc={playerPhoto}
            teacherImage={teacherImg}
            onGameOver={onGameOver}
            onTimeUpdate={setElapsedMs}
            jumpQueueRef={jumpQueueRef}
            slidePressedRef={slideRef}
          />
        </div>

        {/* 게임 화면 바로 아래 조작 버튼 */}
        <div className="mt-3 grid w-full max-w-xs shrink-0 grid-cols-2 gap-3 self-center">
          <button
            type="button"
            className="rounded-xl bg-white py-4 text-lg font-bold text-gray-800 shadow-md active:scale-[0.98]"
            onPointerDown={(e) => {
              e.preventDefault()
              jumpQueueRef.current = Math.min(jumpQueueRef.current + 1, 6)
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
        <p className="mt-2 shrink-0 text-center text-[11px] text-sky-900/70">
          점프를 연속으로 누르면 공중에서 한 번 더 점프합니다. 하늘 책상은 슬라이드로 피하세요.
        </p>

        {/* 플레이 + 게임오버 전용 세로 영역 */}
        <div className="mt-3 flex min-h-[220px] flex-col items-center justify-start px-1">
          {!running && !gameOver && (
            <button
              type="button"
              className="w-full max-w-xs rounded-xl bg-emerald-600 py-3 text-lg font-bold text-white shadow-lg hover:bg-emerald-700"
              onClick={startRun}
            >
              스타트
            </button>
          )}

          {gameOver && lastStats && (
            <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border-2 border-amber-300/80 bg-gradient-to-b from-amber-50 to-orange-50/90 px-4 py-5 shadow-lg">
              <GameOverGraphic className="h-auto w-full max-w-[300px]" />
              <p className="mt-2 text-center text-sm text-amber-900/90">
                생존 <span className="font-semibold">{formatTime(lastStats.duration_ms)}</span> · 타이머{' '}
                {lastStats.timers_collected}개 · 충돌 {lastStats.hits_total}회
              </p>
              {saveHint && (
                <p className="mt-2 text-center text-xs text-amber-800/90">{saveHint}</p>
              )}
              <button
                type="button"
                className="mt-4 w-full max-w-xs rounded-xl bg-sky-600 py-2.5 text-sm font-bold text-white shadow-md hover:bg-sky-700"
                onClick={startRun}
              >
                다시 하기
              </button>
            </div>
          )}
        </div>

        <section className="mt-5 w-full max-w-xs shrink-0 self-center rounded-xl bg-white/90 p-3 shadow">
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
