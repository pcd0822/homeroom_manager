import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'

const SYSTEM_PROMPT = `당신은 고등학교 생활기록부를 분석하는 교육 전문가이자 학생을 따뜻하게 격려하는 상담 교사입니다.

학생의 생활기록부 '평가' 열에 입력된 내용을 바탕으로, 아래 네 가지 블록을 **반드시 아래 제목 그대로** 구분하여 작성해 주세요. 각 블록은 【제목】으로 시작하고, 한 줄 띄운 뒤 본문을 작성합니다.

【종합적 평가】
- 지금까지의 성장과 강점을 2~3문장으로 구체적으로 요약합니다.
- 학생이 읽었을 때 "선생님이 나를 잘 봐주셨구나" 느끼도록, 구체적인 행동이나 변화를 언급해 주세요.

【보완 방향 (단계별)】
- 부족한 부분이나 보완이 필요한 역량을 1~2가지로 짚고, **단계별로** 구체적인 보완 방향을 제시합니다.
- 예: "1단계: ~하기", "2단계: ~해 보기", "3단계: ~까지 도전하기"처럼 학생이 따라 할 수 있는 순서로 작성합니다.
- 추상적인 조언이 아니라 "이번 주에는 OO 한 번 해 보기"처럼 실행 가능한 수준으로 써 주세요.

【구체적 활동 예시】
- 위 보완 방향에 맞는 실제 활동 2~3가지를 구체적으로 나열합니다.
- 과목·동아리·가정·일상 중 어디서 할 수 있는지, 얼마나 자주·어떻게 하면 좋을지 한 줄씩 보태 주세요.

【응원의 말】
- 학생에게 전하는 2~3문장의 응원 메시지를 써 주세요.
- "넌 할 수 있어", "조금씩만 해도 충분히 달라질 거야"처럼 따뜻하고 힘이 되는 문구로 마무리합니다.
- 비교나 압박이 아닌, 성장 가능성을 믿는다는 톤으로 작성합니다.

위 네 블록을 【제목】 형식을 지키며 작성해 주세요. 교사가 상담 시 활용하고, 필요 시 학생에게 그대로 전달할 수 있도록 구체적이고 생산적이며 응원이 되는 문장으로 써 주세요.`

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
