import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getStudents, getRecordByStudent, updateRecordSummaryEvaluation } from '@/api/api'
import type { Student, RecordRow, RecordByStudent } from '@/types'
import { cn } from '@/lib/utils'

const CREATIVE_AREAS = ['자율활동', '동아리활동', '진로활동']

const FEEDBACK_SECTIONS: Array<{ key: string; icon: string; style: string }> = [
  { key: '종합적 평가', icon: '📋', style: 'border-blue-200 bg-blue-50/80' },
  { key: '보완 방향', icon: '📈', style: 'border-amber-200 bg-amber-50/80' },
  { key: '구체적 활동 예시', icon: '💡', style: 'border-emerald-200 bg-emerald-50/80' },
  { key: '응원의 말', icon: '💪', style: 'border-rose-200 bg-rose-50/80' },
]

function parseFeedbackSections(text: string): Array<{ title: string; icon: string; content: string; style: string }> {
  const sections: Array<{ title: string; icon: string; content: string; style: string }> = []
  const regex = /【([^】]+)】\s*\n?/g
  let match: RegExpExecArray | null
  let lastIndex = 0
  let lastTitle = ''
  let lastIcon = '📌'
  let lastStyle = 'border-gray-200 bg-gray-50'

  while ((match = regex.exec(text)) !== null) {
    const titleInBlock = match[1].trim()
    const blockStart = match.index
    if (blockStart > lastIndex) {
      const content = text.slice(lastIndex, blockStart).trim()
      if (content) sections.push({ title: lastTitle || '보완점', icon: lastIcon, content, style: lastStyle })
    }
    const config = FEEDBACK_SECTIONS.find((s) => titleInBlock.startsWith(s.key)) ?? {
      key: titleInBlock,
      icon: '📌',
      style: 'border-gray-200 bg-gray-50',
    }
    lastTitle = titleInBlock
    lastIcon = config.icon
    lastStyle = config.style
    lastIndex = regex.lastIndex
  }
  const tail = text.slice(lastIndex).trim()
  if (tail) sections.push({ title: lastTitle || '보완점', icon: lastIcon, content: tail, style: lastStyle })
  if (sections.length === 0 && text.trim()) {
    sections.push({ title: '보완점', icon: '📌', content: text.trim(), style: 'border-gray-200 bg-gray-50' })
  }
  return sections
}

/** 시트의 역량 열 값이 TRUE/체크로 간주되는지 여부 (TRUE, true, 1만 체크, FALSE/빈값은 미체크) */
function isCompetencyChecked(value: unknown): boolean {
  if (value === true || value === 1) return true
  const s = String(value ?? '').trim().toUpperCase()
  return s === 'TRUE' || s === '1' || s === 'O' || s === 'Y'
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  )
}

function PrinterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  )
}

function RecordTableRow({ row }: { row: RecordRow }) {
  const hasAcademic = isCompetencyChecked(row.academic)
  const hasCareer = isCompetencyChecked(row.career)
  const hasCommunity = isCompetencyChecked(row.community)
  const tags: string[] = []
  if (row.detail_competency) tags.push(`#${row.detail_competency}`)
  if (row.individual_group) tags.push(`#${row.individual_group}`)
  return (
    <tr className="border-b border-gray-200 last:border-0">
      <td className="whitespace-pre-wrap p-2 align-top text-xs text-gray-700">{row.record_summary}</td>
      <td className="w-20 p-2 text-center text-xs">
        <span className={cn(hasAcademic && 'rounded bg-blue-100 px-1 text-blue-700')}>{hasAcademic ? '✓' : ''}</span>
        <span className={cn(hasCareer && 'rounded bg-emerald-100 px-1 text-emerald-700')}>{hasCareer ? '✓' : ''}</span>
        <span className={cn(hasCommunity && 'rounded bg-amber-100 px-1 text-amber-700')}>{hasCommunity ? '✓' : ''}</span>
      </td>
      <td className="max-w-[120px] p-2 text-xs text-gray-600">
        {tags.length ? tags.join(' ') : '-'}
      </td>
      <td className="min-w-[120px] max-w-[200px] whitespace-pre-wrap p-2 text-[11px] leading-snug text-gray-600">{row.evaluation || '-'}</td>
    </tr>
  )
}

function SectionCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-gray-200 bg-white p-3 shadow-sm', className)}>
      <h3 className="mb-2 border-b border-gray-100 pb-1.5 text-sm font-semibold text-gray-800">{title}</h3>
      {children}
    </section>
  )
}

