/**
 * GAS 배포 URL 런타임 해석 + 관리자 세션 관리
 *
 * 빌드 시점에 URL을 고정하지 않는다. 대신 다음 우선순위로 런타임에 해석한다.
 *   1) 현재 URL의 ?api= 쿼리 (학생 공유 링크에 임베드된 GAS URL)
 *   2) 관리자 로그인 세션에 저장된 GAS URL
 *   3) 학생 페이지가 과거에 ?api= 로 받아 저장해 둔 GAS URL
 *   4) (개발 모드 한정) VITE_GAS_API_URL — 프로덕션 빌드에서는 무시
 *
 * 이렇게 하면 사이트에 그냥 접속한 사람은 연결된 시트가 전혀 없어(=DB 비공개),
 * 관리자는 로그인으로, 학생은 교사가 공유한 링크(?api=)로만 데이터에 닿는다.
 */

const ADMIN_URL_KEY = 'homeroom_admin_gas_url' // 디바이스에 영구 저장(localStorage) — 다음 로그인 자동 입력
const SESSION_KEY = 'homeroom_admin_session' // 로그인 세션(sessionStorage) — 웹앱을 닫으면 사라짐 → 자동 로그아웃
const STUDENT_URL_KEY = 'homeroom_student_gas_url'

/** GAS 웹앱 배포 URL 형식 검증 (script.google.com 으로 강제 — 임의 호스트로 데이터 유출 방지) */
export function isValidGasUrl(url: string): boolean {
  if (!url) return false
  return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/(exec|dev)\b/.test(url.trim())
}

function readQueryApi(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = new URLSearchParams(window.location.search).get('api')
    if (!raw) return null
    const url = decodeURIComponent(raw).trim()
    return isValidGasUrl(url) ? url : null
  } catch {
    return null
  }
}

/**
 * 학생 진입 시 URL의 ?api= 를 localStorage에 저장한다.
 * SPA 내부 이동(navigate)으로 쿼리가 사라져도 이후 호출이 같은 GAS를 가리키도록 한다.
 * 앱 부트스트랩에서 1회 호출.
 */
export function captureStudentApiFromUrl(): void {
  const api = readQueryApi()
  if (api) {
    try {
      localStorage.setItem(STUDENT_URL_KEY, api)
    } catch {
      // 저장 실패는 무시 (쿼리값으로 계속 동작)
    }
  }
}

// ----- 관리자 세션 -----
// GAS URL은 디바이스에 영구 저장(localStorage)하여 다음 로그인 때 자동 입력한다.
// 로그인 세션 플래그는 sessionStorage에 둔다 → 웹앱(탭/창)을 닫으면 사라져 자동 로그아웃되고,
// 사용 중(같은 탭 내 새로고침·이동)에는 로그인이 유지된다.

/** 디바이스에 저장된 관리자 GAS URL */
export function getAdminGasUrl(): string | null {
  try {
    const url = localStorage.getItem(ADMIN_URL_KEY)
    return url && isValidGasUrl(url) ? url : null
  } catch {
    return null
  }
}

/** 로그인 성공: GAS URL을 디바이스에 저장하고 세션을 연다. */
export function setAdminSession(gasUrl: string): void {
  const url = gasUrl.trim()
  try {
    localStorage.setItem(ADMIN_URL_KEY, url)
  } catch {
    // URL 저장 실패는 무시 (세션만으로도 동작)
  }
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ gasUrl: url, loggedInAt: Date.now() }))
  } catch {
    // 무시
  }
}

/** 로그아웃: 세션만 닫는다. 저장된 GAS URL은 다음 로그인 편의를 위해 유지. */
export function clearAdminSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // 무시
  }
}

export function isAdminAuthed(): boolean {
  try {
    if (!sessionStorage.getItem(SESSION_KEY)) return false
  } catch {
    return false
  }
  return !!getAdminGasUrl()
}

// ----- 현재 활성 GAS URL 해석 -----
export function getGasUrl(): string | null {
  const q = readQueryApi()
  if (q) return q

  const admin = getAdminGasUrl()
  if (admin) return admin

  try {
    const student = localStorage.getItem(STUDENT_URL_KEY)
    if (student && isValidGasUrl(student)) return student
  } catch {
    // 무시
  }

  // 개발 편의: dev 서버에서만 .env 의 VITE_GAS_API_URL 사용. 프로덕션 빌드에서는 항상 무시.
  if (import.meta.env.DEV && import.meta.env.VITE_GAS_API_URL) {
    return import.meta.env.VITE_GAS_API_URL as string
  }

  return null
}

/**
 * 학생에게 공유할 링크를 만든다. 현재 연결된 GAS URL을 ?api= 로 임베드하여
 * 받는 사람의 브라우저가 곧바로 교사의 시트에 연결되게 한다.
 * @param path 앱 내부 경로. 쿼리 포함 가능 (예: '/cleaning-result?helper=3')
 */
export function buildShareUrl(path: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const gasUrl = getGasUrl()
  try {
    const u = new URL(path, origin)
    if (gasUrl) u.searchParams.set('api', gasUrl)
    return u.toString()
  } catch {
    // path 파싱 실패 시 단순 결합 폴백
    const sep = path.includes('?') ? '&' : '?'
    return gasUrl ? `${origin}${path}${sep}api=${encodeURIComponent(gasUrl)}` : `${origin}${path}`
  }
}
