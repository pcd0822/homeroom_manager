import { useMemo, useState } from 'react'
import type { CalendarEvent, CalendarEventType, CounselingTimetable, Student } from '@/types'
import {
  saveCalendarEvent,
  deleteCalendarEvent,
  requestCounselingEvent,
  updateCounselingRequest,
  deleteCounselingRequest,
  requestParentCounselingEvent,
  updateParentCounselingRequest,
  deleteParentCounselingRequest,
  compareStudentIds,
} from '@/api/api'
import { formatDateLabel } from '@/lib/calendar'

/** 공유 캘린더에서 상담을 신청하는 사람 */
export interface CalendarRequester {
  /** 상담 대상 학번. 학생 모드면 본인, 학부모 모드면 선택한 자녀 */
  student_id: string
  /** 학생 모드 전용 개인코드 */
  auth_code?: string
  name?: string
  /** 사진 (학부모 모드에서 자녀 확인용) */
  photo_data?: string
  /** 기본값은 학생 본인 신청 */
  role?: 'student' | 'parent'
  /** 학부모 모드에서 기존 신청을 수정·취소할 때 제시하는 토큰 */
  request_token?: string
}

/** 저장 결과 — 학부모 신청이면 이후 수정·취소에 쓸 토큰이 함께 온다 */
export interface CalendarSaveResult {
  event_id?: string
  request_token?: string
  student_id?: string
}

interface CalendarEventModalProps {
  dateKey: string
  /** 편집 대상 (없으면 새로 추가) */
  existing?: CalendarEvent | null
  timetable: CounselingTimetable | null
  /**
   * 신청 모드. 값이 있으면 공유 캘린더에서 상담을 신청하는 화면이 된다.
   * (구분은 '상담' 고정, 대상 학생은 서버에서 지정, 대상 선택 UI 없음)
   * role이 'parent'면 로그인 없이 자녀 이름으로 신청하는 학부모 모드.
   */
  requester?: CalendarRequester | null
  /** 상담 대상 선택용 학생 목록 (교사 화면 전용) */
  students?: Student[]
  onClose: () => void
  onSaved: (result?: CalendarSaveResult) => void
}

