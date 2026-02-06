import type { Student } from '@/types'

/**
 * 명렬표를 HTML로 렌더링한 뒤 브라우저 인쇄 대화상자를 띄움.
 * 인쇄 시 "PDF로 저장"을 선택하면 한글이 깨지지 않은 PDF 저장 가능.
 */
export function printRosterAsPdf(
  students: Student[],
  options: { grade: string; classNum: string; teacherName: string }
) {
  const { grade, classNum, teacherName } = options
  const title = `${grade}학년 ${classNum}반 학생 명렬표`

  const rows = students
    .map(
      (s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(String(s.name ?? ''))}</td>
      <td>${escapeHtml(String(s.student_id ?? ''))}</td>
      <td>${escapeHtml(String(s.auth_code ?? ''))}</td>
      <td>${escapeHtml(String(s.phone_student ?? ''))}</td>
      <td>${escapeHtml(String(s.phone_parent ?? ''))}</td>
      <td></td>
    </tr>`
    )
    .join('')

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
        <th>번호</th>
        <th>이름</th>
        <th>학번</th>
        <th>인증코드</th>
        <th>학생 번호</th>
        <th>부모님 번호</th>
        <th>비고</th>
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
