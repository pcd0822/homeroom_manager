# 라우트(문서) 구조

## 경로 목록

| 경로 | 설명 |
|------|------|
| `/` | `/admin`으로 리다이렉트 |
| `/admin` | 관리자 레이아웃 + **데이터 관리** (문서 목록) |
| `/admin/forms/new` | **새 문서 만들기** |
| `/admin/forms/:formId/responses` | 특정 문서 **응답 데이터** 그리드 |
| `/admin/sms` | **문자 발송** |
| `/view/:formId` | 학생용 폼 보기/제출 (공유 링크) |
| 그 외 | `/admin`으로 리다이렉트 |

## Page Not Found가 나올 때

- **Netlify 배포**: `public/_redirects`에 `/* /index.html 200` 이 있어야 합니다. 이미 추가되어 있으므로 재배포 후 반영됩니다.
- **로컬에서 `dist` 폴더로 테스트**: `npx serve dist -s` 처럼 SPA 모드(`-s`)로 실행하거나, `npm run preview`(Vite 기본 서버)를 사용하세요.
