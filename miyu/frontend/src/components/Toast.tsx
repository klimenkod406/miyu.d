import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface ToastProps {
  message: string
  type?: 'success' | 'info' | 'error'
  onClose: () => void
}

export default function Toast({ message, type = 'info', onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300)
    }, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const bgColor = type === 'success' ? 'bg-green-500/90' : type === 'error' ? 'bg-red-500/90' : 'bg-white/20'

  return (
    <div 
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className={`glass backdrop-blur-xl ${bgColor} rounded-full px-6 py-3 flex items-center gap-3 shadow-xl`}>
        <span className="text-white text-sm font-medium">{message}</span>
        <button onClick={onClose} className="text-white/70 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}