import { useEffect, useState, useCallback } from 'react'
import { getStudents, saveCleaningAssignment, getCleaningAssignment, getCleaningAssignmentCounts } from '@/api/api'
import type { Student } from '@/types'
import { cn } from '@/lib/utils'
import { StudentAssignmentCard } from '@/components/cleaning/StudentAssignmentCard'

type AssignStatus = 'in' | 'out'

interface Zone {
  id: string
  name: string
  capacity: number
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function BroomIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v11" />
      <path d="M12 13l-7 9" />
      <path d="M12 13l-3 9" />
      <path d="M12 13v9" />
      <path d="M12 13l3 9" />
      <path d="M12 13l7 9" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

export function CleaningZonesPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [assignStatus, setAssignStatus] = useState<Record<string, AssignStatus>>({})
  const [assignmentResult, setAssignmentResult] = useState<Record<string, Student[]>>({})
  const [cleaningCounts, setCleaningCounts] = useState<Record<string, number>>({})
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getStudents(), getCleaningAssignment(), getCleaningAssignmentCounts()])
      .then(([studentsRes, assignRes, countsRes]) => {
        if (studentsRes.success && studentsRes.data) {
          setStudents(studentsRes.data)
          setAssignStatus((prev) => {
            const next = { ...prev }
            studentsRes.data?.forEach((s) => {
              if (next[s.student_id] === undefined) next[s.student_id] = 'in'
            })
            return next
          })
        }
        if (countsRes.success && countsRes.data) {
          setCleaningCounts(countsRes.data)
        }
        if (assignRes.success && assignRes.data?.assignments && Object.keys(assignRes.data.assignments).length > 0) {
          const map: Record<string, Student[]> = {}
          Object.entries(assignRes.data.assignments).forEach(([zone, list]) => {
            map[zone] = list.map((s) => ({
              student_id: s.student_id,
              name: s.name,
              auth_code: '',
              phone_student: '',
              phone_parent: '',
              photo_data: undefined,
            }))
          })
          setAssignmentResult(map)
          setSavedAt(assignRes.data.saved_at ?? null)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const addZone = () => {
    setZones((prev) => [
      ...prev,
      { id: `zone-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: '', capacity: 1 },
    ])
  }

  const updateZone = (id: string, field: 'name' | 'capacity', value: string | number) => {
    setZones((prev) =>
      prev.map((z) =>
        z.id === id ? { ...z, [field]: field === 'capacity' ? Number(value) || 0 : value } : z
      )
    )
  }

  const removeZone = (id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id))
  }

  const setAllStatus = (status: AssignStatus) => {
    setAssignStatus((prev) => {
      const next = { ...prev }
      students.forEach((s) => {
        next[s.student_id] = status
      })
      return next
    })
  }

  const runRandomAssign = useCallback(() => {
    const validZones = zones.filter((z) => z.name.trim() && z.capacity > 0)
    if (validZones.length === 0) {
      alert('구역을 추가하고 구역명·인원을 입력해 주세요.')
      return
    }
    const pool = students.filter((s) => assignStatus[s.student_id] === 'in')
    if (pool.length === 0) {
      alert('배정 대상 학생을 한 명 이상 선택해 주세요.')
      return
    }
    const shuffled = shuffle(pool)
    const result: Record<string, Student[]> = {}
    let idx = 0
    validZones.forEach((z) => {
      result[z.name.trim()] = []
      for (let i = 0; i < z.capacity && idx < shuffled.length; i++) {
        result[z.name.trim()].push(shuffled[idx])
        idx++
      }
    })
    setAssignmentResult(result)
    setSaving(true)
    const toSave: Record<string, Array<{ student_id: string; name: string }>> = {}
    Object.entries(result).forEach(([zone, list]) => {
      toSave[zone] = list.map((s) => ({ student_id: s.student_id, name: s.name }))
    })
    saveCleaningAssignment(toSave)
      .then((res) => {
        if (res.success && res.data) {
          setSavedAt(res.data.saved_at)
          getCleaningAssignmentCounts().then((r) => r.success && r.data && setCleaningCounts(r.data))
        } else if (!res.success) alert(res.error || '저장에 실패했습니다.')
      })
      .finally(() => setSaving(false))
  }, [zones, students, assignStatus])

  const totalCapacity = zones.reduce((s, z) => s + (z.capacity > 0 ? z.capacity : 0), 0)
  const includedCount = students.filter((s) => assignStatus[s.student_id] === 'in').length

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
        <BroomIcon className="h-6 w-6 text-slate-600" />
        <h1 className="text-xl font-semibold text-gray-900">청소구역 관리</h1>
      </div>
      <p className="text-sm text-gray-600">
        청소구역과 구역별 인원을 입력한 뒤, 배정 대상·제외 학생을 선택하고 랜덤 배정하면 학생들이 구역별로 배정됩니다.
      </p>

      {/* 1. 청소구역 입력 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">청소구역 및 구역별 인원</h2>
        <div className="space-y-2">
          {zones.map((z) => (
            <div key={z.id} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={z.name}
                onChange={(e) => updateZone(z.id, 'name', e.target.value)}
                placeholder="구역명 (예: 1층 복도)"
                className="w-48 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <span className="text-sm text-gray-500">인원</span>
              <input
                type="number"
                min={1}
                value={z.capacity}
                onChange={(e) => updateZone(z.id, 'capacity', e.target.value)}
                className="w-20 rounded-md border border-gray-300 px-2 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeZone(z.id)}
                className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                title="구역 삭제"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addZone}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <PlusIcon className="h-4 w-4" />
          구역 추가
        </button>
        {zones.length > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            총 {totalCapacity}명 수용 · 배정 대상 {includedCount}명
          </p>
        )}
      </section>

      {/* 2. 학생 배정 대상 / 제외 선택 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-800">배정 대상·제외 선택</h2>
        <p className="mb-3 text-xs text-gray-500">
          배정 대상에 포함된 학생만 랜덤 배정됩니다. 청소 누적 횟수를 참고해 배정 제외할 학생을 선택하세요.
        </p>
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setAllStatus('in')}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            전체 배정 대상
          </button>
          <button
            type="button"
            onClick={() => setAllStatus('out')}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            전체 배정 제외
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto rounded border border-gray-200">
          <table className="w-full table-auto border-collapse text-sm">
            <thead className="sticky top-0 bg-gray-100">
              <tr className="border-b border-gray-200 text-left">
                <th className="p-2 font-medium text-gray-700">학번</th>
                <th className="p-2 font-medium text-gray-700">이름</th>
                <th className="w-24 p-2 font-medium text-gray-700">청소 누적</th>
                <th className="w-40 p-2 font-medium text-gray-700">구분</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const count = cleaningCounts[s.student_id] ?? 0
                return (
                  <tr key={s.student_id} className="border-b border-gray-100">
                    <td className="p-2 text-gray-600">{s.student_id}</td>
                    <td className="p-2 font-medium text-gray-900">{s.name}</td>
                    <td className="p-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
                          count >= 3 ? 'bg-amber-100 text-amber-800' : count >= 1 ? 'bg-gray-100 text-gray-700' : 'bg-gray-50 text-gray-500'
                        )}
                      >
                        {count}회
                      </span>
                    </td>
                    <td className="p-2">
                      <select
                        value={assignStatus[s.student_id] ?? 'in'}
                        onChange={(e) =>
                          setAssignStatus((prev) => ({
                            ...prev,
                            [s.student_id]: e.target.value as AssignStatus,
                          }))
                        }
                        className={cn(
                          'rounded border px-2 py-1 text-xs',
                          assignStatus[s.student_id] === 'in'
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-gray-50 text-gray-600'
                        )}
                      >
                        <option value="in">배정 대상</option>
                        <option value="out">배정 제외</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. 랜덤 배정 / 재배정 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runRandomAssign}
            disabled={saving}
            className="rounded-md bg-slate-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            랜덤 배정
          </button>
          <span className="text-xs text-gray-500">
            청소 누적 횟수: 위 표에서 확인 후 배정 제외로 조정 가능
          </span>
          <button
            type="button"
            onClick={runRandomAssign}
            disabled={saving}
            className="rounded-md border border-slate-600 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            재배정
          </button>
          {saving && <span className="text-sm text-gray-500">저장 중…</span>}
          {savedAt && !saving && (
            <span className="text-xs text-gray-500">
              마지막 저장: {new Date(savedAt).toLocaleString('ko-KR')}
            </span>
          )}
        </div>
      </section>

      {/* 4. 배정 결과 */}
      {Object.keys(assignmentResult).length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-800">배정 결과</h2>
            <div className="flex items-center gap-2">
              <a
                href={`${window.location.origin}/cleaning-result`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                결과만 보기
              </a>
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/cleaning-result`
                  navigator.clipboard.writeText(url).then(() => alert('링크가 복사되었습니다.'))
                }}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                링크 복사
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(assignmentResult).map(([zoneName, list]) => (
              <div
                key={zoneName}
                className="rounded-xl border border-gray-200 bg-gray-50 p-3"
              >
                <p className="mb-2 border-b border-gray-200 pb-2 font-medium text-gray-800">{zoneName}</p>
                <div className="flex flex-col gap-2">
                  {list.length === 0 ? (
                    <p className="text-xs text-gray-500">(배정 없음)</p>
                  ) : (
                    list.map((s) => {
                      const full = students.find((st) => st.student_id === s.student_id)
                      return (
                        <StudentAssignmentCard
                          key={s.student_id}
                          studentId={s.student_id}
                          name={s.name}
                          photoData={full?.photo_data}
                        />
                      )
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
