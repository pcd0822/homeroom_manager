import { useForm, FormProvider } from 'react-hook-form'
import type { FormSchema, FormFieldSchema, FormType } from '@/types'
import { cn } from '@/lib/utils'

export interface FormRendererProps {
  /** 'survey' | 'notice' */
  type: FormType
  /** 설문일 때만 사용. Notice면 무시 */
  schema: FormSchema | null
  /** 제출 시 (Survey: answer_data 객체, Notice: { checked: true }) */
  onSubmit: (values: Record<string, unknown>) => void
  /** 제출 중 로딩 */
  isSubmitting?: boolean
  /** Notice일 때 표시할 제목 */
  noticeTitle?: string
  /** Notice일 때 표시할 본문 (HTML 또는 텍스트) */
  noticeBody?: string
  /** 추가 클래스 */
  className?: string
}

function FieldRenderer({
  field,
  name,
  error,
}: {
  field: FormFieldSchema
  name: string
  error?: string
}) {
  const baseClass = 'block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  switch (field.type) {
    case 'text':
    case 'number':
    case 'date':
      return (
        <input
          type={field.type}
          id={field.id}
          name={name}
          placeholder={field.placeholder}
          required={field.required}
          className={cn(baseClass, error && 'border-red-500')}
        />
      )
    case 'textarea':
      return (
        <textarea
          id={field.id}
          name={name}
          rows={4}
          placeholder={field.placeholder}
          required={field.required}
          className={cn(baseClass, 'resize-y', error && 'border-red-500')}
        />
      )
    case 'radio':
      return (
        <div className="space-y-2">
          {(field.options || []).map((opt) => (
            <label key={opt} className="flex items-center gap-2">
              <input type="radio" name={name} value={opt} required={field.required} className="rounded border-gray-300" />
              <span>{opt}</span>
            </label>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )
    case 'checkbox':
      return (
        <div className="space-y-2">
          {(field.options || []).map((opt) => (
            <label key={opt} className="flex items-center gap-2">
              <input type="checkbox" name={name} value={opt} className="rounded border-gray-300" />
              <span>{opt}</span>
            </label>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )
    default:
      return (
        <input
          type="text"
          id={field.id}
          name={name}
          placeholder={field.placeholder}
          required={field.required}
          className={cn(baseClass, error && 'border-red-500')}
        />
      )
  }
}

/** Survey 타입: schema 기반 동적 폼 렌더링 */
function SurveyForm({
  schema,
  onSubmit,
  isSubmitting,
  className,
}: {
  schema: FormSchema
  onSubmit: (values: Record<string, unknown>) => void
  isSubmitting?: boolean
  className?: string
}) {
  const defaultValues: Record<string, unknown> = {}
  schema.fields.forEach((f) => {
    if (f.type === 'checkbox') defaultValues[f.id] = []
    else defaultValues[f.id] = ''
  })

  const methods = useForm({ defaultValues })

  const handleSubmit = methods.handleSubmit((data) => {
    const normalized: Record<string, unknown> = {}
    schema.fields.forEach((f) => {
      const v = data[f.id]
      if (f.type === 'checkbox') normalized[f.id] = Array.isArray(v) ? v : (v ? [v] : [])
      else normalized[f.id] = v
    })
    onSubmit(normalized)
  })

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
        {schema.fields.map((field) => (
          <div key={field.id}>
            <label htmlFor={field.id} className="mb-1 block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500"> *</span>}
            </label>
            <FieldRenderer
              field={field}
              name={field.id}
              error={methods.formState.errors[field.id]?.message as string | undefined}
            />
          </div>
        ))}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? '제출 중...' : '제출하기'}
        </button>
      </form>
    </FormProvider>
  )
}

/** Notice 타입: 확인 버튼만 */
function NoticeForm({
  noticeTitle,
  noticeBody,
  onSubmit,
  isSubmitting,
  className,
}: {
  noticeTitle?: string
  noticeBody?: string
  onSubmit: (values: Record<string, unknown>) => void
  isSubmitting?: boolean
  className?: string
}) {
  const handleConfirm = () => {
    onSubmit({ checked: true })
  }

  return (
    <div className={cn('space-y-6', className)}>
      {noticeTitle && <h2 className="text-xl font-semibold text-gray-900">{noticeTitle}</h2>}
      {noticeBody && (
        <div
          className="prose prose-sm max-w-none text-gray-700"
          dangerouslySetInnerHTML={{ __html: noticeBody }}
        />
      )}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isSubmitting}
        className="w-full rounded-md bg-green-600 px-4 py-2 font-medium text-white shadow hover:bg-green-700 disabled:opacity-50"
      >
        {isSubmitting ? '처리 중...' : '확인했어요'}
      </button>
    </div>
  )
}

export function FormRenderer({
  type,
  schema,
  onSubmit,
  isSubmitting = false,
  noticeTitle,
  noticeBody,
  className,
}: FormRendererProps) {
  if (type === 'notice') {
    return (
      <NoticeForm
        noticeTitle={noticeTitle}
        noticeBody={noticeBody}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        className={className}
      />
    )
  }

  if (type === 'survey' && schema && schema.fields && schema.fields.length > 0) {
    return (
      <SurveyForm
        schema={schema}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        className={className}
      />
    )
  }

  return (
    <div className={cn('rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800', className)}>
      설문 항목이 없습니다.
    </div>
  )
}
