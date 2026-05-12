import { useEffect, useMemo, useRef, useState } from 'react'
import {
  authStudent,
  getTeacherQuizQuestions,
  saveTeacherQuizScore,
} from '@/api/api'
import type { TeacherQuizQuestion } from '@/types'
import {
  computeAnswerPoints,
  extractYoutubeId,
  isShortAnswerCorrect,
} from '@/lib/teacherQuiz'
import { cn } from '@/lib/utils'

type Phase = 'login' | 'intro' | 'playing' | 'failed' | 'cleared'

interface LoginInfo {
  studentId: string
  name: string
}

const HINT_COST = 30
const WRONG_PENALTY = 10
const START_POINTS = 100

const FAILED_MESSAGES = [
  '이렇게 포기하지 말아줘 😭',
  '담임샘이 슬퍼하고 있어요…',
  '한 번만 더 도전해 줄래?',
]
const SUCCESS_PREFIX = '역시 '
const SUCCESS_SUFFIX = '이야! 담임샘에 대해 알아가는 만큼 너희들의 이야기도 많이 들려주길 바라❤️'

function friendlyQuizError(err?: string) {
  if (!err) return '알 수 없는 오류가 발생했습니다.'
  if (err.includes('Unknown action')) {
    return (
      'GAS 백엔드에 들샘 모의고사 기능이 아직 배포되지 않았어요. ' +
      '담임 선생님이 새 버전으로 배포한 뒤 다시 시도해 주세요.'
    )
  }
  return err
}

