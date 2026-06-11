import { useState, useEffect } from 'react'
import { Award, X, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Achievement {
  id: number
  code: string
  title: string
  description: string
  icon: string
  rarity: string
}

interface AchievementToastProps {
  achievement: Achievement
  onClose: () => void
}

const rarityColors: Record<string, { bg: string; text: string; border: string; shadow: string }> = {
  common: { bg: 'bg-gray-500/90', text: 'text-white', border: 'border-gray-400', shadow: 'shadow-gray-400/50' },
  rare: { bg: 'bg-blue-500/90', text: 'text-white', border: 'border-blue-400', shadow: 'shadow-blue-400/50' },
  epic: { bg: 'bg-purple-500/90', text: 'text-white', border: 'border-purple-400', shadow: 'shadow-purple-400/50' },
  legendary: { bg: 'bg-gradient-to-r from-yellow-500/90 to-orange-500/90', text: 'text-white', border: 'border-yellow-400', shadow: 'shadow-yellow-400/60' }
}

export default function AchievementToast({ achievement, onClose }: AchievementToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const colors = rarityColors[achievement.rarity] || rarityColors.common

  useEffect(() => {
    setIsVisible(true)
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300)
    }, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100]">
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          >
            <motion.div
              animate={{
                boxShadow: [
                  `0 0 20px ${colors.shadow}`,
                  `0 0 40px ${colors.shadow}`,
                  `0 0 20px ${colors.shadow}`
                ]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className={`backdrop-blur-xl ${colors.bg} border-2 ${colors.border} rounded-full px-5 py-3 flex items-center gap-3 relative overflow-hidden`}
            >
            {achievement.rarity === 'legendary' && (
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              />
            )}

            <motion.div
              initial={{ rotate: -180, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', damping: 15 }}
              className="relative"
            >
              <Award className={`w-6 h-6 ${colors.text}`} />
              {achievement.rarity === 'legendary' && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="absolute -top-1 -right-1"
                >
                  <Sparkles className="w-3 h-3 text-yellow-300" />
                </motion.div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-2"
            >
              <span className={`${colors.text} text-sm font-semibold whitespace-nowrap`}>
                {achievement.title}
              </span>
              <span className={`${colors.text} opacity-60 text-xs font-medium capitalize`}>
                • {achievement.rarity}
              </span>
            </motion.div>

            <button
              onClick={() => {
                setIsVisible(false)
                setTimeout(onClose, 300)
              }}
              className={`${colors.text} opacity-70 hover:opacity-100 transition`}
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
