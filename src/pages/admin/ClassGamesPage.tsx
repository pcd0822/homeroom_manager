import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GAME_ID_HOME_SEND_ME, GAMES_META } from '@/constants/games'

export function ClassGamesPage() {
  const [copied, setCopied] = useState(false)
  const meta = GAMES_META[GAME_ID_HOME_SEND_ME]
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${meta.studentPath}` : ''

  const copyShare = () => {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">학급 게임</h1>
      <p className="mt-1 text-sm text-gray-600">
        학생은 학번·개인코드로 참여합니다. 아래 링크를 복사해 공유하세요. (데이터 관리하기의 문서 공유와 동일한 방식)
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-1">
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">{meta.title}</h2>
          <p className="mt-2 text-sm text-gray-600">{meta.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyShare}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {copied ? '링크 복사됨!' : '공유하기 (학생용 URL 복사)'}
            </button>
            <Link
              to={`/admin/class-games/${GAME_ID_HOME_SEND_ME}/ranking`}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              랭킹 보기
            </Link>
          </div>
          <p className="mt-3 break-all text-xs text-gray-500">{shareUrl}</p>
        </article>
      </div>
    </div>
  )
}
