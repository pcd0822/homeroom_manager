import { useMemo, useState } from 'react'
import { Check, Hand, MessagesSquare, Repeat, School, Users, X } from 'lucide-react'
import type { CalendarEvent, CalendarEventType, CalendarRepeat, CounselingTimetable, Student } from '@/types'
import {
  saveCalendarEvent,
  deleteCalendarEvent,
  saveCalendarEventSeries,
  deleteCalendarEventSeries,
  requestCounselingEvent,
  updateCounselingRequest,
  deleteCounselingRequest,
  requestParentCounselingEvent,
  updateParentCounselingRequest,
  deleteParentCounselingRequest,
  compareStudentIds,
} from '@/api/api'
import { REPEAT_MAX, WEEKDAY_LABELS, formatDateLabel, parseDateKey, repeatDates, toDateKey } from '@/lib/calendar'

const REPEAT_LABEL: Record<CalendarRepeat, string> = { daily: '매일', weekly: '매주', monthly: '매월' }

/** 반복 종료일 기본값: 시작일로부터 3개월 뒤 */
function defaultUntil(dateKey: string): string {
  const d = parseDateKey(dateKey)
  return toDateKey(new Date(d.getFullYear(), d.getMonth() + 3, d.getDate()))
}

/** "11월 16일" */
function shortKo(key: string): string {
  const d = parseDateKey(key)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

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
  // 반복은 교사가 새 일정을 만들 때만 고른다
  const canRepeat = !isRequest && !existing
  const [repeat, setRepeat] = useState<'none' | CalendarRepeat>('none')
  const [until, setUntil] = useState(() => defaultUntil(dateKey))
  const [skipWeekends, setSkipWeekends] = useState(true)
  const [askSeriesDelete, setAskSeriesDelete] = useState(false)
  const isSeries = !isRequest && !!existing?.series_id

  const seriesDates = useMemo(
    () => (canRepeat && repeat !== 'none' ? repeatDates(dateKey, repeat, until, skipWeekends) : []),
    [canRepeat, repeat, dateKey, until, skipWeekends]
  )
  const repeatSummary = useMemo(() => {
    if (repeat === 'none') return ''
    if (until < dateKey) return '종료일을 시작일 이후로 골라 주세요'
    if (seriesDates.length === 0) return '반복할 날짜가 없습니다'
    const d = parseDateKey(dateKey)
    const rule =
      repeat === 'daily'
        ? `매일${skipWeekends ? '(주말 제외)' : ''}`
        : repeat === 'weekly'
          ? `매주 ${WEEKDAY_LABELS[d.getDay()]}요일`
          : `매월 ${d.getDate()}일`
    const last = seriesDates[seriesDates.length - 1]
    const capped = seriesDates.length >= REPEAT_MAX && last < until
    return `${shortKo(dateKey)}부터 ${rule}, ${seriesDates.length}회${
      capped ? ` (최대 ${REPEAT_MAX}회라 ${shortKo(last)}까지)` : ` (${shortKo(last)}까지)`
    }`
  }, [repeat, until, dateKey, seriesDates, skipWeekends])

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
    if (canRepeat && repeat !== 'none') {
      if (until < dateKey || seriesDates.length === 0) {
        setSaving(false)
        setError('반복 종료일을 시작일 이후로 골라 주세요.')
        return
      }
      const seriesRes = await saveCalendarEventSeries({
        date: dateKey,
        until,
        repeat,
        skip_weekends: skipWeekends,
        type,
        title: title.trim() || (type === 'class' ? '수업' : '상담'),
        start_time: startTime,
        end_time: endTime || startTime,
        location: location.trim(),
        content: content.trim(),
        student_ids: type === 'counseling' ? selectedIds : [],
      })
      setSaving(false)
      if (!seriesRes.success) {
        setError(seriesRes.error || '반복 일정 저장에 실패했습니다.')
        return
      }
      const skipped = seriesRes.data?.skipped || []
      if (skipped.length > 0) {
        alert(
          `반복 일정 ${seriesRes.data?.created ?? 0}회를 만들었습니다. 같은 시간에 일정이 있는 ${skipped.length}일은 건너뛰었습니다: ${skipped
            .map(shortKo)
            .join(', ')}`
        )
      }
      onSaved()
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

  /** 반복 일정: 이 회차만 또는 이 회차와 이후 모두 */
  const handleSeriesDelete = async (scope: 'one' | 'following') => {
    if (!existing) return
    setDeleting(true)
    const res =
      scope === 'one' ? await deleteCalendarEvent(existing.event_id) : await deleteCalendarEventSeries(existing.event_id)
    setDeleting(false)
    if (res.success) onSaved()
    else setError(res.error || '삭제에 실패했습니다.')
  }

  const handleDelete = async () => {
    if (!existing) return
    if (isSeries) {
      setAskSeriesDelete(true)
      return
    }
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
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-line bg-surface p-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-strong">
              {isRequest
                ? existing
                  ? '상담 신청 수정'
                  : '상담 신청'
                : existing
                  ? '일정 수정'
                  : '일정 추가'}
            </h2>
            <p className="text-xs tabular-nums text-muted">
              {formatDateLabel(dateKey)}
              {isSeries && existing?.repeat && (
                <span className="ml-2 inline-flex items-center gap-1 align-middle">
                  <Repeat className="h-3 w-3" aria-hidden />
                  반복 일정 · {REPEAT_LABEL[existing.repeat]}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
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
              aria-pressed={type === t}
              className={`btn h-10 ${
                type === t
                  ? 'border-accent bg-[color-mix(in_srgb,var(--accent)_8%,white)] text-accent-ink'
                  : 'border-line text-ink hover:bg-raised'
              }`}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {t === 'class' ? <School className="h-4 w-4" /> : <MessagesSquare className="h-4 w-4" />}
                {t === 'class' ? '수업시간' : '상담'}
              </span>
            </button>
          ))}
        </div>
        )}

        {isRequest && (
          <div className="mb-4 flex items-center gap-2 border-l-2 border-line py-1 pl-3 text-sm text-ink">
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
                  <Users className="mr-1 inline h-4 w-4 align-middle text-muted" />
                  <span className="font-medium text-ink-strong">{requester?.name || requester?.student_id}</span>(
                  {requester?.student_id}) 학생의 학부모 상담 신청입니다. 선생님께는 학부모 신청으로 표시됩니다.
                </span>
              </>
            ) : (
              <span>
                <Hand className="mr-1 inline h-4 w-4 align-middle text-muted" />
                <span className="font-medium text-ink-strong">{requester?.name || requester?.student_id}</span> 님의 상담
                신청입니다. 상담 대상은 본인으로 자동 지정됩니다.
              </span>
            )}
          </div>
        )}

        <div className="space-y-4">
          {/* 교시 빠른 선택 */}
          {periods.length > 0 && (
            <div>
              <label className="mb-2 block text-xs font-medium text-ink">교시 빠른 선택</label>
              <div className="flex flex-wrap gap-2">
                {periods.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPeriod(p.id)}
                    className={`btn btn-sm ${
                      startTime === p.start_time && endTime === p.end_time
                        ? 'border-accent bg-[color-mix(in_srgb,var(--accent)_8%,white)] text-accent-ink'
                        : 'btn-secondary'
                    }`}
                    title={`${p.start_time}~${p.end_time}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">
                교시를 누르면 시간이 채워집니다. 여러 교시에 걸친 상담은 종료 시간을 직접 늘려 주세요
              </p>
            </div>
          )}

          {/* 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-xs font-medium text-ink">시작 시간</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="field w-full"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-ink">종료 시간</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="field w-full"
              />
            </div>
          </div>

          {/* 반복 (교사의 새 일정만) */}
          {canRepeat && (
            <div>
              <label className="mb-2 block text-xs font-medium text-ink">반복</label>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value as 'none' | CalendarRepeat)}
                  className="field w-full"
                  aria-label="반복 단위"
                >
                  <option value="none">안 함</option>
                  <option value="daily">매일</option>
                  <option value="weekly">매주</option>
                  <option value="monthly">매월</option>
                </select>
                {repeat !== 'none' && (
                  <label className="flex items-center gap-2 text-xs text-ink">
                    <span className="shrink-0">종료일</span>
                    <input
                      type="date"
                      value={until}
                      min={dateKey}
                      onChange={(e) => setUntil(e.target.value)}
                      className="field w-full tabular-nums"
                    />
                  </label>
                )}
              </div>
              {repeat === 'daily' && (
                <label className="mt-2 flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={skipWeekends}
                    onChange={(e) => setSkipWeekends(e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  주말 빼기
                </label>
              )}
              {repeat !== 'none' && (
                <p className="mt-2 text-xs tabular-nums text-muted">
                  {repeatSummary}
                  {type === 'counseling' && seriesDates.length > 0 && '. 같은 시간에 일정이 있는 날은 건너뜁니다'}
                </p>
              )}
            </div>
          )}

          {/* 제목 */}
          <div>
            <label className="mb-2 block text-xs font-medium text-ink">
              {type === 'class' ? '수업/과목명' : '상담 제목 (선택)'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === 'class' ? '예: 국어, 자습, 종례' : '예: 진로 상담'}
              className="field w-full"
            />
          </div>

          {/* 장소 */}
          <div>
            <label className="mb-2 block text-xs font-medium text-ink">장소</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 3학년 2반 교실, 상담실"
              className="field w-full"
            />
          </div>

          {/* 상담 전용: 대상 학생 + 내용 */}
          {type === 'counseling' && (
            <>
              {!isRequest && (
              <div>
                <label className="mb-2 block text-xs font-medium text-ink">
                  대상 학생 {selectedIds.length > 0 && `(${selectedIds.length}명)`}
                </label>
                {selectedIds.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {selectedIds.map((id) => {
                      const s = studentsById[id]
                      return (
                        <span
                          key={id}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-line pl-1 pr-1 text-xs text-ink"
                        >
                          <StudentAvatar student={s} fallbackId={id} size="sm" />
                          {s?.name || id}
                          <button
                            type="button"
                            onClick={() => toggleStudent(id)}
                            className="grid h-5 w-5 place-items-center rounded text-muted hover:text-absent"
                            aria-label="제거"
                          >
                            <X className="h-4 w-4" />
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
                  className="field mb-2 w-full"
                />
                <div className="max-h-48 overflow-y-auto rounded-lg border border-line">
                  {filteredStudents.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-muted">학생이 없습니다</p>
                  ) : (
                    filteredStudents.map((s) => {
                      const selected = selectedIds.includes(s.student_id)
                      return (
                        <button
                          key={s.student_id}
                          type="button"
                          onClick={() => toggleStudent(s.student_id)}
                          className={`flex w-full items-center gap-2 border-b border-line px-3 py-2 text-left transition-colors duration-150 last:border-b-0 ${
                            selected ? 'bg-[color-mix(in_srgb,var(--accent)_8%,white)]' : 'hover:bg-raised'
                          }`}
                        >
                          <StudentAvatar student={s} fallbackId={s.student_id} size="md" />
                          <span className="w-12 shrink-0 text-xs font-medium tabular-nums text-muted">
                            {s.student_id}
                          </span>
                          <span className="flex-1 text-sm text-ink-strong">{s.name}</span>
                          {selected && <Check className="h-4 w-4 text-accent-ink" aria-label="선택됨" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-medium text-ink">상담 내용</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={3}
                  placeholder="상담 목적이나 메모를 간단히 적어 주세요"
                  className="field w-full resize-none"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-absent">{error}</p>}
        </div>

        {askSeriesDelete && (
          <div className="mt-6 border-l-2 border-absent py-1 pl-3">
            <p className="mb-2 text-sm text-ink">반복 일정입니다. 어디까지 삭제할까요?</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSeriesDelete('one')}
                disabled={deleting}
                className="btn btn-danger btn-sm"
              >
                이 일정만
              </button>
              <button
                type="button"
                onClick={() => void handleSeriesDelete('following')}
                disabled={deleting}
                className="btn btn-danger btn-sm"
              >
                이 일정과 이후 반복 모두
              </button>
              <button
                type="button"
                onClick={() => setAskSeriesDelete(false)}
                disabled={deleting}
                className="btn btn-secondary btn-sm"
              >
                그만두기
              </button>
            </div>
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="mt-6 flex items-center gap-2">
          {existing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="btn btn-danger"
            >
              {deleting ? (isRequest ? '취소 중…' : '삭제 중…') : isRequest ? '신청 취소' : '삭제'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary ml-auto"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || deleting}
            className="btn btn-primary"
          >
            {saving
              ? isRequest
                ? '보내는 중…'
                : '저장 중…'
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
      className={`${cls} flex items-center justify-center rounded-full bg-raised text-xs font-medium text-muted`}
    >
      {(student?.name || fallbackId).slice(0, 1)}
    </span>
  )
}
