# 학급 경영 올인원 웹 앱

담임 업무를 한곳에서 처리하는 웹 앱입니다. 가정통신문·설문 수집, 학생 관리, 생기부 기록, 청소구역·자리배치·급식·야자, 학급 정책(새싹), 학급 게임, **상담 캘린더**를 지원합니다.

## Tech Stack

- **Frontend:** React 18 (Vite), TypeScript, Tailwind CSS, React Hook Form, TanStack Table, React Router 6
- **Backend:** Google Apps Script (GAS)
- **Database:** Google Spreadsheets
- **Serverless:** Netlify Functions / Edge Functions (OpenAI 챗봇, 링크 미리보기)
- **Deploy:** Netlify (프론트), Google Workspace (GAS)

## 문서

- `PROJECT_STRUCTURE.md` — 폴더 구조, 인증 구조, GAS API 규약
- `ROUTES.md` — 전체 라우트 목록 (관리자 / 학생·공유)

## 개발 방법

### 1. 프론트엔드

```bash
npm install
npm run dev
```

Netlify Functions(챗봇 등)까지 함께 돌리려면 `netlify dev`를 쓰세요.

GAS URL 연동(런타임): 빌드에 URL을 고정하지 않습니다. 관리자는 **`/admin/login`에서 본인 GAS URL + 비밀번호로 로그인**해 연결하고, 학생은 교사가 공유한 **`?api=` 링크**로 접속합니다. (아래 "관리자 로그인 / DB 비공개" 참고)

