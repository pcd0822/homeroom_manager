import { useEffect, useMemo, useState } from 'react'
import { getStudents, getNightStudyConfig, saveNightStudyConfig } from '@/api/api'
import type {
  NightStudyConfig,
  NightStudyExcludedDate,
  NightStudyGroup,
  NightStudyTimetableRow,
  NightStudyParticipant,
  Student,
  NightExcludedType,
} from '@/types'
import { StudentAssignmentCard } from '@/components/cleaning/StudentAssignmentCard'

function createEmptyConfig(): NightStudyConfig {
  return {
    periodStart: '',
    periodEnd: '',
    excluded: [],
    groups: [],
    timetable: [],
    participants: [],
    updatedAt: '',
  }
}

let rowIdCounter = 1
let groupIdCounter = 1

export function NightStudyPage() {
  const [config, setConfig] = useState<NightStudyConfig>(createEmptyConfig)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [excludedDate, setExcludedDate] = useState('')
  const [excludedReason, setExcludedReason] = useState('')
  const [excludedType, setExcludedType] = useState<NightExcludedType>('off')

  const [groupName, setGroupName] = useState('')

  const [search, setSearch] = useState('')

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([getNightStudyConfig(), getStudents()])
      .then(([cfgRes, stuRes]) => {
        if (cfgRes.success && cfgRes.data) {
          setConfig(cfgRes.data)
          // id 카운터가 겹치지 않도록 현재 최대값 이후로 증가
          cfgRes.data.timetable.forEach((r) => {
            const n = parseInt(String(r.id).replace(/\D/g, '') || '0', 10)
            if (n >= rowIdCounter) rowIdCounter = n + 1
          })
          cfgRes.data.groups.forEach((g) => {
            const n = parseInt(String(g.id).replace(/\D/g, '') || '0', 10)
            if (n >= groupIdCounter) groupIdCounter = n + 1
          })
        }
        if (stuRes.success && stuRes.data) {
          setStudents(stuRes.data)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const assignedIds = useMemo(
    () => new Set(config.participants.map((p) => p.student_id)),
    [config.participants]
  )

  const visibleStudents = useMemo(() => {
    const s = search.trim()
    if (!s) return students
    return students.filter(
      (stu) =>
        stu.student_id.includes(s) ||
        (stu.name && stu.name.includes(s))
    )
  }, [students, search])

  const handleAddExcluded = () => {
    const d = excludedDate.trim()
    if (!d) return
    const next: NightStudyExcludedDate = {
      date: d,
      reason: excludedReason.trim(),
      type: excludedType,
    }
    setConfig((prev) => ({
      ...prev,
      excluded: [...prev.excluded.filter((e) => e.date !== d), next],
    }))
    setExcludedDate('')
    setExcludedReason('')
  }

  const handleRemoveExcluded = (date: string) => {
    setConfig((prev) => ({
      ...prev,
      excluded: prev.excluded.filter((e) => e.date !== date),
    }))
  }

  const handleAddGroup = () => {
    const name = groupName.trim()
    if (!name) return
    const group: NightStudyGroup = {
      id: `G${groupIdCounter++}`,
      name,
    }
    setConfig((prev) => ({
      ...prev,
      groups: [...prev.groups, group],
    }))
    setGroupName('')
  }

  const handleRemoveGroup = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g.id !== id),
      participants: prev.participants.map((p) =>
        p.group_id === id ? { ...p, group_id: null } : p
      ),
    }))
  }

  const handleToggleAssignAll = () => {
    const allIds = students.map((s) => s.student_id)
    const current = new Set(config.participants.map((p) => p.student_id))
    const allAssigned = allIds.every((id) => current.has(id))
    if (allAssigned) {
      setConfig((prev) => ({
        ...prev,
        participants: [],
      }))
    } else {
      const baseGroup = config.groups[0] || null
      const list: NightStudyParticipant[] = allIds.map((id) => ({
        student_id: id,
        group_id: baseGroup ? baseGroup.id : null,
      }))
      setConfig((prev) => ({
        ...prev,
        participants: list,
      }))
    }
  }

  const handleToggleParticipant = (stu: Student) => {
    setConfig((prev) => {
      const exists = prev.participants.find((p) => p.student_id === stu.student_id)
      if (exists) {
        return {
          ...prev,
          participants: prev.participants.filter((p) => p.student_id !== stu.student_id),
        }
      }
      const baseGroup = prev.groups[0] || null
      const next: NightStudyParticipant = {
        student_id: stu.student_id,
        group_id: baseGroup ? baseGroup.id : null,
      }
      return {
        ...prev,
        participants: [...prev.participants, next],
      }
    })
  }

  const handleChangeParticipantGroup = (studentId: string, groupId: string | null) => {
    setConfig((prev) => ({
      ...prev,
      participants: prev.participants.map((p) =>
        p.student_id === studentId ? { ...p, group_id: groupId } : p
      ),
    }))
  }

  const handleAddRow = () => {
    const row: NightStudyTimetableRow = {
      id: `R${rowIdCounter++}`,
      mon: '',
      tue: '',
      wed: '',
      thu: '',
      fri: '',
      holiday: '',
    }
    setConfig((prev) => ({
      ...prev,
      timetable: [...prev.timetable, row],
    }))
  }

  const handleChangeRow = (id: string, field: keyof Omit<NightStudyTimetableRow, 'id'>, value: string) => {
    setConfig((prev) => ({
      ...prev,
      timetable: prev.timetable.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    }))
  }

  const handleRemoveRow = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      timetable: prev.timetable.filter((r) => r.id !== id),
    }))
  }

  const handleSave = async () => {
    if (!config.periodStart || !config.periodEnd) return
    setSaving(true)
    const payload: NightStudyConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
    }
    const res = await saveNightStudyConfig(payload)
    setSaving(false)
    if (res.success) {
      alert('야간 자율학습 설정이 저장되었습니다.')
    } else if (res.error) {
      alert(res.error)
    }
  }

  const periodInvalid =
    !!config.periodStart &&
    !!config.periodEnd &&
    config.periodStart > config.periodEnd

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-gray-900">야간 자율학습 관리</h1>

      {loading && <p className="text-sm text-gray-500">불러오는 중...</p>}

      {/* 1) 운영 기간 설정 */}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">1. 운영 기간 설정</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-gray-600">시작일</span>
            <input
              type="date"
              value={config.periodStart}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, periodStart: e.target.value }))
              }
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <span className="text-gray-500">~</span>
          <label className="flex items-center gap-2">
            <span className="text-gray-600">종료일</span>
            <input
              type="date"
              value={config.periodEnd}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, periodEnd: e.target.value }))
              }
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          {periodInvalid && (
            <p className="text-xs text-red-600">시작일이 종료일보다 늦을 수 없습니다.</p>
          )}
        </div>
      </section>

      {/* 2) 제외 날짜 및 공휴일 */}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">
          2. 야간 자율학습 제외 날짜 / 공휴일 설정
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input
            type="date"
            value={excludedDate}
            onChange={(e) => setExcludedDate(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <select
            value={excludedType}
            onChange={(e) => setExcludedType(e.target.value as NightExcludedType)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="off">야자 제외 (운영 안함)</option>
            <option value="holiday">공휴일 시간표로 운영</option>
          </select>
          <input
            type="text"
            placeholder="비고 (예: 학교 행사, 공휴일명 등)"
            value={excludedReason}
            onChange={(e) => setExcludedReason(e.target.value)}
            className="min-w-[200px] flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={handleAddExcluded}
            className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
          >
            날짜 추가
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-1 text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-2 py-1">날짜</th>
                <th className="px-2 py-1">유형</th>
                <th className="px-2 py-1">비고</th>
                <th className="px-2 py-1 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {config.excluded.map((e) => (
                <tr key={e.date} className="rounded bg-gray-50">
                  <td className="px-2 py-1">{e.date}</td>
                  <td className="px-2 py-1">
                    {e.type === 'off' ? '야자 제외' : '공휴일 시간표'}
                  </td>
                  <td className="px-2 py-1">{e.reason}</td>
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveExcluded(e.date)}
                      className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-red-50 hover:text-red-600"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {config.excluded.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-2 text-center text-gray-400">
                    설정된 제외 날짜가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3) 분반 설정 */}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">3. 야간 자율학습 분반 설정</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input
            type="text"
            placeholder="분반 이름 (예: 1반, 2반)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="min-w-[160px] rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={handleAddGroup}
            className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
          >
            분반 추가
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {config.groups.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-blue-700"
            >
              <span>{g.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveGroup(g.id)}
                className="ml-1 text-blue-500 hover:text-blue-700"
              >
                ×
              </button>
            </div>
          ))}
          {config.groups.length === 0 && (
            <p className="text-xs text-gray-400">등록된 분반이 없습니다.</p>
          )}
        </div>
      </section>

      {/* 4) 참가자 배정 */}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">4. 야간 자율학습 참가자 배정</h2>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={handleToggleAssignAll}
            className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700"
          >
            전체 학생 {assignedIds.size === students.length ? '해제' : '배정'}
          </button>
          <input
            type="text"
            placeholder="학번 또는 이름 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[200px] flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {visibleStudents.map((stu) => {
            const assigned = assignedIds.has(stu.student_id)
            const participant = config.participants.find((p) => p.student_id === stu.student_id)
            return (
              <div
                key={stu.student_id}
                className={`relative cursor-pointer rounded-lg border p-2 transition ${
                  assigned ? 'border-blue-400 bg-blue-50/40' : 'border-gray-200 bg-white'
                }`}
                onClick={() => handleToggleParticipant(stu)}
              >
                {assigned && (
                  <span className="absolute right-2 top-2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                    배정 완료
                  </span>
                )}
                <div className="pointer-events-none">
                  <StudentAssignmentCard
                    studentId={stu.student_id}
                    name={stu.name}
                    photoData={stu.photo_data}
                  />
                </div>
                {assigned && (
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <select
                      value={participant?.group_id || ''}
                      onChange={(e) =>
                        handleChangeParticipantGroup(
                          stu.student_id,
                          e.target.value || null
                        )
                      }
                      className="rounded border border-gray-300 px-2 py-0.5 text-[11px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">분반 선택 안 함</option>
                      {config.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedStudent(stu)
                      }}
                      className="text-[11px] text-blue-600 hover:underline"
                    >
                      시간표 보기
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          {visibleStudents.length === 0 && (
            <p className="text-xs text-gray-400">검색 결과가 없습니다.</p>
          )}
        </div>
      </section>

      {/* 5) 야자 시간표 입력 */}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">5. 야자 시간표 입력</h2>
        <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
          <p>월~금, 공휴일 기준 시간대를 입력해 주세요. (예: 18:30~20:00)</p>
          <button
            type="button"
            onClick={handleAddRow}
            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            행 추가
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-1 text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-2 py-1">월</th>
                <th className="px-2 py-1">화</th>
                <th className="px-2 py-1">수</th>
                <th className="px-2 py-1">목</th>
                <th className="px-2 py-1">금</th>
                <th className="px-2 py-1">공휴일</th>
                <th className="px-2 py-1 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {config.timetable.map((row) => (
                <tr key={row.id} className="rounded bg-gray-50">
                  {(['mon', 'tue', 'wed', 'thu', 'fri', 'holiday'] as const).map((f) => (
                    <td key={f} className="px-2 py-1">
                      <input
                        type="text"
                        value={row[f]}
                        onChange={(e) => handleChangeRow(row.id, f, e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                        placeholder="-"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-red-50 hover:text-red-600"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {config.timetable.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-2 text-center text-gray-400">
                    추가된 시간대가 없습니다. 상단의 &quot;행 추가&quot; 버튼을 눌러 등록해 주세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6) 배정하기 / 저장 */}
      <section className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || periodInvalid}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? '저장 중...' : '배정하기 / 설정 저장'}
        </button>
      </section>

      {/* 참가자 시간표 모달 (주간 기준) */}
      {selectedStudent && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                {selectedStudent.name} ({selectedStudent.student_id}) 야자 시간표
              </h3>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                닫기
              </button>
            </div>
            <div className="mb-3">
              <p className="text-xs text-gray-600">
                분반:{' '}
                {(() => {
                  const p = config.participants.find(
                    (x) => x.student_id === selectedStudent.student_id
                  )
                  if (!p || !p.group_id) return '선택 안 됨'
                  const g = config.groups.find((gg) => gg.id === p.group_id)
                  return g?.name || '선택 안 됨'
                })()}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="border px-2 py-1">요일</th>
                    <th className="border px-2 py-1">시간대</th>
                  </tr>
                </thead>
                <tbody>
                  {(['mon', 'tue', 'wed', 'thu', 'fri', 'holiday'] as const).map((f) => {
                    const label =
                      f === 'mon'
                        ? '월'
                        : f === 'tue'
                        ? '화'
                        : f === 'wed'
                        ? '수'
                        : f === 'thu'
                        ? '목'
                        : f === 'fri'
                        ? '금'
                        : '공휴일'
                    const slots = config.timetable
                      .map((r) => r[f])
                      .filter((v) => v && v.trim().length > 0)
                    return (
                      <tr key={f}>
                        <td className="border px-2 py-1 text-center">{label}</td>
                        <td className="border px-2 py-1">
                          {slots.length > 0 ? (
                            <ul className="list-disc pl-4">
                              {slots.map((s, idx) => (
                                <li key={idx}>{s}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