export function CalendarEventModal({
  dateKey,
  existing,
  timetable,
  students = [],
  requester,
  onClose,
  onSaved,
}: CalendarEventModalProps) {
  const periods = timetable?.periods || []
  const isRequest = !!requester
  const isParent = requester?.role === 'parent'
  const firstPeriod = periods[0]

  const [type, setType] = useState<CalendarEventType>(
    requester ? 'counseling' : existing?.type || 'class'
  )
  const [title, setTitle] = useState(existing?.title || '')
  const [location, setLocation] = useState(existing?.location || '')
  const [content, setContent] = useState(existing?.content || '')
  const [startTime, setStartTime] = useState(existing?.start_time || firstPeriod?.start_time || '09:00')
  const [endTime, setEndTime] = useState(existing?.end_time || firstPeriod?.end_time || '09:50')
  const [selectedIds, setSelectedIds] = useState<string[]>(existing?.student_ids || [])
  const [studentQuery, setStudentQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => compareStudentIds(a.student_id, b.student_id)),
    [students]
  )
  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase()
    if (!q) return sortedStudents
    return sortedStudents.filter(
      (s) => s.student_id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    )
  }, [sortedStudents, studentQuery])

  const studentsById = useMemo(() => {
    const m: Record<string, Student> = {}
    for (const s of students) m[s.student_id] = s
    return m
  }, [students])

  /** 교시 선택 시 시작/종료 시간 자동 채움 */
  const applyPeriod = (periodId: string) => {
    const p = periods.find((x) => x.id === periodId)
    if (!p) return
    setStartTime(p.start_time)
    setEndTime(p.end_time)
  }

  const toggleStudent = (id: string) => {
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  const handleSave = async () => {
    setError('')
    if (!startTime) {
      setError('시작 시간을 입력해 주세요.')
      return
    }
    if (!isRequest && type === 'counseling' && selectedIds.length === 0) {
      setError('상담 대상 학생을 1명 이상 선택해 주세요.')
      return
    }
    setSaving(true)
    if (requester) {
      // 신청 모드: 상담 대상은 서버에서 정해지고, 겹치는 일정이 있으면 거절된다.
      const slot = {
        date: dateKey,
        title: title.trim() || '상담',
        start_time: startTime,
        end_time: endTime || startTime,
        location: location.trim(),
        content: content.trim(),
      }
      if (isParent) {
        // 학부모: 로그인이 없으므로 신청 때 받은 토큰으로 본인 확인한다.
        const parentRes = existing
          ? await updateParentCounselingRequest({
              ...slot,
              event_id: existing.event_id,
              request_token: requester.request_token || '',
            })
          : await requestParentCounselingEvent({ ...slot, child_student_id: requester.student_id })
        setSaving(false)
        if (parentRes.success) onSaved(parentRes.data as CalendarSaveResult)
        else setError(parentRes.error || (existing ? '수정에 실패했습니다.' : '신청에 실패했습니다.'))
        return
      }
      const payload = {
        ...slot,
        student_id: requester.student_id,
        auth_code: requester.auth_code || '',
      }
      const reqRes = existing
        ? await updateCounselingRequest({ ...payload, event_id: existing.event_id })
        : await requestCounselingEvent(payload)
      setSaving(false)
      if (reqRes.success) onSaved()
      else setError(reqRes.error || (existing ? '수정에 실패했습니다.' : '신청에 실패했습니다.'))
      return
    }
    const res = await saveCalendarEvent({
      event_id: existing?.event_id,
      date: dateKey,
      type,
      title: title.trim() || (type === 'class' ? '수업' : '상담'),
      start_time: startTime,
      end_time: endTime || startTime,
      location: location.trim(),
      content: content.trim(),
      student_ids: type === 'counseling' ? selectedIds : [],
    })
    setSaving(false)
    if (res.success) {
      onSaved()
    } else {
      setError(res.error || '저장에 실패했습니다.')
    }
  }

  const handleDelete = async () => {
    if (!existing) return
    if (!confirm(isRequest ? '이 상담 신청을 취소할까요?' : '이 일정을 삭제할까요?')) return
    setDeleting(true)
    const res = isParent
      ? await deleteParentCounselingRequest({
          event_id: existing.event_id,
          request_token: requester?.request_token || '',
        })
      : requester
        ? await deleteCounselingRequest({
            student_id: requester.student_id,
            auth_code: requester.auth_code || '',
            event_id: existing.event_id,
          })
        : await deleteCalendarEvent(existing.event_id)
    setDeleting(false)
    if (res.success) {
      onSaved()
    } else {
      setError(res.error || '삭제에 실패했습니다.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isRequest
                ? existing
                  ? '상담 신청 수정'
                  : '상담 신청'
                : existing
                  ? '일정 수정'
                  : '일정 추가'}
            </h2>
            <p className="text-xs text-gray-500">{formatDateLabel(dateKey)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 구분 토글 (학생 신청 모드에서는 '상담' 고정) */}
        {!isRequest && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          {(['class', 'counseling'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                type === t
                  ? t === 'class'
                    ? 'border-sky-500 bg-sky-50 text-sky-700'
                    : 'border-rose-500 bg-rose-50 text-rose-700'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t === 'class' ? '🏫 수업시간' : '🗣️ 상담'}
            </button>
          ))}
        </div>
        )}

        {isRequest && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border-2 border-rose-100 bg-rose-50/70 px-3 py-2.5 text-xs leading-relaxed text-rose-700">
            {isParent ? (
              <>
                <StudentAvatar
                  student={{
                    student_id: requester?.student_id || '',
                    name: requester?.name || '',
                    auth_code: '',
                    photo_data: requester?.photo_data,
                  }}
                  fallbackId={requester?.student_id || ''}
                  size="md"
                />
                <span>
                  👪 <b>{requester?.name || requester?.student_id}</b>({requester?.student_id}) 학생의{' '}
                  <b>학부모</b> 상담 신청이에요. 선생님께는 <b>학부모 신청</b>으로 표시됩니다.
                </span>
              </>
            ) : (
              <span>
                🙋 <b>{requester?.name || requester?.student_id}</b> 님의 상담 신청이에요. 상담 대상은
                본인으로 자동 지정됩니다.
              </span>
            )}
          </div>
        )}

        <div className="space-y-4">
          {/* 교시 빠른 선택 */}
          {periods.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">교시 빠른 선택</label>
              <div className="flex flex-wrap gap-1.5">
                {periods.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPeriod(p.id)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      startTime === p.start_time && endTime === p.end_time
                        ? 'border-sky-400 bg-sky-50 text-sky-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                    title={`${p.start_time}~${p.end_time}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                교시를 누르면 시간이 채워져요. 여러 시간에 걸친 상담은 종료 시간을 직접 늘려 주세요.
              </p>
            </div>
          )}

          {/* 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">시작 시간</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">종료 시간</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              {type === 'class' ? '수업/과목명' : '상담 제목 (선택)'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === 'class' ? '예: 국어, 자습, 종례' : '예: 진로 상담'}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>

          {/* 장소 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">장소</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 3학년 2반 교실, 상담실"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>

          {/* 상담 전용: 대상 학생 + 내용 */}
          {type === 'counseling' && (
            <>
              {!isRequest && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  대상 학생 {selectedIds.length > 0 && `(${selectedIds.length}명)`}
                </label>
                {selectedIds.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {selectedIds.map((id) => {
                      const s = studentsById[id]
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 rounded-full bg-rose-50 py-0.5 pl-0.5 pr-2 text-xs text-rose-700"
                        >
                          <StudentAvatar student={s} fallbackId={id} size="sm" />
                          {s?.name || id}
                          <button
                            type="button"
                            onClick={() => toggleStudent(id)}
                            className="text-rose-400 hover:text-rose-600"
                            aria-label="제거"
                          >
                            ✕
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}
                <input
                  type="text"
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder="학번 또는 이름 검색"
                  className="mb-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100">
                  {filteredStudents.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-gray-400">학생이 없습니다.</p>
                  ) : (
                    filteredStudents.map((s) => {
                      const selected = selectedIds.includes(s.student_id)
                      return (
                        <button
                          key={s.student_id}
                          type="button"
                          onClick={() => toggleStudent(s.student_id)}
                          className={`flex w-full items-center gap-2 border-b border-gray-50 px-3 py-2 text-left last:border-b-0 ${
                            selected ? 'bg-rose-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <StudentAvatar student={s} fallbackId={s.student_id} size="md" />
                          <span className="w-12 shrink-0 text-xs font-semibold text-gray-500">
                            {s.student_id}
                          </span>
                          <span className="flex-1 text-sm text-gray-800">{s.name}</span>
                          {selected && <span className="text-rose-500">✓</span>}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">상담 내용</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={3}
                  placeholder="상담 목적이나 메모를 간단히 적어 주세요."
                  className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* 하단 버튼 */}
        <div className="mt-5 flex items-center gap-2">
          {existing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="rounded-xl border border-red-200 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? (isRequest ? '취소 중...' : '삭제 중...') : isRequest ? '신청 취소' : '삭제'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || deleting}
            className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
          >
            {saving
              ? isRequest
                ? '보내는 중...'
                : '저장 중...'
              : isRequest
                ? existing
                  ? '수정하기'
                  : '신청하기'
                : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StudentAvatar({
  student,
  fallbackId,
  size,
}: {
  student?: Student
  fallbackId: string
  size: 'sm' | 'md'
}) {
  const cls = size === 'sm' ? 'h-5 w-5' : 'h-8 w-8'
  // 사진 값이 data: URI가 아니면 base64로 간주해 접두사를 붙인다(다른 화면과 동일 규칙).
  const photo = student?.photo_data
  if (photo) {
    const src = photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`
    return <img src={src} alt="" className={`${cls} rounded-full object-cover`} />
  }
  return (
    <span
      className={`${cls} flex items-center justify-center rounded-full bg-gray-300 text-[10px] font-semibold text-white`}
    >
      {(student?.name || fallbackId).slice(0, 1)}
    </span>
  )
}
