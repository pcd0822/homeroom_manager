import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getStudents,
  getSeatingConfig,
  saveSeatingConfig,
  getSeatingAssignment,
} from '@/api/api'
import type {
  SeatingType,
  SeatingLayout,
  SeatingGroup,
  SeatingSeat,
  SeatingRules,
  SeatingConfig,
  SeatingAssignmentRow,
  Student,
} from '@/types'
import { generateLayout, sortSeats } from '@/lib/seating'
import { cn } from '@/lib/utils'

const TYPE_LABEL: Record<SeatingType, string> = {
  individual: '개별',
  pair: '짝',
  group: '모둠',
}

const rid = () => Math.random().toString(36).slice(2, 8)

export function SeatingPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [type, setType] = useState<SeatingType>('pair')
  const [totalSeats, setTotalSeats] = useState<number>(24)
  const [layout, setLayout] = useState<SeatingLayout>({ type: 'pair', groups: [] })
  const [rules, setRules] = useState<SeatingRules>({ fixed: [], apart: [], together: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [lastAssignment, setLastAssignment] = useState<{
    saved_at: string | null
    layout: SeatingLayout | null
    assignments: SeatingAssignmentRow[]
  } | null>(null)

  const studentNameById = useMemo(() => {
    const m: Record<string, string> = {}
    students.forEach((s) => (m[s.student_id] = s.name))
    return m
  }, [students])

  const allSeats = useMemo(() => {
    const arr: Array<{ groupId: string; groupName: string; seat: SeatingSeat }> = []
    layout.groups.forEach((g) =>
      sortSeats(g.seats).forEach((s) => arr.push({ groupId: g.id, groupName: g.name, seat: s }))
    )
    return arr
  }, [layout])

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getStudents(), getSeatingConfig(), getSeatingAssignment()])
      .then(([stuRes, cfgRes, asnRes]) => {
        if (stuRes.success && stuRes.data) setStudents(stuRes.data)
        if (cfgRes.success && cfgRes.data) {
          const cfg = cfgRes.data
          setType(cfg.type)
          setTotalSeats(cfg.totalSeats)
          setLayout(cfg.layout || { type: cfg.type, groups: [] })
          setRules(cfg.rules || { fixed: [], apart: [], together: [] })
          setSavedAt(cfg.updated_at ?? null)
        }
        if (asnRes.success && asnRes.data) {
          setLastAssignment(asnRes.data)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const autoGenerate = () => {
    if (totalSeats <= 0) {
      alert('인원 수를 1 이상으로 입력해 주세요.')
      return
    }
    setLayout(generateLayout(type, totalSeats))
    // 새 layout이므로 지정 좌석 규칙 무효화 (seat id가 바뀜)
    setRules((r) => ({ ...r, fixed: [] }))
  }

  const totalSeatCount = layout.groups.reduce((s, g) => s + g.seats.length, 0)

  const addGroup = () => {
    setLayout((prev) => {
      const idx = prev.groups.length + 1
      const label = prev.type === 'group' ? '모둠' : '분단'
      const newGroup: SeatingGroup = {
        id: `grp-${Date.now().toString(36)}-${rid()}`,
        name: `${label} ${idx}`,
        seats: [],
      }
      return { ...prev, groups: [...prev.groups, newGroup] }
    })
  }

  const removeGroup = (gid: string) => {
    const removed = layout.groups.find((g) => g.id === gid)
    const removedSeatIds = new Set(removed?.seats.map((s) => s.id) ?? [])
    setLayout((prev) => ({ ...prev, groups: prev.groups.filter((g) => g.id !== gid) }))
    setRules((r) => ({
      ...r,
      fixed: r.fixed.filter((f) => !removedSeatIds.has(f.seat_id)),
    }))
  }

  const addSeatToGroup = (gid: string) => {
    setLayout((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => {
        if (g.id !== gid) return g
        // 새 좌석은 마지막 행의 다음 열, 또는 다음 행 1열로 자동 정렬
        const sorted = sortSeats(g.seats)
        const lastRow = sorted.length > 0 ? sorted[sorted.length - 1].row : 1
        const sameRowSeats = sorted.filter((s) => s.row === lastRow)
        const maxColInRow = sameRowSeats.length > 0 ? Math.max(...sameRowSeats.map((s) => s.col)) : 0
        const colsPerRow = prev.type === 'group' ? 2 : prev.type === 'pair' ? 2 : 1
        const nextRow = maxColInRow >= colsPerRow ? lastRow + 1 : lastRow
        const nextCol = maxColInRow >= colsPerRow ? 1 : maxColInRow + 1
        return {
          ...g,
          seats: [
            ...g.seats,
            { id: `seat-${Date.now().toString(36)}-${rid()}`, row: nextRow, col: nextCol },
          ],
        }
      }),
    }))
  }

  const removeSeat = (gid: string, sid: string) => {
    setLayout((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => {
        if (g.id !== gid) return g
        const remaining = g.seats.filter((s) => s.id !== sid)
        // 좌석 제거 후 row/col 재정렬 (앞에서부터 채워서 빈칸 없도록)
        const colsPerRow = prev.type === 'group' ? 2 : prev.type === 'pair' ? 2 : 1
        const sorted = sortSeats(remaining)
        const renumbered = sorted.map((s, i) => ({
          ...s,
          row: Math.floor(i / colsPerRow) + 1,
          col: (i % colsPerRow) + 1,
        }))
        return { ...g, seats: renumbered }
      }),
    }))
    setRules((r) => ({ ...r, fixed: r.fixed.filter((f) => f.seat_id !== sid) }))
  }

  // ----- 규칙: 지정 좌석 -----
  const fixedStudentIds = new Set(rules.fixed.map((f) => f.student_id))
  const occupiedFixedSeats = new Set(rules.fixed.map((f) => f.seat_id))

  const setFixedSeat = (seat_id: string, student_id: string) => {
    setRules((r) => {
      // 같은 학생이 이미 다른 좌석에 지정돼 있으면 옮김
      const others = r.fixed.filter((f) => f.student_id !== student_id && f.seat_id !== seat_id)
      if (!student_id) return { ...r, fixed: others }
      return { ...r, fixed: [...others, { seat_id, student_id }] }
    })
  }

  // ----- 규칙: 떨어져야 / 붙어야 -----
  const addRuleGroup = (kind: 'apart' | 'together') => {
    setRules((r) => ({
      ...r,
      [kind]: [...r[kind], { id: `${kind}-${Date.now().toString(36)}-${rid()}`, student_ids: [] }],
    }))
  }

  const removeRuleGroup = (kind: 'apart' | 'together', id: string) => {
    setRules((r) => ({ ...r, [kind]: r[kind].filter((x) => x.id !== id) }))
  }

  const toggleStudentInRule = (
    kind: 'apart' | 'together',
    ruleId: string,
    studentId: string
  ) => {
    setRules((r) => ({
      ...r,
      [kind]: r[kind].map((x) => {
        if (x.id !== ruleId) return x
        const has = x.student_ids.includes(studentId)
        return {
          ...x,
          student_ids: has
            ? x.student_ids.filter((s) => s !== studentId)
            : [...x.student_ids, studentId],
        }
      }),
    }))
  }

  const saveConfig = async () => {
    setSaving(true)
    const cfg: SeatingConfig = { type, totalSeats, layout, rules }
    const res = await saveSeatingConfig(cfg)
    setSaving(false)
    if (res.success && res.data) {
      setSavedAt(res.data.updated_at)
      alert('자리 배치 기본 설정이 저장되었습니다.')
    } else {
      alert(res.error || '저장에 실패했습니다.')
    }
  }

  const openDrawWindow = async () => {
    // 저장 후 학생용 뽑기 페이지를 새 창으로 오픈
    setSaving(true)
    const cfg: SeatingConfig = { type, totalSeats, layout, rules }
    const res = await saveSeatingConfig(cfg)
    setSaving(false)
    if (!res.success) {
      alert(res.error || '설정 저장에 실패했습니다.')
      return
    }
    if (res.data) setSavedAt(res.data.updated_at)
    window.open(`${window.location.origin}/seating-draw`, '_blank', 'noopener,noreferrer')
  }

  const reloadLastAssignment = async () => {
    const res = await getSeatingAssignment()
    if (res.success && res.data) setLastAssignment(res.data)
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <SeatIcon className="h-6 w-6 text-slate-600" />
        <h1 className="text-xl font-semibold text-gray-900">자리 배치</h1>
      </div>
      <p className="text-sm text-gray-600">
        좌석 형태와 인원을 입력해 좌석을 자동 생성한 뒤, 지정 좌석 · 떨어질 친구 · 붙을 친구를 설정하고
        “자리 뽑기 시작”을 누르면 학생용 공유창에서 자리 뽑기가 진행됩니다.
      </p>

      {/* 1. 기본 좌석 세팅 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">1. 좌석 형태 · 인원</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-1">
            {(['individual', 'pair', 'group'] as SeatingType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                  type === t ? 'bg-white text-slate-800 shadow' : 'text-gray-600 hover:bg-white'
                )}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            인원 수
            <input
              type="number"
              min={1}
              value={totalSeats}
              onChange={(e) => setTotalSeats(Math.max(0, parseInt(e.target.value || '0', 10)))}
              className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            명
          </label>
          <button
            type="button"
            onClick={autoGenerate}
            className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            자동 생성
          </button>
          <span className="text-xs text-gray-500">
            현재 좌석 {totalSeatCount}개 / 학생 {students.length}명
          </span>
        </div>
      </section>

      {/* 2. 좌석 배치도 (수동 수정) */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-800">2. 좌석 배치도 (수동 수정 가능)</h2>
          <button
            type="button"
            onClick={addGroup}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            + {layout.type === 'group' ? '모둠' : '분단'} 추가
          </button>
        </div>
        {layout.groups.length === 0 ? (
          <p className="text-xs text-gray-400">자동 생성 버튼을 눌러 좌석을 만들어 주세요.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {layout.groups.map((g) => (
              <div key={g.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800">{g.name}</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => addSeatToGroup(g.id)}
                      className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] text-gray-700 hover:bg-gray-50"
                    >
                      + 자리
                    </button>
                    <button
                      type="button"
                      onClick={() => removeGroup(g.id)}
                      className="rounded border border-red-200 bg-white px-2 py-0.5 text-[11px] text-red-600 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                <GroupGrid
                  group={g}
                  fixedMap={Object.fromEntries(rules.fixed.map((f) => [f.seat_id, f.student_id]))}
                  studentNameById={studentNameById}
                  onRemoveSeat={(sid) => removeSeat(g.id, sid)}
                  type={layout.type}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. 규칙: 지정 좌석 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-800">3-1. 지정 좌석 배정</h2>
        <p className="mb-3 text-xs text-gray-500">
          특정 좌석에 항상 들어가야 할 학생을 지정합니다. 비워두면 무작위.
        </p>
        {allSeats.length === 0 ? (
          <p className="text-xs text-gray-400">먼저 좌석을 생성해 주세요.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {allSeats.map(({ groupName, seat }) => {
              const current = rules.fixed.find((f) => f.seat_id === seat.id)?.student_id ?? ''
              return (
                <div key={seat.id} className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
                  <span className="w-20 shrink-0 text-xs text-gray-600">
                    {groupName} · R{seat.row}·C{seat.col}
                  </span>
                  <select
                    value={current}
                    onChange={(e) => setFixedSeat(seat.id, e.target.value)}
                    className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
                  >
                    <option value="">(미지정)</option>
                    {students.map((s) => {
                      const taken = fixedStudentIds.has(s.student_id) && current !== s.student_id
                      return (
                        <option key={s.student_id} value={s.student_id} disabled={taken}>
                          {s.student_id} {s.name}
                          {taken ? ' (다른 좌석 지정됨)' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              )
            })}
            {occupiedFixedSeats.size > 0 && (
              <p className="text-[11px] text-gray-500">지정 좌석 {occupiedFixedSeats.size}개</p>
            )}
          </div>
        )}
      </section>

      {/* 4. 규칙: 떨어져야 하는 친구 */}
      <RuleGroupEditor
        kind="apart"
        title="3-2. 떨어져야 하는 친구"
        description="같은 분단/모둠에 함께 있지 않도록 배치합니다. (학생 2명 이상 선택)"
        rules={rules.apart}
        students={students}
        onAdd={() => addRuleGroup('apart')}
        onRemove={(id) => removeRuleGroup('apart', id)}
        onToggle={(id, sid) => toggleStudentInRule('apart', id, sid)}
      />

      {/* 5. 규칙: 붙어야 하는 친구 */}
      <RuleGroupEditor
        kind="together"
        title="3-3. 붙어야 하는 친구"
        description="같은 분단/모둠에 함께 배치되도록 시도합니다. (학생 2명 이상 선택)"
        rules={rules.together}
        students={students}
        onAdd={() => addRuleGroup('together')}
        onRemove={(id) => removeRuleGroup('together', id)}
        onToggle={(id, sid) => toggleStudentInRule('together', id, sid)}
      />

      {/* 6. 액션 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveConfig}
            disabled={saving}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            기본 설정 저장
          </button>
          <button
            type="button"
            onClick={openDrawWindow}
            disabled={saving || layout.groups.length === 0}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            자리 뽑기 시작 (학생화면 새 창)
          </button>
          {saving && <span className="text-sm text-gray-500">저장 중…</span>}
          {savedAt && !saving && (
            <span className="text-xs text-gray-500">
              마지막 설정 저장: {new Date(savedAt).toLocaleString('ko-KR')}
            </span>
          )}
        </div>
      </section>

      {/* 7. 저장된 자리 배치 결과 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-800">저장된 자리 배치</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reloadLastAssignment}
              className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              새로고침
            </button>
            {lastAssignment?.saved_at && (
              <span className="text-xs text-gray-500">
                마지막 저장: {new Date(lastAssignment.saved_at).toLocaleString('ko-KR')}
              </span>
            )}
          </div>
        </div>
        {!lastAssignment?.layout || lastAssignment.assignments.length === 0 ? (
          <p className="text-xs text-gray-400">아직 저장된 자리 배치 결과가 없습니다.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lastAssignment.layout.groups.map((g) => (
              <div key={g.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-sm font-semibold text-gray-800">{g.name}</p>
                <SavedGroupGrid
                  group={g}
                  assignments={lastAssignment.assignments}
                  type={lastAssignment.layout!.type}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ===== 컴포넌트들 =====

function GroupGrid({
  group,
  fixedMap,
  studentNameById,
  onRemoveSeat,
  type,
}: {
  group: SeatingGroup
  fixedMap: Record<string, string>
  studentNameById: Record<string, string>
  onRemoveSeat: (seatId: string) => void
  type: SeatingType
}) {
  const colsPerRow = type === 'individual' ? 1 : 2
  const sorted = sortSeats(group.seats)
  // row 별로 묶기
  const rows = new Map<number, SeatingSeat[]>()
  sorted.forEach((s) => {
    if (!rows.has(s.row)) rows.set(s.row, [])
    rows.get(s.row)!.push(s)
  })
  const rowKeys = Array.from(rows.keys()).sort((a, b) => a - b)
  return (
    <div className="space-y-1">
      {rowKeys.map((r) => (
        <div
          key={r}
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${colsPerRow}, minmax(0, 1fr))` }}
        >
          {(rows.get(r) ?? []).map((seat) => {
            const fixed = fixedMap[seat.id]
            return (
              <div
                key={seat.id}
                className={cn(
                  'group relative flex h-10 items-center justify-center rounded-md border px-2 text-[11px]',
                  fixed
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-500'
                )}
              >
                {fixed ? studentNameById[fixed] || fixed : '랜덤'}
                <button
                  type="button"
                  onClick={() => onRemoveSeat(seat.id)}
                  className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white group-hover:flex"
                  title="자리 삭제"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function SavedGroupGrid({
  group,
  assignments,
  type,
}: {
  group: SeatingGroup
  assignments: SeatingAssignmentRow[]
  type: SeatingType
}) {
  const colsPerRow = type === 'individual' ? 1 : 2
  const byId = new Map(assignments.map((a) => [a.seat_id, a]))
  const sorted = sortSeats(group.seats)
  const rows = new Map<number, SeatingSeat[]>()
  sorted.forEach((s) => {
    if (!rows.has(s.row)) rows.set(s.row, [])
    rows.get(s.row)!.push(s)
  })
  const rowKeys = Array.from(rows.keys()).sort((a, b) => a - b)
  return (
    <div className="space-y-1">
      {rowKeys.map((r) => (
        <div
          key={r}
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${colsPerRow}, minmax(0, 1fr))` }}
        >
          {(rows.get(r) ?? []).map((seat) => {
            const a = byId.get(seat.id)
            return (
              <div
                key={seat.id}
                className={cn(
                  'flex h-10 items-center justify-center rounded-md border px-2 text-[11px]',
                  a
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-dashed border-gray-200 bg-white text-gray-300'
                )}
              >
                {a ? `${a.student_id} ${a.student_name}` : '(빈자리)'}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function RuleGroupEditor({
  kind,
  title,
  description,
  rules,
  students,
  onAdd,
  onRemove,
  onToggle,
}: {
  kind: 'apart' | 'together'
  title: string
  description: string
  rules: Array<{ id: string; student_ids: string[] }>
  students: Student[]
  onAdd: () => void
  onRemove: (id: string) => void
  onToggle: (id: string, studentId: string) => void
}) {
  const accent = kind === 'apart' ? 'rose' : 'indigo'
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        <button
          type="button"
          onClick={onAdd}
          className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          + 그룹 추가
        </button>
      </div>
      <p className="mb-3 text-xs text-gray-500">{description}</p>
      {rules.length === 0 ? (
        <p className="text-xs text-gray-400">아직 등록된 그룹이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, i) => (
            <div
              key={rule.id}
              className={cn(
                'rounded-lg border p-3',
                accent === 'rose' ? 'border-rose-100 bg-rose-50/40' : 'border-indigo-100 bg-indigo-50/40'
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p
                  className={cn(
                    'text-xs font-semibold',
                    accent === 'rose' ? 'text-rose-700' : 'text-indigo-700'
                  )}
                >
                  그룹 {i + 1} (선택 {rule.student_ids.length}명)
                </p>
                <button
                  type="button"
                  onClick={() => onRemove(rule.id)}
                  className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] text-gray-700 hover:bg-gray-50"
                >
                  그룹 삭제
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {students.map((s) => {
                  const selected = rule.student_ids.includes(s.student_id)
                  return (
                    <button
                      key={s.student_id}
                      type="button"
                      onClick={() => onToggle(rule.id, s.student_id)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                        selected
                          ? accent === 'rose'
                            ? 'border-rose-300 bg-rose-100 text-rose-700'
                            : 'border-indigo-300 bg-indigo-100 text-indigo-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      {s.student_id} {s.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function SeatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 19v-3a2 2 0 012-2h8a2 2 0 012 2v3" />
      <path d="M5 19h14" />
      <path d="M8 14V6a2 2 0 012-2h4a2 2 0 012 2v8" />
    </svg>
  )
}
