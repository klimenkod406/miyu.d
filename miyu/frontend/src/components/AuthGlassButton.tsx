import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface AuthGlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  /** flashes: colored light orbs (default). glow: white soft glow at the bottom edge on hover (for icon-only buttons). */
  variant?: 'flashes' | 'glow'
}

export default function AuthGlassButton({
  children,
  className = '',
  variant = 'flashes',
  ...rest
}: AuthGlassButtonProps) {
  return (
    <button className={`btn-glass btn-glass--${variant} ${className}`} {...rest}>
      {variant === 'flashes' && (
        <span className="btn-flashes">
          <span className="btn-flash btn-flash-1" />
          <span className="btn-flash btn-flash-2" />
          <span className="btn-flash btn-flash-3" />
        </span>
      )}
      {variant === 'glow' && <span className="btn-glow" />}
      <span className="btn-glass-content">{children}</span>
    </button>
  )
}