```env
# (선택) 로컬 개발 편의용. 개발 서버에서만 사용되며 프로덕션 빌드에서는 무시됩니다.
VITE_GAS_API_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

> `.env.example`에는 절대 실제 키를 넣지 마세요. placeholder만 두고 실제 값은 `.env.local`과 Netlify 대시보드에만 둡니다.

### 2. Google Sheets 시트 구성

아래 4개는 스프레드시트에 직접 만들고 첫 행에 헤더를 넣습니다.

- **Forms:** form_id, folder_id, title, type, schema, is_active, created_at
- **Responses:** response_id, form_id, student_id, student_name, answer_data, submitted_at
- **Folders:** folder_id, name
- **Students:** student_id, name, auth_code (+ 7번째 열 photo_data — 학생 사진)

나머지 기능별 시트는 **GAS가 처음 사용할 때 헤더까지 자동 생성**합니다. 이름이 겹치지 않도록 대부분 `Homeroom` 접두사를 씁니다.

| 기능 | 시트 |
|------|------|
| 명렬표 정보 | `Class` |
| 생기부 | `record`, `RecordSummary` |
| 청소 | `CleaningAssignments`, `CleaningHelper` |
| 야자 | `NightStudy`, `NightStudyMessages` |
| 학급 게임 | `ClassGameScores`, `HomeroomTeacherQuiz`, `HomeroomTeacherQuizScores`, `HomeroomTeacherQuizSurveys` |
| 학급 정책(새싹) | `HomeroomPolicies`, `HomeroomPolicySeeds`, `HomeroomPolicyHype`, `HomeroomSeedLedger`, `HomeroomSeedProducts` |
| 자리 배치 | `HomeroomSeatingConfig`, `HomeroomSeatingAssignment` |
| 상담 캘린더 | `HomeroomCounselingTimetable`, `HomeroomCalendarEvents` |

### 3. GAS 배포

1. [script.google.com](https://script.google.com)에서 새 프로젝트 생성
2. `gas/Code.gs` 내용을 복사해 붙여넣기
3. Script Property에 `SPREADSHEET_ID` 설정 (또는 코드 내 상수 수정)
4. 배포 → 웹 앱으로 배포 (실행 사용자: 본인, 액세스: 모든 사용자)
5. 배포된 URL을 복사해 두었다가 `/admin/login`에서 입력해 연결 (초기 비밀번호 `1234`)

> **`gas/Code.gs`를 고쳤다면 반드시 새 버전으로 재배포**해야 반영됩니다. 붙여넣기만 하고 배포를 안 하면 프론트는 예전 코드를 호출합니다.

## 관리자 로그인 / DB 비공개

- **DB 비공개**: 사이트에 그냥 접속한 사람에게는 연결된 시트가 전혀 없습니다. GAS URL이 빌드에 들어있지 않기 때문입니다.
- **관리자**: `/admin` 진입 시 로그인 게이트로 막힙니다. `/admin/login`에서 **GAS 배포 URL + 비밀번호**로 로그인합니다.
  - **초기 비밀번호는 `1234`** 입니다. 로그인 후 좌측 메뉴 하단 **"비밀번호 변경"**에서 반드시 변경하세요.
  - 비밀번호는 GAS의 Script Properties에 **salt + SHA-256 해시**로 저장됩니다(시트에 평문 저장 안 함).
  - **GAS URL은 디바이스(localStorage)에 저장**되어 다음 로그인 때 자동 입력됩니다.
  - **로그인 세션은 sessionStorage**에 있어 **웹앱(탭/창)을 닫으면 자동 로그아웃**됩니다. 사용 중에는 유지됩니다.
- **학생**: **학번 + 개인코드**로 인증합니다. 교사가 만든 공유 링크에는 GAS URL이 `?api=`로 포함되어, 학생 브라우저가 자동으로 해당 학급 시트에 연결됩니다.
- **보안 한계(중요)**: GAS 웹앱이 "액세스: 모든 사용자"로 배포되므로, **GAS URL을 아는 사람은 API를 직접 호출할 수 있습니다.** 본 로그인은 프론트엔드 접근 차단(우연한 조회 방지)이며, 서버 단 액션별 인증은 아닙니다. URL을 공개 채널에 노출하지 마세요.

## 상담 캘린더

### 교사 — `/admin/counseling`

- **교시 타임테이블**을 한 번 세팅하면 주말 포함 모든 날짜에 공통 적용됩니다. 일정 등록 시 교시 버튼으로 시간이 자동 입력됩니다.
- 날짜의 `+`를 눌러 **수업시간** 또는 **상담**을 등록합니다. 상담은 대상 학생을 여러 명 지정할 수 있습니다.
- 월 뷰에서 일정이 3건을 넘으면 `+n건 ▼`으로 접히고, 누르면 그 날짜만 펼쳐집니다.
- 우측 상단 **"캘린더 공유 링크"**가 `?api=`를 포함한 `/calendar` 주소를 복사합니다.
- 교사 등록에는 시간 중복 제한이 없습니다(수업 위에 상담을 겹쳐 잡을 수 있음).

### 학생·학부모 — `/calendar` (공유 링크)

- **열람은 로그인 없이** 가능합니다. 남의 상담은 대상·내용이 가려지고 시간과 '상담'만 보입니다.
- 상단에서 먼저 **🙋 학생 / 👪 학부모**를 고릅니다. 열람만 할 거면 고르지 않아도 됩니다.

**🙋 학생**

- 학번+개인코드로 로그인하면 날짜의 `+`가 열립니다. 신청 화면은 교사 등록 화면과 같고, **대상 학생은 서버에서 본인으로 고정**되므로 선택 UI가 없습니다.
- **"🙋 내 상담 일정"** 섹션에서 내 상담을 한눈에 봅니다.
  - **내가 신청한 건**(분홍): 눌러서 시간·제목·장소·내용 **수정**하거나 **신청 취소**
  - **선생님이 등록한 건**(하늘): `선생님 등록` 표시, 읽기 전용 / 학부모가 잡은 건은 `학부모 신청`
- 내 상담은 캘린더 '대상' 칸에 **내 사진과 이름**으로 표시됩니다.

**👪 학부모 — 로그인 없음**

- **자녀(학생) 드롭다운**에서 **사진 + 학번 + 이름**을 보고 자녀를 고르면 날짜의 `+`가 열립니다. (명단은 `GET_COUNSELING_ROSTER`로 받으며 **개인코드는 내려오지 않습니다**.)
- 신청 화면·규칙은 학생과 동일합니다. 상담 대상은 선택한 자녀로 기록되고, 교사 화면에는 **`학부모` 배지**가 함께 표시됩니다.
- 로그인이 없으므로 신청할 때 서버가 **1회용 `request_token`**을 발급해 **그 브라우저(localStorage)**에만 저장합니다. **"👪 이 기기에서 신청한 상담"** 목록에서 수정·취소할 수 있고, **다른 기기에서는 불가**합니다(선생님께 요청).
- 마지막에 고른 자녀는 저장돼 다음 방문 때 자동 선택됩니다. `처음으로`를 누르면 지워집니다.
- ⚠️ 자녀 선택에는 별도 인증이 없습니다. 공유 링크를 아는 사람은 반 학생 명단(사진·이름·학번)을 볼 수 있고 아무 학생 이름으로 신청할 수 있으니, **링크를 학급 구성원에게만** 공유하세요.

### 신청 규칙 (서버에서 강제)

| 규칙 | 동작 |
|------|------|
| 인증 | 학생은 학번+개인코드 검증 후에만 저장(대상=본인 고정). 학부모는 인증 없이 신청하되 대상은 **명단에 있는 학번**이어야 함 |
| 시간 중복 | 같은 날짜에 **수업/상담 구분 없이** 시간이 겹치면 거절 (수정 시에는 자기 자신 제외) |
| 동시 신청 | `LockService`로 *중복검사 → 기록*을 묶어 두 학생이 같은 슬롯을 동시에 잡지 못하게 함 |
| 지난 날짜 | 신청·수정 불가 (취소는 가능) |
| 소유권 | 학생은 `created_by`(신청자 학번)가 본인인 일정만, 학부모는 `request_token`이 일치하는 일정만 수정·취소 가능 |

- 날짜 변경 기능은 없습니다(교사 화면도 동일). 날짜를 옮기려면 취소 후 다시 신청합니다.
- 저장 즉시 캐시를 지우므로 보통 바로 보이지만, 다른 학생 화면에는 최대 60초(캐시 TTL) 뒤에 반영될 수 있습니다.
- `HomeroomCalendarEvents`에 **`created_by`·`requester_role`·`request_token` 열**이 필요합니다. 기존 시트에는 GAS가 처음 접근할 때 열을 자동으로 덧붙입니다. 그 전에 만들어진 학생 신청 건은 `created_by`가 비어 있어 학생 화면에서 수정·취소가 되지 않습니다(시트에서 직접 학번을 넣거나 다시 신청).
- `request_token`은 **공개 조회(`GET_CALENDAR_EVENTS`) 응답에 포함되지 않습니다.** 시트에서만 확인할 수 있습니다.

관련 GAS 액션: `GET/SAVE_COUNSELING_TIMETABLE`, `GET/SAVE/DELETE_CALENDAR_EVENT`, `GET_CALENDAR_EVENTS_FOR_STUDENT`, `REQUEST_COUNSELING_EVENT`, `UPDATE_COUNSELING_REQUEST`, `DELETE_COUNSELING_REQUEST`, `GET_COUNSELING_ROSTER`, `REQUEST_PARENT_COUNSELING_EVENT`, `UPDATE_PARENT_COUNSELING_REQUEST`, `DELETE_PARENT_COUNSELING_REQUEST`.

## 데이터 저장·조회 (웹 ↔ 구글 시트)

- **웹에서 등록/작성** → 웹앱이 GAS API를 호출하고, GAS가 구글 스프레드시트에 저장합니다. (학생 등록, 폼 생성, 폴더 생성, 응답 제출 등 모두 동일)
- **시트에 직접 입력** → 같은 스프레드시트를 GAS가 읽으므로, 시트에 직접 행을 추가해도 웹에서 조회됩니다. (열 이름·순서는 위 시트 구성과 맞춰야 함)
- 정리: **웹에서 하든 시트에서 하든, 같은 시트를 보고 씁니다.**
- 조회는 CacheService로 짧게(항목에 따라 30초~5분) 캐시됩니다. 시트를 직접 고쳤는데 화면이 그대로면 잠시 뒤 새로고침하세요.

## "Failed to fetch" / 서버 연결 실패 시

- 프론트는 GAS에 **Content-Type: text/plain**으로 POST합니다. (GAS가 OPTIONS를 처리하지 않아 CORS preflight를 피하기 위함. GAS는 본문을 그대로 JSON으로 파싱합니다.)
1. **GAS 배포 확인**: 스크립트 편집기에서 "배포" → "웹 앱으로 배포"가 되어 있고, URL이 `/admin/login`에 입력한 값과 같은지 확인
2. **연결된 GAS 없음**: "연결된 GAS가 없습니다" 메시지가 보이면 관리자는 `/admin/login`에서 다시 로그인, 학생은 교사가 준 `?api=` 링크로 접속했는지 확인
3. **스프레드시트**: GAS에서 사용하는 스프레드시트에 위 시트(탭)들이 있고, Script Property `SPREADSHEET_ID` 또는 코드 내 스프레드시트 지정이 맞는지 확인
4. **`Unknown action: ...`**: 프론트는 새 코드인데 GAS를 재배포하지 않은 경우입니다. 새 버전으로 배포하세요.

## 라우트

전체 목록은 `ROUTES.md`에 있습니다. 자주 쓰는 것만:

- `/admin` — 데이터 관리(폴더/문서), `/admin/students` — 학생 관리
- `/admin/counseling` — 상담 캘린더, `/calendar` — 학생용 공유 캘린더
- `/view/:formId` — 학생용 폼 보기/제출, `/register` — 학생 자가등록
- `/student/dashboard` — 학생 대시보드 허브

## 링크 미리보기 (카카오톡·SNS 제목)

- 브라우저 탭 제목·일부 환경: `react-helmet-async`로 **문서 제목·게임 제목** 등이 반영됩니다.
- 카카오 등 **자바스크립트를 실행하지 않는** 미리보기: Netlify **Edge Function** `netlify/edge-functions/share-meta.ts`가 크롤러 요청 시 HTML의 `<title>`·`og:title`을 바꿉니다.
- **필수:** Netlify → Environment variables에 **`GAS_API_URL`**(값은 `VITE_GAS_API_URL`과 동일한 GAS 웹앱 URL)을 추가하고, 변수 설정에서 **Edge functions** 스코프가 적용되도록 합니다. (`VITE_`만 빌드에 쓰이면 Edge에서 안 읽힐 수 있어 별도 키를 둡니다.)
- `/view/:formId` 미리보기 제목은 Edge에서 GAS `GET_FORM`으로 문서 `title`을 불러옵니다.
- 크롤러 판별은 **User-Agent + 확장자**로만 합니다. `Accept: text/html`로 거르면 카카오 미리보기가 깨집니다.

## Netlify 환경 변수

| 키 | 쓰임 |
|----|------|
| `OPENAI_API_KEY` | `netlify/functions/chat.ts`(가정통신문 챗봇), `record-feedback.ts`, `record-link-summarize.ts` |
| `GAS_API_URL` | `netlify/edge-functions/share-meta.ts` (Edge functions 스코프 필요) |

## 라이선스

Private
