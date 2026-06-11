import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'
import ServiceLogo from './ServiceLogo'

const placeholderPhrases = [
  "Какую музыку ищешь?",
  "Найди свой звук",
  "Открой новые треки",
  "Ищи исполнителей",
  "Что послушать?",
  "Настройся на волну",
  "Найди вдохновение",
  "Твой следующий хит",
]

function AnimatedPlaceholder({ isActive }: { isActive: boolean }) {
  const [index, setIndex] = useState(0)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (isActive) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % placeholderPhrases.length)
    }, 2500)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isActive])

  if (isActive) return null

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={index}
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -10, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="absolute left-10 right-10 top-0 bottom-0 my-auto flex items-center text-sm text-white/30 pointer-events-none max-[414px]:left-9 max-[414px]:right-4 max-[414px]:text-xs"
      >
        {placeholderPhrases[index]}
      </motion.span>
    </AnimatePresence>
  )
}

export default function Header() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const isSearchPage = location.pathname === '/search'
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '')
  const [showHeaderLogo, setShowHeaderLogo] = useState(true)
  const debounceTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const readSettings = () => {
      try {
        const raw = localStorage.getItem('userSettings')
        if (!raw) {
          setShowHeaderLogo(true)
          return
        }
        const parsed = JSON.parse(raw)
        setShowHeaderLogo(parsed.showHeaderLogo !== false)
      } catch {
        setShowHeaderLogo(true)
      }
    }

    const handleSettingsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ showHeaderLogo?: boolean }>
      setShowHeaderLogo(customEvent.detail?.showHeaderLogo !== false)
    }

    readSettings()
    window.addEventListener('storage', readSettings)
    window.addEventListener('user-settings-updated', handleSettingsUpdated as EventListener)

    return () => {
      window.removeEventListener('storage', readSettings)
      window.removeEventListener('user-settings-updated', handleSettingsUpdated as EventListener)
    }
  }, [])

  // Update search value when URL changes
  useEffect(() => {
    const queryFromUrl = searchParams.get('q') || ''
    setSearchValue(queryFromUrl)
  }, [searchParams])

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchValue(value)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = window.setTimeout(() => {
      if (value) {
        setSearchParams({ q: value })
      } else {
        setSearchParams({})
      }
    }, 300)
  }

  const handleSearchSubmit = () => {
    if (searchValue) {
      setSearchParams({ q: searchValue })
    }
  }

  const handleClearSearch = () => {
    setSearchValue('')
    setSearchParams({})
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearchPage) {
        navigate(-1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, isSearchPage])

  return (
    <header className="sticky top-0 z-40">
      <div className="relative flex items-center justify-center px-4 py-3 max-[414px]:gap-2 max-[414px]:px-3 max-[414px]:py-2.5 max-[375px]:px-2.5">
        {showHeaderLogo && (
          <div className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 md:block">
            <ServiceLogo />
          </div>
        )}

        <motion.div
          animate={{
            paddingRight: isSearchPage ? 38 : 0,
          }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="w-full max-w-xl md:max-w-[42rem] md:pl-4 md:pr-28"
        >
          <div className="relative flex items-center">
            <div className="relative flex-1">
              <button
                onClick={handleSearchSubmit}
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-white/30 transition hover:text-white max-[414px]:left-2.5"
              >
                <Search size={18} />
              </button>
              <input
                type="text"
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                readOnly={!isAuthenticated}
                className="w-full rounded-xl glass py-2.5 pl-10 pr-10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 max-[414px]:py-2 max-[414px]:pl-9 max-[414px]:pr-9 max-[414px]:text-[13px]"
                onFocus={() => {
                  if (!isAuthenticated) {
                    return
                  }
                  setIsInputFocused(true)
                  if (location.pathname !== '/search') {
                    navigate('/search')
                  }
                }}
                onBlur={() => setIsInputFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchSubmit()
                  }
                }}
              />
              {searchValue && isAuthenticated && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-white/30 transition hover:text-white max-[414px]:right-2.5"
                >
                  <X size={16} />
                </button>
              )}
              {isAuthenticated ? (
                <AnimatedPlaceholder isActive={isInputFocused || searchValue.length > 0} />
              ) : (
                <span className="absolute left-10 right-4 top-0 bottom-0 my-auto flex items-center text-sm text-white/30 pointer-events-none max-[414px]:left-9 max-[414px]:text-xs">
                  Поиск и переходы откроются после входа
                </span>
              )}
            </div>
            {isSearchPage && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => navigate(-1)}
                className="ml-2.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white max-[414px]:ml-2 max-[414px]:h-7 max-[414px]:w-7"
              >
                <X size={16} />
              </motion.button>
            )}
          </div>
        </motion.div>
      </div>
    </header>
  )
}
