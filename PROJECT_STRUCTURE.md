# 학급 경영 올인원 웹 앱 - 프로젝트 폴더 구조

```
homeroom_manager/
├── public/                     # 정적 자산 (_redirects: SPA fallback, game/ 이미지)
├── src/
│   ├── api/
│   │   └── api.ts              # GAS REST API 서비스 레이어 (런타임 URL 해석 + 관리자 검증)
│   ├── lib/
│   │   ├── gasUrl.ts           # ★ GAS URL 런타임 해석 + 관리자 세션 + 공유 링크(buildShareUrl)
│   │   ├── calendar.ts         # 상담 캘린더용 날짜·시간 순수 유틸 (dateKey/주·월 그리드/시간 포맷)
│   │   ├── seating.ts · teacherQuiz.ts · policySeeds.ts · rosterPdf.ts ...  # 기능별 순수 로직
│   │   └── utils.ts
│   ├── components/
│   │   ├── RequireAdmin.tsx    # ★ /admin 로그인 게이트
│   │   ├── ChangePasswordModal.tsx  # ★ 관리자 비밀번호 변경 모달
│   │   ├── FormRenderer.tsx · FormEditSlidePanel.tsx
│   │   ├── calendar/
│   │   │   ├── CalendarBoard.tsx      # 월/주/일 · 캘린더/테이블 뷰 (교사·학생 공용)
│   │   │   └── CalendarEventModal.tsx # 일정 등록·수정 (교사) / 상담 신청·수정·취소 (학생)
│   │   ├── cleaning/ · seating/ · game/   # 기능별 프레젠테이션 컴포넌트
│   │   └── layout/
│   │       └── AdminLayout.tsx # 좌측 메뉴 + 연결정보/비밀번호변경/로그아웃
│   ├── pages/
│   │   ├── admin/             # 관리자 전용 (RequireAdmin 게이트 안)
│   │   │   ├── AdminLoginPage.tsx   # ★ GAS URL + 비밀번호 로그인
│   │   │   ├── Dashboard.tsx · FormBuilderPage.tsx · ResponseGridPage.tsx
│   │   │   ├── StudentsPage.tsx · RecordDashboardPage.tsx · RecordStudentDashboardPage.tsx
│   │   │   ├── CleaningZonesPage.tsx · MealBoardPage.tsx · NightStudyPage.tsx
│   │   │   ├── PoliciesAdminPage.tsx · SeatingPage.tsx · CounselingCalendarPage.tsx
│   │   │   └── ClassGamesPage.tsx · ClassGameRankingPage.tsx
│   │   │       · TeacherQuizEditPage.tsx · TeacherQuizRankingPage.tsx
│   │   ├── student/           # 학생용 (학번+개인코드 인증, 공유 링크로 진입)
│   │   │   ├── StudentPoliciesPage.tsx · StudentPolicyRegisterPage.tsx
│   │   │   ├── PolicyBoardSharedPage.tsx · StudentSeedLedgerPage.tsx
│   │   │   └── StudentCounselingPage.tsx   # 내 상담 일정 목록
│   │   ├── view/FormView.tsx  # /view/:formId (학생용 폼/공지)
│   │   ├── game/HomeRunGamePage.tsx
│   │   ├── CalendarSharedPage.tsx  # /calendar 공유 캘린더 + 상담 신청
│   │   ├── RegisterPage.tsx · SeatingDrawPage.tsx · CleaningResultPage.tsx
│   │   ├── StudentMealBoardPage.tsx · StudentDashboardHubPage.tsx · TeacherQuizPlayPage.tsx
│   ├── types/index.ts
│   ├── App.tsx                 # 라우트 정의 (/admin/login, RequireAdmin) — 목록은 ROUTES.md
│   ├── main.tsx                # captureStudentApiFromUrl() 부트스트랩
│   └── index.css
├── gas/
│   └── Code.gs                 # doPost/doGet 라우터 + 시트 유틸 + CacheService + ★관리자 인증
├── netlify/
│   ├── functions/              # chat.ts(가정통신문 챗봇) · record-feedback.ts · record-link-summarize.ts
│   └── edge-functions/
│       └── share-meta.ts       # 카카오 등 링크 미리보기용 <title>/og 치환
└── README.md / PROJECT_STRUCTURE.md / ROUTES.md
```

## 인증 / GAS 연결 (중요)

빌드에 GAS URL을 고정하지 않는다. 사이트에 그냥 접속한 사람은 연결된 시트가 전혀 없다(= DB 비공개).

### GAS URL 런타임 해석 (`src/lib/gasUrl.ts` · `getGasUrl()`)

우선순위: **① 현재 URL `?api=`(학생 공유 링크) → ② 관리자 세션 GAS URL → ③ 학생이 저장해 둔 URL → ④ (개발 모드 한정) `VITE_GAS_API_URL`**. 없으면 API 호출은 친절한 오류로 단락된다.

### 관리자 로그인

