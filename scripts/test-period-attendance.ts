// 교시 출결 규칙 점검: npx tsx scripts/test-period-attendance.ts
import {
  applyKindClick,
  deriveEarly,
  effectiveRecords,
  hasPeriodMarks,
  nextLateFlag,
  parseMarks,
  stringifyMarks,
  type MarkMap,
} from '../src/lib/attendance'

let fail = 0
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) console.log('ok  ', name)
  else {
    fail++
    console.log('FAIL', name, '\n   got ', g, '\n   want', w)
  }
}
const s = (m: MarkMap) => stringifyMarks(m)
const N = 7

eq('지각 2교시 → 조회~2', s(applyKindClick({}, 'L', 2, N)), '0:L,1:L,2:L')
eq('지각 3 → 2로 줄이기', s(applyKindClick(parseMarks('0:L,1:L,2:L,3:L'), 'L', 2, N)), '0:L,1:L,2:L')
eq('지각 같은 칸 다시 → 지움', s(applyKindClick(parseMarks('0:L,1:L,2:L'), 'L', 2, N)), '')
eq('결석 → 조회~7', s(applyKindClick({}, 'A', 4, N)), '0:A,1:A,2:A,3:A,4:A,5:A,6:A,7:A')
eq('결석 다시 → 지움', s(applyKindClick(parseMarks('0:A,1:A,2:A,3:A,4:A,5:A,6:A,7:A'), 'A', 1, N)), '')
eq('조퇴 3 → 3~7', s(applyKindClick({}, 'E', 3, N)), '3:E,4:E,5:E,6:E,7:E')
eq('조퇴 5교시 날(N=5) 3 → 3~5', s(applyKindClick({}, 'E', 3, 5)), '3:E,4:E,5:E')
eq('조퇴 3 → 5로 옮기기', s(applyKindClick(parseMarks('3:E,4:E,5:E,6:E,7:E'), 'E', 5, N)), '5:E,6:E,7:E')
eq('결과 → 한 칸 토글', s(applyKindClick(parseMarks('5:S'), 'R', 2, N)), '2:R,5:S')
eq('결과 → 있는 칸 지움', s(applyKindClick(parseMarks('2:R,5:S'), 'R', 5, N)), '2:R')
eq('지각 + 교과 체크 유지', s(applyKindClick(parseMarks('6:S'), 'L', 1, N)), '0:L,1:L,6:S')

eq('조퇴 판정: 1,2 출석, 3~7 체크', deriveEarly(parseMarks('3:S,4:S,5:S,6:S,7:S'), 7), true)
eq('조퇴 판정: 7교시만 체크', deriveEarly(parseMarks('7:S'), 7), true)
eq('조퇴 아님: 결석(전부)', deriveEarly(parseMarks('0:A,1:A,2:A,3:A,4:A,5:A,6:A,7:A'), 7), false)
eq('조퇴 아님: 마지막 교시 출석', deriveEarly(parseMarks('3:S,4:S'), 7), false)
eq('조퇴 아님: 지각(조회~2)', deriveEarly(parseMarks('0:L,1:L,2:L'), 7), false)
eq('조퇴: 지각 + 6~7 체크', deriveEarly(parseMarks('0:L,1:L,6:E,7:E'), 7), true)
eq('조퇴 판정: 5교시 날 5교시만', deriveEarly(parseMarks('5:S'), 5), true)
eq('7교시 체크는 5교시 날엔 무시', deriveEarly(parseMarks('7:S'), 5), false)

const L2 = parseMarks('0:L,1:L,2:L')
eq('지각 칸: 지각 구분으로 채움 → 켜짐', nextLateFlag(false, 'L', {}, L2, N), true)
eq('지각 칸: 지각 구분으로 지움 → 꺼짐', nextLateFlag(true, 'L', L2, {}, N), false)
eq('지각 칸: 구분 없이 마지막 칸 지움 → 꺼짐', nextLateFlag(true, '', parseMarks('0:L'), {}, N), false)
eq('지각 칸: 결과 구분으로 마지막 칸 지움 → 꺼짐', nextLateFlag(true, 'R', parseMarks('0:L'), {}, N), false)
eq('지각 칸: 조회 칸만 지워져도 비면 꺼짐', nextLateFlag(true, '', parseMarks('0:S'), {}, N), false)
eq('지각 칸: 다른 칸이 남으면 유지', nextLateFlag(true, '', parseMarks('0:L,1:L'), parseMarks('0:L'), N), true)
eq('지각 칸: 구분 없이 교과 칸 추가 → 직접 체크 유지', nextLateFlag(true, '', {}, parseMarks('3:S'), N), true)
eq('지각 칸: 처음부터 빈 칸이면 직접 체크 유지', nextLateFlag(true, 'E', {}, {}, 0), true)
eq('지각 칸: 5교시 날 안 보이는 7교시만 남으면 꺼짐', nextLateFlag(true, '', parseMarks('3:S,7:S'), parseMarks('7:S'), 5), false)

