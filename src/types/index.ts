/** 폼 타입 */
export type FormType = 'survey' | 'notice'

/** 폼 스키마 필드 타입 */
export type FieldType = 'text' | 'textarea' | 'radio' | 'checkbox' | 'number' | 'date'

export interface FormFieldSchema {
  id: string
  type: FieldType
  label: string
  required?: boolean
  options?: string[]  // radio, checkbox용
  placeholder?: string
}

export interface FormSchema {
  fields: FormFieldSchema[]
  /** Notice 타입일 때 본문(설명) 텍스트 */
  body?: string
  /** Notice 타입일 때 동의서 블록 (선택) */
  consent?: {
    title: string
    body: string
    options?: string[]
  }
}

export interface Form {
  form_id: string
  folder_id: string
  title: string
  type: FormType
  schema: string  // JSON 문자열 (FormSchema)
  is_active: boolean
  created_at: string
}

export interface FormWithParsedSchema extends Omit<Form, 'schema'> {
  schema: FormSchema | null
}

export interface ResponseRow {
  response_id: string
  form_id: string
  student_id: string
  student_name: string
  answer_data: string  // JSON 문자열
  submitted_at: string
}

export interface Folder {
  folder_id: string
  name: string
}

export interface Student {
  student_id: string
  name: string
  auth_code: string
  phone_student: string
  phone_parent: string
  email?: string
  photo_data?: string
}

export interface SmsLog {
  log_id: string
  sent_at: string
  receiver_count: number
  message_content: string
  status: string
}

export interface AssignmentRow {
  form_id: string
  student_id: string
  start_date: string
  end_date: string
  assigned_at: string
}

/** GAS API 공통 응답 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/** 생기부 record 시트 한 행 */
export interface RecordRow {
  student_id: string
  name: string
  hope_career: string
  grade: string
  area: string
  record_summary: string
  individual_group: string
  academic: string
  career: string
  community: string
  detail_competency: string
  link_cell: string
  books: string
  evaluation: string
  _rowIndex?: number
}

/** 생기부 학생별 조회 결과 */
export interface RecordByStudent {
  profile: { student_id: string; name: string; hope_career: string }
  rows: RecordRow[]
  summary_evaluation: string
  cell_ref_map: Record<string, string>
  /** 기록이 0건일 때 원인 파악용 (시트 행 수, 시트 학번 열 샘플) */
  _debug?: {
    requested_student_id: string
    record_sheet_rows: number
    sid_column_index: number
    sample_ids_from_sheet: string[]
  }
}

// ----- 야간 자율학습 -----

export type NightExcludedType = 'off' | 'holiday'

export interface NightStudyExcludedDate {
  date: string
  reason: string
  type: NightExcludedType
}

export interface NightStudyGroup {
  id: string
  name: string
}

export interface NightStudyTimetableRow {
  id: string
  mon: string
  tue: string
  wed: string
  thu: string
  fri: string
  holiday: string
}

export interface NightStudyParticipant {
  student_id: string
  group_ids: string[]
  days: string[]
}

export interface NightStudyConfig {
  periodStart: string
  periodEnd: string
  excluded: NightStudyExcludedDate[]
  groups: NightStudyGroup[]
  timetable: NightStudyTimetableRow[]
  participants: NightStudyParticipant[]
  updatedAt: string
}

export interface NightStudyForStudent {
  assigned: boolean
  date: string
  isOff: boolean
  offReason?: string
  isHolidaySchedule: boolean
  groupName?: string | null
  slots: string[]
  encouragement?: string
}

/** 학급 게임 랭킹 한 줄 (학생별 최고 기록) */
export interface ClassGameRankingRow {
  student_id: string
  student_name: string
  duration_ms: number
  played_at: string
}

/** 학생 정책(씨앗) */
export interface Policy {
  policy_id: string
  title: string
  goal: string
  description: string
  expected_effect: string
  seeds_per_participation: number
  logo_data: string
  creator_student_id: string
  co_registrants: string[]
  co_registrants_json?: string
  participation_links?: string[]
  created_at: string
  updated_at: string
  hype_count?: number
}

export interface PolicyParticipant {
  student_id: string
  student_name: string
  photo_data?: string
  seeds_count: number
}

