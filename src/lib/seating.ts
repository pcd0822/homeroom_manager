import type {
  SeatingType,
  SeatingLayout,
  SeatingGroup,
  SeatingSeat,
  SeatingRules,
} from '@/types'

const rid = () => Math.random().toString(36).slice(2, 8)
const seatId = () => `seat-${Date.now().toString(36)}-${rid()}`
const groupId = () => `grp-${Date.now().toString(36)}-${rid()}`

export function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 좌석 타입과 인원 수를 받아 균일한 분단(모둠) layout을 생성.
 *
 * 기본 규칙
 * - 개별: 분단당 4행 × 1열 = 4명. 분단 수 = ceil(N/4)
 * - 짝:   분단당 4행 × 2열 = 8명. 분단 수 = ceil(N/8)
 * - 모둠: 모둠당 2행 × 2열 = 4명. 모둠 수 = ceil(N/4)
 */
export function generateLayout(type: SeatingType, totalSeats: number): SeatingLayout {
  const n = Math.max(0, Math.floor(totalSeats))
  if (n === 0) return { type, groups: [] }

  if (type === 'individual') {
    const rowsPerGroup = 4
    const colsPerGroup = 1
    return buildUniformLayout(type, n, rowsPerGroup, colsPerGroup, '분단')
  }
  if (type === 'pair') {
    const rowsPerGroup = 4
    const colsPerGroup = 2
    return buildUniformLayout(type, n, rowsPerGroup, colsPerGroup, '분단')
  }
  // group
  const rowsPerGroup = 2
  const colsPerGroup = 2
  return buildUniformLayout(type, n, rowsPerGroup, colsPerGroup, '모둠')
}

function buildUniformLayout(
  type: SeatingType,
  total: number,
  rows: number,
  cols: number,
  groupLabel: string
): SeatingLayout {
  const perGroup = rows * cols
  const groupCount = Math.ceil(total / perGroup)
  const groups: SeatingGroup[] = []
  let remaining = total
  for (let gi = 0; gi < groupCount; gi++) {
    const gid = groupId()
    const seats: SeatingSeat[] = []
    const take = Math.min(remaining, perGroup)
    // 균일 분포: 마지막 분단도 가급적 행/열을 채워서 자연스러운 그리드 유지
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        if (seats.length >= take) break
        seats.push({ id: seatId(), row: r, col: c })
      }
    }
    remaining -= take
    groups.push({ id: gid, name: `${groupLabel} ${gi + 1}`, seats })
  }
  return { type, groups }
}

/** 분단 단위 좌석들을 (row, col) 기준으로 정렬해 반환 (시각화·배정용) */
export function sortSeats(seats: SeatingSeat[]): SeatingSeat[] {
  return [...seats].sort((a, b) => (a.row - b.row) || (a.col - b.col))
}

export interface AssignResult {
  /** seat_id → student_id */
  bySeat: Record<string, string>
}

/**
 * 자리 배치 알고리즘 (v1 휴리스틱)
 * 1) 지정 좌석 먼저 배치
 * 2) "붙어야 하는 친구" 그룹을 같은 분단의 인접 좌석에 우선 배치
 * 3) 남은 학생들을 랜덤하게 빈 좌석에 배치
 * 4) "떨어져야 하는 친구"가 같은 분단이면 swap으로 분리 시도
 */
