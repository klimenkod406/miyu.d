import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface ServiceLogoProps {
  compact?: boolean
  animationIntervalMs?: number
}

export default function ServiceLogo({ compact = false, animationIntervalMs = 40000 }: ServiceLogoProps) {
  const iconSize = compact ? 36 : 42
  const loops = 9
  const [isRevealing, setIsRevealing] = useState(false)
  const animationDurationMs = 4800

  useEffect(() => {
    let resetTimeout: number | undefined
    let nextCycleTimeout: number | undefined

    const triggerReveal = () => {
      setIsRevealing(true)
      resetTimeout = window.setTimeout(() => {
        setIsRevealing(false)
        nextCycleTimeout = window.setTimeout(triggerReveal, animationIntervalMs)
      }, animationDurationMs)
    }

    nextCycleTimeout = window.setTimeout(triggerReveal, animationIntervalMs)

    return () => {
      if (nextCycleTimeout) window.clearTimeout(nextCycleTimeout)
      if (resetTimeout) window.clearTimeout(resetTimeout)
    }
  }, [animationDurationMs, animationIntervalMs])

  return (
    <>
      <style>{`
        @property --miyu-hole-size {
          syntax: '<percentage>';
          inherits: false;
          initial-value: 0%;
        }

        @keyframes miyu-logo-center-reveal {
          0% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
            filter: brightness(1);
            --miyu-hole-size: 0%;
          }
          32% {
            opacity: 1;
            transform: scale(0.98) rotate(120deg);
            filter: brightness(1.15);
            --miyu-hole-size: 132%;
          }
          54% {
            opacity: 1;
            transform: scale(0.94) rotate(220deg);
            filter: brightness(1.22);
            --miyu-hole-size: 132%;
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(360deg);
            filter: brightness(1);
            --miyu-hole-size: 0%;
          }
        }

        @keyframes miyu-logo-glow-reveal {
          0% {
            opacity: 0.18;
            transform: scale(0.82) rotate(0deg);
            filter: blur(12px);
          }
          28% {
            opacity: 0.58;
            transform: scale(1.08) rotate(90deg);
            filter: blur(14px);
          }
          58% {
            opacity: 0.42;
            transform: scale(1.18) rotate(180deg);
            filter: blur(18px);
          }
          100% {
            opacity: 0;
            transform: scale(1.34) rotate(360deg);
            filter: blur(22px);
          }
        }

        .miyu-logo-reveal {
          animation: miyu-logo-center-reveal 4.8s cubic-bezier(0.22, 1, 0.36, 1);
          transform-origin: center;
          -webkit-mask-image: radial-gradient(circle at 50% 50%, transparent 0 var(--miyu-hole-size), #000 calc(var(--miyu-hole-size) + 1%), #000 100%);
          mask-image: radial-gradient(circle at 50% 50%, transparent 0 var(--miyu-hole-size), #000 calc(var(--miyu-hole-size) + 1%), #000 100%);
          will-change: opacity, transform, filter, mask-image, -webkit-mask-image;
        }

        .miyu-logo-glow-reveal {
          animation: miyu-logo-glow-reveal 4.8s cubic-bezier(0.22, 1, 0.36, 1);
          transform-origin: center;
          will-change: opacity, transform, filter;
        }
      `}</style>

      <Link
        to="/"
        className="group inline-flex items-center gap-3 px-1 py-1 transition duration-300"
        aria-label="MiYu — на главную"
      >
        <span
          className="relative flex items-center justify-center rounded-xl overflow-visible"
          style={{ width: iconSize, height: iconSize }}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute z-0 inset-[-8px] rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.42)_0%,rgba(168,85,247,0.32)_38%,rgba(56,189,248,0.18)_62%,transparent_78%)] opacity-0 ${isRevealing ? 'miyu-logo-glow-reveal' : ''}`}
          />
          <span className={`relative z-10 inline-flex ${isRevealing ? 'miyu-logo-reveal' : ''}`}>
            <svg
              width={iconSize}
              height={iconSize}
              viewBox="-6 -6 76 76"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="overflow-visible drop-shadow-[0_0_18px_rgba(168,85,247,0.32)]"
            >
            <defs>
              <radialGradient id="miyu-logo-center-fade" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32 32) rotate(90) scale(24)">
                <stop offset="0" stopColor="white" stopOpacity="0" />
                <stop offset="0.42" stopColor="white" stopOpacity="0" />
                <stop offset="0.68" stopColor="white" stopOpacity="0.45" />
                <stop offset="0.86" stopColor="white" stopOpacity="0.88" />
                <stop offset="1" stopColor="white" stopOpacity="1" />
              </radialGradient>
              <mask id="miyu-logo-center-mask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="-24" y="-24" width="112" height="112">
                <rect x="-24" y="-24" width="112" height="112" fill="url(#miyu-logo-center-fade)" />
              </mask>
              <linearGradient id="miyu-logo-ring-1" x1="14" y1="10" x2="50" y2="54" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.98" />
                <stop offset="0.18" stopColor="#F5D0FE" stopOpacity="0.96" />
                <stop offset="0.52" stopColor="#D946EF" stopOpacity="0.9" />
                <stop offset="0.78" stopColor="#8B5CF6" stopOpacity="0.88" />
                <stop offset="1" stopColor="#38BDF8" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="miyu-logo-ring-2" x1="18" y1="8" x2="46" y2="56" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.99" />
                <stop offset="0.16" stopColor="#FBCFE8" stopOpacity="0.95" />
                <stop offset="0.44" stopColor="#EC4899" stopOpacity="0.92" />
                <stop offset="0.72" stopColor="#A855F7" stopOpacity="0.9" />
                <stop offset="1" stopColor="#60A5FA" stopOpacity="0.92" />
              </linearGradient>
              <linearGradient id="miyu-logo-ring-3" x1="10" y1="18" x2="54" y2="46" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.96" />
                <stop offset="0.2" stopColor="#DDD6FE" stopOpacity="0.93" />
                <stop offset="0.5" stopColor="#8B5CF6" stopOpacity="0.9" />
                <stop offset="0.8" stopColor="#6366F1" stopOpacity="0.9" />
                <stop offset="1" stopColor="#38BDF8" stopOpacity="0.94" />
              </linearGradient>
            </defs>

            <circle cx="32" cy="32" r="23.5" stroke="url(#miyu-logo-ring-2)" strokeOpacity="0.16" />

            {Array.from({ length: loops }).map((_, index) => (
              <g key={index} transform={`rotate(${index * (360 / loops)} 32 32)`} mask="url(#miyu-logo-center-mask)">
                <ellipse
                  cx="32"
                  cy="17"
                  rx="9.6"
                  ry="19.5"
                  stroke={index % 3 === 0 ? 'url(#miyu-logo-ring-1)' : index % 3 === 1 ? 'url(#miyu-logo-ring-2)' : 'url(#miyu-logo-ring-3)'}
                  strokeWidth="2.9"
                  strokeLinecap="round"
                  opacity="0.98"
                />
              </g>
            ))}

              <circle cx="32" cy="32" r="15.75" fill="#050505" fillOpacity="1" />
              <circle cx="32" cy="32" r="15.75" stroke="rgba(255,255,255,0.04)" />
            </svg>
          </span>
        </span>

        <span className="flex flex-col leading-none">
          <span className="text-lg font-black tracking-[0.18em] text-white">
            MIYU
          </span>
        </span>
      </Link>
    </>
  )
}
