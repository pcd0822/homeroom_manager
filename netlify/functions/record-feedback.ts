import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'

const SYSTEM_PROMPT = `당신은 고등학교 생활기록부를 분석하는 교육 전문가입니다.
학생의 생활기록부 '평가' 열에 입력된 내용들을 종합하여 다음을 작성해 주세요.
1. 종합적 평가 (전체적인 성장과 강점을 2~3문장으로 요약)
2. 부족한 부분 및 보완이 필요한 역량
3. 구체적인 활동 예시 (실제로 할 수 있는 활동 2~3가지)

답변은 교사가 학생 상담이나 기록에 참고할 수 있도록 간결하고 실용적으로 작성해 주세요.`

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

  let body: { evaluations?: string[] }
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const evaluations = Array.isArray(body.evaluations) ? body.evaluations.filter(Boolean) : []
  const text = evaluations.length > 0
    ? evaluations.join('\n\n')
    : '(입력된 평가 내용이 없습니다.)'

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
          { role: 'user', content: text },
        ],
        max_tokens: 1500,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: err || 'OpenAI API error' }),
      }
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const reply = data.choices?.[0]?.message?.content ?? ''
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply }),
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
    }
  }
}
