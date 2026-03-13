import { useEffect, useState } from 'react'

const NEIS_BASE = 'https://open.neis.go.kr/hub'
const MEAL_KEY = '1ff34ee414734a8ab3bf67c55492df58'
const SCHEDULE_KEY = '8262772d3934410fae17de7bdf1ae020'
// 속초여자고등학교
const ATPT_OFCDC_SC_CODE = 'K10'
const SD_SCHUL_CODE = '7801153'

type MealItem = {
  mealName: string
  dishes: { name: string; allergyNumbers: string[] }[]
}

type ScheduleItem = {
  date: string
  name: string
}

function formatDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

async function fetchMeals(target: Date): Promise<MealItem[]> {
  const ymd = formatDate(target)
  const url = `${NEIS_BASE}/mealServiceDietInfo?KEY=${MEAL_KEY}&Type=json&pIndex=1&pSize=100&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_YMD=${ymd}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('급식 정보를 불러오지 못했습니다.')
  const json = await res.json()
  const rows: any[] = json?.mealServiceDietInfo?.[1]?.row ?? []
  const map: Record<string, MealItem> = {}
  rows.forEach((row) => {
    const mealName = String(row.MMEAL_SC_NM || '')
    const raw = String(row.DDISH_NM || '')
    const parts = raw.split('<br/>').filter(Boolean)
    const dishes = parts.map((p) => {
      const m = p.match(/(.+?)(\(([\d.,]+)\))?$/)
      const name = (m?.[1] || '').trim()
      const nums = (m?.[3] || '')
        .split(/[.,]/)
        .map((s) => s.trim())
        .filter(Boolean)
      return { name, allergyNumbers: nums }
    })
    if (!map[mealName]) {
      map[mealName] = { mealName, dishes: [] }
    }
    map[mealName].dishes.push(...dishes)
  })
  return ['조식', '중식', '석식']
    .map((name) => map[name])
    .filter((v): v is MealItem => !!v)
}

async function fetchSchedule(range: 'week' | 'month', base: Date): Promise<ScheduleItem[]> {
  const start = new Date(base)
  const end = new Date(base)
  if (range === 'week') {
    const day = base.getDay() || 7
    start.setDate(base.getDate() - (day - 1))
    end.setDate(start.getDate() + 6)
  } else {
    start.setDate(1)
    end.setMonth(base.getMonth() + 1, 0)
  }
  const from = formatDate(start)
  const to = formatDate(end)
  const url = `${NEIS_BASE}/SchoolSchedule?KEY=${SCHEDULE_KEY}&Type=json&pIndex=1&pSize=100&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&AA_FROM_YMD=${from}&AA_TO_YMD=${to}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('학사일정을 불러오지 못했습니다.')
  const json = await res.json()
  const rows: any[] = json?.SchoolSchedule?.[1]?.row ?? []
  return rows.map((r) => ({
    date: String(r.AA_YMD || ''),
    name: String(r.EVENT_NM || ''),
  }))
}

