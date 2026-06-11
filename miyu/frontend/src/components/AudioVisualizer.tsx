import { useEffect, useRef } from 'react'
import { Play, Pause } from 'lucide-react'
import { usePlayer } from '../hooks/PlayerContext'
import { subscribeAnalyser } from '../lib/audioAnalyser'
import { IDLE_PALETTE, paletteForGenre, type Palette, type RGB } from '../lib/visualizerPalettes'
import { setMainVisualizerVisible } from '../lib/visualizerVisibility'

const RING_COUNT = 18
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export default function AudioVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const isPlayingRef = useRef<boolean>(false)
  // Color animation: current shown palette + target palette (lerped each frame)
  const currentPaletteRef = useRef<Palette>([
    [...IDLE_PALETTE[0]] as RGB,
    [...IDLE_PALETTE[1]] as RGB,
    [...IDLE_PALETTE[2]] as RGB,
  ])
  const targetPaletteRef = useRef<Palette>(IDLE_PALETTE)

  const { isPlaying, currentTrack, isWaveActive, startWave, togglePlay } = usePlayer()

  const handleWaveClick = () => {
    if (isWaveActive && currentTrack) {
      togglePlay()
      return
    }

    startWave().catch((error) => console.error('Failed to start Miyu wave:', error))
  }

  // Keep ref in sync with state — read inside RAF loop without re-creating it
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  // Update target palette when track or play state changes
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

  // Track main visualizer visibility (in viewport + mounted) so the mini one can show otherwise
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        setMainVisualizerVisible(entry.isIntersecting && entry.intersectionRatio > 0.15)
      },
      { threshold: [0, 0.15, 0.5, 1] }
    )
    obs.observe(el)
    return () => {
      obs.disconnect()
      setMainVisualizerVisible(false)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let dpr = window.devicePixelRatio || 1
    let width = 0
    let height = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const freqData = new Uint8Array(256)
    let t = 0
    let smoothBass = 0
    let smoothMid = 0
    let smoothTreble = 0
    let smoothVocal = 0
    let smoothPresence = 0
    let activityEnvelope = 0
    // Per-ring smoothed band amplitudes — each ring tracks its own frequency slice
    const ringBands = new Float32Array(RING_COUNT)
    const ringVoiceBands = new Float32Array(RING_COUNT)
    // Per-ring integrated rotation — each ring spins at its own SPEED
    const ringRotAccum = new Float32Array(RING_COUNT)
    // Per-ring beat-pulse envelope (0..1, decays after each beat)
    const ringBeatEnv = new Float32Array(RING_COUNT)
    // Beat detection state
    let bassAvg = 0
    let lastBeatT = 0
    const beatIntervals: number[] = []
    let smoothInterval = 50 // frames per beat (~120 BPM at 60fps)
    // Per-ring randomized config for asynchronous motion
    const ringConfig = Array.from({ length: RING_COUNT }, (_, i) => ({
      phaseOffset: Math.random() * Math.PI * 2,
      breathFreq: 0.008 + Math.random() * 0.025,
      breathPhase: Math.random() * Math.PI * 2,
      dirSign: Math.random() < 0.5 ? -1 : 1,
      speedMul: 0.5 + Math.random() * 1.4,
      jitterPhase: Math.random() * Math.PI * 2,
      stretchAxis: Math.random() < 0.5, // true = stretch X, false = stretch Y
      // Each ring's own initial rotation so they start asynchronously
      initialAngle: (i / RING_COUNT) * Math.PI + Math.random() * 0.4,
    }))
    // Pre-seed accumulator with initial angles for instant variety
    for (let i = 0; i < RING_COUNT; i++) ringRotAccum[i] = ringConfig[i].initialAngle

    const tick = () => {
      t += 1

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
      activityEnvelope = lerp(
        activityEnvelope,
        envelopeTarget,
        envelopeTarget > activityEnvelope ? 0.045 : 0.026,
      )
      const easedEnvelope = activityEnvelope * activityEnvelope * (3 - 2 * activityEnvelope)
      const activeResponse = clamp(easedEnvelope, 0, 1)

      if (idle) {
        // Very gentle idle — small values for minimal deformation
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

      // ---- Beat detection on bass ----
      // Moving average of bass; beat when current bass spikes well above it
      bassAvg = bassAvg * 0.96 + bass * 0.04
      const canBeat = !idle && easedEnvelope > 0.18
      const isBeat =
        canBeat &&
        bass > bassAvg * 1.45 &&
        bass > 0.22 &&
        t - lastBeatT > 10 // min 10 frames between beats (~360 BPM ceiling)
      if (isBeat) {
        if (lastBeatT > 0) {
          const interval = t - lastBeatT
          // Only accept reasonable intervals (≥40 BPM, ≤200 BPM at 60fps)
          if (interval > 18 && interval < 90) {
            beatIntervals.push(interval)
            if (beatIntervals.length > 6) beatIntervals.shift()
            const avg = beatIntervals.reduce((a, b) => a + b, 0) / beatIntervals.length
            smoothInterval = smoothInterval * 0.6 + avg * 0.4
          }
        }
        lastBeatT = t
        // Trigger beat envelope on every ring, limited by activity envelope
        for (let i = 0; i < RING_COUNT; i++) ringBeatEnv[i] = easedEnvelope
      }
      // Decay beat envelope per frame (exponential)
      for (let i = 0; i < RING_COUNT; i++) ringBeatEnv[i] *= 0.90

      // Smooth values for less jittery motion, with gentler attack/release while activity ramps
      smoothBass = lerp(smoothBass, bass, 0.06 + 0.12 * activeResponse)
      smoothMid = lerp(smoothMid, mid, 0.05 + 0.10 * activeResponse)
      smoothTreble = lerp(smoothTreble, treble, 0.07 + 0.13 * activeResponse)
      smoothVocal = lerp(smoothVocal, vocal, 0.07 + 0.15 * activeResponse)
      smoothPresence = lerp(smoothPresence, presence, 0.06 + 0.10 * activeResponse)

      // Lerp current palette toward target — smooth color transition
      const target = targetPaletteRef.current
      const cur = currentPaletteRef.current
      const colorLerp = 0.025 // ~1.5s transition
      for (let p = 0; p < 3; p++) {
        for (let c = 0; c < 3; c++) {
          cur[p][c] += (target[p][c] - cur[p][c]) * colorLerp
        }
      }

      // True transparent clear — no background
      ctx.clearRect(0, 0, width, height)

      const cx = width / 2
      const cy = height / 2
      const isCompactViewport = width <= 414
      // Base radius — on compact screens make rings a bit larger while keeping enough headroom for glow
      const R = Math.min(width, height) * (isCompactViewport ? 0.35 : 0.30)

      // Per-ring band sampling: each ring owns a slice of the FFT spectrum.
      // Map ring i (0..N-1) to log-spaced frequency band [binStart..binEnd).
      const binMaxIdx = 200 // skip ultra-high noisy bins
      for (let i = 0; i < RING_COUNT; i++) {
        const binStart = 2 + Math.floor(Math.pow(i / RING_COUNT, 1.5) * binMaxIdx)
        const binEnd = 2 + Math.floor(Math.pow((i + 1) / RING_COUNT, 1.5) * binMaxIdx)
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
          // Tiny idle wobble — barely visible
          raw = 0.015 + 0.012 * Math.sin(t * 0.012 + i * 0.7)
          voiceRaw = 0.015 + 0.01 * Math.sin(t * 0.014 + i * 0.9)
        } else {
          raw *= activeResponse
          voiceRaw *= activeResponse
        }
        // Asymmetric smoothing — fast attack, slow release per ring
        const prev = ringBands[i]
        ringBands[i] = lerp(prev, raw, raw > prev ? 0.12 + 0.33 * activeResponse : 0.05 + 0.05 * activeResponse)
        const voicePrev = ringVoiceBands[i]
        ringVoiceBands[i] = lerp(voicePrev, voiceRaw, voiceRaw > voicePrev ? 0.14 + 0.41 * activeResponse : 0.06 + 0.06 * activeResponse)
      }

      ctx.save()
      ctx.translate(cx, cy)

      // Outer glow on lines via shadow — uses middle palette color
      const shadowCol = cur[1]
      ctx.shadowColor = `rgba(${shadowCol[0] | 0}, ${shadowCol[1] | 0}, ${shadowCol[2] | 0}, 0.85)`
      ctx.shadowBlur = 10 + smoothVocal * 20 + smoothPresence * 12

      // Idle: extra slow rotation. Music: adds tempo-driven boost (very calm)
      const baseSpeed = idle ? 0.00012 : 0.00035
      // Tempo speed: faster BPM → faster rotation, but very gentle
      const tempoSpeed = idle ? 0 : (60 / Math.max(20, smoothInterval)) * 0.0035 * easedEnvelope

      for (let i = 0; i < RING_COUNT; i++) {
        const cfg = ringConfig[i]
        const band = ringBands[i]
        const voiceBand = ringVoiceBands[i]
        const beat = ringBeatEnv[i] * easedEnvelope // 0..1 spike on each beat, decays
        const boostedBand = Math.min(1, band * 1.25) * easedEnvelope
        const boostedVoice = Math.min(1, voiceBand * 1.55) * easedEnvelope
        const vocalBias = clamp(boostedVoice * 0.72 + boostedBand * 0.28, 0, 1)

        // Per-ring rotation speed favors vocal motion over bass-driven expansion.
        ringRotAccum[i] +=
          cfg.dirSign * cfg.speedMul * (baseSpeed + tempoSpeed + vocalBias * 0.009)
        const ringRot = ringRotAccum[i] + Math.sin(t * 0.008 + cfg.jitterPhase) * (idle ? 0.018 : 0.055)

        // ---- DYNAMIC DEFORMATION ----
        // Each ring's shape continuously oscillates; band/beat control SWING AMPLITUDE.
        const wobbleFreq = cfg.breathFreq * (idle ? 1.0 : 2.0)
        const wobble = Math.sin(t * wobbleFreq + cfg.breathPhase)
        // Idle: very small swing baseline. Music: bigger.
        const swingBase = idle ? 0.04 : 0.092
        const swing = swingBase + boostedBand * 0.08 + boostedVoice * 0.24 + beat * 0.1
        const aspect = Math.max(
          0.44,
          Math.min(0.98, 0.82 + wobble * swing * 0.52)
        )

        // Major-axis breathes (calm in idle)
        const growWobble = Math.sin(t * wobbleFreq + cfg.breathPhase + 1.7)
        const growSwingBase = idle ? 0.035 : 0.092
        const growSwing = growSwingBase + boostedBand * 0.1 + boostedVoice * 0.16 + beat * 0.14
        const grow = 1 + growSwing * (0.5 + 0.5 * growWobble)
        const jitter = (smoothTreble * 0.45 + smoothPresence * 0.55) * Math.sin(t * 0.3 + cfg.jitterPhase) * 0.022
        const scale = grow + jitter

        // Stretch axis ROTATES over time — slower in idle
        const axisSpeed = (0.004 + cfg.breathFreq * 0.5) * (idle ? 0.35 : 1.0)
        const axisAngle = cfg.breathPhase + t * axisSpeed * cfg.dirSign
        const baseRadius = R * scale
        const rx = baseRadius
        const ry = baseRadius * aspect
        const finalRot = ringRot + axisAngle
        const radialDrift = !idle
          ? Math.sin(t * (0.018 + cfg.speedMul * 0.008) + cfg.phaseOffset) * (6 + boostedVoice * 18)
          : Math.sin(t * 0.012 + cfg.phaseOffset) * 4
        const centerShiftX = Math.cos(cfg.phaseOffset + t * 0.01) * vocalBias * 16
        const centerShiftY = Math.sin(cfg.breathPhase + t * 0.012) * vocalBias * 10
        const strokePulse = 0.55 + boostedVoice * 0.65 + beat * 0.18

        // Color: interpolate across the 3-stop palette by ring index
        const hueT = i / (RING_COUNT - 1) // 0..1
        let cr: number, cg: number, cb: number
        if (hueT < 0.5) {
          const u = hueT * 2 // 0..1 between cur[0] and cur[1]
          cr = cur[0][0] + (cur[1][0] - cur[0][0]) * u
          cg = cur[0][1] + (cur[1][1] - cur[0][1]) * u
          cb = cur[0][2] + (cur[1][2] - cur[0][2]) * u
        } else {
          const u = (hueT - 0.5) * 2 // 0..1 between cur[1] and cur[2]
          cr = cur[1][0] + (cur[2][0] - cur[1][0]) * u
          cg = cur[1][1] + (cur[2][1] - cur[1][1]) * u
          cb = cur[1][2] + (cur[2][2] - cur[1][2]) * u
        }
        const r = cr | 0
        const g = cg | 0
        const b = cb | 0

        ctx.save()
        ctx.rotate(finalRot)

        const vocalPulseA = Math.sin(t * 0.028 + cfg.phaseOffset)
        const vocalPulseB = Math.cos(t * 0.024 + cfg.breathPhase)
        const vocalPulseC = Math.sin(t * 0.032 + cfg.jitterPhase)
        const vocalPulseD = Math.cos(t * 0.026 + cfg.phaseOffset + cfg.breathPhase)

        const topRadius = ry * (1 + boostedVoice * 0.32 + beat * 0.08 + vocalPulseA * (idle ? 0.04 : 0.12))
        const rightRadius = rx * (1 + boostedBand * 0.1 + boostedVoice * 0.12 + vocalPulseB * (idle ? 0.03 : 0.1))
        const bottomRadius = ry * (1 - boostedVoice * 0.08 + boostedBand * 0.14 + vocalPulseC * (idle ? 0.03 : 0.09))
        const leftRadius = rx * (1 + boostedVoice * 0.24 + beat * 0.04 + vocalPulseD * (idle ? 0.035 : 0.11))

        const top = {
          x: centerShiftX * 0.45 + Math.sin(t * 0.021 + cfg.phaseOffset) * vocalBias * 12,
          y: centerShiftY - topRadius - radialDrift * 0.28,
        }
        const right = {
          x: centerShiftX + rightRadius + radialDrift,
          y: centerShiftY * 0.4 + Math.cos(t * 0.018 + cfg.jitterPhase) * boostedVoice * 10,
        }
        const bottom = {
          x: centerShiftX * 0.35 + Math.sin(t * 0.019 + cfg.breathPhase) * boostedBand * 10,
          y: centerShiftY + bottomRadius + radialDrift * 0.2,
        }
        const left = {
          x: centerShiftX - leftRadius - radialDrift * 0.86,
          y: centerShiftY * 0.55 + Math.cos(t * 0.02 + cfg.phaseOffset) * vocalBias * 14,
        }

        const topHandle = clamp(baseRadius * (0.52 + boostedVoice * 0.24 + beat * 0.08), baseRadius * 0.35, baseRadius * 0.92)
        const sideHandle = clamp(baseRadius * (0.5 + boostedBand * 0.14 + boostedVoice * 0.18), baseRadius * 0.35, baseRadius * 0.95)
        const asymX = vocalBias * 22
        const asymY = boostedVoice * 18

        const traceRingPath = () => {
          ctx.beginPath()
          ctx.moveTo(top.x, top.y)
          ctx.bezierCurveTo(
            top.x + topHandle + asymX * 0.15,
            top.y - asymY * 0.35,
            right.x + asymX * 0.3,
            right.y - sideHandle * (0.8 + boostedVoice * 0.18),
            right.x,
            right.y,
          )
          ctx.bezierCurveTo(
            right.x + asymX * 0.28,
            right.y + sideHandle * (0.55 + boostedBand * 0.2),
            bottom.x + topHandle * 0.35,
            bottom.y + asymY * 0.45,
            bottom.x,
            bottom.y,
          )
          ctx.bezierCurveTo(
            bottom.x - topHandle * (0.9 + boostedVoice * 0.15),
            bottom.y + asymY * 0.18,
            left.x - asymX * 0.36,
            left.y + sideHandle * (0.7 + beat * 0.22),
            left.x,
            left.y,
          )
          ctx.bezierCurveTo(
            left.x - asymX * 0.1,
            left.y - sideHandle * (0.86 + boostedVoice * 0.2),
            top.x - topHandle * (0.78 + boostedVoice * 0.26),
            top.y - asymY * 0.08,
            top.x,
            top.y,
          )
          ctx.closePath()
        }

        const alpha = 0.8 + smoothVocal * 0.14 + beat * 0.08 - i * 0.008
        const glowAlpha = Math.max(0.08, 0.12 + boostedVoice * 0.18 + smoothPresence * 0.1 - i * 0.004)
        const glowWidth = 5 + strokePulse * 4.2 + boostedVoice * 3.5
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${glowAlpha})`
        ctx.lineWidth = glowWidth
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${0.95})`
        ctx.shadowBlur = 18 + boostedVoice * 18 + smoothPresence * 10
        traceRingPath()
        ctx.stroke()

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${Math.max(0.48, Math.min(1, alpha))})`
        ctx.lineWidth = 1.6 + strokePulse * 1.5
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${0.45 + boostedVoice * 0.25})`
        ctx.shadowBlur = 8 + boostedVoice * 8
        traceRingPath()
        ctx.stroke()

        ctx.restore()
      }

      ctx.restore()

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
    // Run animation loop ONCE — never restart on play/pause to avoid resetting all per-ring state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative w-full h-[760px] mt-[-110px] mb-[-80px] max-[414px]:h-[700px] max-[414px]:mt-[-104px] max-[414px]:mb-[-68px]"
    >
      {/* Transparent canvas — no background, no border, no card */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ display: 'block' }}
      />

      {/* Center liquid-glass wave launch button */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <button
          onClick={handleWaveClick}
          aria-label={isWaveActive && isPlaying ? 'Волна Miyu играет' : 'Запустить Волну Miyu'}
          className="group relative pointer-events-auto flex h-14 items-center overflow-hidden rounded-full border border-white/18 bg-white/[0.085] py-0 pl-2 pr-2 text-white shadow-[0_12px_38px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.26),inset_0_-18px_34px_rgba(255,255,255,0.055)] backdrop-blur-2xl transition-[padding,background-color,border-color,box-shadow,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.018] hover:border-white/28 hover:bg-white/[0.13] hover:pl-3 hover:pr-5 hover:shadow-[0_18px_48px_rgba(0,0,0,0.38),0_0_36px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.34),inset_0_-22px_42px_rgba(255,255,255,0.075)] md:h-16 max-[414px]:pl-3 max-[414px]:pr-5"
        >
          <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_22%,rgba(255,255,255,0.42),transparent_24%),radial-gradient(circle_at_74%_78%,rgba(125,211,252,0.18),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.035)_42%,rgba(255,255,255,0.13))] opacity-80 transition-opacity duration-700 group-hover:opacity-100" />
          <span className="pointer-events-none absolute -inset-x-8 top-0 h-full rounded-full bg-[linear-gradient(115deg,transparent_15%,rgba(255,255,255,0.26)_42%,transparent_68%)] opacity-0 blur-sm transition-[transform,opacity] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-7 group-hover:opacity-80" />
          <span className="pointer-events-none absolute inset-[3px] rounded-full border border-white/10 bg-black/[0.035]" />

          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.10] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] md:h-12 md:w-12">
            {isWaveActive && isPlaying ? (
              <Pause className="h-5 w-5 fill-current drop-shadow-lg md:h-6 md:w-6" />
            ) : (
              <Play className="ml-0.5 h-5 w-5 fill-current drop-shadow-lg md:h-6 md:w-6" />
            )}
          </span>
          <span className="relative ml-0 max-w-0 whitespace-nowrap text-base font-medium opacity-0 drop-shadow-lg transition-[max-width,opacity,margin,color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:ml-2 group-hover:max-w-[16rem] group-hover:opacity-100 md:text-lg max-[414px]:ml-2 max-[414px]:max-w-[16rem] max-[414px]:opacity-100">
            {isWaveActive && isPlaying ? 'Волна Miyu играет' : 'Волна Miyu'}
          </span>
        </button>
      </div>
    </section>
  )
}
