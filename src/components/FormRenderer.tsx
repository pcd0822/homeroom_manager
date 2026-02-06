import { useForm, FormProvider, useFormContext } from 'react-hook-form'
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
  const { register, watch, setValue } = useFormContext()
  const baseClass = 'block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  switch (field.type) {
    case 'text':
    case 'number':
    case 'date':
      return (
        <input
          type={field.type}
          id={field.id}
          placeholder={field.placeholder}
          required={field.required}
          className={cn(baseClass, error && 'border-red-500')}
          {...register(name)}
        />
      )
    case 'textarea':
      return (
        <textarea
          id={field.id}
          rows={4}
          placeholder={field.placeholder}
          required={field.required}
          className={cn(baseClass, 'resize-y', error && 'border-red-500')}
          {...register(name)}
        />
      )
    case 'radio': {
      const hasOther = (field.options || []).includes('기타')
      const selectedRadio = watch(name) as string
      return (
        <div className="space-y-2">
          {(field.options || []).map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                value={opt}
                required={field.required}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                {...register(name)}
              />
              <span>{opt}</span>
            </label>
          ))}
          {hasOther && selectedRadio === '기타' && (
            <div className="mt-2 pl-6">
              <input
                type="text"
                placeholder="직접 입력 (선택)"
                className={cn(baseClass, 'text-sm')}
                {...register(name + '_other')}
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )
    }
    case 'checkbox': {
      const selected = (watch(name) as string[]) || []
      const hasOther = (field.options || []).includes('기타')
      const toggle = (opt: string) => {
        const next = selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt]
        setValue(name, next)
      }
      return (
        <div className="space-y-2">
          {(field.options || []).map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                value={opt}
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{opt}</span>
            </label>
          ))}
          {hasOther && selected.includes('기타') && (
            <div className="mt-2 pl-6">
              <input
                type="text"
                placeholder="기타 직접 입력 (선택)"
                className={cn(baseClass, 'text-sm')}
                {...register(name + '_other')}
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )
    }
    default:
      return (
        <input
          type="text"
          id={field.id}
          placeholder={field.placeholder}
          required={field.required}
          className={cn(baseClass, error && 'border-red-500')}
          {...register(name)}
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
  const hasOtherOption = (f: FormFieldSchema) =>
    (f.type === 'radio' || f.type === 'checkbox') && (f.options || []).includes('기타')
  schema.fields.forEach((f) => {
    if (f.type === 'checkbox') defaultValues[f.id] = []
    else defaultValues[f.id] = ''
    if (hasOtherOption(f)) defaultValues[f.id + '_other'] = ''
  })

  const methods = useForm({ defaultValues })

  const handleSubmit = methods.handleSubmit((data) => {
    const normalized: Record<string, unknown> = {}
    schema.fields.forEach((f) => {
      const v = data[f.id]
      const otherText = (data[f.id + '_other'] as string)?.trim() || ''
      const hasOther = (f.options || []).includes('기타')
      if (f.type === 'checkbox') {
        let arr = Array.isArray(v) ? v : (v ? [v] : []) as string[]
        if (hasOther && arr.includes('기타') && otherText)
          arr = arr.map((x) => (x === '기타' ? `기타 (${otherText})` : x))
        normalized[f.id] = arr
      } else if (f.type === 'radio' && hasOther && v === '기타' && otherText) {
        normalized[f.id] = `기타 (${otherText})`
      } else {
        normalized[f.id] = v
      }
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
