# 학급 경영 올인원 웹 앱 - 프로젝트 폴더 구조

```
homeroom_manager/
├── public/                     # 정적 자산
│   └── favicon.ico
├── src/
│   ├── api/
│   │   └── api.ts              # GAS REST API 호출 서비스 레이어
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 컴포넌트 (필요 시 추가)
│   │   ├── FormRenderer.tsx    # 동적 폼 렌더러 (Schema 기반)
│   │   ├── FormBuilder.tsx     # 관리자용 폼 빌더
│   │   └── layout/
│   │       └── AdminLayout.tsx
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── Dashboard.tsx   # 폴더별 문서 목록, 응답률
│   │   │   ├── FormBuilderPage.tsx
│   │   │   ├── ResponseGrid.tsx # TanStack Table 응답 데이터
│   │   │   └── SmsModal.tsx    # SMS 발송 모달
│   │   └── view/
│   │       └── FormView.tsx    # /view/:formId (학생용)
│   ├── lib/
│   │   └── utils.ts            # 유틸 (cn 등)
│   ├── types/
│   │   └── index.ts            # Form, Response, Student 등 타입
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── gas/                        # Google Apps Script (별도 배포)
│   └── Code.gs                 # doPost/doGet 라우터, 시트 유틸
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── components.json             # shadcn 설정
└── README.md
```

## 설명

- **src/api**: GAS 배포 URL과 통신하는 fetch 래퍼 및 액션별 함수.
- **src/components/FormRenderer**: `schema`(JSON)를 받아 텍스트/라디오/체크박스 등 필드를 동적 렌더링.
- **src/pages/admin**: 대시보드, 폼 빌더, 응답 그리드, SMS 모달.
- **src/pages/view**: 공유 링크 `/view/:formId`에서 인증 후 Notice/Survey 렌더링.
- **gas/Code.gs**: 시트 읽기/쓰기, `action` 파라미터에 따른 라우팅(GET_FORM, SUBMIT_RESPONSE, SEND_SMS 등).
