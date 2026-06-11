import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Users, Newspaper, Play, Disc, Music, Mic, Heart, Star, Smile, Sparkles, MessageCircle, Radio } from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useUserPresence } from '../hooks/useUserPresence'
import OnlineStatus from './OnlineStatus'
import MiniAudioVisualizer from './MiniAudioVisualizer'
import { getPresenceSubtitle, getPresenceTitle } from './friendPresenceView'
import type { User } from '../types'

type SocialSidebarMode = 'floating' | 'dropdown'

interface SocialSidebarProps {
  mode?: SocialSidebarMode
  onNavigate?: () => void
}

const socialNav = [
  { to: '/notifications', icon: Bell, label: 'Уведомления' },
  { to: '/friends', icon: Users, label: 'Друзья' },
  { to: '/feed', icon: Newspaper, label: 'Лента' },
]

const encouragingIcons = [
  { icon: Heart, color: 'text-pink-400', message: 'Найди друзей!' },
  { icon: Users, color: 'text-blue-400', message: 'Добавь друзей' },
  { icon: Star, color: 'text-yellow-400', message: 'Будь активным' },
  { icon: Smile, color: 'text-green-400', message: 'Общайся' },
  { icon: Sparkles, color: 'text-purple-400', message: 'Слушай музыку' },
  { icon: MessageCircle, color: 'text-cyan-400', message: 'Заводи друзей' },
]

function EmptyFriendsSlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % encouragingIcons.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  const current = encouragingIcons[currentIndex]
  const Icon = current.icon

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -10 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-2"
        >
          <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
            <Icon className={`w-5 h-5 ${current.color}`} />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function isPathActive(pathname: string, itemPath: string): boolean {
  if (pathname === itemPath) return true
  if (itemPath !== '/' && pathname.startsWith(itemPath + '/')) return true
  return false
}

function ListeningIndicator({ type }: { type: string }) {
  switch (type) {
    case 'track':
      return <Play className="w-3 h-3 text-green-400" />
    case 'album':
      return <Disc className="w-3 h-3 text-purple-400" />
    case 'artist':
      return <Mic className="w-3 h-3 text-pink-400" />
    default:
      return <Music className="w-3 h-3 text-white/40" />
  }
}

