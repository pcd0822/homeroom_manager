/**
 * 정책 로고를 스프레드시트 셀(~5만자) 및 GAS 전송에 맞게 JPEG로 압축합니다.
 */
/** 스프레드시트 셀 5만자·JSON·GAS 전송 여유를 두고 여유 있게 제한 */
const MAX_DATA_URL_CHARS = 32000

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

export async function compressImageFileToPolicyLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 선택할 수 있습니다.')
  }
  const img = await loadImage(file)
  let maxSide = 520
  let quality = 0.82
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('브라우저에서 이미지 처리를 지원하지 않습니다.')

  for (let attempt = 0; attempt < 12; attempt++) {
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
    if (dataUrl.length <= MAX_DATA_URL_CHARS) {
      return dataUrl
    }
    maxSide = Math.max(120, Math.floor(maxSide * 0.85))
    quality = Math.max(0.35, quality - 0.08)
  }

  canvas.width = 120
  canvas.height = 120
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 120, 120)
  ctx.drawImage(img, 0, 0, 120, 120)
  let dataUrl = canvas.toDataURL('image/jpeg', 0.5)
  if (dataUrl.length > MAX_DATA_URL_CHARS) {
    dataUrl = canvas.toDataURL('image/jpeg', 0.35)
  }
  return dataUrl
}
