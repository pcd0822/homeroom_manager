# 학급 경영 올인원 웹 앱

선생님이 가정통신문·설문·참가 동의서 등을 보내고 데이터를 수집·관리하는 시스템입니다.

## Tech Stack

- **Frontend:** React (Vite), TypeScript, Tailwind CSS, shadcn/ui, React Hook Form, TanStack Table, React Router
- **Backend:** Google Apps Script (GAS)
- **Database:** Google Spreadsheets
- **Deploy:** Netlify (프론트), Google Workspace (GAS)

## 프로젝트 구조

`PROJECT_STRUCTURE.md` 참고.

## 개발 방법

### 1. 프론트엔드

```bash
npm install
npm run dev
```

GAS URL 연동(런타임): 빌드에 URL을 고정하지 않습니다. 관리자는 **`/admin/login`에서 본인 GAS URL + 비밀번호로 로그인**해 연결하고, 학생은 교사가 공유한 **`?api=` 링크**로 접속합니다. (자세한 내용은 아래 "관리자 로그인 / DB 비공개" 참고)

```env
# (선택) 로컬 개발 편의용. 개발 서버(npm run dev)에서만 사용되며 프로덕션 빌드에서는 무시됩니다.
VITE_GAS_API_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

### 2. Google Sheets 시트 구성

스프레드시트에 아래 시트(탭)를 만들고, 첫 행에 헤더를 넣습니다.

- **Forms:** form_id, folder_id, title, type, schema, is_active, created_at
- **Responses:** response_id, form_id, student_id, student_name, answer_data, submitted_at
- **Folders:** folder_id, name
- **Students:** student_id, name, auth_code
- **Class:** grade, class, teacher_name (명렬표 정보 1행, 없으면 GAS가 자동 생성)

### 3. GAS 배포

1. [script.google.com](https://script.google.com)에서 새 프로젝트 생성
2. `gas/Code.gs` 내용을 복사해 붙여넣기
3. Script Property에 `SPREADSHEET_ID` 설정 (또는 코드 내 상수 수정)
4. 배포 → 웹 앱으로 배포 (실행 사용자: 본인, 액세스: 모든 사용자)
5. 배포된 URL을 복사해 두었다가 `/admin/login`에서 입력해 연결 (초기 비밀번호 `1234`)

## 관리자 로그인 / DB 비공개

- **DB 비공개**: 사이트에 그냥 접속한 사람에게는 연결된 시트가 전혀 없습니다. GAS URL이 빌드에 들어있지 않기 때문입니다.
- **관리자**: `/admin` 진입 시 로그인 게이트로 막힙니다. `/admin/login`에서 **GAS 배포 URL + 비밀번호**로 로그인합니다.
  - **초기 비밀번호는 `1234`** 입니다. 로그인 후 좌측 메뉴 하단 **"비밀번호 변경"**에서 반드시 변경하세요.
  - 비밀번호는 GAS의 Script Properties에 **salt + SHA-256 해시**로 저장됩니다(시트에 평문 저장 안 함).
  - **GAS URL은 디바이스(localStorage)에 저장**되어 다음 로그인 때 자동 입력됩니다.
  - **로그인 세션은 sessionStorage**에 있어 **웹앱(탭/창)을 닫으면 자동 로그아웃**됩니다. 사용 중에는 유지됩니다.
- **학생**: 기존과 동일하게 **학번 + 학생코드**로 인증합니다. 교사가 만든 공유 링크에는 GAS URL이 `?api=`로 포함되어, 학생 브라우저가 자동으로 해당 학급 시트에 연결됩니다.
- **보안 한계(중요)**: GAS 웹앱이 "액세스: 모든 사용자"로 배포되므로, **GAS URL을 아는 사람은 API를 직접 호출할 수 있습니다.** 본 로그인은 프론트엔드 접근 차단(우연한 조회 방지)이며, 서버 단 액션별 인증은 아닙니다. URL을 공개 채널에 노출하지 마세요.

## 데이터 저장·조회 (웹 ↔ 구글 시트)

- **웹에서 등록/작성** → 웹앱이 GAS API를 호출하고, GAS가 구글 스프레드시트에 저장합니다. (학생 등록, 폼 생성, 폴더 생성, 응답 제출 등 모두 동일)
- **시트에 직접 입력** → 같은 스프레드시트를 GAS가 읽으므로, 시트에 직접 행을 추가해도 웹에서 조회됩니다. (열 이름·순서는 위 시트 구성과 맞춰야 함)
- 정리: **웹에서 하든 시트에서 하든, 같은 시트를 보고 씁니다.**

## "Failed to fetch" / 서버 연결 실패 시

- 프론트는 GAS에 **Content-Type: text/plain**으로 POST합니다. (GAS가 OPTIONS를 처리하지 않아 CORS preflight를 피하기 위함. GAS는 본문을 그대로 JSON으로 파싱합니다.)
1. **GAS 배포 확인**: 스크립트 편집기에서 "배포" → "웹 앱으로 배포"가 되어 있고, URL이 `/admin/login`에 입력한 값과 같은지 확인
2. **연결된 GAS 없음**: "연결된 GAS가 없습니다" 메시지가 보이면 관리자는 `/admin/login`에서 다시 로그인, 학생은 교사가 준 `?api=` 링크로 접속했는지 확인
3. **스프레드시트**: GAS에서 사용하는 스프레드시트에 위 시트(탭)들이 있고, Script Property `SPREADSHEET_ID` 또는 코드 내 스프레드시트 지정이 맞는지 확인

## 라우트

- `/admin` — 관리자 대시보드 (폴더/문서 카드, +폴더로 폴더 생성)
- `/admin/forms/new` — 새 문서 만들기 (폼 빌더 + 가정통신문 챗봇)
- `/admin/forms/:formId/responses` — 해당 문서 응답 그리드
- `/admin/students` — 학생관리 (학번·이름 등록, 인증코드 발급)
- `/view/:formId` — 학생용 폼 보기/제출 (인증 후 Survey 또는 Notice 렌더링)
- `/register` — 학생 자가등록 (학번·이름 입력 후 인증코드 발급)
- `/game/home-run`, `/student/meal-board`, `/cleaning-result` — 학생·공유용 페이지

## 링크 미리보기 (카카오톡·SNS 제목)

- 브라우저 탭 제목·일부 환경: `react-helmet-async`로 **문서 제목·게임 제목** 등이 반영됩니다.
- 카카오 등 **자바스크립트를 실행하지 않는** 미리보기: Netlify **Edge Function** `netlify/edge-functions/share-meta.ts`가 크롤러 요청 시 HTML의 `<title>`·`og:title`을 바꿉니다.
- **필수:** Netlify → Environment variables에 **`GAS_API_URL`**(값은 `VITE_GAS_API_URL`과 동일한 GAS 웹앱 URL)을 추가하고, 변수 설정에서 **Edge functions** 스코프가 적용되도록 합니다. (`VITE_`만 빌드에 쓰이면 Edge에서 안 읽힐 수 있어 별도 키를 둡니다.)
- `/view/:formId` 미리보기 제목은 Edge에서 GAS `GET_FORM`으로 문서 `title`을 불러옵니다.

## Netlify 환경 변수 (가정통신문 챗봇)

- **OPENAI_API_KEY** — OpenAI API 키 (Netlify 대시보드 → Site settings → Environment variables). 새 문서 만들기 페이지 오른쪽 챗봇에서 사용합니다.

## 라이선스

Private