- `/admin` 전체는 `RequireAdmin`으로 막히고, 비로그인 시 `/admin/login`으로 이동.
- 로그인 = **GAS 배포 URL + 비밀번호**. 해당 GAS의 `VERIFY_ADMIN` 액션이 비밀번호를 1회 검증.
- **초기 비밀번호 `1234`** (GAS `DEFAULT_ADMIN_PASSWORD`). 로그인 후 `ChangePasswordModal`에서 변경 → GAS Script Properties에 **salt+SHA-256 해시** 저장. 변경 이후로는 해시로 검증.
- **GAS URL**: `localStorage`(`homeroom_admin_gas_url`)에 영구 저장 → 다음 로그인 자동 입력.
- **세션**: `sessionStorage`(`homeroom_admin_session`)에 저장 → **웹앱(탭/창)을 닫으면 자동 로그아웃**, 사용 중에는 유지.

### 학생

**학번 + 개인코드**(`AUTH_STUDENT`)로 인증한다. 교사가 만든 공유 링크에는 `buildShareUrl()`이 GAS URL을 `?api=`로 임베드하므로, 학생 브라우저가 자동으로 해당 학급 시트에 연결된다. SPA 내부 이동에도 `captureStudentApiFromUrl()`이 저장한 값으로 연결이 유지된다. 로그인 정보는 `localStorage`의 `homeroom_login`에 저장돼 학생 화면끼리 공유된다.

### 보안 한계

GAS 웹앱이 "액세스: 모든 사용자"로 배포되므로 URL을 아는 사람은 API 직접 호출이 가능하다. 본 게이트는 **프론트엔드 접근 차단(우연한 조회 방지)**이며 서버 단 액션별 인증은 아니다. 다만 학생이 데이터를 **쓰는** 액션(상담 신청·수정·취소 등)은 GAS에서 학번+개인코드를 검증하고 소유권까지 확인한다.

## GAS API (`gas/Code.gs`)

- `action` 파라미터로 분기하는 REST 라우터. POST 본문/GET 쿼리 모두 `action` 사용.
- CORS 우회를 위해 프론트는 `Content-Type: text/plain`으로 POST.
- 읽기·집계는 CacheService read-through 캐시(`cacheGet/cachePut`), 쓰기 함수는 의존 키 `cacheDelMany` 필수.
- 관리자 인증 액션: `VERIFY_ADMIN`, `CHANGE_ADMIN_PASSWORD`. 학생 인증: `AUTH_STUDENT`.
- 시트는 `SHEETS` 상수에 이름이 모여 있고, 없으면 `getOrCreate...Sheet()`가 헤더까지 만들어 준다. 헤더가 늘어난 시트(예: `HomeroomCalendarEvents.created_by`)는 열이 없으면 자동으로 덧붙인다.

## 상담 캘린더 (교사 등록 + 학생 신청)

| 구성 | 위치 |
|------|------|
| 교사 화면 | `pages/admin/CounselingCalendarPage.tsx` (`/admin/counseling`) |
| 학생 공유 화면 | `pages/CalendarSharedPage.tsx` (`/calendar`) |
| 공용 뷰 | `components/calendar/CalendarBoard.tsx` |
| 공용 모달 | `components/calendar/CalendarEventModal.tsx` |
| 시트 | `HomeroomCounselingTimetable`, `HomeroomCalendarEvents` |
| 학부모 신청 | `CalendarSharedPage`의 역할 선택(학생/학부모) → `ChildPicker`(사진+학번+이름) |

- `CalendarBoard`의 `editable`은 **일정 클릭 → 편집**(교사), `addable`은 **날짜 `+` → 추가**(교사·학생·학부모)로 분리돼 있다. 공유 화면은 `addable`만 켠다.
- `CalendarEventModal`은 `requester` prop이 있으면 **신청 모드**가 된다. 구분은 '상담' 고정, 대상 학생 선택 UI 없음, 저장/삭제가 신청 전용 액션으로 나간다. `requester.role === 'parent'`면 학부모 액션(`*_PARENT_*`)으로 나간다.
- 일정 행의 `created_by`가 **신청자 학번**이다. 학생은 `created_by`가 본인인 일정만 수정·취소할 수 있고, 교사가 등록한 상담은 학생 화면에서 읽기 전용으로 보인다. 교사가 내용을 고쳐도 `created_by`는 보존된다.
- **학부모 신청**은 `created_by`가 비고 `requester_role='parent'`, `request_token`이 채워진다. 로그인이 없으므로 이 토큰(신청한 브라우저의 localStorage `homeroom_parent_counseling`)이 유일한 소유권 증명이다. 토큰은 `GET_CALENDAR_EVENTS` 응답에 **절대 싣지 않는다**. 교사 화면에서는 대상 학생 칩에 `학부모` 배지가 붙는다.
- 학부모의 자녀 선택 목록은 `GET_COUNSELING_ROSTER`(학번·이름·사진만, 개인코드 제외)로 받는다. 공유 링크를 아는 사람은 이 명단을 볼 수 있다는 점을 감안해 링크를 배포해야 한다.
- 자세한 동작·제약은 `README.md`의 "상담 캘린더" 절 참고.
