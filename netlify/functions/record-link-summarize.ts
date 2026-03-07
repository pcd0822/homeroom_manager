import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'

const SYSTEM_PROMPT = `당신은 생활기록부 기록을 요약하는 도우미입니다.
주어진 "연결된 기록"과 "참조된 기록" 텍스트를 각각 1~2문장으로 핵심만 요약해 주세요.
응답은 반드시 JSON 배열 하나만 출력하세요. 예: [{"from_summary":"...", "to_summary":"..."}, ...]
각 객체는 from_summary(첫 번째 기록 요약), to_summary(두 번째 기록 요약) 키를 가집니다.`

export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'OPENAI_API_KEY is not configured.' }),
    }
  }

  let body: { pairs?: Array<{ from_text: string; to_text: string }> }
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const pairs = Array.isArray(body.pairs) ? body.pairs : []
  if (pairs.length === 0) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summaries: [] }) }
  }

  const userContent = pairs
    .map(
      (p, i) =>
        `[${i + 1}] 연결된 기록: ${(p.from_text || '').slice(0, 500)}\n참조된 기록: ${(p.to_text || '').slice(0, 500)}`
    )
    .join('\n\n')

  const prompt = `위 각 번호별로 "연결된 기록"과 "참조된 기록"을 각각 1~2문장으로 요약한 JSON 배열만 출력하세요. ${pairs.length}개 객체, 각각 from_summary, to_summary 키.\n\n${userContent}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1500,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return { statusCode: res.status, body: JSON.stringify({ error: err || 'OpenAI API error' }) }
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data.choices?.[0]?.message?.content?.trim() ?? '[]'
    let summaries: Array<{ from_summary: string; to_summary: string }>
    try {
      let jsonStr = raw
      const arrMatch = raw.match(/\[[\s\S]*\]/)
      if (arrMatch) jsonStr = arrMatch[0]
      const parsed = JSON.parse(jsonStr)
      summaries = Array.isArray(parsed)
        ? parsed.map((o: unknown) => ({
            from_summary: typeof (o as { from_summary?: string }).from_summary === 'string' ? (o as { from_summary: string }).from_summary : '',
            to_summary: typeof (o as { to_summary?: string }).to_summary === 'string' ? (o as { to_summary: string }).to_summary : '',
          }))
        : pairs.map(() => ({ from_summary: '', to_summary: '' }))
    } catch {
      summaries = pairs.map((p) => ({
        from_summary: (p.from_text || '').slice(0, 80) + ((p.from_text || '').length > 80 ? '…' : ''),
        to_summary: (p.to_text || '').slice(0, 80) + ((p.to_text || '').length > 80 ? '…' : ''),
      }))
    }
    while (summaries.length < pairs.length) {
      summaries.push({ from_summary: '', to_summary: '' })
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summaries: summaries.slice(0, pairs.length) }),
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
    }
  }
}
