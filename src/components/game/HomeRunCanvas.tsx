import { useEffect, useRef, useCallback } from 'react'

const W = 360
const H = 300
const GROUND = 258
const PLAYER_X = 108
const PW = 40
const PH = 42
const TEACHER_SCALE = 3
/** 단일 점프로는 3단(78px) 책상을 넘지 못하고, 2단 점프로만 통과 · 낮은 중력으로 체공 연장 */
const GRAVITY = 0.39
const JUMP_V = -7.55
const JUMP2_MUL = 0.69
const SLIDE_MS = 520
const BASE_SPEED = 2.45
const SPEED_RAMP = 0.00105
const TEACHER_CATCH_GAP = 12
const GAP_START = 88
const GAP_TIMER_BONUS = 38
const GAP_HIT_PENALTY = 32
const PASSIVE_MS_MAX = 30000
const TIMER_SPAWN_INTERVAL_MS = 10000

type ObsKind = 'f1' | 'f2' | 'f3' | 'air'

type Obstacle = {
  x: number
  kind: ObsKind
  w: number
  hit: boolean
}

type TimerItem = {
  x: number
  collected: boolean
}

function deskHeight(kind: ObsKind): number {
  if (kind === 'f1') return 26
  if (kind === 'f2') return 52
  if (kind === 'f3') return 78
  return 0
}

function drawStackedDesks(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  stacks: 1 | 2 | 3,
  width: number
) {
  const unit = 26
  for (let i = 0; i < stacks; i++) {
    const top = groundY - (i + 1) * unit
    ctx.fillStyle = '#8B5A2B'
    ctx.fillRect(x, top, width, unit - 2)
    ctx.fillStyle = '#5D3A1A'
    ctx.fillRect(x + 4, top + unit - 6, 5, 6)
    ctx.fillRect(x + width - 9, top + unit - 6, 5, 6)
    ctx.strokeStyle = '#4a2c12'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, top + 0.5, width - 1, unit - 2.5)
  }
}

