import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { usePlayer } from '../hooks/PlayerContext'
import { subscribeAnalyser } from '../lib/audioAnalyser'
import { IDLE_PALETTE, paletteForGenre, type Palette, type RGB } from '../lib/visualizerPalettes'
import { subscribeMainVisualizerVisible } from '../lib/visualizerVisibility'

const RING_COUNT = 8
const DEFAULT_SIZE = 48 // px — matches sidebar block width to avoid layout shift

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

// ── Persistent animation state (survives component remounts) ──────────────
// Without this, every remount randomizes ring configs and resets all
// smoothing values to 0, causing a jarring "different visualizer" effect.

interface RingCfg {
  breathFreq: number
  breathPhase: number
  dirSign: number
  speedMul: number
  initialAngle: number
}

let persistentRingConfig: RingCfg[] | null = null
let persistentRingRotAccum: Float32Array | null = null
let persistentT = 0
let persistentSmoothBass = 0
let persistentSmoothMid = 0
let persistentSmoothTreble = 0
let persistentSmoothVocal = 0
let persistentSmoothPresence = 0
let persistentActivityEnvelope = 0
let persistentBassAvg = 0
let persistentLastFrameTime = 0
let persistentLastBeatT = 0
let persistentRingBeatEnv: Float32Array | null = null
let persistentRingBands: Float32Array | null = null
let persistentRingVoiceBands: Float32Array | null = null

function initPersistentState() {
  persistentRingConfig = Array.from({ length: RING_COUNT }, () => ({
    breathFreq: 0.012 + Math.random() * 0.025,
    breathPhase: Math.random() * Math.PI * 2,
    dirSign: Math.random() < 0.5 ? -1 : 1,
    speedMul: 0.6 + Math.random() * 1.2,
    initialAngle: Math.random() * Math.PI,
  }))
  persistentRingRotAccum = new Float32Array(RING_COUNT)
  for (let i = 0; i < RING_COUNT; i++) persistentRingRotAccum[i] = persistentRingConfig[i].initialAngle
  persistentRingBands = new Float32Array(RING_COUNT)
  persistentRingVoiceBands = new Float32Array(RING_COUNT)
  persistentRingBeatEnv = new Float32Array(RING_COUNT)
  persistentT = 0
  persistentSmoothBass = 0
  persistentSmoothMid = 0
  persistentSmoothTreble = 0
  persistentSmoothVocal = 0
  persistentSmoothPresence = 0
  persistentActivityEnvelope = 0
  persistentBassAvg = 0
  persistentLastBeatT = 0
  persistentLastFrameTime = 0
}

// ── Component ──────────────────────────────────────────────────────────────

interface MiniAudioVisualizerProps {
  hideWhenMainVisible?: boolean
  inline?: boolean
  reserveSpace?: boolean
  size?: number
  onVisibilityChange?: (visible: boolean) => void
}

