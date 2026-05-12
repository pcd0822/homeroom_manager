import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getStudents,
  getSeatingConfig,
  saveSeatingAssignment,
} from '@/api/api'
import { assignSeats, sortSeats } from '@/lib/seating'
import type {
  SeatingLayout,
  SeatingRules,
  SeatingType,
  Student,
} from '@/types'
import { cn } from '@/lib/utils'

type Phase = 'loading' | 'drumroll' | 'reveal' | 'error'

const FUN_LINES = [
  '누가 내 짝이 될까?',
  '두근두근…',
  '운명의 자리는?',
  '오늘의 짝꿍은…',
  '눈 감고 살짝!',
  '제발 친한 친구!',
  '운명을 믿어요',
  '심호흡 한 번!',
  '오늘 자리 운 시작!',
  '셔플 중… 🎲',
]

export function SeatingDrawPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [layout, setLayout] = useState<SeatingLayout | null>(null)
  const [rules, setRules] = useState<SeatingRules>({ fixed: [], apart: [], together: [] })
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string>('')
  const [assignment, setAssignment] = useState<Record<string, string>>({})
  const [funLine, setFunLine] = useState<string>(FUN_LINES[0])
  const [randomPhoto, setRandomPhoto] = useState<Student | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const drumrollTimerRef = useRef<number | null>(null)

  const studentById = useMemo(() => {
    const m = new Map<string, Student>()
    students.forEach((s) => m.set(s.student_id, s))
    return m
  }, [students])

  // 초기 로드
  useEffect(() => {
    Promise.all([getStudents(), getSeatingConfig()])
      .then(([stuRes, cfgRes]) => {
        if (!stuRes.success || !stuRes.data) {
          setError(stuRes.error || '학생 목록을 불러올 수 없습니다.')
          setPhase('error')
          return
        }
        if (!cfgRes.success || !cfgRes.data) {
          setError(cfgRes.error || '자리 배치 설정이 저장되지 않았습니다. 관리자 화면에서 먼저 설정을 저장해 주세요.')
          setPhase('error')
          return
        }
        const cfg = cfgRes.data
        if (!cfg.layout || cfg.layout.groups.length === 0) {
          setError('좌석 정보가 비어 있습니다. 관리자 화면에서 좌석을 자동 생성한 뒤 다시 시도해 주세요.')
          setPhase('error')
          return
        }
        setStudents(stuRes.data)
        setLayout(cfg.layout)
        setRules(cfg.rules || { fixed: [], apart: [], together: [] })
        // 즉시 자리 뽑기 시작
        startDrumroll(stuRes.data, cfg.layout, cfg.rules || { fixed: [], apart: [], together: [] })
      })
    return () => {
      if (drumrollTimerRef.current != null) window.clearInterval(drumrollTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runAssign = useCallback(
    (stuList: Student[], lyt: SeatingLayout, rls: SeatingRules) => {
      const ids = stuList.map((s) => s.student_id)
      const { bySeat } = assignSeats(ids, lyt, rls)
      setAssignment(bySeat)
    },
    []
  )

  const startDrumroll = useCallback(
    (stuList: Student[], lyt: SeatingLayout, rls: SeatingRules) => {
      setPhase('drumroll')
      const total = stuList.length
      // 드럼롤 동안 랜덤 학생 사진 + 문구 셔플
      let lineIdx = 0
      const tick = () => {
        if (total > 0) {
          setRandomPhoto(stuList[Math.floor(Math.random() * total)])
        }
        lineIdx = (lineIdx + 1) % FUN_LINES.length
        setFunLine(FUN_LINES[lineIdx])
      }
      tick()
      const id = window.setInterval(tick, 220)
      drumrollTimerRef.current = id

      // 실제 배정은 백그라운드에서 즉시 실행
      runAssign(stuList, lyt, rls)

      // 약 3.6초 뒤 reveal
      window.setTimeout(() => {
        if (drumrollTimerRef.current != null) {
          window.clearInterval(drumrollTimerRef.current)
          drumrollTimerRef.current = null
        }
        setPhase('reveal')
      }, 3600)
    },
    [runAssign]
  )

  const reroll = () => {
    if (!layout) return
    setSavedAt(null)
    startDrumroll(students, layout, rules)
  }

  const save = async () => {
    if (!layout) return
    setSaving(true)
    const rows = Object.entries(assignment).map(([seat_id, student_id]) => {
      const stu = studentById.get(student_id)
      const groupId = layout.groups.find((g) => g.seats.some((s) => s.id === seat_id))?.id || ''
      return {
        seat_id,
        group_id: groupId,
        student_id,
        student_name: stu?.name || '',
      }
    })
    const res = await saveSeatingAssignment(layout, rows)
    setSaving(false)
    if (res.success && res.data) {
      setSavedAt(res.data.saved_at)
      alert('자리 배치가 저장되었습니다. 관리자 화면에서도 확인할 수 있습니다.')
    } else {
      alert(res.error || '저장에 실패했습니다.')
    }
  }

  if (phase === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-pink-50 p-6">
        <div className="max-w-md rounded-xl border border-rose-200 bg-white p-6 text-center shadow">
          <p className="mb-2 text-lg font-semibold text-rose-700">자리 뽑기를 시작할 수 없어요</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (phase === 'loading' || phase === 'drumroll') {
    return <DrumrollView funLine={funLine} student={randomPhoto} />
  }

  // reveal
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">🎉 자리 배치 결과</h1>
            <p className="mt-1 text-sm text-gray-600">
              마음에 들면 <span className="font-semibold text-emerald-700">저장</span>, 다시 뽑으려면{' '}
              <span className="font-semibold text-indigo-700">다시 뽑기</span>를 눌러주세요.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reroll}
              disabled={saving}
              className="rounded-md border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
            >
              🔄 다시 뽑기
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              💾 저장
            </button>
            {saving && <span className="text-xs text-gray-500">저장 중…</span>}
            {savedAt && !saving && (
              <span className="text-xs text-gray-500">{new Date(savedAt).toLocaleString('ko-KR')} 저장됨</span>
            )}
          </div>
        </div>
        {layout && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {layout.groups.map((g) => (
              <RevealedGroup
                key={g.id}
                group={g}
                assignment={assignment}
                studentById={studentById}
                type={layout.type}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DrumrollView({ funLine, student }: { funLine: string; student: Student | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-pink-100 p-6">
      <div className="flex flex-col items-center gap-6">
        {/* 도넛 + 피넛 스피너 */}
        <div className="relative h-44 w-44">
          <div className="absolute inset-0 animate-spin rounded-full border-[14px] border-pink-200 border-t-pink-500" style={{ animationDuration: '1.2s' }} />
          <div className="absolute inset-5 animate-spin rounded-full border-[10px] border-amber-200 border-b-amber-500" style={{ animationDuration: '0.9s', animationDirection: 'reverse' }} />
          <div className="absolute inset-10 flex items-center justify-center rounded-full bg-white shadow-inner">
            {student?.photo_data ? (
              <img
                src={student.photo_data}
                alt={student.name}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span className="text-2xl">🥜</span>
            )}
          </div>
        </div>

        <p className="text-2xl font-bold text-slate-800 drop-shadow-sm">{funLine}</p>
        {student && (
          <p className="text-sm text-slate-600">
            지금 카드 안의 친구는… <span className="font-semibold">{student.name}</span> ✨
          </p>
        )}
        <div className="flex gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-pink-500 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-amber-500 [animation-delay:120ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-500 [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  )
}

function RevealedGroup({
  group,
  assignment,
  studentById,
  type,
}: {
  group: { id: string; name: string; seats: Array<{ id: string; row: number; col: number }> }
  assignment: Record<string, string>
  studentById: Map<string, Student>
  type: SeatingType
}) {
  const colsPerRow = type === 'individual' ? 1 : 2
  const sorted = sortSeats(group.seats)
  const rows = new Map<number, typeof sorted>()
  sorted.forEach((s) => {
    if (!rows.has(s.row)) rows.set(s.row, [])
    rows.get(s.row)!.push(s)
  })
  const rowKeys = Array.from(rows.keys()).sort((a, b) => a - b)
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-slate-800">{group.name}</p>
      <div className="space-y-2">
        {rowKeys.map((r) => (
          <div
            key={r}
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${colsPerRow}, minmax(0, 1fr))` }}
          >
            {(rows.get(r) ?? []).map((seat) => {
              const sid = assignment[seat.id]
              const stu = sid ? studentById.get(sid) : null
              return (
                <div
                  key={seat.id}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs',
                    stu
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-dashed border-gray-200 bg-white text-gray-400'
                  )}
                >
                  {stu?.photo_data ? (
                    <img
                      src={stu.photo_data}
                      alt={stu.name}
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[10px] text-gray-400">
                      {stu ? stu.name.slice(0, 1) : '·'}
                    </div>
                  )}
                  <div className="min-w-0 leading-tight">
                    <p className="truncate font-semibold">{stu?.name || '(빈자리)'}</p>
                    {stu && <p className="truncate text-[10px] text-emerald-700/70">{stu.student_id}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
