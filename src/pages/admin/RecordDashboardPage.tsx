import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getStudents, ensureRecordSheet } from '@/api/api'
import type { Student } from '@/types'
import { cn } from '@/lib/utils'

function ChartBarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

export function RecordDashboardPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    ensureRecordSheet().then((res) => {
      if (!res.success) setError(res.error || 'record 시트 초기화 실패')
    })
    getStudents()
      .then((res) => {
        if (res.success && res.data) setStudents(res.data)
        else setError(res.error || '학생 목록을 불러올 수 없습니다.')
      })
      .finally(() => setLoading(false))
  }, [])

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
        <ChartBarIcon className="h-6 w-6 text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">생기부 분석 대시보드</h1>
      </div>
      <p className="text-sm text-gray-600">
        학생을 선택하면 해당 학생의 생활기록부 기록을 시트 데이터와 매칭하여 대시보드로 볼 수 있습니다.
      </p>
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {students.map((s) => (
          <Link
            key={s.student_id}
            to={`/admin/record-dashboard/${encodeURIComponent(s.student_id)}`}
            className={cn(
              'flex flex-col items-center rounded-xl border border-gray-200 bg-white p-4 shadow-sm',
              'transition hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            )}
          >
            <div className="mb-2 h-20 w-20 overflow-hidden rounded-full border-2 border-gray-200 bg-gray-100">
              {s.photo_data ? (
                <img
                  src={s.photo_data}
                  alt={s.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-medium text-gray-400">
                  {s.name.charAt(0)}
                </div>
              )}
            </div>
            <span className="text-xs font-medium text-gray-500">{s.student_id}</span>
            <span className="mt-0.5 text-sm font-semibold text-gray-900">{s.name}</span>
          </Link>
        ))}
      </div>
      {students.length === 0 && !loading && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center text-gray-600">
          등록된 학생이 없습니다. 학생관리에서 먼저 학생을 등록해 주세요.
        </div>
      )}
    </div>
  )
}
