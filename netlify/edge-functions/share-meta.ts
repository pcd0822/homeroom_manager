/**
 * 카카오·페이스북 등 링크 미리보기용: 크롤러 요청 시 HTML의 <title>·og:title을 페이지별로 주입합니다.
 * 문서(/view/:id)는 GAS GET_FORM으로 제목을 가져옵니다.
 *
 * Netlify → Site settings → Environment variables 에 다음을 추가하고
 * "Scopes"에서 Edge functions 포함 여부를 켜 주세요.
 *   GAS_API_URL = (VITE_GAS_API_URL과 동일한 GAS 웹앱 URL)
 */
import type { Config, Context } from '@netlify/edge-functions'

declare const Deno: { env: { get(key: string): string | undefined } }

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function fetchFormTitle(gasUrl: string, formId: string): Promise<string | null> {
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'GET_FORM', form_id: formId }),
      signal: controller.signal,
    })
    const json = (await res.json()) as { success?: boolean; data?: { title?: string } }
    if (json?.success && json?.data?.title) {
      const t = String(json.data.title).trim()
      return t.length ? t : null
    }
  } catch {
    // ignore
  } finally {
    clearTimeout(tid)
  }
  return null
}

function injectShareMeta(html: string, title: string, desc: string, canonical: string): string {
  const et = escapeAttr(title)
  const ed = escapeAttr(desc)
  const ec = escapeAttr(canonical)
  let out = html.replace(/<title>[^<]*<\/title>/i, `<title>${et}</title>`)
  out = out.replace(/\n\s*<meta name="description"[^>]*>\s*/gi, '\n')
  out = out.replace(/\n\s*<meta property="og:type"[^>]*>\s*/gi, '\n')
  out = out.replace(/\n\s*<meta property="og:title"[^>]*>\s*/gi, '\n')
  out = out.replace(/\n\s*<meta property="og:description"[^>]*>\s*/gi, '\n')
  out = out.replace(/\n\s*<meta name="twitter:card"[^>]*>\s*/gi, '\n')
  out = out.replace(/\n\s*<meta name="twitter:title"[^>]*>\s*/gi, '\n')
  const pack = `
    <meta name="description" content="${ed}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${et}" />
    <meta property="og:description" content="${ed}" />
    <meta property="og:url" content="${ec}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${et}" />
    <meta name="twitter:description" content="${ed}" />
`
  out = out.replace(/<\/head>/i, `${pack}  </head>`)
  return out
}

export default async function shareMeta(request: Request, context: Context): Promise<Response> {
  const url = new URL(request.url)
  let pathname = url.pathname
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1)

  const accept = request.headers.get('accept') || ''
  if (!accept.includes('text/html')) {
    return context.next()
  }
  if (/\.(js|mjs|css|png|jpg|jpeg|gif|svg|ico|woff2?|map|json|webp)(\?|$)/i.test(pathname)) {
    return context.next()
  }
  if (pathname.startsWith('/assets/')) {
    return context.next()
  }

  const ua = request.headers.get('user-agent') || ''
  const isCrawler =
    /bot|crawler|spider|facebookexternalhit|Facebot|Twitterbot|Slackbot|Discordbot|LinkedInBot|Yeti|kakaotalk|Telegram|WhatsApp|Pinterest|Googlebot|bingpreview|Slurp|Applebot/i.test(
      ua
    )
  if (!isCrawler) {
    return context.next()
  }

  const gasUrl = Deno.env.get('GAS_API_URL') ?? Deno.env.get('VITE_GAS_API_URL') ?? ''

  let rewrite = false
  let pageTitle = '학급 경영 올인원'
  let pageDesc = '학급 문서·설문·학생 관리·게임을 한곳에서 관리합니다.'

  const viewMatch = pathname.match(/\/view\/([^/?#]+)/)
  if (viewMatch) {
    rewrite = true
    const formId = viewMatch[1]
    if (gasUrl) {
      const t = await fetchFormTitle(gasUrl, formId)
      if (t) {
        pageTitle = `${t} | 학급 경영`
        pageDesc = `${t} - 학급 문서·설문`
      } else {
        pageTitle = '문서 | 학급 경영'
        pageDesc = '학급 문서·설문에 참여합니다.'
      }
    } else {
      pageTitle = '문서 | 학급 경영'
      pageDesc = '학급 문서·설문에 참여합니다.'
    }
  } else if (/\/game\/home-run(\/|$|\?)/.test(pathname)) {
    rewrite = true
    pageTitle = '집 보내주세요! | 학급 게임'
    pageDesc = '담임샘을 피해 책상 장애물을 점프·슬라이드로 피하며 최대한 오래 달리세요.'
  } else if (/\/student\/meal-board(\/|$|\?)/.test(pathname)) {
    rewrite = true
    pageTitle = '학급 급식·과제 보드 | 학급 경영'
    pageDesc = '학번·개인코드로 오늘 급식, 학사일정, 배당 과제를 확인합니다.'
  } else if (/\/cleaning-result(\/|$|\?)/.test(pathname)) {
    rewrite = true
    pageTitle = '청소구역 배정 결과 | 학급 경영'
    pageDesc = '학급 청소구역 배정 결과를 확인합니다.'
  }

  if (!rewrite) {
    return context.next()
  }

  const res = await context.next()
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('text/html')) {
    return res
  }

  const html = await res.text()
  const canonical = url.href.split('#')[0]
  const body = injectShareMeta(html, pageTitle, pageDesc, canonical)

  const headers = new Headers(res.headers)
  headers.delete('content-length')

  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  })
}

export const config: Config = {
  path: '/*',
}
