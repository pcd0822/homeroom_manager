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
  RecordByStudent,
  AssignmentRow,
  NightStudyConfig,
  NightStudyForStudent,
  ClassGameRankingRow,
  Policy,
  PolicyParticipant,
  PolicyTreeDashboard,
  SeatingConfig,
  SeatingLayout,
  SeatingAssignmentData,
  SeatingAssignmentRow,
  TeacherQuizQuestion,
  TeacherQuizScoreRow,
  TeacherQuizSurveyAnswer,
  TeacherQuizSurveyRow,
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

export function updateForm(params: {
  form_id: string
  folder_id?: string
  title?: string
  type?: 'survey' | 'notice'
  schema?: FormSchema | string
}) {
  return request('UPDATE_FORM', 'POST', params)
}

export function deleteForm(formId: string) {
  return request('DELETE_FORM', 'POST', { form_id: formId })
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
/** 학번을 자연 정렬(숫자 우선)로 비교. "1" < "2" < "10" 같은 직관적 순서. */
export function compareStudentIds(a: string, b: string) {
  return String(a).localeCompare(String(b), 'ko', { numeric: true, sensitivity: 'base' })
}

export async function getStudents() {
  const res = await request<Student[]>('GET_STUDENTS', 'POST')
  if (res.success && res.data) {
    res.data.sort((a, b) => compareStudentIds(a.student_id, b.student_id))
  }
  return res
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
  photo_data?: string
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

export async function getNonResponders(formId: string) {
  const res = await request<Student[]>('GET_NON_RESPONDERS', 'POST', { form_id: formId })
  if (res.success && res.data) {
    res.data.sort((a, b) => compareStudentIds(a.student_id, b.student_id))
  }
  return res
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

// ----- 생기부 record -----
export function ensureRecordSheet() {
  return request('ENSURE_RECORD_SHEET', 'POST')
}

export function getRecordByStudent(studentId: string) {
  return request<RecordByStudent>('GET_RECORD_BY_STUDENT', 'POST', { student_id: studentId })
}

/** record 시트에 기록이 있는 학번 목록(중복 제거) */
export function getRecordUpdatedStudentIds() {
  return request<{ student_ids: string[] }>('GET_RECORD_UPDATED_IDS', 'POST')
}

export function getRecordSummaryEvaluation(studentId: string) {
  return request<{ summary_evaluation: string }>('GET_RECORD_SUMMARY_EVALUATION', 'POST', {
    student_id: studentId,
  })
}

export function updateRecordSummaryEvaluation(studentId: string, summaryEvaluation: string) {
  return request('UPDATE_RECORD_SUMMARY_EVALUATION', 'POST', {
    student_id: studentId,
    summary_evaluation: summaryEvaluation,
  })
}

// ----- 청소구역 배정 -----
export function saveCleaningAssignment(assignments: Record<string, Array<{ student_id: string; name: string }>>) {
  return request<{ run_id: string; saved_at: string }>('SAVE_CLEANING_ASSIGNMENT', 'POST', {
    assignments,
  })
}

export function getCleaningAssignment() {
  return request<{
    run_id: string | null
    saved_at: string | null
    assignments: Record<string, Array<{ student_id: string; name: string }>>
  }>('GET_CLEANING_ASSIGNMENT', 'POST')
}

/** 학번별 청소 배정 누적 횟수 */
export function getCleaningAssignmentCounts() {
  return request<Record<string, number>>('GET_CLEANING_ASSIGNMENT_COUNTS', 'POST')
}

/** 칠판·교탁 정리 도우미 저장 */
export function saveCleaningHelper(studentId: string) {
  return request<{ saved_at: string; student_id: string }>('SAVE_CLEANING_HELPER', 'POST', {
    student_id: studentId,
  })
}

/** 최근 저장된 칠판·교탁 정리 도우미 */
export function getCleaningHelper() {
  return request<{ student_id: string | null; saved_at: string | null }>('GET_CLEANING_HELPER', 'POST')
}

/** 학번별 칠판 도우미 누적 횟수 */
export function getCleaningHelperCounts() {
  return request<Record<string, number>>('GET_CLEANING_HELPER_COUNTS', 'POST')
}

// ----- 과제 배당 -----
export function saveAssignments(formId: string, items: Array<{ student_id: string; start_date: string; end_date: string }>) {
  return request<{ form_id: string; count: number }>('SAVE_ASSIGNMENTS', 'POST', {
    form_id: formId,
    assignments: items,
  })
}

export function getAssignmentsByForm(formId: string) {
  return request<AssignmentRow[]>('GET_ASSIGNMENTS_BY_FORM', 'POST', { form_id: formId })
}

export function getAssignmentsByStudent(studentId: string) {
  return request<AssignmentRow[]>('GET_ASSIGNMENTS_BY_STUDENT', 'POST', { student_id: studentId })
}

// ----- 야간 자율학습 -----

export function getNightStudyConfig() {
  return request<NightStudyConfig | null>('GET_NIGHT_STUDY_CONFIG', 'POST')
}

export function saveNightStudyConfig(config: NightStudyConfig) {
  return request('SAVE_NIGHT_STUDY_CONFIG', 'POST', { config })
}

export function getNightStudyForStudent(studentId: string, date: string) {
  return request<NightStudyForStudent>('GET_NIGHT_STUDY_FOR_STUDENT', 'POST', {
    student_id: studentId,
    date,
  })
}

// ----- 학급 게임 -----
export function saveClassGameScore(params: {
  game_id: string
  student_id: string
  student_name: string
  duration_ms: number
  timers_collected?: number
  hits_total?: number
}) {
  return request<{ saved: boolean }>('SAVE_CLASS_GAME_SCORE', 'POST', params)
}

export function getClassGameRanking(gameId: string, limit = 50) {
  return request<ClassGameRankingRow[]>('GET_CLASS_GAME_RANKING', 'POST', {
    game_id: gameId,
    limit,
  })
}

// ----- 학생 정책(씨앗) -----
export function savePolicy(params: {
  policy_id?: string
  title: string
  goal: string
  description: string
  expected_effect: string
  seeds_per_participation: number
  logo_data: string
  creator_student_id: string
  co_registrants: string[]
  participation_links?: string[]
  actor_student_id: string
  is_teacher?: boolean
}) {
  return request<{ policy_id: string }>('SAVE_POLICY', 'POST', params as Record<string, unknown>)
}

export function deletePolicy(policyId: string) {
  return request<{ policy_id: string }>('DELETE_POLICY', 'POST', {
    policy_id: policyId,
    is_teacher: true,
  })
}

export function hypePolicy(params: {
  policy_id: string
  actor_student_id: string
}) {
  return request<{ policy_id: string; hype_count: number }>('HYPE_POLICY', 'POST', params as Record<string, unknown>)
}

export function getPolicies() {
  return request<Policy[]>('GET_POLICIES', 'POST')
}

export function getPoliciesForStudent(studentId: string) {
  return request<Policy[]>('GET_POLICIES_FOR_STUDENT', 'POST', { student_id: studentId })
}

export function getPolicyDetail(policyId: string) {
  return request<Policy>('GET_POLICY_DETAIL', 'POST', { policy_id: policyId })
}

export function getPolicyParticipants(policyId: string) {
  return request<PolicyParticipant[]>('GET_POLICY_PARTICIPANTS', 'POST', { policy_id: policyId })
}

export function setPolicySeeds(params: {
  policy_id: string
  student_id: string
  seeds_count: number
  actor_student_id: string
  is_teacher?: boolean
}) {
  return request<{ saved: boolean }>('SET_POLICY_SEEDS', 'POST', params as Record<string, unknown>)
}

export function batchSetPolicySeeds(params: {
  policy_id: string
  items: Array<{ student_id: string; seeds_count: number }>
  actor_student_id: string
  is_teacher?: boolean
}) {
  return request<{ saved: boolean }>('BATCH_SET_POLICY_SEEDS', 'POST', params as Record<string, unknown>)
}

export function getPolicyTreeDashboard() {
  return request<PolicyTreeDashboard>('GET_POLICY_TREE_DASHBOARD', 'POST')
}

// ----- 씨앗 가계부/교환 -----
export function getStudentSeedLedger(studentId: string) {
  return request<{
    balance: number
    gains: Array<{ created_at: string; policy_id: string; policy_title: string; amount: number }>
    spends: Array<{ created_at: string; product_name: string; memo: string; amount: number }>
    transactions: Array<{
      created_at: string
      tx_type: string
      policy_title: string
      product_name: string
      memo: string
      amount: number
      remaining_after: number
    }>
  }>('GET_STUDENT_SEED_LEDGER', 'POST', { student_id: studentId })
}

export function getSeedProducts() {
  return request<
    Array<{ product_id: string; product_name: string; seeds_required: number; created_at: string }>
  >('GET_SEED_PRODUCTS', 'POST')
}

export function saveSeedProduct(params: { product_name: string; seeds_required: number }) {
  return request<{ product_id: string }>('SAVE_SEED_PRODUCT', 'POST', params as Record<string, unknown>)
}

export function spendSeeds(params: {
  student_id: string
  seeds_used: number
  product_id: string
  memo: string
  actor_student_id: string
}) {
  return request<{ balance: number }>('SPEND_SEEDS', 'POST', params as Record<string, unknown>)
}

export function getClassSeedSummary() {
  return request<
    Array<{
      student_id: string
      student_name: string
      photo_data?: string
      total_gained: number
      total_spent: number
      balance: number
    }>
  >('GET_CLASS_SEED_SUMMARY', 'POST')
}

// ----- 자리 배치 -----
export function getSeatingConfig() {
  return request<SeatingConfig | null>('GET_SEATING_CONFIG', 'POST')
}

export function saveSeatingConfig(config: SeatingConfig) {
  return request<{ updated_at: string }>('SAVE_SEATING_CONFIG', 'POST', { config } as Record<string, unknown>)
}

export function getSeatingAssignment() {
  return request<SeatingAssignmentData>('GET_SEATING_ASSIGNMENT', 'POST')
}

export function saveSeatingAssignment(layout: SeatingLayout, assignments: SeatingAssignmentRow[]) {
  return request<{ saved_at: string }>('SAVE_SEATING_ASSIGNMENT', 'POST', {
    layout,
    assignments,
  } as Record<string, unknown>)
}

// ----- 들샘 모의고사 -----
export function getTeacherQuizQuestions() {
  return request<TeacherQuizQuestion[]>('GET_TEACHER_QUIZ_QUESTIONS', 'POST')
}

export function saveTeacherQuizQuestions(questions: TeacherQuizQuestion[]) {
  return request<{ count: number }>('SAVE_TEACHER_QUIZ_QUESTIONS', 'POST', {
    questions,
  } as Record<string, unknown>)
}

export function saveTeacherQuizScore(params: {
  student_id: string
  student_name: string
  total_score: number
  retries: number
  survey_answers?: TeacherQuizSurveyAnswer[]
}) {
  return request<{ played_at: string }>('SAVE_TEACHER_QUIZ_SCORE', 'POST', params as Record<string, unknown>)
}

export function getTeacherQuizRanking(limit = 100) {
  return request<TeacherQuizScoreRow[]>('GET_TEACHER_QUIZ_RANKING', 'POST', { limit })
}

export function getTeacherQuizSurveys(studentId: string, playedAt?: string) {
  return request<TeacherQuizSurveyRow[]>('GET_TEACHER_QUIZ_SURVEYS', 'POST', {
    student_id: studentId,
    played_at: playedAt || '',
  })
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
