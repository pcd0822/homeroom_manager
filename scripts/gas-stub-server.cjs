/**
 * gas/Code.gs 를 Node에서 그대로 돌리는 스텁 서버(로컬 점검용).
 *   node scripts/gas-stub-server.cjs [port]      → http://localhost:8787 에 POST(text/plain JSON)
 *   node scripts/gas-stub-server.cjs --selftest  → 교시 출결 API 흐름 점검 후 종료
 * SpreadsheetApp·PropertiesService·CacheService·LockService·Utilities·ContentService 를 메모리로 흉내 낸다.
 * 실제 시트는 건드리지 않는다.
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const http = require('http')
const crypto = require('crypto')

function makeSheet(name, rows) {
  const data = rows.map((r) => r.slice())
  const width = () => Math.max(0, ...data.map((r) => r.length))
  const ensure = (r, c) => {
    while (data.length < r) data.push([])
    for (const row of data) while (row.length < c) row.push('')
  }
  const range = (r, c, nr = 1, nc = 1) => ({
    getValues: () => {
      ensure(r + nr - 1, c + nc - 1)
      return data.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc))
    },
    setValues: (vals) => {
      ensure(r + vals.length - 1, c + (vals[0] ? vals[0].length : 1) - 1)
      vals.forEach((row, i) => row.forEach((v, j) => (data[r - 1 + i][c - 1 + j] = v)))
      return range(r, c, nr, nc)
    },
    setValue: (v) => {
      ensure(r, c)
      data[r - 1][c - 1] = v
    },
    clearContent: () => {
      for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (data[r - 1 + i]) data[r - 1 + i][c - 1 + j] = ''
      // 뒤쪽 빈 행 제거(getLastRow 흉내)
      while (data.length && data[data.length - 1].every((v) => v === '' || v == null)) data.pop()
    },
    setNumberFormat: () => range(r, c, nr, nc),
  })
  return {
    _data: data,
    getName: () => name,
    getLastRow: () => {
      let n = data.length
      while (n && data[n - 1].every((v) => v === '' || v == null)) n--
      return n
    },
    getLastColumn: () => width(),
    getRange: (a, b, c, d) => (typeof a === 'string' ? range(1, 1, 1, 1) : range(a, b, c, d)),
    getDataRange: () => range(1, 1, Math.max(1, data.length), Math.max(1, width())),
    appendRow: (row) => data.push(row.slice()),
  }
}

function createRuntime(seed) {
  const sheets = new Map()
  for (const [name, rows] of Object.entries(seed.sheets || {})) sheets.set(name, makeSheet(name, rows))
  const ss = {
    getSheetByName: (n) => sheets.get(n) || null,
    insertSheet: (n) => {
      const s = makeSheet(n, [])
      sheets.set(n, s)
      return s
    },
  }
  const props = new Map(Object.entries(seed.props || {}))
  const cache = new Map()
  const ctx = {
    SpreadsheetApp: { openById: () => ss, getActiveSpreadsheet: () => ss },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props.has(k) ? props.get(k) : null),
        setProperty: (k, v) => props.set(k, String(v)),
        deleteProperty: (k) => props.delete(k),
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cache.has(k) ? cache.get(k) : null),
        put: (k, v) => cache.set(k, v),
        remove: (k) => cache.delete(k),
        removeAll: (ks) => ks.forEach((k) => cache.delete(k)),
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: (d, _tz, fmt) => {
        // Asia/Seoul 고정
        const k = new Date(d.getTime() + 9 * 3600 * 1000)
        const p = (n) => String(n).padStart(2, '0')
        if (fmt === 'yyyy-MM-dd') return `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())}`
        return k.toISOString()
      },
      computeDigest: () => [],
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (t) => ({ _t: t, setMimeType() { return this } }),
    },
    Session: { getScriptTimeZone: () => 'Asia/Seoul' },
    console,
  }
  vm.createContext(ctx)
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas', 'Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' })
  const call = (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } })._t)
  return { call, sheets, props }
}

const SEED = {
  props: { SPREADSHEET_ID: 'stub' },
  sheets: {
    Students: [
      ['student_id', 'name', 'auth_code', 'x', 'y', 'z', 'photo_data'],
      ['30501', '김하늘', '1111', '', '', '', 'data:image/jpeg;base64,AAAA'],
      ['30502', '이서준', '2222', '', '', '', ''],
      ['30503', '박지우', '3333', '', '', '', ''],
      ['30504', '최리헌', '4444', '', '', '', ''],
      ['30505', '정이안', '5555', '', '', '', ''],
    ],
    HomeroomAttendance: [['date', 'student_id', 'late', 'early', 'late_doc', 'early_doc', 'updated_at']],
  },
}

function selftest() {
  const { call } = createRuntime(SEED)
  let fail = 0
  const check = (name, ok, extra) => {
    console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : JSON.stringify(extra))
    if (!ok) fail++
  }
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)

  const sch = call({ action: 'GET_PERIOD_SCHEDULE' })
  check('기본 교시 설정', sch.success && sch.data.weekday.join() === '0,7,7,7,7,7,0', sch)
  const save = call({ action: 'SAVE_PERIOD_SCHEDULE', schedule: { weekday: [7, 7, 7, 7, 7, 7, 7], dates: { [today]: 6 } } })
  check('교시 설정 저장(오늘 6교시)', save.success && save.data.dates[today] === 6, save)

  const ops = [
    { student_id: '30501', type: 'kind', kind: 'L' },
    { student_id: '30501', type: 'mark', period: 0, value: 'L' },
    { student_id: '30501', type: 'mark', period: 1, value: 'L' },
    { student_id: '30501', type: 'note', note: '병원 진료 후 등교' },
    { student_id: '30502', type: 'mark', period: 5, value: 'E' },
    { student_id: '30502', type: 'mark', period: 6, value: 'E' },
  ]
  const r1 = call({ action: 'SAVE_PERIOD_OPS', date: today, ops })
  const row1 = r1.data && r1.data.rows.find((r) => r.student_id === '30501')
  check('담임 저장', r1.success && row1 && row1.marks === '0:L,1:L' && row1.kind === 'L' && row1.note === '병원 진료 후 등교', r1)

  const key = call({ action: 'GET_ATTENDANCE_SHARE_KEY' }).data.key
  check('공유 키 발급', typeof key === 'string' && key.length === 16, key)
  const bad = call({ action: 'GET_ATTENDANCE_BOARD', k: 'nope' })
  check('잘못된 키 거절', !bad.success, bad)
  const board = call({ action: 'GET_ATTENDANCE_BOARD', k: key, roster: true })
  check(
    'QR 출석부 조회(명단·교시 수·비고)',
    board.success && board.data.roster.length === 5 && board.data.periods === 6 && board.data.rows.some((r) => r.note) && board.data.roster[0].photo_data === 'data:image/jpeg;base64,AAAA' && board.data.roster[1].photo_data === '',
    board
  )

  const poll = call({ action: 'GET_ATTENDANCE_BOARD', k: key })
  check('폴링엔 명단·사진 없음', poll.success && !poll.data.roster, poll)

  const m1 = call({ action: 'SAVE_ATTENDANCE_BOARD_MARK', k: key, date: today, student_id: '30503', period: 3, on: true })
  check('교과교사 빗금 체크', m1.success && m1.data.rows.find((r) => r.student_id === '30503').marks === '3:S', m1)
  const m2 = call({ action: 'SAVE_ATTENDANCE_BOARD_MARK', k: key, date: today, student_id: '30501', period: 1, on: false })
  check('담임 체크 칸은 못 바꿈', !m2.success, m2)
  const m3 = call({ action: 'SAVE_ATTENDANCE_BOARD_MARK', k: key, date: today, student_id: '30503', period: 7, on: true })
  check('그날 교시 수 넘으면 거절', !m3.success, m3)
  const m4 = call({ action: 'SAVE_ATTENDANCE_BOARD_MARK', k: key, date: '2020-01-01', student_id: '30503', period: 1, on: true })
  check('지난 날짜는 거절', !m4.success, m4)
  const m5 = call({ action: 'SAVE_ATTENDANCE_BOARD_MARK', k: key, date: today, student_id: '99999', period: 1, on: true })
  check('명단에 없는 학생 거절', !m5.success, m5)

  // 동시 저장: 담임이 30503 비고를 쓰는 동안 교과교사가 4교시 체크 → 둘 다 남아야 함
  call({ action: 'SAVE_ATTENDANCE_BOARD_MARK', k: key, date: today, student_id: '30503', period: 4, on: true })
  const r2 = call({ action: 'SAVE_PERIOD_OPS', date: today, ops: [{ student_id: '30503', type: 'note', note: '보건실' }] })
  const row3 = r2.data.rows.find((r) => r.student_id === '30503')
  check('담임·교과 변경이 서로 덮어쓰지 않음', row3.marks === '3:S,4:S' && row3.note === '보건실', row3)

  const adm = call({ action: 'GET_PERIOD_ATTENDANCE', date: today })
  check('관리자 날짜별 조회(캐시 무효화 반영)', adm.success && adm.data.length === 3, adm)
  const all = call({ action: 'GET_PERIOD_ATTENDANCE' })
  check('관리자 전체 조회', all.success && all.data.length === 3, all)

  const stu = call({ action: 'GET_ATTENDANCE_FOR_STUDENT', student_id: '30502', auth_code: '2222' })
  const mine = stu.success && stu.data.period_marks.find((p) => p.student_id === 'me')
  check(
    '학생 화면: 교시 체크 전달, 비고·학번 숨김',
    stu.success && mine && mine.marks === '5:E,6:E' && !JSON.stringify(stu.data.period_marks).includes('보건실') && !JSON.stringify(stu.data.period_marks).includes('30501') && !!stu.data.period_schedule,
    stu
  )

  const rot = call({ action: 'ROTATE_ATTENDANCE_SHARE_KEY' })
  const old = call({ action: 'GET_ATTENDANCE_BOARD', k: key })
  check('재발급하면 예전 QR 거절', rot.success && rot.data.key !== key && !old.success, old)

  // 기존 기능 회귀: 하루치 지각·조퇴 저장
  const att = call({ action: 'SAVE_ATTENDANCE_DAY', date: today, records: [{ student_id: '30501', late: true, early: false, late_doc: true, early_doc: false }] })
  const recs = call({ action: 'GET_ATTENDANCE_RECORDS' })
  check('기존 지각 저장 그대로', att.success && recs.data.length === 1 && recs.data[0].late_doc === true, recs)

  console.log(fail ? `\n${fail}개 실패` : '\n모두 통과')
  process.exit(fail ? 1 : 0)
}

if (process.argv.includes('--selftest')) selftest()
else {
  const port = Number(process.argv[2]) || 8787
  const { call } = createRuntime(SEED)
  http
    .createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      if (req.method !== 'POST') {
        res.end('{}')
        return
      }
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        let out
        try {
          out = call(JSON.parse(body))
        } catch (e) {
          out = { success: false, error: String(e) }
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(out))
      })
    })
    .listen(port, () => console.log(`GAS stub on http://localhost:${port}`))
}