export function TeacherQuizPlayPage() {
  const [phase, setPhase] = useState<Phase>('login')
  const [questions, setQuestions] = useState<TeacherQuizQuestion[]>([])
  const [loginInfo, setLoginInfo] = useState<LoginInfo | null>(null)
  const [studentIdInput, setStudentIdInput] = useState('')
  const [authCodeInput, setAuthCodeInput] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [points, setPoints] = useState(START_POINTS)
  const [retries, setRetries] = useState(0)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [hintRevealed, setHintRevealed] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [feedback, setFeedback] = useState<string>('')
  const [questionsError, setQuestionsError] = useState('')
  const tickRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const [scoreSaved, setScoreSaved] = useState(false)

  // 문제 로드 (게임 화면 진입 시)
  useEffect(() => {
    if (phase === 'intro' && questions.length === 0) {
      getTeacherQuizQuestions().then((res) => {
        if (res.success && res.data) {
          setQuestions(res.data)
        } else {
          setQuestionsError(friendlyQuizError(res.error))
        }
      })
    }
  }, [phase, questions.length])

  // 타이머
  useEffect(() => {
    if (phase !== 'playing') return
    if (questions.length === 0) return
    const q = questions[currentIdx]
    if (!q) return
    startTimeRef.current = Date.now()
    setElapsed(0)
    const id = window.setInterval(() => {
      const e = (Date.now() - startTimeRef.current) / 1000
      setElapsed(e)
    }, 100)
    tickRef.current = id
    return () => {
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current)
        tickRef.current = null
      }
    }
  }, [phase, currentIdx, questions])

  const currentQuestion = questions[currentIdx]
  const timeLimit = currentQuestion?.time_limit ?? 30
  const remaining = Math.max(0, timeLimit - elapsed)
  const timeRatio = Math.max(0, Math.min(1, remaining / timeLimit))

  const handleLogin = async () => {
    if (!studentIdInput.trim() || !authCodeInput.trim()) {
      setLoginError('학번과 개인코드를 입력해 주세요.')
      return
    }
    setLoginLoading(true)
    setLoginError('')
    const res = await authStudent(studentIdInput.trim(), authCodeInput.trim())
    setLoginLoading(false)
    if (res.success && res.data) {
      setLoginInfo({ studentId: res.data.student_id, name: res.data.name })
      setPhase('intro')
    } else {
      setLoginError(res.error || '인증에 실패했습니다.')
    }
  }

  const startGame = () => {
    if (questions.length === 0) return
    setPoints(START_POINTS)
    setCurrentIdx(0)
    setHintRevealed(false)
    setFeedback('')
    setScoreSaved(false)
    setPhase('playing')
  }

  const retry = () => {
    if (questions.length === 0) return
    setRetries((r) => r + 1)
    setPoints(START_POINTS)
    setCurrentIdx(0)
    setHintRevealed(false)
    setFeedback('')
    setScoreSaved(false)
    setPhase('playing')
  }

  const losePoints = (amount: number, message: string) => {
    setPoints((p) => {
      const next = p - amount
      if (next <= 0) {
        setFeedback('')
        setPhase('failed')
        return 0
      }
      setFeedback(message)
      return next
    })
  }

  const useHint = () => {
    if (hintRevealed) return
    if (!currentQuestion?.hint) return
    losePoints(HINT_COST, `힌트를 사용했어요. -${HINT_COST}p`)
    setHintRevealed(true)
  }

  const handleAnswer = (answer: string) => {
    if (!currentQuestion) return
    const q = currentQuestion
    let correct = false
    if (q.type === 'choice' || q.type === 'imageChoice') {
      correct = String(answer) === String(q.correct_answer)
    } else if (q.type === 'ox') {
      correct = answer.toUpperCase() === q.correct_answer.toUpperCase()
    } else {
      correct = isShortAnswerCorrect(answer, q.correct_answer)
    }

    if (correct) {
      const pts = computeAnswerPoints(q.time_limit, elapsed)
      setPoints((p) => p + pts)
      setFeedback(`정답! +${pts}p`)
      // 다음 문제 또는 클리어
      if (currentIdx >= questions.length - 1) {
        // 클리어
        setTimeout(() => {
          setPhase('cleared')
        }, 600)
      } else {
        setTimeout(() => {
          setCurrentIdx((i) => i + 1)
          setHintRevealed(false)
          setFeedback('')
        }, 600)
      }
    } else {
      losePoints(WRONG_PENALTY, `아쉬워요… -${WRONG_PENALTY}p`)
    }
  }

  // 클리어 시 점수 저장 (1회만)
  useEffect(() => {
    if (phase !== 'cleared') return
    if (scoreSaved) return
    if (!loginInfo) return
    const finalScore = Math.max(0, points - retries * 10)
    setScoreSaved(true)
    saveTeacherQuizScore({
      student_id: loginInfo.studentId,
      student_name: loginInfo.name,
      total_score: finalScore,
      retries,
    })
  }, [phase, scoreSaved, loginInfo, points, retries])

  // ===== 화면들 =====
  if (phase === 'login') {
    return (
      <LoginView
        studentId={studentIdInput}
        setStudentId={setStudentIdInput}
        authCode={authCodeInput}
        setAuthCode={setAuthCodeInput}
        onSubmit={handleLogin}
        error={loginError}
        loading={loginLoading}
      />
    )
  }

  if (phase === 'intro') {
    return (
      <IntroView
        name={loginInfo?.name || ''}
        questionsCount={questions.length}
        loading={questions.length === 0 && !questionsError}
        error={questionsError}
        onStart={startGame}
      />
    )
  }

  if (phase === 'failed') {
    return <FailedView onRetry={retry} />
  }

  if (phase === 'cleared') {
    const finalScore = Math.max(0, points - retries * 10)
    return (
      <ClearedView
        name={loginInfo?.name || ''}
        finalScore={finalScore}
        rawScore={points}
        retries={retries}
        onRetry={retry}
      />
    )
  }

  // playing
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-amber-50 to-rose-50">
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        {/* 상단 상태바 */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌷</span>
            <h1 className="text-lg font-bold text-slate-800">
              들샘 모의고사 <span className="text-xs text-slate-500">({currentIdx + 1}/{questions.length})</span>
            </h1>
          </div>
          <div className="flex items-center gap-3 rounded-full bg-white px-3 py-1.5 shadow-sm">
            <span className="text-xs text-gray-500">{loginInfo?.name}</span>
            <span className="text-base font-bold text-rose-600">{points}P</span>
          </div>
        </header>

        {/* 카운트다운 바 */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-gray-600">⏱ 남은 시간</span>
            <span className={cn('font-mono font-bold', remaining < 6 ? 'text-rose-600' : 'text-slate-700')}>
              {remaining.toFixed(1)}초
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-rose-100">
            <div
              className={cn(
                'h-full rounded-full transition-[width]',
                remaining < 6 ? 'bg-rose-500' : remaining < 18 ? 'bg-amber-400' : 'bg-emerald-500'
              )}
              style={{ width: `${timeRatio * 100}%` }}
            />
          </div>
        </div>

        {/* 문제 카드 */}
        {currentQuestion && (
          <article className="rounded-2xl border border-pink-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-base font-semibold text-slate-900">{currentQuestion.question}</p>

            {currentQuestion.type === 'image' && currentQuestion.image_data && (
              <img
                src={currentQuestion.image_data}
                alt="문제 이미지"
                className="mb-3 max-h-72 w-full rounded-xl border border-gray-200 object-contain"
              />
            )}

            {currentQuestion.type === 'youtube' && currentQuestion.youtube_url && (
              <div className="mb-3 aspect-video w-full overflow-hidden rounded-xl border border-gray-200 bg-black">
                <iframe
                  title="youtube"
                  className="h-full w-full"
                  src={`https://www.youtube.com/embed/${extractYoutubeId(currentQuestion.youtube_url)}`}
                  allowFullScreen
                />
              </div>
            )}

            <AnswerInput question={currentQuestion} onAnswer={handleAnswer} />

            {/* 힌트 */}
            {currentQuestion.hint && (
              <div className="mt-3">
                {hintRevealed ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    💡 힌트: {currentQuestion.hint}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={useHint}
                    className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
                  >
                    💡 힌트 보기 (-{HINT_COST}P)
                  </button>
                )}
              </div>
            )}
          </article>
        )}

        {/* 피드백 */}
        {feedback && (
          <p className="mt-3 text-center text-sm font-semibold text-rose-600">{feedback}</p>
        )}
      </div>
    </div>
  )
}

