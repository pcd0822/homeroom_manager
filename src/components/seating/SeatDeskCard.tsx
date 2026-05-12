import { cn } from '@/lib/utils'

interface DeskStudent {
  student_id: string
  name: string
  photo_data?: string
}

/**
 * 책상 모양 카드. 윗면(아이덴티티)과 책상다리 두 개로 구성.
 * variant
 * - reveal: 학생 공유창(컬러풀)
 * - admin: 관리자 저장 결과(더 차분)
 */
export function SeatDeskCard({
  student,
  variant = 'reveal',
}: {
  student?: DeskStudent | null
  variant?: 'reveal' | 'admin'
}) {
  const empty = !student

  const topClass = empty
    ? 'border-dashed border-gray-300 bg-white'
    : variant === 'reveal'
      ? 'border-amber-200 bg-gradient-to-b from-amber-50 to-amber-100'
      : 'border-amber-200 bg-amber-50'

  const accentClass = empty
    ? 'bg-gray-200'
    : variant === 'reveal'
      ? 'bg-amber-300/80'
      : 'bg-amber-300/70'

  const legClass = empty ? 'bg-gray-300' : 'bg-amber-400'

  return (
    <div className="flex w-full flex-col items-center">
      {/* 책상 윗판 */}
      <div
        className={cn(
          'relative w-full rounded-xl border px-2 py-2 shadow-sm',
          topClass
        )}
      >
        {/* 책상 앞 모서리 강조 라인 */}
        <div className={cn('absolute inset-x-2 -top-1 h-1.5 rounded-t', accentClass)} />
        {empty ? (
          <div className="flex h-12 items-center justify-center">
            <span className="text-[10px] text-gray-400">빈자리</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {student!.photo_data ? (
              <img
                src={student!.photo_data}
                alt={student!.name}
                className="h-10 w-10 shrink-0 rounded-full border-2 border-white object-cover shadow"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white bg-white text-[11px] font-semibold text-gray-500 shadow">
                {student!.name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[10px] text-amber-700/80">{student!.student_id}</p>
              <p className="truncate text-xs font-semibold text-gray-800">{student!.name}</p>
            </div>
          </div>
        )}
      </div>
      {/* 책상 다리 */}
      <div className="flex w-full justify-between px-2.5">
        <div className={cn('h-2.5 w-1.5 rounded-b', legClass)} />
        <div className={cn('h-2.5 w-1.5 rounded-b', legClass)} />
      </div>
    </div>
  )
}

/** 교탁 표시 — 분단 그리드 위쪽에 가운데 정렬로 배치 */
export function TeacherDeskBanner({
  className,
  variant = 'reveal',
}: {
  className?: string
  variant?: 'reveal' | 'admin'
}) {
  const bg =
    variant === 'reveal'
      ? 'bg-gradient-to-b from-slate-100 to-slate-200 border-slate-300'
      : 'bg-slate-100 border-slate-300'
  return (
    <div className={cn('mx-auto w-full max-w-md', className)}>
      <div className="flex flex-col items-center">
        <div className={cn('w-full rounded-xl border px-4 py-3 text-center shadow-inner', bg)}>
          <p className="text-sm font-semibold tracking-wide text-slate-700">📋 교탁</p>
        </div>
        <div className="flex w-1/2 justify-between px-4">
          <div className="h-2.5 w-1.5 rounded-b bg-slate-400" />
          <div className="h-2.5 w-1.5 rounded-b bg-slate-400" />
        </div>
      </div>
    </div>
  )
}
