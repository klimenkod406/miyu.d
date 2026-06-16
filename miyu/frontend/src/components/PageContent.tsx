import { ReactNode } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

interface PageContentProps {
  children?: ReactNode
}

export default function PageContent({ children }: PageContentProps) {
  const location = useLocation()
  const outlet = useOutlet()
  const content = children ?? outlet

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className=""
      >
        {content}
      </motion.div>
    </AnimatePresence>
  )
}