function drawHangingDesk(ctx: CanvasRenderingContext2D, x: number, yTop: number, w: number) {
  ctx.fillStyle = '#6b4423'
  ctx.fillRect(x, yTop, w, 20)
  ctx.fillStyle = '#4a2c12'
  ctx.fillRect(x + w * 0.35, yTop + 20, 4, 28)
  ctx.fillRect(x + w * 0.6, yTop + 20, 4, 28)
  ctx.strokeStyle = '#3d2410'
  ctx.strokeRect(x + 0.5, yTop + 0.5, w - 1, 19)
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.beginPath()
  ctx.ellipse(x, y, 22 * s, 12 * s, 0, 0, Math.PI * 2)
  ctx.ellipse(x + 18 * s, y - 3 * s, 18 * s, 14 * s, 0, 0, Math.PI * 2)
  ctx.ellipse(x + 36 * s, y, 16 * s, 10 * s, 0, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * 밝은 단색·흰 배경만 투명 처리 (피부톤은 채도·채널 차이로 보존)
 */
function createProfileCanvasWithoutWhiteBg(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (w < 1 || h < 1) {
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    return c
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const xctx = c.getContext('2d', { willReadFrequently: true })
  if (!xctx) return c
  xctx.drawImage(img, 0, 0)
  let id: ImageData
  try {
    id = xctx.getImageData(0, 0, w, h)
  } catch {
    return c
  }
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    const aIn = d[i + 3]
    if (aIn < 8) continue

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const sat = max <= 0 ? 0 : (max - min) / max
    const avg = (r + g + b) / 3

    // 순백·아주 연한 회색 배경
    let bgFactor = 0
    if (avg >= 248 && sat < 0.08) {
      bgFactor = 1
    } else if (avg >= 218 && min >= 195 && sat < 0.14) {
      bgFactor = Math.min(1, (avg - 218) / 32 + (0.14 - sat) * 2)
    } else if (avg >= 235 && sat < 0.06) {
      bgFactor = 0.85
    }

    if (bgFactor > 0) {
      const na = Math.round(aIn * (1 - Math.min(1, bgFactor)))
      d[i + 3] = na
    }
  }
  xctx.putImageData(id, 0, 0)
  return c
}

function drawPlayerGroundShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  jumpLift: number,
  maxLift: number
) {
  const t = Math.min(1, Math.max(0, jumpLift / maxLift))
  const rx = 16 + (1 - t) * 4
  const ry = 4 + t * 2
  const alpha = 0.22 * (1 - t * 0.65)
  ctx.save()
  ctx.fillStyle = `rgba(30,50,30,${alpha})`
  ctx.beginPath()
  ctx.ellipse(cx, groundY + 2, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawFallbackTeacher(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save()
  ctx.translate(cx, cy)
  const s = size / 48
  ctx.scale(s, s)
  ctx.fillStyle = '#c41e3a'
  const rw = 20
  const rh = 22
  ctx.beginPath()
  ctx.moveTo(-rw + 6, -8)
  ctx.lineTo(rw - 6, -8)
  ctx.quadraticCurveTo(rw, -8, rw, -8 + 6)
  ctx.lineTo(rw, -8 + rh - 6)
  ctx.quadraticCurveTo(rw, -8 + rh, rw - 6, -8 + rh)
  ctx.lineTo(-rw + 6, -8 + rh)
  ctx.quadraticCurveTo(-rw, -8 + rh, -rw, -8 + rh - 6)
  ctx.lineTo(-rw, -8 + 6)
  ctx.quadraticCurveTo(-rw, -8, -rw + 6, -8)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#f5e6a8'
  ctx.fillRect(-8, -18, 16, 10)
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  ctx.arc(-6, -28, 3, 0, Math.PI * 2)
  ctx.arc(6, -28, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffd4c4'
  ctx.beginPath()
  ctx.arc(0, -22, 14, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()
}

export type HomeRunGameStats = {
  duration_ms: number
  timers_collected: number
  hits_total: number
}

type Props = {
  running: boolean
  playerPhotoSrc: string | null
  teacherImage: HTMLImageElement | null
  onGameOver: (stats: HomeRunGameStats) => void
  onTimeUpdate: (ms: number) => void
  /** 터치마다 +1, 매 프레임 최대 1회 점프 처리(이단 점프는 연속 프레임에 반영) */
  jumpQueueRef: React.MutableRefObject<number>
  slidePressedRef: React.MutableRefObject<boolean>
}

export function HomeRunCanvas({
  running,
  playerPhotoSrc,
  teacherImage,
  onGameOver,
  onTimeUpdate,
  jumpQueueRef,
  slidePressedRef,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  /** 원본(폴백용) */
  const playerImgRef = useRef<HTMLImageElement | null>(null)
  /** 흰 배경 제거 후 그리기용 */
  const playerDrawCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const teacherImgRef = useRef<HTMLImageElement | null>(null)
  const rafRef = useRef<number>(0)
  teacherImgRef.current = teacherImage
  const stateRef = useRef({
    vy: 0,
    py: GROUND - PH,
    jumpsLeft: 2,
    sliding: false,
    slideEnd: 0,
    obstacles: [] as Obstacle[],
    timers: [] as TimerItem[],
    speed: BASE_SPEED,
    startTime: 0,
    lastFrame: 0,
    gap: GAP_START,
    passiveMs: 0,
    lastTimerSpawnGameMs: 0,
    hitCount: 0,
    timersCollected: 0,
    invulnUntil: 0,
    runFrame: 0,
    ended: false,
    clouds: [] as { x: number; y: number; s: number; sp: number }[],
  })

  useEffect(() => {
    playerDrawCanvasRef.current = null
    playerImgRef.current = null
    if (!playerPhotoSrc) return
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => {
      playerImgRef.current = im
      try {
        playerDrawCanvasRef.current = createProfileCanvasWithoutWhiteBg(im)
      } catch {
        playerDrawCanvasRef.current = null
      }
    }
    im.src = playerPhotoSrc
  }, [playerPhotoSrc])

  const onGameOverRef = useRef(onGameOver)
  onGameOverRef.current = onGameOver
  const onTimeUpdateRef = useRef(onTimeUpdate)
  onTimeUpdateRef.current = onTimeUpdate

  const resetState = useCallback(() => {
    const clouds = Array.from({ length: 6 }, (_, i) => ({
      x: (i * 90) % (W + 100),
      y: 28 + (i % 3) * 22,
      s: 0.7 + (i % 3) * 0.15,
      sp: 0.35 + (i % 2) * 0.2,
    }))
    stateRef.current = {
      vy: 0,
      py: GROUND - PH,
      jumpsLeft: 2,
      sliding: false,
      slideEnd: 0,
      obstacles: [],
      timers: [],
      speed: BASE_SPEED,
      startTime: performance.now(),
      lastFrame: performance.now(),
      gap: GAP_START,
      passiveMs: 0,
      lastTimerSpawnGameMs: 0,
      hitCount: 0,
      timersCollected: 0,
      invulnUntil: 0,
      runFrame: 0,
      ended: false,
      clouds,
    }
  }, [])

  useEffect(() => {
    if (!running) return
    resetState()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pickKind = (): ObsKind => {
      const r = Math.random()
      if (r < 0.28) return 'f1'
      if (r < 0.52) return 'f2'
      if (r < 0.72) return 'f3'
      return 'air'
    }

    const spawnObstacle = (st: typeof stateRef.current) => {
      const kind = pickKind()
      const w = kind === 'air' ? 56 : 40
      let spawnX = W + 64 + Math.random() * 90
      if (st.obstacles.length > 0) {
        let maxX = 0
        for (const o of st.obstacles) if (o.x > maxX) maxX = o.x
        spawnX = Math.max(spawnX, maxX + 170 + Math.random() * 160)
      }
      st.obstacles.push({ x: spawnX, kind, w, hit: false })
    }

    const loop = (now: number) => {
      const st = stateRef.current
      if (st.ended) return

      const dt = Math.min(32, now - st.lastFrame)
      st.lastFrame = now
      const gameMs = now - st.startTime
      onTimeUpdateRef.current(gameMs)

      const hasAhead = st.obstacles.some((o) => o.x > W + 165)
      if (!hasAhead) {
        spawnObstacle(st)
      }

      if (gameMs - st.lastTimerSpawnGameMs >= TIMER_SPAWN_INTERVAL_MS) {
        st.lastTimerSpawnGameMs = gameMs
        st.timers.push({ x: W + 30 + Math.random() * 80, collected: false })
      }

      st.speed = BASE_SPEED + gameMs * SPEED_RAMP
      const teacherBoost = 1 + gameMs * 0.0000008
      const catchUp = 0.0125 * teacherBoost * (dt / 16)
      st.gap -= catchUp
      st.passiveMs += dt

      if (jumpQueueRef.current > 0 && st.jumpsLeft > 0) {
        jumpQueueRef.current -= 1
        const inAir = st.py < GROUND - PH - 2
        const isSecondJump = st.jumpsLeft === 1 && inAir
        st.vy = isSecondJump ? JUMP_V * JUMP2_MUL : JUMP_V
        st.jumpsLeft -= 1
      }

      if (slidePressedRef.current) {
        slidePressedRef.current = false
        st.sliding = true
        st.slideEnd = now + SLIDE_MS
      }
      if (st.sliding && now > st.slideEnd) st.sliding = false

      st.vy += GRAVITY
      st.py += st.vy
      if (st.py >= GROUND - PH) {
        st.py = GROUND - PH
        st.vy = 0
        st.jumpsLeft = 2
      }

      for (const c of st.clouds) {
        c.x -= st.speed * c.sp * 0.35 * (dt / 16)
        if (c.x < -80) c.x = W + 40 + Math.random() * 60
      }

      for (const o of st.obstacles) {
        o.x -= st.speed * (dt / 16)
      }
      for (const t of st.timers) {
        t.x -= st.speed * (dt / 16)
      }
      st.obstacles = st.obstacles.filter((o) => o.x > -60)
      st.timers = st.timers.filter((t) => t.x > -40 || !t.collected)

      const playerTop = st.py
      const playerBottom = st.py + PH
      const slideShrink = st.sliding ? 20 : 0
      const bodyTop = playerTop + slideShrink

      const airY = GROUND - 98
      const airH = 22

      for (const o of st.obstacles) {
        if (o.hit || now < st.invulnUntil) continue
        const ox = o.x
        const ow = o.w
        const overlapX = PLAYER_X + PW - 6 > ox + 4 && PLAYER_X + 6 < ox + ow - 4

        if (o.kind === 'air') {
          if (!overlapX) continue
          const plankTop = airY
          const plankBot = airY + airH
          if (bodyTop < plankBot && playerBottom > plankTop) {
            o.hit = true
            st.hitCount++
            st.gap -= GAP_HIT_PENALTY
            st.passiveMs = 0
            st.invulnUntil = now + 900
          }
        } else {
          const dh = deskHeight(o.kind)
          const obsTop = GROUND - dh
          if (!overlapX) continue
          const clearedHigh = playerBottom <= obsTop + 4
          if (clearedHigh) continue
          if (playerBottom > obsTop + 2 && bodyTop < GROUND - 4) {
            o.hit = true
            st.hitCount++
            st.gap -= GAP_HIT_PENALTY
            st.passiveMs = 0
            st.invulnUntil = now + 900
          }
        }
      }

      for (const t of st.timers) {
        if (t.collected) continue
        if (t.x < PLAYER_X + PW && t.x + 28 > PLAYER_X && playerBottom > GROUND - 50 && playerTop < GROUND - 20) {
          t.collected = true
          st.timersCollected++
          st.gap = Math.min(GAP_START + 40, st.gap + GAP_TIMER_BONUS)
          st.passiveMs = 0
        }
      }

      const maxHits = 3 + st.timersCollected
      if (st.hitCount >= maxHits) {
        st.ended = true
        onGameOverRef.current({
          duration_ms: Math.floor(gameMs),
          timers_collected: st.timersCollected,
          hits_total: st.hitCount,
        })
        return
      }
      if (st.gap < TEACHER_CATCH_GAP) {
        st.ended = true
        onGameOverRef.current({
          duration_ms: Math.floor(gameMs),
          timers_collected: st.timersCollected,
          hits_total: st.hitCount,
        })
        return
      }
      if (st.passiveMs >= PASSIVE_MS_MAX) {
        st.ended = true
        onGameOverRef.current({
          duration_ms: Math.floor(gameMs),
          timers_collected: st.timersCollected,
          hits_total: st.hitCount,
        })
        return
      }

      st.runFrame += dt * 0.012

      ctx.clearRect(0, 0, W, H)
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND)
      sky.addColorStop(0, '#7ec8ff')
      sky.addColorStop(1, '#b8e0ff')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, GROUND)

      for (const c of st.clouds) {
        drawCloud(ctx, c.x, c.y, c.s)
      }

      ctx.fillStyle = '#c4d4a8'
      ctx.fillRect(0, GROUND - 6, W, 8)
      ctx.fillStyle = '#8fbc6b'
      ctx.fillRect(0, GROUND + 2, W, H - GROUND)

      const tBob = Math.sin(st.runFrame * 1.1 + 1) * 2
      const onGround = st.py >= GROUND - PH - 1 && st.vy >= -0.01

      for (const o of st.obstacles) {
        if (o.kind === 'air') {
          drawHangingDesk(ctx, o.x, airY, o.w)
        } else {
          const stacks = o.kind === 'f1' ? 1 : o.kind === 'f2' ? 2 : 3
          drawStackedDesks(ctx, o.x, GROUND, stacks, o.w)
        }
      }

      for (const t of st.timers) {
        if (t.collected) continue
        ctx.fillStyle = '#22c55e'
        ctx.beginPath()
        ctx.moveTo(t.x + 14, GROUND - 42)
        ctx.lineTo(t.x + 28, GROUND - 28)
        ctx.lineTo(t.x + 14, GROUND - 14)
        ctx.lineTo(t.x, GROUND - 28)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 11px system-ui,sans-serif'
        ctx.fillText('T', t.x + 10, GROUND - 22)
      }

      const teacherW = PW * TEACHER_SCALE
      const teacherH = PH * TEACHER_SCALE
      const teacherX = PLAYER_X - st.gap - teacherW * 0.45
      const teacherY = GROUND - teacherH + tBob

      const tim = teacherImgRef.current
      if (tim && tim.complete && tim.naturalWidth > 0) {
        ctx.drawImage(tim, teacherX, teacherY, teacherW, teacherH)
      } else {
        drawFallbackTeacher(ctx, teacherX + teacherW / 2, teacherY + teacherH / 2, Math.min(teacherW, teacherH))
      }

      const pDrawY = st.py
      const feetY = pDrawY + PH
      const jumpLift = Math.max(0, GROUND - feetY)
      const anchorX = PLAYER_X + PW * 0.5
      const anchorY = feetY - 3

      drawPlayerGroundShadow(ctx, anchorX, GROUND, jumpLift, 95)

      let lean = 0
      let sx = 1
      let sy = 1
      if (st.sliding) {
        sy = 0.52
        sx = 1.12
        lean = 0.35
      } else if (onGround) {
        const phase = st.runFrame * 2.55
        lean = Math.sin(phase) * 0.09
        sx = 1 + Math.sin(phase) * 0.04
        sy = 1 - Math.sin(phase) * 0.035
      } else {
        lean = Math.max(-0.22, Math.min(0.26, st.vy * 0.0115))
        const stretch = Math.max(-0.1, Math.min(0.13, -st.vy * 0.019))
        sy = 1 + stretch
        sx = 1 - stretch * 0.45
      }

      ctx.save()
      ctx.translate(anchorX, anchorY)
      ctx.rotate(lean)
      ctx.scale(sx, sy)
      ctx.translate(-anchorX, -anchorY)

      const pCanvas = playerDrawCanvasRef.current
      const pim = playerImgRef.current
      const drawSrc: CanvasImageSource | null =
        pCanvas && pCanvas.width > 0 ? pCanvas : pim && pim.complete && pim.naturalWidth > 0 ? pim : null

      if (drawSrc) {
        ctx.save()
        ctx.beginPath()
        ctx.ellipse(anchorX, pDrawY + PH * 0.48, PW * 0.46, PH * 0.47, 0, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(drawSrc, PLAYER_X, pDrawY, PW, PH)
        ctx.restore()
      } else {
        ctx.fillStyle = '#3b82f6'
        const r0 = 8
        ctx.beginPath()
        ctx.moveTo(PLAYER_X + r0, pDrawY)
        ctx.arcTo(PLAYER_X + PW, pDrawY, PLAYER_X + PW, pDrawY + PH, r0)
        ctx.arcTo(PLAYER_X + PW, pDrawY + PH, PLAYER_X, pDrawY + PH, r0)
        ctx.arcTo(PLAYER_X, pDrawY + PH, PLAYER_X, pDrawY, r0)
        ctx.arcTo(PLAYER_X, pDrawY, PLAYER_X + PW, pDrawY, r0)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [running, resetState, jumpQueueRef, slidePressedRef])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="mx-auto max-w-full rounded-xl border-2 border-sky-300/80 bg-sky-200 shadow-inner"
      style={{ width: '100%', maxWidth: 360, height: 'auto', aspectRatio: `${W} / ${H}` }}
    />
  )
}
