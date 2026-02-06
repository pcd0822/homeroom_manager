import type { Student } from '@/types'

/** 인쇄 시 선택 가능한 열 (번호 제외) */
export type RosterPrintColumnId =
  | 'name'
  | 'student_id'
  | 'auth_code'
  | 'phone_student'
  | 'phone_parent'
  | 'email'
  | 'note'

export const ROSTER_PRINT_COLUMNS: { id: RosterPrintColumnId; label: string }[] = [
  { id: 'name', label: '이름' },
  { id: 'student_id', label: '학번' },
  { id: 'auth_code', label: '인증코드' },
  { id: 'phone_student', label: '학생 번호' },
  { id: 'phone_parent', label: '부모님 번호' },
  { id: 'email', label: '이메일' },
  { id: 'note', label: '비고' },
]

/**
 * 명렬표를 HTML로 렌더링한 뒤 브라우저 인쇄 대화상자를 띄움.
 * columns에 포함된 열만 인쇄. 인쇄 시 "PDF로 저장" 선택 시 한글 깨짐 없음.
 */
export function printRosterAsPdf(
  students: Student[],
  options: {
    grade: string
    classNum: string
    teacherName: string
    columns: RosterPrintColumnId[]
  }
) {
  const { grade, classNum, teacherName, columns } = options
  const title = `${grade}학년 ${classNum}반 학생 명렬표`

  const headers = ['번호', ...ROSTER_PRINT_COLUMNS.filter((c) => columns.includes(c.id)).map((c) => c.label)]

  const getCell = (s: Student, id: RosterPrintColumnId): string => {
    switch (id) {
      case 'name':
        return String(s.name ?? '')
      case 'student_id':
        return String(s.student_id ?? '')
      case 'auth_code':
        return String(s.auth_code ?? '')
      case 'phone_student':
        return String(s.phone_student ?? '')
      case 'phone_parent':
        return String(s.phone_parent ?? '')
      case 'email':
        return String(s.email ?? '')
      case 'note':
        return ''
      default:
        return ''
    }
  }

  const visibleCols = ROSTER_PRINT_COLUMNS.filter((c) => columns.includes(c.id))
  const rows = students
    .map(
      (s, i) => `
    <tr>
      <td>${i + 1}</td>
      ${visibleCols.map((c) => `<td>${escapeHtml(getCell(s, c.id))}</td>`).join('\n      ')}
    </tr>`
    )
    .join('')

  const thCells = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('\n        ')

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 20px;
      color: #111;
      font-size: 12px;
    }
    h1 { font-size: 18px; margin: 0 0 16px 0; }
    .header-right { text-align: right; margin-bottom: 16px; font-size: 11px; color: #374151; }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background: #2563eb;
      color: #fff;
      font-weight: 600;
    }
    @media print {
      body { padding: 12px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="header-right">담임교사: ${escapeHtml(teacherName || '')} (서명 또는 인)</div>
  <table>
    <thead>
      <tr>
        ${thCells}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="no-print" style="margin-top: 24px; font-size: 11px; color: #6b7280;">
    인쇄 대화상자에서 「대상: PDF로 저장」을 선택하면 PDF 파일로 저장할 수 있습니다.
  </p>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    alert('팝업이 차단되었을 수 있습니다. 팝업을 허용한 뒤 다시 시도해 주세요.')
    return
  }
  win.document.write(html)
  win.document.close()
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