// ===== 입력 컴포넌트 =====

function AnswerInput({
  question,
  onAnswer,
}: {
  question: TeacherQuizQuestion
  onAnswer: (answer: string) => void
}) {
  const [text, setText] = useState('')
  // 문제가 바뀌면 입력 초기화
  useEffect(() => {
    setText('')
  }, [question.id])

  if (question.type === 'choice') {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {(question.choices ?? []).map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onAnswer(String(i))}
            className="rounded-xl border-2 border-pink-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-800 transition-colors hover:border-rose-400 hover:bg-rose-50"
          >
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">
              {i + 1}
            </span>
            {c || `선택지 ${i + 1}`}
          </button>
        ))}
      </div>
    )
  }

  if (question.type === 'imageChoice') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {(question.choice_images ?? []).map((img, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onAnswer(String(i))}
            className="overflow-hidden rounded-xl border-2 border-pink-200 bg-white transition-colors hover:border-rose-400"
          >
            <div className="flex items-center justify-between bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
              <span>{i + 1}번</span>
            </div>
            {img ? (
              <img src={img} alt={`선택지 ${i + 1}`} className="h-40 w-full object-contain" />
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-gray-400">
                (이미지 없음)
              </div>
            )}
          </button>
        ))}
      </div>
    )
  }

  if (question.type === 'ox') {
    return (
      <div className="flex justify-center gap-4">
        <button
          type="button"
          onClick={() => onAnswer('O')}
          className="h-24 w-24 rounded-2xl border-4 border-rose-300 bg-rose-50 text-4xl font-extrabold text-rose-500 shadow-sm transition-transform hover:scale-105"
        >
          O
        </button>
        <button
          type="button"
          onClick={() => onAnswer('X')}
          className="h-24 w-24 rounded-2xl border-4 border-blue-300 bg-blue-50 text-4xl font-extrabold text-blue-500 shadow-sm transition-transform hover:scale-105"
        >
          X
        </button>
      </div>
    )
  }

  // short / image / youtube → 텍스트 입력
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) onAnswer(text)
      }}
      className="flex flex-wrap gap-2"
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="정답을 입력하세요"
        autoFocus
        className="min-w-0 flex-1 rounded-xl border-2 border-pink-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-rose-400 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-600"
      >
        제출
      </button>
    </form>
  )
}

// ===== 화면들 =====