export default function MiniAudioVisualizer({ hideWhenMainVisible = true, inline = false, reserveSpace = false, size = DEFAULT_SIZE, onVisibilityChange }: MiniAudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const isPlayingRef = useRef<boolean>(false)
  const currentPaletteRef = useRef<Palette>([
    [...IDLE_PALETTE[0]] as RGB,
    [...IDLE_PALETTE[1]] as RGB,
    [...IDLE_PALETTE[2]] as RGB,
  ])
  const targetPaletteRef = useRef<Palette>(IDLE_PALETTE)

  const { isPlaying, currentTrack } = usePlayer()

  // Show only when the main visualizer is NOT visible (other page or scrolled away)
  const [hidden, setHidden] = useState(hideWhenMainVisible ? true : false)
  useEffect(() => {
    if (!hideWhenMainVisible) {
      setHidden(false)
      return
    }
    return subscribeMainVisualizerVisible(visible => setHidden(visible))
  }, [hideWhenMainVisible])

  useEffect(() => {
    onVisibilityChange?.(!hidden)
  }, [hidden, onVisibilityChange])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    if (isPlaying && currentTrack) {
      targetPaletteRef.current = paletteForGenre(currentTrack.genre)
    } else {
      targetPaletteRef.current = IDLE_PALETTE
    }
  }, [isPlaying, currentTrack])

  useEffect(() => {
    const unsub = subscribeAnalyser(a => {
      analyserRef.current = a
    })
    return unsub
  }, [])

  // Initialize persistent state once (survives remounts)
  if (!persistentRingConfig) {
    initPersistentState()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Use persistent state (shared across remounts)
    const ringConfig = persistentRingConfig!
    const ringRotAccum = persistentRingRotAccum!
    const ringBands = persistentRingBands!
    const ringVoiceBands = persistentRingVoiceBands!
    const ringBeatEnv = persistentRingBeatEnv!
    const freqData = new Uint8Array(256)

    const tick = () => {
      // Time-based delta for frame-rate independent animation
      const now = performance.now()
      if (persistentLastFrameTime === 0) {
        persistentLastFrameTime = now
      }
      const dt = Math.min((now - persistentLastFrameTime) / 16.667, 3)
      persistentLastFrameTime = now
      persistentT += dt
      const t = persistentT

      let bass = 0
      let mid = 0
      let treble = 0
      let vocal = 0
      let presence = 0
      let total = 0
      const analyser = analyserRef.current
      if (analyser) {
        analyser.getByteFrequencyData(freqData)
        let s = 0
        for (let i = 0; i < 16; i++) s += freqData[i]
        bass = s / (16 * 255)
        s = 0
        for (let i = 16; i < 64; i++) s += freqData[i]
        mid = s / ((64 - 16) * 255)
        s = 0
        for (let i = 64; i < freqData.length; i++) s += freqData[i]
        treble = s / ((freqData.length - 64) * 255)
        s = 0
        for (let i = 22; i < 82; i++) s += freqData[i]
        vocal = s / ((82 - 22) * 255)
        s = 0
        for (let i = 48; i < 120; i++) s += freqData[i]
        presence = s / ((120 - 48) * 255)
        total = (bass + mid + treble) / 3
      }

      const idle = !isPlayingRef.current || total < 0.005
      const envelopeTarget = idle ? 0 : clamp(total * 2.8 + bass * 1.2 + vocal * 0.9, 0, 1)
      persistentActivityEnvelope = lerp(
        persistentActivityEnvelope,
        envelopeTarget,
        clamp((envelopeTarget > persistentActivityEnvelope ? 0.04 : 0.02) * dt, 0, 1),
      )
      const easedEnvelope = persistentActivityEnvelope * persistentActivityEnvelope * (3 - 2 * persistentActivityEnvelope)
      const activeResponse = clamp(easedEnvelope, 0, 1)

      if (idle) {
        const breathe = (Math.sin(t * 0.012) + 1) / 2
        bass = 0.015 + breathe * 0.015
        mid = 0.015 + breathe * 0.012
        treble = 0.01 + breathe * 0.01
        vocal = 0.012 + breathe * 0.014
        presence = 0.01 + breathe * 0.012
      } else {
        bass *= activeResponse
        mid *= activeResponse
        treble *= activeResponse
        vocal *= activeResponse
        presence *= activeResponse
      }

      persistentBassAvg = lerp(persistentBassAvg, bass, clamp(0.04 * dt, 0, 1))
      const isBeat = !idle && easedEnvelope > 0.18 && bass > persistentBassAvg * 1.45 && bass > 0.22 && t - persistentLastBeatT > 10
      if (isBeat) {
        persistentLastBeatT = t
        for (let i = 0; i < RING_COUNT; i++) ringBeatEnv[i] = easedEnvelope
      }
      for (let i = 0; i < RING_COUNT; i++) ringBeatEnv[i] *= Math.pow(0.9, dt)

      persistentSmoothBass = lerp(persistentSmoothBass, bass, clamp((0.06 + 0.12 * activeResponse) * dt, 0, 1))
      persistentSmoothMid = lerp(persistentSmoothMid, mid, clamp((0.05 + 0.10 * activeResponse) * dt, 0, 1))
      persistentSmoothTreble = lerp(persistentSmoothTreble, treble, clamp((0.07 + 0.13 * activeResponse) * dt, 0, 1))
      persistentSmoothVocal = lerp(persistentSmoothVocal, vocal, clamp((0.07 + 0.15 * activeResponse) * dt, 0, 1))
      persistentSmoothPresence = lerp(persistentSmoothPresence, presence, clamp((0.06 + 0.10 * activeResponse) * dt, 0, 1))

      // Per-ring band sampling (log-spaced)
      for (let i = 0; i < RING_COUNT; i++) {
        const binStart = 2 + Math.floor(Math.pow(i / RING_COUNT, 1.5) * 180)
        const binEnd = 2 + Math.floor(Math.pow((i + 1) / RING_COUNT, 1.5) * 180)
        const voiceStart = 18 + Math.floor((i / RING_COUNT) * 78)
        const voiceEnd = 24 + Math.floor(((i + 1) / RING_COUNT) * 92)
        let s = 0
        const count = Math.max(1, binEnd - binStart)
        if (analyser) {
          for (let b = binStart; b < binEnd && b < freqData.length; b++) s += freqData[b]
        }
        let raw = analyser ? s / (count * 255) : 0
        s = 0
        const voiceCount = Math.max(1, voiceEnd - voiceStart)
        if (analyser) {
          for (let b = voiceStart; b < voiceEnd && b < freqData.length; b++) {
            const emphasis = b >= 34 && b <= 72 ? 1.25 : 0.85
            s += freqData[b] * emphasis
          }
        }
        let voiceRaw = analyser ? s / (voiceCount * 255) : 0
        if (idle) {
          raw = 0.02 + 0.015 * Math.sin(t * 0.012 + i * 0.7)
          voiceRaw = 0.018 + 0.012 * Math.sin(t * 0.014 + i * 0.9)
        } else {
          raw *= activeResponse
          voiceRaw *= activeResponse
        }
        const prev = ringBands[i]
        ringBands[i] = lerp(prev, raw, raw > prev ? 0.10 + 0.28 * activeResponse : 0.05 + 0.04 * activeResponse)
        const voicePrev = ringVoiceBands[i]
        ringVoiceBands[i] = lerp(voicePrev, voiceRaw, voiceRaw > voicePrev ? 0.12 + 0.36 * activeResponse : 0.06 + 0.05 * activeResponse)
      }

      // Lerp palette
      const target = targetPaletteRef.current
      const cur = currentPaletteRef.current
      for (let p = 0; p < 3; p++) {
        for (let c = 0; c < 3; c++) {
          cur[p][c] += (target[p][c] - cur[p][c]) * 0.025
        }
      }

      ctx.clearRect(0, 0, size, size)

      const cx = size / 2
      const cy = size / 2
      const R = size * 0.3

      ctx.save()
      ctx.translate(cx, cy)

      // Soft shadow glow
      const shadowCol = cur[1]
      ctx.shadowColor = `rgba(${shadowCol[0] | 0}, ${shadowCol[1] | 0}, ${shadowCol[2] | 0}, 0.7)`
      ctx.shadowBlur = 4 + persistentSmoothVocal * 7 + persistentSmoothPresence * 4

      const baseSpeed = idle ? 0.00008 : 0.00020

      for (let i = 0; i < RING_COUNT; i++) {
        const cfg = ringConfig[i]
        const band = ringBands[i]
        const voiceBand = ringVoiceBands[i]
        const boostedBand = Math.min(1, band * 1.2) * easedEnvelope
        const boostedVoice = Math.min(1, voiceBand * 1.55) * easedEnvelope
        const vocalBias = Math.min(1, boostedVoice * 0.72 + boostedBand * 0.28)
        const beatPulse = ringBeatEnv[i] * (1 - i / (RING_COUNT * 1.4))

        ringRotAccum[i] += cfg.dirSign * cfg.speedMul * (baseSpeed + vocalBias * 0.009)
        const wobbleFreq = cfg.breathFreq * (idle ? 1.0 : 1.5)
        const wobble = Math.sin(t * wobbleFreq + cfg.breathPhase)
        const swingBase = idle ? 0.025 : 0.05
        const swing = swingBase + boostedBand * 0.04 + boostedVoice * 0.12
        const aspect = Math.max(0.44, Math.min(0.98, 0.82 + wobble * swing * 0.52))

        const growSwingBase = idle ? 0.02 : 0.055
        const growSwing = growSwingBase + boostedBand * 0.06 + boostedVoice * 0.1 + beatPulse * 0.05
        const growWobble = Math.sin(t * wobbleFreq + cfg.breathPhase + 1.7)
        const grow = 1 + growSwing * (0.5 + 0.5 * growWobble)
        const jitter = (persistentSmoothPresence * 0.35 + persistentSmoothBass * 0.2 + persistentSmoothMid * 0.1) * Math.sin(t * 0.3 + cfg.breathPhase) * 0.008
        const scale = grow + jitter

        const axisSpeed = (0.004 + cfg.breathFreq * 0.5) * (idle ? 0.35 : 1.0)
        const axisAngle = cfg.breathPhase + t * axisSpeed * cfg.dirSign

        // Micro-wobble on rotation for organic feel (matches main visualizer)
        const rotJitter = Math.sin(t * 0.008 + cfg.breathPhase) * (idle ? 0.018 : 0.055)
        const rx = R * scale
        const ry = R * scale * aspect
        const finalRot = ringRotAccum[i] + axisAngle + rotJitter

        // Color from palette
        const hueT = i / (RING_COUNT - 1)
        let cr: number, cg: number, cb: number
        if (hueT < 0.5) {
          const u = hueT * 2
          cr = cur[0][0] + (cur[1][0] - cur[0][0]) * u
          cg = cur[0][1] + (cur[1][1] - cur[0][1]) * u
          cb = cur[0][2] + (cur[1][2] - cur[0][2]) * u
        } else {
          const u = (hueT - 0.5) * 2
          cr = cur[1][0] + (cur[2][0] - cur[1][0]) * u
          cg = cur[1][1] + (cur[2][1] - cur[1][1]) * u
          cb = cur[1][2] + (cur[2][2] - cur[1][2]) * u
        }
        const alpha = 0.8 + persistentSmoothVocal * 0.14 + ringBeatEnv[i] * 0.08 - i * 0.008
        ctx.strokeStyle = `rgba(${cr | 0}, ${cg | 0}, ${cb | 0}, ${Math.max(0.5, Math.min(1, alpha))})`
        ctx.lineWidth = 1 + boostedVoice * 0.55 + boostedBand * 0.18 + beatPulse * 0.3 + persistentSmoothTreble * 0.15

        ctx.save()
        ctx.rotate(finalRot)
        ctx.beginPath()
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
      ctx.restore()

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <motion.div
      initial={false}
      animate={{
        opacity: hidden ? 0 : 1,
        height: hidden && !reserveSpace ? 0 : size,
        marginBottom: (hidden && !reserveSpace) || inline ? 0 : 12,
      }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center justify-center overflow-hidden"
      style={{ pointerEvents: hidden ? 'none' : 'auto' }}
      title="Главная"
      aria-hidden={hidden}
    >
      <Link to="/" className="block relative" style={{ width: size, height: size }}>
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="block"
          style={{ width: size, height: size }}
        />
      </Link>
    </motion.div>
  )
}
