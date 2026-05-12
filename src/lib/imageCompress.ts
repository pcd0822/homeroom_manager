/**
 * 이미지 파일을 스프레드시트 셀(약 5만자) + GAS POST 본문에 안전하게 들어갈
 * 크기의 JPEG data URL로 압축한다.
 *
 * 정책 로고용 compressPolicyLogo.ts와 동일한 패턴을 일반화한 버전.
 */

interface CompressOpts {
  /** 긴 변 최대 픽셀. 기본 800 */
  maxSide?: number
  /** 초기 JPEG 품질 (0~1). 기본 0.82 */
  quality?: number
  /** 최대 허용 data URL 길이(문자). 기본 35000 — 시트 셀 5만자 한계의 70% 정도 */
  maxChars?: number
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지를 불러올 수 없습니다.'))
    }
    img.src = url
  })
}

export async function compressImageToDataUrl(
  file: File,
  opts: CompressOpts = {}
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 선택할 수 있습니다.')
  }
  const targetMaxChars = opts.maxChars ?? 35000
  const img = await loadImage(file)
  let maxSide = opts.maxSide ?? 800
  let quality = opts.quality ?? 0.82
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('브라우저에서 이미지 처리를 지원하지 않습니다.')

  for (let attempt = 0; attempt < 14; attempt++) {
    let w = img.naturalWidth
    let h = img.naturalHeight
    const scale = Math.min(1, maxSide / Math.max(w, h))
    w = Math.max(1, Math.round(w * scale))
    h = Math.max(1, Math.round(h * scale))
    canvas.width = w
    canvas.height = h
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    if (dataUrl.length <= targetMaxChars) return dataUrl
    maxSide = Math.max(160, Math.floor(maxSide * 0.85))
    quality = Math.max(0.35, quality - 0.07)
  }

  // 마지막 안전망: 강하게 축소해서라도 한도 안에 들이기
  canvas.width = 160
  canvas.height = 160
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 160, 160)
  ctx.drawImage(img, 0, 0, 160, 160)
  let dataUrl = canvas.toDataURL('image/jpeg', 0.4)
  if (dataUrl.length > targetMaxChars) {
    dataUrl = canvas.toDataURL('image/jpeg', 0.3)
  }
  return dataUrl
}
