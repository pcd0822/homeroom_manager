import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  GAME_ID_HOME_SEND_ME,
  GAME_ID_TEACHER_QUIZ,
  GAMES_META,
} from '@/constants/games'

export function ClassGamesPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const copyShare = (gameId: string, path: string) => {
    const url = `${origin}${path}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(gameId)
      setTimeout(() => setCopiedId((cur) => (cur === gameId ? null : cur)), 2000)
    })
  }

  const homeRunMeta = GAMES_META[GAME_ID_HOME_SEND_ME]
  const quizMeta = GAMES_META[GAME_ID_TEACHER_QUIZ]

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">학급 게임</h1>
      <p className="mt-1 text-sm text-gray-600">
        학생은 학번·개인코드로 참여합니다. 아래 링크를 복사해 공유하세요. (데이터 관리하기의 문서 공유와 동일한 방식)
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-1">
        {/* 집 보내주세요! */}
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">{homeRunMeta.title}</h2>
          <p className="mt-2 text-sm text-gray-600">{homeRunMeta.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyShare(GAME_ID_HOME_SEND_ME, homeRunMeta.studentPath)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {copiedId === GAME_ID_HOME_SEND_ME ? '링크 복사됨!' : '공유하기 (학생용 URL 복사)'}
            </button>
            <Link
              to={`/admin/class-games/${GAME_ID_HOME_SEND_ME}/ranking`}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              랭킹 보기
            </Link>
          </div>
          <p className="mt-3 break-all text-xs text-gray-500">{origin}{homeRunMeta.studentPath}</p>
        </article>

        {/* 들샘 모의고사 */}
        <article className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-amber-50 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌷</span>
            <h2 className="text-lg font-semibold text-gray-900">{quizMeta.title}</h2>
          </div>
          <p className="mt-2 text-sm text-gray-700">{quizMeta.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/admin/class-games/teacher-quiz/edit"
              className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600"
            >
              📝 문제 출제하기
            </Link>
            <button
              type="button"
              onClick={() => copyShare(GAME_ID_TEACHER_QUIZ, quizMeta.studentPath)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {copiedId === GAME_ID_TEACHER_QUIZ ? '링크 복사됨!' : '공유하기 (학생용 URL 복사)'}
            </button>
            <Link
              to="/admin/class-games/teacher-quiz/ranking"
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              🏆 랭킹 보기
            </Link>
          </div>
          <p className="mt-3 break-all text-xs text-gray-600">{origin}{quizMeta.studentPath}</p>
        </article>
      </div>
    </div>
  )
}
