OG(링크 미리보기) 이미지 폴더
================================

이 폴더에 아래 이름으로 이미지를 넣으면 카카오톡·페이스북 등 링크 미리보기에 표시됩니다.

  og-image.png   ← 이 이름 그대로 넣어주세요

권장 규격
  - 크기: 1200 x 630 px (가로 세로 비율 1.91:1)
  - 형식: PNG 또는 JPG
  - 용량: 8MB 이하 (가능하면 1MB 이하 권장)

동작 방식
  - public/ 안의 파일은 빌드 시 dist/ 루트로 복사됩니다.
    → public/og/og-image.png  ==>  배포 후 /og/og-image.png 로 서빙
  - 링크 미리보기는 netlify/edge-functions/share-meta.ts 가
    요청 도메인 기준 절대 URL(https://<도메인>/og/og-image.png)로 자동 주입합니다.
    따라서 netlify.app 주소든 커스텀 도메인이든 코드 수정 없이 동작합니다.

주의
  - OG 이미지는 반드시 절대 URL(https://...)이어야 크롤러가 읽습니다.
  - 이미지를 바꿔도 카카오/페북은 캐시를 유지합니다.
    · 카카오: https://developers.kakao.com/tool/debugger/sharing 에서 "캐시 삭제"
    · 페이스북: https://developers.facebook.com/tools/debug/ 에서 "Scrape Again"
