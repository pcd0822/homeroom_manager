import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTeacherQuizQuestions, saveTeacherQuizQuestions } from '@/api/api'
import type { TeacherQuizQuestion, TeacherQuizType } from '@/types'
import {
  QUIZ_TYPES,
  emptyQuestion,
  extractYoutubeId,
  fileToDataUrl,
} from '@/lib/teacherQuiz'
import { cn } from '@/lib/utils'

function friendlyQuizError(err?: string) {
  if (!err) return '저장에 실패했습니다.'
  if (err.includes('Unknown action')) {
    return (
      'GAS 백엔드에 들샘 모의고사 기능이 아직 배포되지 않았어요.\n' +
      '구글 스크립트 편집기에서 gas/Code.gs를 새 버전으로 “웹 앱 배포”해 주세요.'
    )
  }
  return err
}

export function TeacherQuizEditPage() {
  const [questions, setQuestions] = useState<TeacherQuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    getTeacherQuizQuestions()
      .then((res) => {
        if (res.success && res.data) setQuestions(res.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const addQuestion = () => {
    setQuestions((prev) => [...prev, emptyQuestion(prev.length + 1)])
  }

  const removeQuestion = (idx: number) => {
    if (!confirm(`${idx + 1}번 문제를 삭제할까요?`)) return
    setQuestions((prev) =>
      prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order_no: i + 1 }))
    )
  }

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    setQuestions((prev) => {
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
      return arr.map((q, i) => ({ ...q, order_no: i + 1 }))
    })
  }

  const updateQuestion = (idx: number, patch: Partial<TeacherQuizQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)))
  }

  const changeType = (idx: number, type: TeacherQuizType) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q
        // 타입에 따라 기본 필드 정리
        const next: TeacherQuizQuestion = { ...q, type }
        if (type === 'choice') {
          next.choices = q.choices && q.choices.length >= 2 ? q.choices : ['', '']
          next.choice_images = []
          next.image_data = ''
          next.youtube_url = ''
          if (!/^\d+$/.test(q.correct_answer)) next.correct_answer = '0'
        } else if (type === 'imageChoice') {
          next.choice_images =
            q.choice_images && q.choice_images.length >= 2 ? q.choice_images : ['', '']
          next.choices = []
          next.image_data = ''
          next.youtube_url = ''
          if (!/^\d+$/.test(q.correct_answer)) next.correct_answer = '0'
        } else if (type === 'ox') {
          next.choices = []
          next.choice_images = []
          next.image_data = ''
          next.youtube_url = ''
          if (q.correct_answer !== 'O' && q.correct_answer !== 'X') next.correct_answer = 'O'
        } else if (type === 'short') {
          next.choices = []
          next.choice_images = []
          next.image_data = ''
          next.youtube_url = ''
        } else if (type === 'image') {
          next.choices = []
          next.choice_images = []
          next.youtube_url = ''
        } else if (type === 'imageMc') {
          // 문제에 이미지 + 텍스트 선택지
          next.choices = q.choices && q.choices.length >= 2 ? q.choices : ['', '']
          next.choice_images = []
          next.youtube_url = ''
          if (!/^\d+$/.test(q.correct_answer)) next.correct_answer = '0'
        } else if (type === 'youtube') {
          next.choices = []
          next.choice_images = []
          next.image_data = ''
        } else if (type === 'survey') {
          // 설문형: 정답 없음, 미디어 없음
          next.choices = []
          next.choice_images = []
          next.image_data = ''
          next.youtube_url = ''
          next.correct_answer = ''
        }
        return next
      })
    )
  }

  const onImage = async (idx: number, file: File | null) => {
    if (!file) return
    const data = await fileToDataUrl(file)
    updateQuestion(idx, { image_data: data })
  }

  const onChoiceImage = async (idx: number, choiceIdx: number, file: File | null) => {
    if (!file) return
    const data = await fileToDataUrl(file)
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q
        const arr = [...(q.choice_images ?? [])]
        arr[choiceIdx] = data
        return { ...q, choice_images: arr }
      })
    )
  }

  const save = async () => {
    // 간단 검증
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.question.trim()) {
        alert(`${i + 1}번 문제의 질문을 입력해 주세요.`)
        return
      }
      if (q.type === 'choice' || q.type === 'imageMc') {
        if (!q.choices || q.choices.filter((c) => c.trim()).length < 2) {
          alert(`${i + 1}번 문제: 선택지를 2개 이상 입력해 주세요.`)
          return
        }
      }
      if (q.type === 'imageChoice') {
        if (!q.choice_images || q.choice_images.filter((c) => c).length < 2) {
          alert(`${i + 1}번 문제: 이미지 선택지를 2개 이상 업로드해 주세요.`)
          return
        }
      }
      if ((q.type === 'image' || q.type === 'imageMc') && !q.image_data) {
        alert(`${i + 1}번 문제: 문제용 이미지를 업로드해 주세요.`)
        return
      }
      if (q.type === 'youtube' && !extractYoutubeId(q.youtube_url || '')) {
        alert(`${i + 1}번 문제: 유튜브 링크를 확인해 주세요.`)
        return
      }
      // 설문형은 정답이 없으므로 검증 스킵
      if (q.type !== 'survey' && !q.correct_answer.toString().trim()) {
        alert(`${i + 1}번 문제: 정답을 입력해 주세요.`)
        return
      }
      if (q.time_limit < 10 || q.time_limit >= 60) {
        alert(`${i + 1}번 문제: 제한 시간은 10초 이상 59초 이하로 설정해 주세요.`)
        return
      }
    }
    setSaving(true)
    const res = await saveTeacherQuizQuestions(questions)
    setSaving(false)
    if (res.success) {
      setSavedAt(new Date().toISOString())
      alert(`총 ${questions.length}문항이 저장되었습니다.`)
    } else {
      alert(friendlyQuizError(res.error))
    }
  }

  if (loading) {
    return <p className="p-6 text-sm text-gray-500">로딩 중...</p>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/admin/class-games" className="text-sm text-blue-600 hover:underline">
          ← 학급 게임
        </Link>
      </div>
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          🌷 들샘 모의고사 — 문제 출제
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          담임샘에 대한 다양한 유형의 문제를 출제하세요. 학생은 공유 링크에서 학번·코드로 입장해
          문제를 풀고 포인트를 쌓습니다.
        </p>
      </header>

      {/* 문제 리스트 */}
      <div className="space-y-4">
        {questions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            아직 문제가 없어요. 아래 버튼으로 첫 문제를 추가해 주세요.
          </p>
        ) : (
          questions.map((q, idx) => (
            <QuestionEditor
              key={q.id}
              idx={idx}
              question={q}
              onChange={(patch) => updateQuestion(idx, patch)}
              onChangeType={(t) => changeType(idx, t)}
              onRemove={() => removeQuestion(idx)}
              onMoveUp={() => moveQuestion(idx, -1)}
              onMoveDown={() => moveQuestion(idx, 1)}
              onImage={(file) => onImage(idx, file)}
              onChoiceImage={(ci, file) => onChoiceImage(idx, ci, file)}
              total={questions.length}
            />
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addQuestion}
          className="rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
        >
          + 문제 추가
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || questions.length === 0}
          className="rounded-md bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-60"
        >
          {saving ? '저장 중…' : '전체 저장'}
        </button>
        {savedAt && !saving && (
          <span className="text-xs text-gray-500">
            마지막 저장: {new Date(savedAt).toLocaleString('ko-KR')}
          </span>
        )}
      </div>
    </div>
  )
}

