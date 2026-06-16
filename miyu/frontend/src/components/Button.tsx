import { motion, HTMLMotionProps } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ReactNode } from 'react'

type ButtonVariant = 'primary' | 'glass' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface BaseProps {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  className?: string
}

interface ButtonAsButton extends BaseProps, Omit<HTMLMotionProps<'button'>, 'children'> {
  as?: 'button'
}

interface ButtonAsLink extends BaseProps, Omit<HTMLMotionProps<'a'>, 'children'> {
  as: 'link'
  to: string
}

type ButtonProps = ButtonAsButton | ButtonAsLink

/** Visual style variants. */
const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
  glass: 'glass-hover text-white',
  ghost: 'hover:bg-white/5 text-white/80',
  danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
}

/** Size presets controlling padding and font-size. */
const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5',
  lg: 'px-6 py-3 text-lg',
}

const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors'
const disabledClasses = 'opacity-50 cursor-not-allowed pointer-events-none'

/** Motion animation props shared between button and link variants. */
const motionAnimations = {
  hover: { scale: 1.02 },
  tap: { scale: 0.97 },
  transition: { duration: 0.2 },
}

/**
 * Animated button component with multiple visual variants and sizes.
 * Supports rendering as a standard button or a react-router Link.
 *
 * @example
 * <Button variant="primary" size="md">Click me</Button>
 * <Button as="link" to="/home" variant="glass">Go Home</Button>
 */
export default function Button(props: ButtonProps) {
  const {
    children,
    variant = 'glass',
    size = 'md',
    disabled = false,
    className = '',
    as = 'button',
    ...rest
  } = props

  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    disabled ? disabledClasses : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const animations = disabled
    ? { whileHover: undefined, whileTap: undefined }
    : { whileHover: motionAnimations.hover, whileTap: motionAnimations.tap }

  if (as === 'link') {
    const { to, ...linkRest } = rest as Omit<HTMLMotionProps<'a'>, 'children'> & { to: string }
    const MotionLink = motion.create(Link)
    return (
      <MotionLink
        to={to}
        className={classes}
        transition={motionAnimations.transition}
        {...animations}
        {...linkRest}
      >
        {children}
      </MotionLink>
    )
  }

  return (
    <motion.button
      className={classes}
      transition={motionAnimations.transition}
      disabled={disabled}
      {...animations}
      {...rest}
    >
      {children}
    </motion.button>
  )
}