function LoginView({
  studentId,
  setStudentId,
  authCode,
  setAuthCode,
  onSubmit,
  error,
  loading,
}: {
  studentId: string
  setStudentId: (v: string) => void
  authCode: string
  setAuthCode: (v: string) => void
  onSubmit: () => void
  error: string
  loading: boolean
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-100 via-amber-50 to-rose-100 p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        className="w-full max-w-sm rounded-3xl border border-pink-200 bg-white p-6 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-center gap-2">
          <span className="text-3xl">🌷</span>
          <h1 className="text-xl font-bold text-slate-800">들샘 모의고사</h1>
        </div>
        <p className="mb-5 text-center text-xs text-gray-600">
          스승의 날 기념! 담임샘에 대해 얼마나 알고 있나요?
          <br />
          학번과 개인코드를 입력하고 도전해 보세요.
        </p>
        <div className="space-y-3">
          <input
            type="text"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="학번"
            className="w-full rounded-xl border-2 border-pink-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none"
          />
          <input
            type="text"
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            placeholder="개인코드"
            className="w-full rounded-xl border-2 border-pink-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none"
          />
        </div>
        {error && <p className="mt-3 text-center text-xs text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-rose-600 disabled:opacity-60"
        >
          {loading ? '확인 중…' : '입장하기'}
        </button>
      </form>
    </div>
  )
}

function IntroView({
  name,
  questionsCount,
  loading,
  error,
  onStart,
}: {
  name: string
  questionsCount: number
  loading: boolean
  error: string
  onStart: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-100 via-amber-50 to-rose-100 p-6">
      <div className="w-full max-w-md rounded-3xl border border-pink-200 bg-white p-6 text-center shadow-lg">
        <p className="text-3xl">🌷</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-800">
          환영해요, {name || '친구'}!
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          스승의 날 기념 들샘 모의고사예요.
        </p>
        <ul className="mt-4 space-y-1 rounded-xl border border-pink-100 bg-pink-50/60 p-3 text-left text-xs text-gray-700">
          <li>• 시작 포인트는 <b>{START_POINTS}P</b>예요.</li>
          <li>• 정답을 빨리 맞출수록 더 많은 포인트(최대 100P)를 받아요.</li>
          <li>• 정답을 맞춰야 다음 문제로 넘어갈 수 있어요.</li>
          <li>• 틀리면 <b>-{WRONG_PENALTY}P</b>, 힌트 사용은 <b>-{HINT_COST}P</b>.</li>
          <li>• 포인트가 모두 떨어지면 자동 탈락…!</li>
          <li>• 모든 문제를 맞추면 랭킹에 점수가 등록됩니다.</li>
        </ul>
        {loading && <p className="mt-4 text-xs text-gray-500">문제를 불러오는 중…</p>}
        {error && <p className="mt-4 text-xs text-rose-600">{error}</p>}
        {!loading && !error && questionsCount === 0 && (
          <p className="mt-4 text-xs text-gray-500">아직 출제된 문제가 없어요. 담임샘에게 물어봐 주세요!</p>
        )}
        <button
          type="button"
          onClick={onStart}
          disabled={loading || !!error || questionsCount === 0}
          className="mt-5 w-full rounded-xl bg-rose-500 px-4 py-3 text-base font-semibold text-white shadow hover:bg-rose-600 disabled:opacity-60"
        >
          ▶ 시작하기 ({questionsCount}문항)
        </button>
      </div>
    </div>
  )
}

function FailedView({ onRetry }: { onRetry: () => void }) {
  const msg = useMemo(
    () => FAILED_MESSAGES[Math.floor(Math.random() * FAILED_MESSAGES.length)],
    []
  )
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-100 via-pink-100 to-amber-100 p-6">
      <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 text-center shadow-lg">
        <img
          src="/game/teacher-sad.png"
          alt="슬픈 담임샘"
          className="mx-auto h-40 w-40 rounded-2xl object-contain"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
        <h1 className="mt-3 text-2xl font-bold text-rose-700">{msg}</h1>
        <p className="mt-2 text-sm text-gray-600">
          포인트가 모두 떨어졌어요. 다시 도전해서 담임샘을 웃게 만들어 주세요!
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 w-full rounded-xl bg-rose-500 px-4 py-3 text-base font-semibold text-white shadow hover:bg-rose-600"
        >
          🔁 다시 도전하기
        </button>
      </div>
    </div>
  )
}

function ClearedView({
  name,
  finalScore,
  rawScore,
  retries,
  onRetry,
}: {
  name: string
  finalScore: number
  rawScore: number
  retries: number
  onRetry: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-pink-50 to-rose-50 p-6">
      <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 text-center shadow-xl">
        <img
          src="/game/teacher-love.png"
          alt="기뻐하는 담임샘"
          className="mx-auto h-40 w-40 rounded-2xl object-contain"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
        <h1 className="mt-3 text-xl font-bold text-rose-700">
          {SUCCESS_PREFIX}
          <span className="font-extrabold text-rose-600">{name || '친구'}</span>
          {SUCCESS_SUFFIX}
        </h1>
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs text-gray-600">최종 점수</p>
          <p className="mt-1 text-4xl font-extrabold text-rose-600">{finalScore}P</p>
          {retries > 0 && (
            <p className="mt-1 text-[11px] text-gray-500">
              (원점수 {rawScore}P, 재도전 {retries}회 · -{retries * 10}P)
            </p>
          )}
        </div>
        <p className="mt-4 text-xs text-gray-500">
          {retries === 0
            ? '대단해요! 한 번에 모두 맞췄어요 🎉'
            : '재도전해서 클리어할 때마다 10P씩 감점됩니다.'}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 w-full rounded-xl bg-rose-500 px-4 py-3 text-base font-semibold text-white shadow hover:bg-rose-600"
        >
          🔁 다시 도전하기 (총점 -10P)
        </button>
      </div>
    </div>
  )
}
