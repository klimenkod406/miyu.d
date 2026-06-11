import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Gift, X } from 'lucide-react'

interface PaymentSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  isGift?: boolean
}

export default function PaymentSuccessModal({ isOpen, onClose, isGift = false }: PaymentSuccessModalProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShow(true)
      // Auto close after 5 seconds
      const timer = setTimeout(() => {
        handleClose()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleClose = () => {
    setShow(false)
    setTimeout(() => {
      onClose()
    }, 300)
  }

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="relative bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] rounded-3xl p-8 max-w-md w-full mx-4 border border-white/10 shadow-2xl pointer-events-auto"
            >
              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Success icon with animation */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="flex justify-center mb-6"
              >
                <div className="relative">
                  {/* Pulsing background */}
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.2, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full blur-xl"
                  />

                  {/* Icon */}
                  <div className="relative bg-gradient-to-r from-green-500 to-emerald-500 rounded-full p-4">
                    {isGift ? (
                      <Gift className="w-12 h-12 text-white" />
                    ) : (
                      <CheckCircle className="w-12 h-12 text-white" />
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Text content */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center"
              >
                <h2 className="text-2xl font-bold mb-2">
                  {isGift ? 'Подарок отправлен!' : 'Оплата успешна!'}
                </h2>
                <p className="text-white/60 mb-6">
                  {isGift
                    ? 'Получатель получит подарочную подписку на указанный email'
                    : 'Ваша подписка активирована и готова к использованию'
                  }
                </p>

                {/* Confetti effect */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex justify-center gap-2 text-2xl"
                >
                  {['🎉', '✨', '🎊'].map((emoji, i) => (
                    <motion.span
                      key={i}
                      animate={{
                        y: [0, -10, 0],
                        rotate: [0, 10, -10, 0],
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    >
                      {emoji}
                    </motion.span>
                  ))}
                </motion.div>
              </motion.div>

              {/* Progress bar */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 5, ease: 'linear' }}
                className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-500 rounded-b-3xl origin-left"
              />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
