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
}

export interface SmsLog {
  log_id: string
  sent_at: string
  receiver_count: number
  message_content: string
  status: string
}

/** GAS API 공통 응답 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