export function RecordStudentDashboardPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const [student, setStudent] = useState<Student | null>(null)
  const [record, setRecord] = useState<RecordByStudent | null>(null)
  const [summaryEvaluation, setSummaryEvaluation] = useState('')
  const [savingSummary, setSavingSummary] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [linkSummaries, setLinkSummaries] = useState<Array<{ from_summary: string; to_summary: string }> | null>(null)
  const [loadingLinkSummaries, setLoadingLinkSummaries] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!studentId) return
    setLoading(true)
    Promise.all([getStudents(), getRecordByStudent(studentId)])
      .then(([studentsRes, recordRes]) => {
        if (studentsRes.success && studentsRes.data) {
          const s = studentsRes.data.find((x) => String(x.student_id) === String(studentId))
          setStudent(s || null)
        }
        if (recordRes.success && recordRes.data) {
          setRecord(recordRes.data)
          setSummaryEvaluation(recordRes.data.summary_evaluation || '')
          setLinkSummaries(null)
        }
      })
      .finally(() => setLoading(false))
  }, [studentId])

  useEffect(() => {
    load()
  }, [load])

  const handleSaveSummary = () => {
    if (!studentId) return
    setSavingSummary(true)
    updateRecordSummaryEvaluation(studentId, summaryEvaluation)
      .then((res) => {
        if (res.success) setSummaryEvaluation(summaryEvaluation)
      })
      .finally(() => setSavingSummary(false))
  }

  const handleFetchFeedback = () => {
    if (!record) return
    const evals = record.rows.map((r) => r.evaluation).filter(Boolean)
    setLoadingFeedback(true)
    fetch('/.netlify/functions/record-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evaluations: evals }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.reply) setFeedbackText(data.reply)
        else if (data.error) setFeedbackText('오류: ' + data.error)
      })
      .catch(() => setFeedbackText('보완점 분석 요청에 실패했습니다.'))
      .finally(() => setLoadingFeedback(false))
  }

  const handleFetchLinkSummaries = () => {
    const linkRows_ = rows.filter((r) => (r.link_cell || '').trim() !== '')
    const cellRefMap_ = record?.cell_ref_map ?? {}
    if (linkRows_.length === 0) return
    const pairs = linkRows_.map((row) => ({
      from_text: row.record_summary || '',
      to_text: cellRefMap_[row.link_cell] ?? '',
    }))
    setLoadingLinkSummaries(true)
    fetch('/.netlify/functions/record-link-summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairs }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.summaries && Array.isArray(data.summaries)) setLinkSummaries(data.summaries)
        else if (data.error) setLinkSummaries(pairs.map((p) => ({ from_summary: p.from_text.slice(0, 80) + '…', to_summary: p.to_text.slice(0, 80) + '…' })))
      })
      .catch(() => setLinkSummaries(null))
      .finally(() => setLoadingLinkSummaries(false))
  }

  if (!studentId || loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    )
  }

  const profile = record?.profile ?? { student_id: studentId, name: student?.name ?? '', hope_career: '' }
  const rows = record?.rows ?? []
  const hopeCareer = profile.hope_career || '(미입력)'

  const creativeRows = rows.filter((r) => CREATIVE_AREAS.includes(r.area))
  const byGradeCreative: Record<string, RecordRow[]> = {}
  creativeRows.forEach((r) => {
    const g = r.grade || '미지정'
    if (!byGradeCreative[g]) byGradeCreative[g] = []
    byGradeCreative[g].push(r)
  })
  const gradeOrder = [...new Set(creativeRows.map((r) => r.grade || '미지정'))].sort()

  const rowBulRows = rows.filter((r) => r.area === '행발')
  const gyosuRows = rows.filter((r) => r.area === '교과이수현황')
  const gyosuSpecialRows = rows.filter((r) => r.area === '교과세특')

  const booksRaw = rows.map((r) => r.books).filter(Boolean)
  const bookList = booksRaw.flatMap((s) => s.split(/[,，\n]/).map((t) => t.trim()).filter(Boolean))

  const linkRows = rows.filter((r) => (r.link_cell || '').trim() !== '')
  const cellRefMap = record?.cell_ref_map ?? {}

  const academicCount = rows.filter((r) => isCompetencyChecked(r.academic)).length
  const careerCount = rows.filter((r) => isCompetencyChecked(r.career)).length
  const communityCount = rows.filter((r) => isCompetencyChecked(r.community)).length
  const total = academicCount + careerCount + communityCount
  const academicPct = total > 0 ? Math.round((academicCount / total) * 100) : 0
  const careerPct = total > 0 ? Math.round((careerCount / total) * 100) : 0
  const communityPct = total > 0 ? Math.round((communityCount / total) * 100) : 0

  const printArea = () => {
    window.print()
  }

  return (
    <div className="space-y-4">
      {/* 상단: 목록으로 + 출력 버튼 (화면용, 인쇄 시 숨김) */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          to="/admin/record-dashboard"
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          목록으로
        </Link>
        <button
          type="button"
          onClick={printArea}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <PrinterIcon className="h-4 w-4" />
          출력 (B4)
        </button>
      </div>

      {/* 인쇄용 B4 영역 */}
      <div className="record-dashboard-print rounded-xl border border-gray-200 bg-gray-50 p-4 print:border-0 print:bg-white print:p-2">
        {/* 프로필: 사진, 학번, 이름, 희망진로 */}
        <div className="mb-4 flex items-center gap-4 border-b border-gray-200 pb-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-gray-200 bg-gray-100">
            {student?.photo_data ? (
              <img src={student.photo_data} alt={profile.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-gray-400">
                {profile.name.charAt(0) || '?'}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">학번 {profile.student_id}</p>
            <p className="text-lg font-bold text-gray-900">{profile.name}</p>
            <p className="text-sm text-gray-600">희망진로: {hopeCareer}</p>
          </div>
        </div>

        {rows.length === 0 && record?._debug && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden">
            <p className="font-medium">record 시트에 이 학번과 일치하는 기록이 없습니다.</p>
            <p className="mt-1 text-amber-700">
              요청한 학번: <strong>{record._debug.requested_student_id}</strong> · 시트 데이터 행 수: {record._debug.record_sheet_rows}행 · 학번 열(#{record._debug.sid_column_index + 1}) 샘플: {record._debug.sample_ids_from_sheet.join(', ') || '(비어 있음)'}
            </p>
            <p className="mt-1 text-xs">Students 시트의 학번과 record 시트의 학번(첫 번째 열) 형식이 같은지 확인해 주세요. (예: 10101 vs &quot;10101&quot;, 앞자리 0 유무)</p>
          </div>
        )}

        {/* 3단 레이아웃 */}
        <div className="grid grid-cols-1 gap-4 print:grid-cols-3 lg:grid-cols-3">
          {/* 1단: 창의적 체험활동 + 행발 */}
          <div className="flex flex-col gap-3">
            <SectionCard title="창의적 체험활동">
              {gradeOrder.length === 0 ? (
                <p className="text-xs text-gray-500">기록 없음</p>
              ) : (
                <div className="space-y-3">
                  {gradeOrder.map((grade) => (
                    <div key={grade} className="print-grade-block">
                      <p className="mb-1 text-xs font-medium text-gray-600">{grade}</p>
                      <table className="w-full table-auto border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-gray-300 bg-gray-100 text-left">
                            <th className="p-1.5">기록내용</th>
                            <th className="w-16 p-1.5 text-center">역량</th>
                            <th className="w-24 p-1.5">해시태그</th>
                            <th className="min-w-[120px] max-w-[200px] p-1.5 text-[11px]">평가</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(byGradeCreative[grade] || []).map((row, i) => (
                            <RecordTableRow key={`${grade}-${i}`} row={row} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
            <SectionCard title="행발">
              {rowBulRows.length === 0 ? (
                <p className="text-xs text-gray-500">기록 없음</p>
              ) : (
                <table className="w-full table-auto border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-300 bg-gray-100 text-left">
                      <th className="p-1.5">기록내용</th>
                      <th className="w-16 p-1.5 text-center">역량</th>
                      <th className="w-24 p-1.5">해시태그</th>
                      <th className="min-w-[120px] max-w-[200px] p-1.5 text-[11px]">평가</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowBulRows.map((row, i) => (
                      <RecordTableRow key={i} row={row} />
                    ))}
                  </tbody>
                </table>
              )}
            </SectionCard>
          </div>

          {/* 2단: 교과이수현황 + 교과세특 */}
          <div className="flex flex-col gap-3">
            {gyosuRows.length > 0 && (
              <SectionCard title="교과이수현황">
                <table className="w-full table-auto border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-300 bg-gray-100 text-left">
                      <th className="p-1.5">기록내용</th>
                      <th className="w-16 p-1.5 text-center">역량</th>
                      <th className="w-24 p-1.5">해시태그</th>
                      <th className="min-w-[120px] max-w-[200px] p-1.5 text-[11px]">평가</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gyosuRows.map((row, i) => (
                      <RecordTableRow key={i} row={row} />
                    ))}
                  </tbody>
                </table>
              </SectionCard>
            )}
            <SectionCard title="교과세특">
              {gyosuSpecialRows.length === 0 ? (
                <p className="text-xs text-gray-500">기록 없음</p>
              ) : (
                <table className="w-full table-auto border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-300 bg-gray-100 text-left">
                      <th className="p-1.5">기록내용</th>
                      <th className="w-16 p-1.5 text-center">역량</th>
                      <th className="w-24 p-1.5">해시태그</th>
                      <th className="min-w-[120px] max-w-[200px] p-1.5 text-[11px]">평가</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gyosuSpecialRows.map((row, i) => (
                      <RecordTableRow key={i} row={row} />
                    ))}
                  </tbody>
                </table>
              )}
            </SectionCard>
          </div>

          {/* 3단: 읽은 책, 종합적 평가, 연결망, 보완점, 역량 원그래프 */}
          <div className="flex flex-col gap-3">
            <SectionCard title="읽은 책 목록">
              {bookList.length === 0 ? (
                <p className="text-xs text-gray-500">기록 없음</p>
              ) : (
                <ul className="grid grid-cols-1 gap-0.5 text-xs text-gray-700 print:grid-cols-1">
                  {bookList.map((b, i) => (
                    <li key={i} className="list-inside list-disc">{b}</li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="종합적 평가">
              <textarea
                value={summaryEvaluation}
                onChange={(e) => setSummaryEvaluation(e.target.value)}
                placeholder="교사가 직접 입력하는 종합적 평가"
                rows={4}
                className="mb-2 w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSaveSummary}
                disabled={savingSummary}
                className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingSummary ? '저장 중...' : '저장'}
              </button>
            </SectionCard>

            <SectionCard title="연결망 (연속적 활동)">
              {linkRows.length === 0 ? (
                <p className="text-xs text-gray-500">연결된 기록 없음</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleFetchLinkSummaries}
                    disabled={loadingLinkSummaries}
                    className="mb-2 rounded bg-slate-600 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {loadingLinkSummaries ? '요약 생성 중...' : 'AI 요약으로 보기'}
                  </button>
                  <ul className="space-y-3 text-xs">
                    {linkRows.map((row, i) => {
                      const refSummary = cellRefMap[row.link_cell] ?? '(참조 없음)'
                      const fromLabel = '연결된 기록'
                      const toLabel = '참조된 기록'
                      const fromText = linkSummaries && linkSummaries[i]?.from_summary
                        ? linkSummaries[i].from_summary
                        : (row.record_summary || '-').slice(0, 120) + ((row.record_summary || '').length > 120 ? '…' : '')
                      const toText = linkSummaries && linkSummaries[i]?.to_summary
                        ? linkSummaries[i].to_summary
                        : (refSummary === '(참조 없음)' ? refSummary : refSummary.slice(0, 120) + (refSummary.length > 120 ? '…' : ''))
                      return (
                        <li key={i} className="rounded border border-gray-200 bg-gray-50 p-2">
                          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                            연결 관계 (셀 {row.link_cell} 참조)
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-700">
                              <span className="text-gray-500">{fromLabel}: </span>
                              {fromText}
                            </div>
                            <span className="shrink-0 text-gray-400" aria-hidden>→</span>
                            <div className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-700">
                              <span className="text-gray-500">{toLabel}: </span>
                              {toText}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </SectionCard>

            <SectionCard title="보완점 (AI 분석)">
              <button
                type="button"
                onClick={handleFetchFeedback}
                disabled={loadingFeedback}
                className="mb-2 rounded bg-slate-600 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {loadingFeedback ? '분석 중...' : '평가 기반 보완점 생성'}
              </button>
              {feedbackText && (
                <div className="space-y-2">
                  {parseFeedbackSections(feedbackText).map((section, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'rounded-lg border p-2.5 text-[11px] leading-relaxed',
                        section.style
                      )}
                    >
                      <p className="mb-1 flex items-center gap-1.5 font-semibold text-gray-800">
                        <span className="text-base" aria-hidden>{section.icon}</span>
                        {section.title}
                      </p>
                      <div className="whitespace-pre-wrap text-gray-700">{section.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="역량 분포">
              {total === 0 ? (
                <p className="text-xs text-gray-500">기록 없음</p>
              ) : (
                <div className="flex flex-wrap gap-4">
                  <div className="flex flex-col items-center">
                    <PieSlice value={academicPct} strokeClass="stroke-blue-500" />
                    <span className="mt-1 text-xs text-gray-600">학업 {academicPct}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <PieSlice value={careerPct} strokeClass="stroke-emerald-500" />
                    <span className="mt-1 text-xs text-gray-600">진로 {careerPct}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <PieSlice value={communityPct} strokeClass="stroke-amber-500" />
                    <span className="mt-1 text-xs text-gray-600">공동체 {communityPct}%</span>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  )
}

function PieSlice({ value, strokeClass }: { value: number; strokeClass: string }) {
  const r = 24
  const circumference = 2 * Math.PI * r
  const strokeDash = value === 0 ? 0 : (value / 100) * circumference
  return (
    <svg width="56" height="56" className="-rotate-90">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        className={strokeClass}
        stroke="currentColor"
        strokeWidth="8"
        strokeDasharray={`${strokeDash} ${circumference}`}
        strokeLinecap="round"
      />
    </svg>
  )
}
