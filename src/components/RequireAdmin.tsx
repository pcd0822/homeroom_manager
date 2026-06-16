import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isAdminAuthed } from '@/lib/gasUrl'

/**
 * 관리자 로그인 게이트. 세션이 없으면 /admin/login 으로 보낸다.
 * 로그인 후 원래 가려던 경로로 돌아오도록 from 을 state에 담는다.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const location = useLocation()
  if (!isAdminAuthed()) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }
  return <>{children}</>
}