export function assignSeats(
  studentIds: string[],
  layout: SeatingLayout,
  rules: SeatingRules
): AssignResult {
  const bySeat: Record<string, string> = {}
  const placed = new Set<string>()
  const occupied = new Set<string>()

  const allSeats: Array<{ groupId: string; seat: SeatingSeat }> = []
  layout.groups.forEach((g) => g.seats.forEach((s) => allSeats.push({ groupId: g.id, seat: s })))

  const groupOfSeat = new Map<string, string>()
  allSeats.forEach((s) => groupOfSeat.set(s.seat.id, s.groupId))

  const seatIds = new Set(allSeats.map((s) => s.seat.id))
  const validStudentIds = new Set(studentIds)

  // 1) 지정 좌석
  for (const f of rules.fixed) {
    if (!seatIds.has(f.seat_id)) continue
    if (!validStudentIds.has(f.student_id)) continue
    if (occupied.has(f.seat_id)) continue
    if (placed.has(f.student_id)) continue
    bySeat[f.seat_id] = f.student_id
    placed.add(f.student_id)
    occupied.add(f.seat_id)
  }

  // 2) 붙어야 하는 친구 — 같은 분단의 빈 좌석 N개 동시에 점유 시도
  const togetherGroups = shuffleArr(rules.together)
  for (const tg of togetherGroups) {
    const ids = tg.student_ids.filter((id) => !placed.has(id) && validStudentIds.has(id))
    if (ids.length < 2) continue
    let success = false
    const groupOrder = shuffleArr(layout.groups)
    for (const lg of groupOrder) {
      const free = lg.seats.filter((s) => !occupied.has(s.id))
      if (free.length >= ids.length) {
        // 행/열 기준 정렬 후 앞에서부터 인접 좌석 선택
        const chosen = sortSeats(free).slice(0, ids.length)
        ids.forEach((sid, i) => {
          bySeat[chosen[i].id] = sid
          placed.add(sid)
          occupied.add(chosen[i].id)
        })
        success = true
        break
      }
    }
    if (!success) {
      // fallback: 빈 좌석 어디든
      const free = allSeats.filter((s) => !occupied.has(s.seat.id))
      const chosen = free.slice(0, ids.length)
      ids.forEach((sid, i) => {
        if (!chosen[i]) return
        bySeat[chosen[i].seat.id] = sid
        placed.add(sid)
        occupied.add(chosen[i].seat.id)
      })
    }
  }

  // 3) 나머지 학생을 빈 좌석에 랜덤 배정
  const remainStudents = shuffleArr(studentIds.filter((id) => !placed.has(id)))
  const remainSeats = shuffleArr(allSeats.filter((s) => !occupied.has(s.seat.id)))
  const len = Math.min(remainStudents.length, remainSeats.length)
  for (let i = 0; i < len; i++) {
    bySeat[remainSeats[i].seat.id] = remainStudents[i]
    placed.add(remainStudents[i])
    occupied.add(remainSeats[i].seat.id)
  }

  // 4) 떨어져야 하는 친구 swap (지정 좌석은 건드리지 않음)
  const fixedStudents = new Set(rules.fixed.map((f) => f.student_id))
  const seatOfStudent = () => {
    const m = new Map<string, string>()
    Object.entries(bySeat).forEach(([sid, stuId]) => m.set(stuId, sid))
    return m
  }
  for (let iter = 0; iter < 6; iter++) {
    let conflict = false
    const stuToSeat = seatOfStudent()
    for (const ap of rules.apart) {
      const inLayout = ap.student_ids.filter((id) => stuToSeat.has(id))
      // 같은 분단에 있는 페어 찾기
      for (let i = 0; i < inLayout.length; i++) {
        for (let j = i + 1; j < inLayout.length; j++) {
          const a = inLayout[i]
          const b = inLayout[j]
          const sa = stuToSeat.get(a)!
          const sb = stuToSeat.get(b)!
          if (groupOfSeat.get(sa) === groupOfSeat.get(sb)) {
            // b와 swap할 다른 분단의 학생 찾기
            const candidates = allSeats.filter((s) => {
              const occ = bySeat[s.seat.id]
              if (!occ) return false
              if (fixedStudents.has(occ)) return false
              if (groupOfSeat.get(s.seat.id) === groupOfSeat.get(sb)) return false
              // 후보 학생이 다른 apart/together 규칙으로 묶여 있을 수도 있지만 v1은 무시
              return true
            })
            if (candidates.length === 0) continue
            const pick = candidates[Math.floor(Math.random() * candidates.length)]
            const pickStu = bySeat[pick.seat.id]
            bySeat[sb] = pickStu
            bySeat[pick.seat.id] = b
            conflict = true
          }
        }
      }
    }
    if (!conflict) break
  }

  return { bySeat }
}
