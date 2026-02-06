import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Student } from '@/types'

export function downloadRosterPdf(
  students: Student[],
  options: { grade: string; classNum: string; teacherName: string }
) {
  const doc = new jsPDF()
  const { grade, classNum, teacherName } = options
  const title = `${grade}학년 ${classNum}반 학생 명렬표`

  doc.setFontSize(16)
  doc.text(title, 14, 20)

  doc.setFontSize(10)
  doc.text(`담임교사: ${teacherName || ''} (서명 또는 인)`, doc.internal.pageSize.getWidth() - 14, 20, { align: 'right' })

  const tableData = students.map((s, i) => [
    (i + 1).toString(),
    String(s.name ?? ''),
    String(s.student_id ?? ''),
    String(s.auth_code ?? ''),
    String(s.phone_student ?? ''),
    String(s.phone_parent ?? ''),
    '', // 비고
  ])

  autoTable(doc, {
    startY: 28,
    head: [['번호', '이름', '학번', '인증코드', '학생 번호', '부모님 번호', '비고']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [66, 139, 202], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 22 },
      2: { cellWidth: 22 },
      3: { cellWidth: 22 },
      4: { cellWidth: 28 },
      5: { cellWidth: 28 },
      6: { cellWidth: 28 },
    },
  })

  doc.save(`${title}.pdf`)
}
