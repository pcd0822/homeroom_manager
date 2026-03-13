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
}
