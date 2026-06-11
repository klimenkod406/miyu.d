import { motion, HTMLMotionProps } from 'framer-motion'
import { ReactNode } from 'react'

interface Props extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode
  variant?: 'icon' | 'default' | 'card'
}

const variantClasses = {
  icon: 'w-10 h-10 rounded-xl',
  default: 'px-5 py-2.5 rounded-xl',
  card: 'p-5 rounded-2xl',
}

export default function GlassButton({ children, variant = 'default', className = '', ...props }: Props) {
  return (
    <motion.button
      className={`glass-hover text-white ${variantClasses[variant]} ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.92 }}
      transition={{ duration: 0.15 }}
      {...props}
    >
      <span className="relative z-10">{children}</span>
    </motion.button>
  )
}