const schedule = { weekday: [0, 7, 7, 7, 7, 7, 0], dates: { '2026-11-06': 5 } }
eq(
  '점수 기록 합치기',
  effectiveRecords(
    [
      { date: '2026-11-05', student_id: '1', late: true, early: true, late_doc: false, early_doc: true },
      { date: '2026-11-04', student_id: '2', late: false, early: true, late_doc: false, early_doc: false },
    ],
    [
      { date: '2026-11-05', student_id: '1', marks: '0:L,1:L' }, // 교시상 조퇴 아님 → 직접 체크한 조퇴 무시
      { date: '2026-11-06', student_id: '3', marks: '4:S,5:S' }, // 교과 체크만으로 조퇴
    ],
    schedule
  ),
  [
    { date: '2026-11-04', student_id: '2', late: false, early: true, late_doc: false, early_doc: false },
    { date: '2026-11-05', student_id: '1', late: true, early: false, late_doc: false, early_doc: false },
    { date: '2026-11-06', student_id: '3', late: false, early: true, late_doc: false, early_doc: false },
  ]
)

// 2026-11-10: 지각 칸을 결석이 덮어쓰면 지각 체크 해제, 기타(O) 구분
{
  const n = 7
  const late2 = applyKindClick({}, 'L', 2, n)
  const absent = applyKindClick(late2, 'A', 3, n)
  eq('지각 → 결석으로 덮으면 지각 체크 해제', nextLateFlag(true, 'A', late2, absent, n), false)
  eq('지각 + 결과 한 칸이면 지각 유지', nextLateFlag(true, 'R', late2, applyKindClick(late2, 'R', 5, n), n), true)
  eq('지각 칸 없이 직접 체크한 지각은 결석이어도 유지', nextLateFlag(true, 'A', {}, applyKindClick({}, 'A', 1, n), n), true)
  eq('기타는 누른 칸만', applyKindClick({}, 'O', 3, n), { 3: 'O' })
  eq('기타 다시 누르면 빠짐', applyKindClick({ 3: 'O' }, 'O', 3, n), {})
  eq('마지막 교시 기타만 → 조퇴 아님', deriveEarly({ 7: 'O' }, n), false)
  eq('기타 1~4 + 조퇴 5~7 → 조퇴', deriveEarly({ 1: 'O', 2: 'O', 3: 'O', 4: 'O', 5: 'E', 6: 'E', 7: 'E' }, n), true)
  eq('마지막 교시만 결과 → 조퇴 아님', deriveEarly({ 7: 'R' }, n), false)
  eq('5~7교시 결과 → 조퇴 아님', deriveEarly({ 5: 'R', 6: 'R', 7: 'R' }, n), false)
  eq('결과 1~4 + 조퇴 5~7 → 조퇴', deriveEarly({ 1: 'R', 2: 'R', 3: 'R', 4: 'R', 5: 'E', 6: 'E', 7: 'E' }, n), true)
  eq('6교시 교과 체크 + 7교시 결과 → 조퇴 아님', deriveEarly({ 6: 'S', 7: 'R' }, n), false)
  eq('7교시 교과 체크 → 지금처럼 조퇴', deriveEarly({ 7: 'S' }, n), true)
  eq('결과만 있는 날은 자동 판정하지 않음(직접 체크 값)', hasPeriodMarks({ 7: 'R' }, n), false)
  eq('기타 왕복', parseMarks(stringifyMarks({ 0: 'L', 3: 'O' })), { 0: 'L', 3: 'O' })
}

if (fail) {
  console.log(`\n${fail}개 실패`)
  process.exit(1)
}
console.log('\n모두 통과')
