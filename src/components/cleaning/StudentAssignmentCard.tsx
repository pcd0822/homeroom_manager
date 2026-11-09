interface StudentAssignmentCardProps {
  studentId: string
  name: string
  photoData?: string | null
}

export function StudentAssignmentCard({ studentId, name, photoData }: StudentAssignmentCardProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface p-2">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-raised">
        {photoData ? (
          <img
            src={photoData.startsWith('data:') ? photoData : `data:image/jpeg;base64,${photoData}`}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted">
            {name.charAt(0) || '?'}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-strong">{name}</p>
        <p className="text-xs tabular-nums text-muted">{studentId}</p>
      </div>
    </div>
  )
}
