import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 연락처를 000-0000-0000(또는 01X-XXX-XXXX) 형식으로 맞춤.
 * 빈 문자열이면 빈 문자열 반환.
 */
export function formatPhoneKorean(value: string): string {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length === 0) return ''
  if (digits.length === 11 && digits.startsWith('010')) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10 && /^01[16978]/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length >= 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}${digits.length > 11 ? '-' + digits.slice(11) : ''}`
  }
  if (digits.length >= 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return digits
}
