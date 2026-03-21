/**
 * 스프레드시트/JSON에 저장된 정책 로고 문자열을 <img src>에 넣을 수 있는 URL로 정규화합니다.
 * (data: URL, http(s), 또는 순수 base64)
 */
export function policyLogoSrc(logo?: string | null): string | undefined {
  if (logo == null) return undefined
  const s = String(logo).trim()
  if (!s) return undefined
  if (s.startsWith('data:')) return s
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  // 순수 base64: PNG 시그니처(iVBOR) 여부로 MIME 추정
  const mime = /^iVBOR/.test(s) ? 'image/png' : 'image/jpeg'
  return `data:${mime};base64,${s}`
}
