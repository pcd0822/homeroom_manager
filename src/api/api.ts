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

  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (method === 'POST') {
    options.body = JSON.stringify({ action, ...payload })
  }

  const res = await fetch(method === 'GET' ? url.toString() : BASE_URL, options)
  const data = (await res.json()) as ApiResponse<T>
  if (!res.ok) {
    return { success: false, error: data.error || res.statusText }
  }
  return data
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
