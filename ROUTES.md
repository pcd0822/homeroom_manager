# 라우트 구조

정의 위치: `src/App.tsx`. 목록에 없는 경로는 모두 `/admin`으로 리다이렉트된다.

## 관리자 (`/admin/*`)

`RequireAdmin` 게이트 안이며 `AdminLayout`(좌측 메뉴)을 공유한다. 비로그인 상태면 `/admin/login`으로 보낸다.

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/admin/login` | `AdminLoginPage` | GAS 배포 URL + 비밀번호 로그인 (게이트 밖) |
| `/admin` | `Dashboard` | 데이터 관리 — 폴더/문서 목록 |
| `/admin/forms/new` | `FormBuilderPage` | 새 문서 만들기 (폼 빌더 + 가정통신문 챗봇) |
| `/admin/forms/:formId/responses` | `ResponseGridPage` | 문서별 응답 그리드 |
| `/admin/students` | `StudentsPage` | 학생 관리 (학번·이름·사진, 개인코드 발급) |
| `/admin/record-dashboard` | `RecordDashboardPage` | 생기부 기록 대시보드 |
| `/admin/record-dashboard/:studentId` | `RecordStudentDashboardPage` | 학생별 생기부 상세 |
| `/admin/cleaning-zones` | `CleaningZonesPage` | 청소구역 배정 |
| `/admin/meal-board` | `MealBoardPage` | 급식 게시판 |
| `/admin/night-study` | `NightStudyPage` | 야간자율학습 관리 |
| `/admin/class-games` | `ClassGamesPage` | 학급 게임 목록 |
| `/admin/class-games/:gameId/ranking` | `ClassGameRankingPage` | 게임별 랭킹 |
| `/admin/class-games/teacher-quiz/edit` | `TeacherQuizEditPage` | 담임 퀴즈 문항 편집 |
| `/admin/class-games/teacher-quiz/ranking` | `TeacherQuizRankingPage` | 담임 퀴즈 랭킹·설문 |
| `/admin/policies` | `PoliciesAdminPage` | 학급 정책(새싹) 관리 |
| `/admin/seating` | `SeatingPage` | 자리 배치 |
| `/admin/counseling` | `CounselingCalendarPage` | 상담 캘린더 — 교시 타임테이블, 일정 등록, 공유 링크 |

## 학생 · 공유 링크

로그인 게이트가 없다. 교사가 `buildShareUrl()`로 만든 링크에 GAS URL이 `?api=`로 들어 있어야 데이터에 연결된다. 개인 데이터가 걸린 화면은 화면 안에서 **학번 + 개인코드**로 인증한다.

| 경로 | 컴포넌트 | 인증 | 설명 |
|------|----------|------|------|
| `/register` | `RegisterPage` | - | 학생 자가등록 (개인코드 발급) |
| `/view/:formId` | `FormView` | 학번+코드 | 폼·가정통신문 보기/제출 |
| `/calendar` | `CalendarSharedPage` | 열람 없음 / 학생 신청 시 학번+코드 / 학부모는 자녀 선택만 | 학급 일정 캘린더 + **상담 신청·수정·취소**(학생·학부모) |
| `/student/counseling` | `StudentCounselingPage` | 학번+코드 | 내 상담 일정 목록 |
| `/student/dashboard` | `StudentDashboardHubPage` | 학번+코드 | 학생 대시보드 허브 |
| `/student/meal-board` | `StudentMealBoardPage` | 학번+코드 | 급식 게시판 |
| `/student/policies` | `StudentPoliciesPage` | 학번+코드 | 학급 정책 참여 |
| `/student/policy/register` | `StudentPolicyRegisterPage` | 학번+코드 | 정책 제안 등록 |
| `/student/policy-board` | `PolicyBoardSharedPage` | - | 정책 게시판(열람용) |
| `/student/seed-ledger` | `StudentSeedLedgerPage` | 학번+코드 | 새싹 씨앗 내역 |
| `/seating-draw` | `SeatingDrawPage` | - | 자리 뽑기 |
| `/cleaning-result` | `CleaningResultPage` | - | 청소 배정 결과 |
| `/game/home-run` | `HomeRunGamePage` | 학번+코드 | 홈런 게임 |
| `/play/teacher-quiz` | `TeacherQuizPlayPage` | 학번+코드 | 담임 퀴즈 플레이 |

학생 로그인은 `localStorage`의 `homeroom_login`(학번+개인코드)에 저장돼 학생 화면끼리 공유된다. 한 화면에서 로그인하면 다른 화면에서는 자동 인증된다.

## Page Not Found가 나올 때

- **Netlify 배포**: `public/_redirects`에 `/* /index.html 200`이 있어야 한다. 이미 있으므로 재배포하면 반영된다.
- **로컬에서 `dist` 확인**: `npx serve dist -s`처럼 SPA 모드(`-s`)로 띄우거나 `npm run preview`를 쓴다.
