정책 나무 — 사용자 이미지 업로드 안내
=====================================

이 폴더(public/policy-tree/)에 아래 파일명으로 이미지를 넣어 주세요.
권장: PNG 또는 WebP (배경 투명 가능). 가로 약 400~800px, 비율은 자유입니다.

  파일명                    설명 (학급 총 씨앗 기준)
  ---------------------------------------------------------------------------
  seed.png                  씨앗 (0 ~ 50개)
  sprout.png                새싹 (51 ~ 100개)
  sapling.png               묘목 (101 ~ 250개)
  tree.png                  나무 (251 ~ 450개)
  tree-fruit.png            열매 나무 (451개 이상) / 500개 달성 시 UI에 배지 표시

※ JPG를 쓰는 경우: 파일명을 그대로 두고 확장자만 바꾸면 안 됩니다.
   예) seed.jpg 로 넣었다면 src/components/PolicyTreeIllustration.tsx 의
   FILE_NAMES 의 확장자를 .jpg 로 맞추거나, 이미지를 PNG로 내보내 seed.png 로 저장하세요.

배포(Netlify 등) 시 이 폴더가 빌드 결과(dist/policy-tree/)에 포함되는지 확인하세요.