function QuestionEditor({
  idx,
  question,
  onChange,
  onChangeType,
  onRemove,
  onMoveUp,
  onMoveDown,
  onImage,
  onChoiceImage,
  total,
}: {
  idx: number
  question: TeacherQuizQuestion
  onChange: (patch: Partial<TeacherQuizQuestion>) => void
  onChangeType: (t: TeacherQuizType) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onImage: (file: File | null) => void
  onChoiceImage: (ci: number, file: File | null) => void
  total: number
}) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">문제 {idx + 1}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={idx === 0}
            className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            title="위로"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={idx === total - 1}
            className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            title="아래로"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded border border-red-200 bg-white px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
          >
            삭제
          </button>
        </div>
      </div>

      {/* 유형 */}
      <div className="mb-3">
        <p className="mb-1 text-xs font-medium text-gray-700">문제 유형</p>
        <div className="flex flex-wrap gap-1">
          {QUIZ_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onChangeType(t.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                question.type === t.value
                  ? 'border-rose-300 bg-rose-100 text-rose-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 질문 */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-gray-700">질문</label>
        <textarea
          rows={2}
          value={question.question}
          onChange={(e) => onChange({ question: e.target.value })}
          placeholder="예) 담임샘이 가장 좋아하는 음식은?"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {/* 타입별 본문 */}
      {(question.type === 'image' || question.type === 'imageMc') && (
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-gray-700">문제 이미지</label>
          <ImageUploader
            value={question.image_data}
            onChange={(file) => onImage(file)}
            onClear={() => onChange({ image_data: '' })}
          />
        </div>
      )}

      {question.type === 'youtube' && (
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-gray-700">유튜브 URL 또는 영상 ID</label>
          <input
            type="text"
            value={question.youtube_url || ''}
            onChange={(e) => onChange({ youtube_url: e.target.value })}
            placeholder="https://youtu.be/... 또는 영상 ID"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {extractYoutubeId(question.youtube_url || '') && (
            <div className="mt-2 aspect-video w-full max-w-md overflow-hidden rounded-md border border-gray-200 bg-black">
              <iframe
                title="preview"
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${extractYoutubeId(question.youtube_url || '')}`}
                allowFullScreen
              />
            </div>
          )}
        </div>
      )}

      {(question.type === 'choice' || question.type === 'imageMc') && (
        <ChoiceListEditor
          choices={question.choices ?? []}
          correctIdx={parseInt(question.correct_answer || '0', 10)}
          onChange={(choices, correctIdx) =>
            onChange({ choices, correct_answer: String(correctIdx) })
          }
        />
      )}

      {question.type === 'imageChoice' && (
        <ImageChoiceListEditor
          images={question.choice_images ?? []}
          correctIdx={parseInt(question.correct_answer || '0', 10)}
          onChangeCorrect={(ci) => onChange({ correct_answer: String(ci) })}
          onUpload={onChoiceImage}
          onAdd={() =>
            onChange({ choice_images: [...(question.choice_images ?? []), ''] })
          }
          onRemove={(i) => {
            const arr = [...(question.choice_images ?? [])]
            arr.splice(i, 1)
            const cur = parseInt(question.correct_answer || '0', 10)
            const newCorrect = cur >= arr.length ? Math.max(0, arr.length - 1) : cur
            onChange({ choice_images: arr, correct_answer: String(newCorrect) })
          }}
        />
      )}

      {question.type === 'ox' && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium text-gray-700">정답</p>
          <div className="flex gap-2">
            {(['O', 'X'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChange({ correct_answer: v })}
                className={cn(
                  'h-12 w-16 rounded-lg border-2 text-xl font-bold transition-colors',
                  question.correct_answer === v
                    ? v === 'O'
                      ? 'border-rose-400 bg-rose-100 text-rose-600'
                      : 'border-blue-400 bg-blue-100 text-blue-600'
                    : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {(question.type === 'short' || question.type === 'image' || question.type === 'youtube') && (
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-gray-700">정답 (주관식)</label>
          <input
            type="text"
            value={question.correct_answer}
            onChange={(e) => onChange({ correct_answer: e.target.value })}
            placeholder="예) 떡볶이"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-gray-500">
            대소문자·공백 무시하고 비교합니다.
          </p>
        </div>
      )}

      {question.type === 'survey' && (
        <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
          📝 <b>설문형</b> 문제는 정답이 없어요.
          학생이 제한 시간 안에 답을 적어 제출하면 <b>+100P</b>를 받고, 시간이 지난 뒤 제출하면 <b>+10P</b>만 받습니다.
          오답 페널티도 없어요.
        </div>
      )}

      {/* 힌트, 시간 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">힌트 (30포인트 차감, 선택)</label>
          <input
            type="text"
            value={question.hint || ''}
            onChange={(e) => onChange({ hint: e.target.value })}
            placeholder="예) 매콤한 분식이에요"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            제한 시간 (10~59초)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={10}
              max={59}
              value={question.time_limit}
              onChange={(e) =>
                onChange({
                  time_limit: Math.max(10, Math.min(59, parseInt(e.target.value || '0', 10) || 30)),
                })
              }
              className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="text-xs text-gray-500">초</span>
          </div>
        </div>
      </div>
    </article>
  )
}

function ImageUploader({
  value,
  onChange,
  onClear,
}: {
  value?: string
  onChange: (file: File | null) => void
  onClear: () => void
}) {
  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt="문제 이미지" className="max-h-48 rounded-md border border-gray-200" />
          <button
            type="button"
            onClick={onClear}
            className="absolute -right-1 -top-1 h-6 w-6 rounded-full bg-red-500 text-xs text-white shadow"
          >
            ×
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-400">아직 업로드된 이미지가 없습니다.</p>
      )}
      <input
        type="file"
        accept="image/*"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="block text-xs text-gray-700"
      />
    </div>
  )
}

function ChoiceListEditor({
  choices,
  correctIdx,
  onChange,
}: {
  choices: string[]
  correctIdx: number
  onChange: (choices: string[], correctIdx: number) => void
}) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-xs font-medium text-gray-700">선택지</p>
      <div className="space-y-1.5">
        {choices.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange(choices, i)}
              className={cn(
                'h-7 w-7 shrink-0 rounded-full border text-xs font-bold transition-colors',
                correctIdx === i
                  ? 'border-rose-400 bg-rose-100 text-rose-600'
                  : 'border-gray-300 bg-white text-gray-400'
              )}
              title="이 선택지가 정답"
            >
              {i + 1}
            </button>
            <input
              type="text"
              value={c}
              onChange={(e) => {
                const arr = [...choices]
                arr[i] = e.target.value
                onChange(arr, correctIdx)
              }}
              placeholder={`선택지 ${i + 1}`}
              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                const arr = choices.filter((_, j) => j !== i)
                const nc = correctIdx >= arr.length ? Math.max(0, arr.length - 1) : correctIdx
                onChange(arr, nc)
              }}
              disabled={choices.length <= 2}
              className="rounded border border-gray-200 bg-white px-1.5 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...choices, ''], correctIdx)}
        className="mt-2 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
      >
        + 선택지 추가
      </button>
      <p className="mt-1 text-[11px] text-gray-500">
        번호 동그라미를 클릭해 정답을 지정하세요. (현재 {correctIdx + 1}번)
      </p>
    </div>
  )
}

function ImageChoiceListEditor({
  images,
  correctIdx,
  onChangeCorrect,
  onUpload,
  onAdd,
  onRemove,
}: {
  images: string[]
  correctIdx: number
  onChangeCorrect: (ci: number) => void
  onUpload: (ci: number, file: File | null) => void
  onAdd: () => void
  onRemove: (ci: number) => void
}) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-xs font-medium text-gray-700">이미지 선택지</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {images.map((img, i) => (
          <div
            key={i}
            className={cn(
              'rounded-xl border-2 p-2',
              correctIdx === i ? 'border-rose-400 bg-rose-50' : 'border-gray-200 bg-white'
            )}
          >
            <div className="mb-1 flex items-center justify-between">
              <button
                type="button"
                onClick={() => onChangeCorrect(i)}
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-bold',
                  correctIdx === i ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-500'
                )}
              >
                {i + 1}번 {correctIdx === i ? '(정답)' : ''}
              </button>
              <button
                type="button"
                onClick={() => onRemove(i)}
                disabled={images.length <= 2}
                className="rounded border border-gray-200 bg-white px-1.5 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                삭제
              </button>
            </div>
            {img ? (
              <img src={img} alt={`선택지 ${i + 1}`} className="h-32 w-full rounded-md border border-gray-200 object-contain" />
            ) : (
              <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
                이미지 업로드
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onUpload(i, e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-xs text-gray-700"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
      >
        + 이미지 선택지 추가
      </button>
    </div>
  )
}
