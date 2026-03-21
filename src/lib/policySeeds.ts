import type { PolicyParticipant } from '@/types'

/** 시트/API에서 학번 타입이 섞일 수 있음 */
export function existingSeedsFor(sid: string, parts: PolicyParticipant[]): number {
  const row = parts.find((p) => String(p.student_id).trim() === String(sid).trim())
  return Math.max(0, Number(row?.seeds_count) || 0)
}
