import { AlertCircle } from 'lucide-react'
import { useRef, useState, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

type ExplicitBadgeVariant = 'icon' | 'pill' | 'text'
type ExplicitBadgeSize = 'xs' | 'sm' | 'md'

interface ExplicitBadgeProps {
  is_explicit?: boolean | number | null
  variant?: ExplicitBadgeVariant
  size?: ExplicitBadgeSize
  className?: string
}

const TOOLTIP = 'AI-анализ обнаружил нецензурную лексику или контент 18+'
const TOOLTIP_OFFSET = 6

const ICON_SIZE: Record<ExplicitBadgeSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
}

const TEXT_SIZE: Record<ExplicitBadgeSize, string> = {
  xs: 'text-[9px] px-1 py-px',
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-[11px] px-2 py-0.5',
}

function TooltipPortal({ anchor }: { anchor: HTMLElement | null }) {
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null)

  useLayoutEffect(() => {
    if (!anchor) return
    const recalc = () => {
      const tip = tooltipRef.current
      if (!tip) return
      const rect = anchor.getBoundingClientRect()
      const tipRect = tip.getBoundingClientRect()
      const margin = 6
      const spaceAbove = rect.top
      const placeAbove = spaceAbove >= tipRect.height + TOOLTIP_OFFSET + margin
      const top = placeAbove
        ? rect.top - tipRect.height - TOOLTIP_OFFSET
        : rect.bottom + TOOLTIP_OFFSET
      let left = rect.left + rect.width / 2 - tipRect.width / 2
      left = Math.max(margin, Math.min(left, window.innerWidth - tipRect.width - margin))
      setPos({ top, left, placement: placeAbove ? 'top' : 'bottom' })
    }
    recalc()
    window.addEventListener('scroll', recalc, true)
    window.addEventListener('resize', recalc)
    return () => {
      window.removeEventListener('scroll', recalc, true)
      window.removeEventListener('resize', recalc)
    }
  }, [anchor])

  if (!anchor) return null

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        position: 'fixed',
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        zIndex: 9999,
        pointerEvents: 'none',
        visibility: pos ? 'visible' : 'hidden',
      }}
      className="whitespace-nowrap rounded-md border border-white/10 bg-black/95 px-2 py-1 text-[11px] font-medium text-white/90 shadow-xl"
    >
      {TOOLTIP}
      {pos && (
        <span
          className={`absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rotate-45 border-white/10 bg-black/95 ${
            pos.placement === 'top'
              ? 'bottom-0 translate-y-1/2 border-b border-r'
              : 'top-0 -translate-y-1/2 border-t border-l'
          }`}
        />
      )}
    </div>,
    document.body
  )
}

export function ExplicitBadge({
  is_explicit,
  variant = 'icon',
  size = 'sm',
  className = '',
}: ExplicitBadgeProps) {
  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const [hovered, setHovered] = useState(false)

  if (!is_explicit) return null

  if (variant === 'pill') {
    return (
      <>
        <span
          ref={anchorRef}
          className={`group/explicit relative inline-flex flex-shrink-0 items-center rounded-full border border-white/[0.12] bg-white/[0.06] text-white/60 ${TEXT_SIZE[size]} ${className}`}
          aria-label={TOOLTIP}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
        >
          <AlertCircle className={ICON_SIZE[size]} strokeWidth={1.75} />
        </span>
        {hovered && <TooltipPortal anchor={anchorRef.current} />}
      </>
    )
  }

  if (variant === 'text') {
    return (
      <>
        <span
          ref={anchorRef}
          className={`group/explicit relative inline-flex flex-shrink-0 items-center rounded-full border border-white/10 bg-white/[0.06] font-medium text-white/65 ${TEXT_SIZE[size]} ${className}`}
          aria-label={TOOLTIP}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
        >
          Explicit
        </span>
        {hovered && <TooltipPortal anchor={anchorRef.current} />}
      </>
    )
  }

  return (
    <>
      <span
        ref={anchorRef}
        className={`group/explicit relative inline-flex flex-shrink-0 items-center ${className}`}
        aria-label={TOOLTIP}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <AlertCircle
          className={`${ICON_SIZE[size]} text-white/55 transition-colors group-hover/explicit:text-white/80`}
          strokeWidth={1.75}
        />
      </span>
      {hovered && <TooltipPortal anchor={anchorRef.current} />}
    </>
  )
}

export default ExplicitBadge
