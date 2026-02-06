/**
 * GAS 배포 URL과 통신하는 API 서비스 레이어
 * 배포 후 여기 BASE_URL을 웹 앱 URL로 교체
 */

import type {
  ApiResponse,
  Form,
  FormWithParsedSchema,
  ResponseRow,
  Folder,
  Student,
  FormSchema,
} from '@/types'

const BASE_URL = import.meta.env.VITE_GAS_API_URL || 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'

async function request<T = unknown>(
  action: string,
  method: 'GET' | 'POST' = 'POST',
  payload?: Record<string, unknown>
): Promise<ApiResponse<T>> {
  const url = new URL(BASE_URL)
  if (method === 'GET') {
    url.searchParams.set('action', action)
    if (payload) {
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
      })
    }
  }

  // Content-Type을 text/plain으로 보내야 CORS preflight(OPTIONS)가 발생하지 않음.
  // GAS는 OPTIONS를 처리하지 않으므로, application/json이면 브라우저에서 요청이 막힘.
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  }
  if (method === 'POST') {
    options.body = JSON.stringify({ action, ...payload })
  }

  try {
    const res = await fetch(method === 'GET' ? url.toString() : BASE_URL, options)
    const data = (await res.json()) as ApiResponse<T>
    if (!res.ok) {
      return { success: false, error: data.error || res.statusText }
    }
    return data
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'Failed to fetch' || message.includes('fetch')) {
      return {
        success: false,
        error: '서버에 연결할 수 없습니다. GAS 배포 URL(VITE_GAS_API_URL)과 스프레드시트 연결을 확인하고, Netlify 배포 시 환경변수 설정 후 다시 빌드해 주세요.',
      }
    }
    return { success: false, error: message }
  }
}

// ----- Forms -----
export function getForm(formId: string) {
  return request<Form>('GET_FORM', 'POST', { form_id: formId })
}

export function getForms(folderId?: string) {
  return request<Form[]>('GET_FORMS', 'POST', folderId ? { folder_id: folderId } : undefined)
}

export function createForm(params: {
  folder_id?: string
  title: string
  type: 'survey' | 'notice'
  schema: FormSchema | string
}) {
  return request<{ form_id: string; created_at: string }>('CREATE_FORM', 'POST', params)
}

// ----- Folders -----
export function getFolders() {
  return request<Folder[]>('GET_FOLDERS', 'POST')
}

export function createFolder(params: { name: string }) {
  return request<{ folder_id: string; name: string }>('CREATE_FOLDER', 'POST', params)
}

// ----- Responses -----
export function getResponses(formId: string) {
  return request<ResponseRow[]>('GET_RESPONSES', 'POST', { form_id: formId })
}

export function submitResponse(params: {
  form_id: string
  student_id: string
  student_name: string
  answer_data: Record<string, unknown> | string
}) {
  return request<{ response_id: string; submitted_at: string }>('SUBMIT_RESPONSE', 'POST', params)
}

export function updateResponse(params: {
  response_id: string
  answer_data: Record<string, unknown> | string
}) {
  return request('UPDATE_RESPONSE', 'POST', params)
}

export function deleteResponse(responseId: string) {
  return request('DELETE_RESPONSE', 'POST', { response_id: responseId })
}

// ----- Students & Auth -----
export function getStudents() {
  return request<Student[]>('GET_STUDENTS', 'POST')
}

export function addStudent(params: {
  student_id: string
  name: string
  phone_student?: string
  phone_parent?: string
  email?: string
}) {
  return request<{ student_id: string; name: string; auth_code: string }>('ADD_STUDENT', 'POST', params)
}

export function updateStudent(params: {
  find_by_student_id: string
  student_id?: string
  name?: string
  auth_code?: string
  phone_student?: string
  phone_parent?: string
  email?: string
}) {
  return request('UPDATE_STUDENT', 'POST', params)
}

export function deleteStudent(studentId: string) {
  return request('DELETE_STUDENT', 'POST', { student_id: studentId })
}

export function getClassInfo() {
  return request<{ grade: string; class: string; teacher_name: string }>('GET_CLASS_INFO', 'POST')
}

export function saveClassInfo(params: { grade: string; classNum: string; teacherName: string }) {
  return request<{ grade: string; class: string; teacher_name: string }>('SAVE_CLASS_INFO', 'POST', {
    grade: params.grade,
    class: params.classNum,
    teacher_name: params.teacherName,
  })
}

export function getNonResponders(formId: string) {
  return request<Student[]>('GET_NON_RESPONDERS', 'POST', { form_id: formId })
}

export function authStudent(studentId: string, authCode: string) {
  return request<{ student_id: string; name: string }>('AUTH_STUDENT', 'POST', {
    student_id: studentId,
    auth_code: authCode,
  })
}

// ----- SMS -----
export function sendSms(params: {
  receivers: Array<{ phone: string; name?: string }>
  message?: string
  template?: string
}) {
  return request<{ log_id: string; sent_at: string; receiver_count: number }>('SEND_SMS', 'POST', params)
}

// ----- Helper: Form with parsed schema -----
export function parseFormSchema(form: Form): FormWithParsedSchema {
  let schema: FormSchema | null = null
  try {
    schema = typeof form.schema === 'string' ? JSON.parse(form.schema) : form.schema
  } catch {
    schema = null
  }
  return { ...form, schema }
}