export interface PolicyTreeDashboard {
  total_seeds_class: number
  top_students: Array<{
    student_id: string
    student_name: string
    photo_data?: string
    total_seeds: number
  }>
  lowest_students: Array<{
    student_id: string
    student_name: string
    photo_data?: string
    total_seeds: number
  }>
  top_policies: Array<{
    policy_id: string
    title: string
    policy_title?: string
    policy_logo_data?: string
    logo_data?: string
    total_seeds: number
  }>
  lowest_policies: Array<{
    policy_id: string
    title: string
    policy_title?: string
    policy_logo_data?: string
    logo_data?: string
    total_seeds: number
  }>
  /** 정책 참여로 받은 씨앗 누적 — 학생 전체(다수→소수). GAS 최신 배포 시 포함 */
  all_students?: Array<{
    student_id: string
    student_name: string
    photo_data?: string
    total_seeds: number
  }>
  /** 정책별 누적 씨앗 합계 — 전체(다수→소수). GAS 최신 배포 시 포함 */
  all_policies?: Array<{
    policy_id: string
    title: string
    policy_title?: string
    policy_logo_data?: string
    logo_data?: string
    total_seeds: number
  }>

  /** 🔥 정책 하입 Top4 (정책 게시판 대시보드용) */
  top_hype_policies?: Array<{
    policy_id: string
    title: string
    logo_data?: string
    policy_logo_data?: string
    hype_count: number
  }>
}

// ----- 들샘 모의고사 -----

export type TeacherQuizType =
  | 'choice' // 객관식 (텍스트 선택지)
  | 'short' // 주관식
  | 'ox' // OX
  | 'image' // 문제에 이미지, 주관식 답
  | 'imageChoice' // 텍스트 문제 + 이미지 선택지
  | 'youtube' // 문제에 유튜브, 주관식 답

export interface TeacherQuizQuestion {
  id: string
  order_no: number
  type: TeacherQuizType
  question: string
  /** choice 타입의 텍스트 선택지 */
  choices?: string[]
  /** imageChoice 타입의 이미지 선택지 (base64 data URL) */
  choice_images?: string[]
  /**
   * 정답
   * - choice/imageChoice: 선택지 인덱스 (문자열, 0부터)
   * - short/image/youtube: 정답 문자열 (앞뒤 공백·대소문자 무시 비교)
   * - ox: 'O' 또는 'X'
   */
  correct_answer: string
  /** image 타입의 문제 이미지 (base64 data URL) */
  image_data?: string
  /** youtube 타입의 영상 URL (또는 ID) */
  youtube_url?: string
  hint?: string
  /** 제한 시간 (초). 10 이상 59 이하 */
  time_limit: number
}

export interface TeacherQuizScoreRow {
  student_id: string
  student_name: string
  total_score: number
  retries: number
  played_at: string
}
// ----- 자리 배치 -----

export type SeatingType = 'individual' | 'pair' | 'group'

export interface SeatingSeat {
  /** 그룹 내에서 고유한 id (groupId-row-col 등) */
  id: string
  row: number
  col: number
}

export interface SeatingGroup {
  id: string
  name: string
  seats: SeatingSeat[]
}

export interface SeatingLayout {
  type: SeatingType
  groups: SeatingGroup[]
}

export interface SeatingRules {
  /** 지정 좌석: seat_id → student_id */
  fixed: Array<{ seat_id: string; student_id: string }>
  /** 떨어져야 하는 친구 묶음 (각 묶음의 학생들은 서로 같은 group 안에 같이 있지 않도록) */
  apart: Array<{ id: string; student_ids: string[] }>
  /** 붙어야 하는 친구 묶음 (같은 그룹/짝/모둠에 함께 배정 시도) */
  together: Array<{ id: string; student_ids: string[] }>
}

export interface SeatingConfig {
  type: SeatingType
  totalSeats: number
  layout: SeatingLayout
  rules: SeatingRules
  updated_at?: string
}

export interface SeatingAssignmentRow {
  seat_id: string
  group_id: string
  student_id: string
  student_name: string
}

export interface SeatingAssignmentData {
  saved_at: string | null
  layout: SeatingLayout | null
  assignments: SeatingAssignmentRow[]
}
