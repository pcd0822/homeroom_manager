import { Link } from 'react-router-dom'

/** 문서(폼) 생성 페이지 - 추후 폼 빌더 UI 구현 */
export function FormBuilderPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link to="/admin" className="text-sm font-medium text-blue-600 hover:underline">
            ← 대시보드
          </Link>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">문서 만들기</h1>
          <p className="mt-2 text-gray-600">폼 빌더 기능은 추후 구현 예정입니다.</p>
        </div>
      </div>
    </div>
  )
}
