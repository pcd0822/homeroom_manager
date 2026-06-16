# 학급 경영 올인원 웹 앱 - 프로젝트 폴더 구조

```
homeroom_manager/
├── public/                     # 정적 자산 (_redirects: SPA fallback)
├── src/
│   ├── api/
│   │   └── api.ts              # GAS REST API 서비스 레이어 (런타임 URL 해석 + 관리자 검증)
│   ├── lib/
│   │   ├── gasUrl.ts          # ★ GAS URL 런타임 해석 + 관리자 세션 + 공유 링크(buildShareUrl)
│   │   ├── seating.ts / teacherQuiz.ts / policySeeds.ts ...  # 기능별 순수 로직
│   │   └── utils.ts
│   ├── components/
│   │   ├── RequireAdmin.tsx    # ★ /admin 로그인 게이트
│   │   ├── ChangePasswordModal.tsx  # ★ 관리자 비밀번호 변경 모달
│   │   ├── FormRenderer.tsx / FormEditSlidePanel.tsx
│   │   ├── cleaning/ · seating/ · game/   # 기능별 프레젠테이션 컴포넌트
│   │   └── layout/
│   │       └── AdminLayout.tsx # 좌측 메뉴 + 연결정보/비밀번호변경/로그아웃
│   ├── pages/
│   │   ├── admin/             # 관리자 전용 (RequireAdmin 게이트 안)
│   │   │   ├── AdminLoginPage.tsx   # ★ GAS URL + 비밀번호 로그인
│   │   │   ├── Dashboard.tsx · FormBuilderPage.tsx · ResponseGridPage.tsx
│   │   │   ├── StudentsPage.tsx · RecordDashboardPage.tsx · RecordStudentDashboardPage.tsx
│   │   │   ├── CleaningZonesPage.tsx · MealBoardPage.tsx · NightStudyPage.tsx
│   │   │   ├── PoliciesAdminPage.tsx · SeatingPage.tsx
│   │   │   └── ClassGamesPage.tsx · ClassGameRankingPage.tsx
│   │   │       · TeacherQuizEditPage.tsx · TeacherQuizRankingPage.tsx
│   │   ├── student/           # 학생용 (학번+학생코드 인증, 공유 링크로 진입)
│   │   │   ├── StudentPoliciesPage.tsx · StudentPolicyRegisterPage.tsx
│   │   │   ├── PolicyBoardSharedPage.tsx · StudentSeedLedgerPage.tsx
│   │   ├── view/FormView.tsx  # /view/:formId (학생용 폼/공지)
│   │   ├── game/HomeRunGamePage.tsx
│   │   ├── RegisterPage.tsx · SeatingDrawPage.tsx · CleaningResultPage.tsx
│   │   ├── StudentMealBoardPage.tsx · StudentDashboardHubPage.tsx · TeacherQuizPlayPage.tsx
│   ├── types/index.ts
│   ├── App.tsx                 # 라우트 정의 (/admin/login, RequireAdmin)
│   ├── main.tsx                # captureStudentApiFromUrl() 부트스트랩
│   └── index.css
├── gas/
│   └── Code.gs                 # doPost/doGet 라우터 + 시트 유틸 + CacheService + ★관리자 인증
├── netlify/functions/          # 가정통신문 챗봇(OpenAI) 등 서버리스
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

기존과 동일하게 **학번 + 학생코드**(`AUTH_STUDENT`)로 인증. 교사가 만든 공유 링크에는 `buildShareUrl()`이 GAS URL을 `?api=`로 임베드하므로, 학생 브라우저가 자동으로 해당 학급 시트에 연결된다. SPA 내부 이동에도 `captureStudentApiFromUrl()`이 저장한 값으로 연결이 유지된다.

### 보안 한계

GAS 웹앱이 "액세스: 모든 사용자"로 배포되므로 URL을 아는 사람은 API 직접 호출이 가능하다. 본 게이트는 **프론트엔드 접근 차단(우연한 조회 방지)**이며 서버 단 액션별 인증은 아니다.

## GAS API (`gas/Code.gs`)

- `action` 파라미터로 분기하는 REST 라우터. POST 본문/GET 쿼리 모두 `action` 사용.
- CORS 우회를 위해 프론트는 `Content-Type: text/plain`으로 POST.
- 읽기·집계는 CacheService read-through 캐시(`cacheGet/cachePut`), 쓰기 함수는 의존 키 `cacheDelMany` 필수.
- 관리자 인증 액션: `VERIFY_ADMIN`, `CHANGE_ADMIN_PASSWORD`. 학생 인증: `AUTH_STUDENT`.