export function MealBoardPage() {
  const [tab, setTab] = useState<'meal' | 'schedule'>('meal')
  const [date, setDate] = useState(() => new Date())
  const [mealItems, setMealItems] = useState<MealItem[] | null>(null)
  const [mealError, setMealError] = useState('')
  const [mealLoading, setMealLoading] = useState(false)
  const [scheduleRange, setScheduleRange] = useState<'week' | 'month'>('week')
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[] | null>(null)
  const [scheduleError, setScheduleError] = useState('')
  const [scheduleLoading, setScheduleLoading] = useState(false)

  useEffect(() => {
    setMealLoading(true)
    setMealError('')
    fetchMeals(date)
      .then((items) => setMealItems(items))
      .catch((e) => setMealError(e.message || '급식 정보를 불러오지 못했습니다.'))
      .finally(() => setMealLoading(false))
  }, [date])

  useEffect(() => {
    setScheduleLoading(true)
    setScheduleError('')
    fetchSchedule(scheduleRange, date)
      .then((items) => setScheduleItems(items))
      .catch((e) => setScheduleError(e.message || '학사일정을 불러오지 못했습니다.'))
      .finally(() => setScheduleLoading(false))
  }, [scheduleRange, date])

  const displayDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`

  const changeDay = (delta: number) => {
    setDate((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() + delta)
      return d
    })
  }

  const changeMonth = (delta: number) => {
    setDate((prev) => {
      const d = new Date(prev)
      d.setMonth(d.getMonth() + delta)
      return d
    })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">급식알림판</h1>
          <p className="text-xs text-gray-500">오늘의 급식 메뉴와 학사일정을 한눈에 확인하세요.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white p-1 text-xs">
          <button
            type="button"
            onClick={() => setTab('meal')}
            className={`rounded-full px-3 py-1 ${tab === 'meal' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
          >
            급식
          </button>
          <button
            type="button"
            onClick={() => setTab('schedule')}
            className={`rounded-full px-3 py-1 ${tab === 'schedule' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
          >
            학사일정
          </button>
        </div>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (tab === 'meal' ? changeDay(-1) : changeMonth(-1))}
              className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50"
            >
              ◀
            </button>
            <span className="font-medium">{displayDate}</span>
            <button
              type="button"
              onClick={() => (tab === 'meal' ? changeDay(1) : changeMonth(1))}
              className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50"
            >
              ▶
            </button>
          </div>
          {tab === 'schedule' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScheduleRange('week')}
                className={`rounded px-2 py-1 ${scheduleRange === 'week' ? 'bg-blue-50 text-blue-700' : ''}`}
              >
                주간
              </button>
              <button
                type="button"
                onClick={() => setScheduleRange('month')}
                className={`rounded px-2 py-1 ${scheduleRange === 'month' ? 'bg-blue-50 text-blue-700' : ''}`}
              >
                월간
              </button>
            </div>
          )}
        </div>

        {tab === 'meal' ? (
          <div>
            {mealLoading && <p className="text-sm text-gray-500">급식 정보를 불러오는 중...</p>}
            {mealError && <p className="text-sm text-red-600">{mealError}</p>}
            {!mealLoading && !mealError && mealItems && mealItems.length === 0 && (
              <p className="text-sm text-gray-500">등록된 급식 정보가 없습니다.</p>
            )}
            <div className="grid gap-4 md:grid-cols-3">
              {mealItems?.map((meal) => (
                <div key={meal.mealName} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <h2 className="mb-2 text-sm font-semibold text-gray-800">{meal.mealName}</h2>
                  <ul className="space-y-1 text-xs text-gray-700">
                    {meal.dishes.map((d, idx) => (
                      <li key={idx} className="leading-snug">
                        <span>{d.name}</span>
                        {d.allergyNumbers.length > 0 && (
                          <span className="ml-1 text-[10px] text-gray-500">({d.allergyNumbers.join(',')})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-md border border-yellow-100 bg-yellow-50 p-3 text-[11px] leading-snug text-gray-700">
              <p className="font-semibold text-yellow-800">알레르기 유발 식재료 번호 안내</p>
              <p>
                1.난류, 2.우유, 3.메밀, 4.땅콩, 5.대두, 6.밀, 7.고등어, 8.게, 9.새우, 10.돼지고기, 11.복숭아, 12.토마토,
                13.아황산류, 14.호두, 15.닭고기, 16.쇠고기, 17.오징어, 18.조개류(굴·전복·홍합 포함), 19.잣
              </p>
            </div>
          </div>
        ) : (
          <div>
            {scheduleLoading && <p className="text-sm text-gray-500">학사일정을 불러오는 중...</p>}
            {scheduleError && <p className="text-sm text-red-600">{scheduleError}</p>}
            {!scheduleLoading && !scheduleError && scheduleItems && scheduleItems.length === 0 && (
              <p className="text-sm text-gray-500">등록된 학사일정이 없습니다.</p>
            )}
            <ul className="divide-y divide-gray-200 text-sm">
              {scheduleItems?.map((s) => (
                <li key={`${s.date}-${s.name}`} className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-gray-500">
                    {s.date.slice(0, 4)}-{s.date.slice(4, 6)}-{s.date.slice(6, 8)}
                  </span>
                  <span className="ml-3 flex-1 truncate text-gray-800">{s.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