function ActiveUser({ user, isOnline, presence, onHover }: { user: User; isOnline?: boolean; presence?: any; onHover?: () => void }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const isListening = !!presence?.listeningTo
  const title = getPresenceTitle(presence)
  const subtitle = getPresenceSubtitle(presence)
  const trackCover = presence?.listeningTo?.track?.cover_url || presence?.listeningTo?.track?.album?.cover_url

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        setShowTooltip(true)
        onHover?.()
      }}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Link to={`/user/${user.id}`}>
        <div className="relative w-9 h-9">
          {user.avatar_url ? (
            <img
              src={`${user.avatar_url}`}
              alt={user.username}
              className="absolute inset-0.5 w-8 h-8 rounded-full object-cover cursor-pointer"
            />
          ) : (
            <div
              className="absolute inset-0.5 rounded-full flex items-center justify-center text-sm font-medium text-white cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
              }}
            >
              {user.username[0].toUpperCase()}
            </div>
          )}
          <OnlineStatus isOnline={isOnline} size="sm" className="absolute bottom-0 right-0" />
        </div>
      </Link>

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, x: 12, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 12, scale: 0.94 }}
            className="absolute left-full ml-3 top-1/2 z-50 w-72 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/10 bg-[#08080f]/95 shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
            style={{ backdropFilter: 'blur(24px)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-purple-500/10 to-pink-500/10" />
            <div className="relative p-3.5">
              <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
                <Radio className={`h-3 w-3 ${isListening ? 'text-emerald-300' : 'text-white/30'}`} />
                {isListening ? 'Слушает сейчас' : presence?.isOnline ? 'Онлайн' : 'Не в сети'}
              </div>
              <div className="flex gap-3">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/8">
                  {trackCover ? (
                    <img src={trackCover} alt="" className="h-full w-full object-cover" />
                  ) : user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ListeningIndicator type={presence?.listeningTo?.type || 'track'} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/55">{subtitle}</p>
                  <Link
                    to={`/user/${user.id}`}
                    className="mt-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-[11px] font-medium text-white/60 transition hover:border-white/25 hover:text-white"
                  >
                    Открыть профиль
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function SocialSidebar({ mode = 'floating', onNavigate }: SocialSidebarProps) {
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const [friends, setFriends] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)

  const loadUnreadCount = async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setUnreadCount(0)
      return
    }

    try {
      const res = await fetch('/api/notifications/unread', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(Number(data?.count || 0))
      }
    } catch {
      // noop
    }
  }

  const loadPendingRequestsCount = async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setPendingRequestsCount(0)
      return
    }

    try {
      const res = await fetch('/api/friends/requests', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setPendingRequestsCount(Array.isArray(data) ? data.length : 0)
      }
    } catch {
      // noop
    }
  }

  const onlineStatus = useOnlineStatus(friends.map(u => u.id))
  const { presence, refreshPresence } = useUserPresence(friends.map(u => u.id))

  // Filter and sort friends: pinned first, hide hidden ones
  const visibleFriends = friends
    .filter(f => !f.is_hidden_in_sidebar)
    .sort((a, b) => {
      if (a.is_pinned_in_sidebar && !b.is_pinned_in_sidebar) return -1
      if (!a.is_pinned_in_sidebar && b.is_pinned_in_sidebar) return 1
      return 0
    })

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    const loadFriends = async () => {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      try {
        const res = await fetch('/api/friends', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setFriends(data)
        }
      } catch (err) {
        console.error('Failed to load friends:', err)
      } finally {
        setLoading(false)
      }
    }

    loadFriends()

    // Auto-refresh friends list every 30 seconds
    const intervalId = setInterval(loadFriends, 30000)

    // Listen for custom event to refresh immediately
    const handleRefresh = () => loadFriends()
    window.addEventListener('refresh-friends-sidebar', handleRefresh)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('refresh-friends-sidebar', handleRefresh)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0)
      setPendingRequestsCount(0)
      return
    }

    loadUnreadCount()
    loadPendingRequestsCount()
    const intervalId = setInterval(loadUnreadCount, 10000)
    const requestsIntervalId = setInterval(loadPendingRequestsCount, 10000)
    const handleUnreadRefresh = () => loadUnreadCount()
    const handleRequestsRefresh = () => loadPendingRequestsCount()
    window.addEventListener('refresh-notification-unread', handleUnreadRefresh)
    window.addEventListener('refresh-friends-sidebar', handleRequestsRefresh)

    return () => {
      clearInterval(intervalId)
      clearInterval(requestsIntervalId)
      window.removeEventListener('refresh-notification-unread', handleUnreadRefresh)
      window.removeEventListener('refresh-friends-sidebar', handleRequestsRefresh)
    }
  }, [isAuthenticated, location.pathname])


  const navItems = (
    <motion.div
      className={`${mode === 'dropdown' ? 'rounded-xl p-2' : 'glass rounded-2xl p-1'} shadow-xl flex ${mode === 'dropdown' ? 'items-stretch' : 'items-center'} flex-col gap-1`}
      style={mode === 'dropdown'
        ? {
            background: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }
        : undefined
      }
    >
      {socialNav.map((item) => {
        const Icon = item.icon
        const isActive = isPathActive(location.pathname, item.to)

        return (
          <Link key={item.to} to={item.to} onClick={onNavigate} className={mode === 'dropdown' ? 'w-full' : undefined}>
            <motion.div
              className={mode === 'dropdown'
                ? `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    isActive ? 'glass text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
                  }`
                : `flex items-center justify-center w-10 h-10 rounded-xl ${
                    isActive ? 'glass-accent' : 'glass-hover'
                  }`
              }
              whileTap={{ scale: 0.92 }}
            >
              <div className="relative">
                <Icon className="w-5 h-5 text-white" />
                {item.to === '/notifications' && unreadCount > 0 && (
                  <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center leading-none">
                    {unreadCount > 999 ? '999+' : unreadCount}
                  </span>
                )}
                {item.to === '/friends' && pendingRequestsCount > 0 && (
                  <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center leading-none">
                    {pendingRequestsCount > 999 ? '999+' : pendingRequestsCount}
                  </span>
                )}
              </div>
              {mode === 'dropdown' && <span>{item.label}</span>}
            </motion.div>
          </Link>
        )
      })}
    </motion.div>
  )

  const friendsPanel = (
    <motion.div
      className={`${mode === 'dropdown' ? 'rounded-xl p-3 w-full' : 'glass rounded-2xl p-2 w-[52px] mt-3'} shadow-xl overflow-hidden flex flex-col`}
      style={mode === 'dropdown'
        ? {
            background: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }
        : undefined
      }
    >
      {visibleFriends.length > 0 && (
        <p className={`text-white/30 text-center leading-tight ${mode === 'dropdown' ? 'text-xs mb-3' : 'text-[10px] mb-2'}`}>
          Онлайн {mode === 'dropdown' ? `(${visibleFriends.filter(u => onlineStatus[u.id]).length})` : <><br />({visibleFriends.filter(u => onlineStatus[u.id]).length})</>}
        </p>
      )}
      <div
        ref={setScrollContainer}
        className={`overflow-y-auto overflow-x-hidden scrollbar-none ${mode === 'dropdown' ? 'flex flex-wrap gap-2 justify-start max-h-[220px]' : 'flex flex-col items-center gap-2 max-h-[33vh]'}`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {visibleFriends.length === 0 ? (
          <EmptyFriendsSlideshow />
        ) : (
          visibleFriends.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05, duration: 0.2 }}
              whileHover={{ scale: 1.1 }}
              style={{ transition: 'transform 0.2s ease-out, opacity 0.2s ease-out' }}
            >
              <ActiveUser user={user} isOnline={onlineStatus[user.id]} presence={presence[user.id]} onHover={refreshPresence} />
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  )

  if (mode === 'dropdown') {
    return (
      <div className="flex w-[220px] max-w-[calc(100vw-1rem)] flex-col gap-2">
        {navItems}
        {friendsPanel}
      </div>
    )
  }

  return (
    <aside className="fixed top-1/2 left-4 -translate-y-1/2 z-40 hidden lg:flex flex-col max-h-[52vh]">
      <MiniAudioVisualizer />
      <motion.div
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col"
      >
        {navItems}
        {friendsPanel}
      </motion.div>
    </aside>
  )
}
