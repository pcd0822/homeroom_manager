import { useEffect, useState } from 'react'
import { getStudents, getCleaningAssignment } from '@/api/api'
import type { Student } from '@/types'
import { StudentAssignmentCard } from '@/components/cleaning/StudentAssignmentCard'

type AssignmentMap = Record<string, Array<{ student_id: string; name: string }>>

export function CleaningResultPage() {
  const [assignments, setAssignments] = useState<AssignmentMap>({})
  const [studentMap, setStudentMap] = useState<Record<string, Student>>({})
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getStudents(), getCleaningAssignment()])
      .then(([studentsRes, assignRes]) => {
        if (studentsRes.success && studentsRes.data) {
          const map: Record<string, Student> = {}
          studentsRes.data.forEach((s) => {
            map[s.student_id] = s
          })
          setStudentMap(map)
        }
        if (assignRes.success && assignRes.data?.assignments && Object.keys(assignRes.data.assignments).length > 0) {
          setAssignments(assignRes.data.assignments)
          setSavedAt(assignRes.data.saved_at ?? null)
        } else {
          setAssignments({})
        }
      })
      .catch((err) => setError(err?.message || '데이터를 불러올 수 없습니다.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">불러오는 중…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  const hasResult = Object.keys(assignments).length > 0

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-2 text-xl font-semibold text-gray-800">청소구역 배정 결과</h1>
        {savedAt && (
          <p className="mb-6 text-sm text-gray-500">
            배정 일시: {new Date(savedAt).toLocaleString('ko-KR')}
          </p>
        )}
        {!hasResult ? (
          <p className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
            저장된 배정 결과가 없습니다.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(assignments).map(([zoneName, list]) => (
              <div
                key={zoneName}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <h2 className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">
                  {zoneName}
                </h2>
                <div className="flex flex-col gap-2">
                  {list.length === 0 ? (
                    <p className="text-xs text-gray-400">(배정 없음)</p>
                  ) : (
                    list.map((s) => (
                      <StudentAssignmentCard
                        key={s.student_id}
                        studentId={s.student_id}
                        name={s.name}
                        photoData={studentMap[s.student_id]?.photo_data}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
