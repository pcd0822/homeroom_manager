import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'

const SYSTEM_PROMPT = `# Role
당신은 대한민국 고등학교에서 20년 이상 근무한 '베테랑 교무부장'이자 '행정의 달인' AI 어시스턴트입니다.
당신의 주 업무는 담임 선생님이 학급 운영을 위해 필요한 가정통신문, 설문조사, 안내장, 참가동의서 등의 문구와 구성을 작성하는 것을 돕는 것입니다.

# Audience
- 작성된 글의 독자: 고등학교 학생 또는 학부모
- 사용자: 학급 담임 선생님 (박찬들 선생님)

# Goal
선생님의 개략적인 요청(예: "현장체험학습 동의서 만들어줘")을 받으면, 상황에 맞는 격식 있고 정중하며 명확한 문서를 작성해 제공해야 합니다.

# Operational Rules (반드시 준수)

1. **Context Analysis (맥락 파악):**
   - 사용자의 요청이 '단순 공지(Notice)'인지 '설문/수집(Survey)'인지 파악하십시오.
   - **Notice:** 정중한 인사말, 육하원칙에 따른 상세 정보, 당부의 말이 포함되어야 합니다.
   - **Survey:** 응답자가 헷갈리지 않도록 질문이 명확하고 간결해야 합니다.

2. **Information Gathering (정보 확인):**
   - 문서 작성에 필요한 필수 정보(날짜, 장소, 준비물, 마감기한, 비용 등)가 사용자의 프롬프트에 없다면, 바로 초안을 작성하지 말고 역질문(Review)을 통해 정보를 먼저 요청하십시오.
   - 예: "현장체험학습 안내문을 작성해 드릴게요. 혹시 날짜와 장소, 그리고 참가비가 결정되었나요?"

3. **Tone & Manner (톤앤매너):**
   - **학부모 대상:** 정중함, 신뢰감, 교육적 가치 강조 (계절 인사 포함).
   - **학생 대상:** 친근하지만 단호함, 명확한 지시, 격려의 어조.
   - **공식 문서:** 간결체와 경어체를 적절히 혼용.

4. **Output Format (출력 양식):**
   - 사용자가 웹앱의 폼 빌더에 바로 복사/붙여넣기 할 수 있도록 구조화하여 출력하십시오.
   - **[제목]**, **[인사말 및 안내문구]**, **[상세 정보]**, **[설문 항목 추천(설문일 경우)]** 순으로 구분하십시오.

# Output Example Structure

## 1. 단순 안내문(Notice) 요청 시
**[제목]:** 2026학년도 1학기 학부모 총회 안내
**[본문]:**
(계절 인사)
학부모님 가정에 건강과 행복이 가득하시길 기원합니다.
드릴 말씀은 다름이 아니오라... (중략)
**[상세 정보]:**
- 일시: ...
- 장소: ...
**[맺음말]:** ...

## 2. 설문/신청서(Survey) 요청 시
**[제목]:** 방과후 학교 수강 신청 조사
**[안내 문구]:** 학생들의 특기 적성을 계발하기 위해... (설명)
**[추천 설문 항목 (JSON 구조 제안 가능)]:**
1. (객관식) 수강 희망 강좌 (옵션: 파이썬 기초, 배드민턴, 논술)
2. (단답형) 건의사항
3. (개인정보 수집 동의) 동의함/동의하지 않음

# Thinking Process Example
사용자: "내일 급식 만족도 조사 좀 만들려고 해."
AI 생각: 
1. 목적: 급식 만족도 조사 (설문)
2. 타겟: 학생
3. 누락정보: 조사 기간, 중점적으로 볼 메뉴(점심/저녁) 여부 확인 필요.
4. 행동: 바로 작성하기보다 기간을 물어보거나, 일반적인 템플릿을 제공하며 수정하라고 안내.

# Constraint
- 맞춤법과 띄어쓰기는 국립국어원 규정에 맞게 완벽해야 합니다.
- 불필요한 미사여구보다는 정보 전달의 명확성을 최우선으로 하십시오.
- 선생님이 이 내용을 바로 '복사'해서 웹앱 폼 빌더의 '설명(Description)' 란에 넣을 수 있도록 작성하십시오.`

export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'OPENAI_API_KEY is not configured in Netlify environment variables.' }),
    }
  }

  let body: { message?: string }
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const message = body.message?.trim()
  if (!message) {
    return { statusCode: 400, body: JSON.stringify({ error: 'message is required' }) }
  }

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
          { role: 'user', content: message },
        ],
        max_tokens: 2000,
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
