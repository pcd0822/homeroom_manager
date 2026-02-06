# 학급 경영 올인원 웹 앱

선생님이 가정통신문·설문·참가 동의서 등을 보내고 데이터를 수집·관리하며, 필요 시 문자를 발송하는 시스템입니다.

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

GAS URL 연동: `.env`에 다음 추가 후 사용

```env
VITE_GAS_API_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

### 2. Google Sheets 시트 구성

스프레드시트에 아래 시트(탭)를 만들고, 첫 행에 헤더를 넣습니다.

- **Forms:** form_id, folder_id, title, type, schema, is_active, created_at
- **Responses:** response_id, form_id, student_id, student_name, answer_data, submitted_at
- **Folders:** folder_id, name
- **Students:** student_id, name, auth_code, phone_student, phone_parent
- **SmsLogs:** log_id, sent_at, receiver_count, message_content, status

### 3. GAS 배포

1. [script.google.com](https://script.google.com)에서 새 프로젝트 생성
2. `gas/Code.gs` 내용을 복사해 붙여넣기
3. Script Property에 `SPREADSHEET_ID` 설정 (또는 코드 내 상수 수정)
4. 배포 → 웹 앱으로 배포 (실행 사용자: 본인, 액세스: 모든 사용자)
5. 배포된 URL을 프론트엔드 `VITE_GAS_API_URL`에 설정

## 데이터 저장·조회 (웹 ↔ 구글 시트)

- **웹에서 등록/작성** → 웹앱이 GAS API를 호출하고, GAS가 구글 스프레드시트에 저장합니다. (학생 등록, 폼 생성, 폴더 생성, 응답 제출 등 모두 동일)
- **시트에 직접 입력** → 같은 스프레드시트를 GAS가 읽으므로, 시트에 직접 행을 추가해도 웹에서 조회됩니다. (열 이름·순서는 위 시트 구성과 맞춰야 함)
- 정리: **웹에서 하든 시트에서 하든, 같은 시트를 보고 씁니다.**

## "Failed to fetch" / 서버 연결 실패 시

1. **GAS 배포 확인**: 스크립트 편집기에서 "배포" → "웹 앱으로 배포"가 되어 있고, URL이 복사된 값과 같은지 확인
2. **VITE_GAS_API_URL**:  
   - 로컬: `.env`에 `VITE_GAS_API_URL=실제_GAS_웹앱_URL`  
   - Netlify: Site settings → Environment variables에 `VITE_GAS_API_URL` 추가 후 **사이트 다시 빌드·배포** (빌드 시점에 값이 들어가므로, 추가만 하고 재배포하지 않으면 적용 안 됨)
3. **스프레드시트**: GAS에서 사용하는 스프레드시트에 위 5개 시트(탭)가 있고, Script Property `SPREADSHEET_ID` 또는 코드 내 스프레드시트 지정이 맞는지 확인

## 라우트

- `/admin` — 관리자 대시보드 (폴더/문서 카드, +폴더로 폴더 생성)
- `/admin/forms/new` — 새 문서 만들기 (폼 빌더 + 가정통신문 챗봇)
- `/admin/forms/:formId/responses` — 해당 문서 응답 그리드
- `/admin/sms` — 문자 발송 (학생/학부모 번호 선택)
- `/admin/students` — 학생관리 (학번·이름 등록, 인증코드 발급)
- `/view/:formId` — 학생용 폼 보기/제출 (인증 후 Survey 또는 Notice 렌더링)

## Netlify 환경 변수 (가정통신문 챗봇)

- **OPENAI_API_KEY** — OpenAI API 키 (Netlify 대시보드 → Site settings → Environment variables). 새 문서 만들기 페이지 오른쪽 챗봇에서 사용합니다.

## 라이선스

Private
