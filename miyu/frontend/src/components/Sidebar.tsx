import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Home, Search, User, Mic, Settings, Heart, ListMusic, Shield, LogOut, Award, MoreHorizontal, Ticket, Users, Clapperboard } from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'
import { LucideIcon } from 'lucide-react'
import { getStoredTokens } from '../api/auth'
import SocialSidebar from './SocialSidebar'

function isPathActive(pathname: string, itemPath: string): boolean {
  if (pathname === itemPath) return true
  if (itemPath !== '/' && pathname.startsWith(itemPath + '/')) return true
  return false
}

function NavItem({ to, icon: Icon }: { to: string; icon: LucideIcon }) {
  const location = useLocation()
  const isActive = isPathActive(location.pathname, to)

  return (
    <NavLink to={to}>
      <motion.div
        className={`flex items-center justify-center w-10 h-10 rounded-xl ${isActive ? 'glass' : 'glass-hover'}`}
        whileTap={{ scale: 0.92 }}
      >
        <Icon className="w-5 h-5 text-white" />
      </motion.div>
    </NavLink>
  )
}

const LOGIN_LABELS = ['Sign in', 'Войти', 'Anmelden', 'Entrar', 'Connexion', 'ログイン']

function Dropdown({ icon: Icon, items, label }: { icon: LucideIcon; items: { to?: string; icon: LucideIcon; label: string; action?: () => void }[]; label: string }) {
  const location = useLocation()
  const isActive = items.some(item => item.to && isPathActive(location.pathname, item.to))

  return (
    <div className="relative group">
      <motion.button 
        className={`flex items-center justify-center w-10 h-10 rounded-xl ${isActive ? 'glass' : 'glass-hover'}`}
        whileTap={{ scale: 0.92 }}
      >
        <Icon className="w-5 h-5 text-white" />
      </motion.button>

      <div
        className="absolute bottom-full left-1/2 z-[70] mb-2 min-w-40 -translate-x-1/2 rounded-xl p-2 opacity-0 invisible shadow-xl transition-all duration-200 group-hover:visible group-hover:opacity-100 max-[414px]:left-auto max-[414px]:right-0 max-[414px]:translate-x-0"
        style={{
          background: 'rgba(0, 0, 0, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {items.map((item, idx) => {
          const ItemIcon = item.icon
          if (item.action) {
            return (
              <button
                key={idx}
                onClick={item.action}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition text-gray-400 hover:text-white hover:bg-white/10 w-full"
              >
                <ItemIcon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            )
          }
          return (
            <NavLink
              key={item.to}
              to={item.to!}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  isActive ? 'glass text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <ItemIcon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}

function SocialDropdown() {
  const location = useLocation()
  const isActive = ['/notifications', '/friends', '/feed'].some((path) => isPathActive(location.pathname, path))

  return (
    <div className="relative group lg:hidden">
      <motion.button
        className={`flex items-center justify-center w-10 h-10 rounded-xl ${isActive ? 'glass' : 'glass-hover'}`}
        whileTap={{ scale: 0.92 }}
      >
        <Users className="w-5 h-5 text-white" />
      </motion.button>

      <div className="fixed bottom-[8.75rem] left-2 right-2 z-[70] hidden group-hover:block max-[375px]:left-1.5 max-[375px]:right-1.5">
        <SocialSidebar mode="dropdown" />
      </div>
    </div>
  )
}

export default function Sidebar() {
  const { user, isAuthenticated, logout } = useAuth()
  const [pinnedPlaylists, setPinnedPlaylists] = useState<any[]>([])
  const [loginLabelIndex, setLoginLabelIndex] = useState(0)
  const [animatedLoginLabel, setAnimatedLoginLabel] = useState('')
  const [loginAnimationPhase, setLoginAnimationPhase] = useState<'typing' | 'pausing' | 'deleting'>('typing')

  const loadPinnedPlaylists = () => {
    const tokens = getStoredTokens()
    if (!tokens) return

    fetch('/api/playlists', {
      headers: { Authorization: `Bearer ${tokens.accessToken}` }
    })
      .then(res => res.json())
      .then(data => {
        const pinned = Array.isArray(data) ? data.filter(p => p.is_pinned === 1) : []
        setPinnedPlaylists(pinned.slice(0, 5))
      })
      .catch(() => {})
  }

  useEffect(() => {
    if (!isAuthenticated) return
    loadPinnedPlaylists()
  }, [isAuthenticated])

  useEffect(() => {
    const handlePlaylistPinned = () => loadPinnedPlaylists()
    window.addEventListener('playlist-pinned', handlePlaylistPinned)
    window.addEventListener('playlist-updated', handlePlaylistPinned)
    return () => {
      window.removeEventListener('playlist-pinned', handlePlaylistPinned)
      window.removeEventListener('playlist-updated', handlePlaylistPinned)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      setAnimatedLoginLabel('')
      setLoginAnimationPhase('typing')
      return
    }

    const currentLabel = LOGIN_LABELS[loginLabelIndex]
    let frame: ReturnType<typeof setTimeout> | null = null

    if (loginAnimationPhase === 'typing') {
      if (animatedLoginLabel.length < currentLabel.length) {
        frame = setTimeout(() => {
          setAnimatedLoginLabel(currentLabel.slice(0, animatedLoginLabel.length + 1))
        }, 85)
      } else {
        frame = setTimeout(() => {
          setLoginAnimationPhase('pausing')
        }, 1200)
      }
    } else if (loginAnimationPhase === 'pausing') {
      frame = setTimeout(() => {
        setLoginAnimationPhase('deleting')
      }, 0)
    } else if (loginAnimationPhase === 'deleting') {
      if (animatedLoginLabel.length > 0) {
        frame = setTimeout(() => {
          setAnimatedLoginLabel((prev) => prev.slice(0, -1))
        }, 45)
      } else {
        frame = setTimeout(() => {
          setLoginLabelIndex((prev) => (prev + 1) % LOGIN_LABELS.length)
          setLoginAnimationPhase('typing')
        }, 260)
      }
    }

    return () => {
      if (frame) clearTimeout(frame)
    }
  }, [animatedLoginLabel, isAuthenticated, loginAnimationPhase, loginLabelIndex])

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  const mainNav = [
    { to: '/', icon: Home, label: 'Главная' },
    { to: '/search', icon: Search, label: 'Поиск' },
    { to: '/concerts', icon: Ticket, label: 'Концерты' },
    { to: '/clips', icon: Clapperboard, label: 'Клипы' },
    { to: '/profile', icon: User, label: 'Профиль' },
  ]

  const showLibrarySection = isAuthenticated
  const showArtistAdminSection = Boolean(isAuthenticated && (user?.role === 'artist' || user?.role === 'admin'))
  const showMoreSection = isAuthenticated

  if (!isAuthenticated) {
    return (
      <aside className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 max-[414px]:z-[70] max-[414px]:bottom-3 max-[414px]:left-3 max-[414px]:right-3 max-[414px]:translate-x-0">
        <NavLink to="/login">
          <motion.div
            className="flex h-12 min-w-[154px] items-center justify-center rounded-2xl px-5 text-base font-medium text-white/90 shadow-2xl glass max-[414px]:min-w-0 max-[414px]:w-full max-[414px]:px-4 max-[414px]:text-sm"
            whileTap={{ scale: 0.98 }}
          >
            <span className="tracking-wide">{animatedLoginLabel}</span>
            <span className="ml-0.5 inline-block w-[1px] h-4 bg-white/70 animate-pulse" />
          </motion.div>
        </NavLink>
      </aside>
    )
  }

  return (
    <aside className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 max-[414px]:z-[70] max-[414px]:bottom-3 max-[414px]:left-2 max-[414px]:right-2 max-[414px]:translate-x-0 flex flex-col items-center gap-2">
      <div className="flex items-center gap-1 rounded-2xl p-2 shadow-2xl glass max-[414px]:w-full max-[414px]:justify-between max-[414px]:gap-0.5 max-[414px]:px-1.5 max-[414px]:py-1.5 max-[375px]:px-1">
        {mainNav.map((item) => (
          <NavItem key={item.to} to={item.to} icon={item.icon} />
        ))}

        {showLibrarySection && <div className="w-px h-8 bg-white/30 mx-0.5" />}

        {showLibrarySection && (
          <>
            <NavItem to="/profile/library/liked" icon={Heart} />

            <NavLink to="/profile/library/playlists">
              <motion.div
                className="flex items-center justify-center w-10 h-10 rounded-xl glass-hover"
                whileTap={{ scale: 0.92 }}
              >
                <ListMusic className="w-5 h-5 text-white" />
              </motion.div>
            </NavLink>

            {pinnedPlaylists.map((playlist) => (
              <NavLink key={playlist.id} to={`/playlist/${playlist.id}`}>
                <motion.div
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 overflow-hidden flex items-center justify-center"
                  whileTap={{ scale: 0.92 }}
                >
                  {playlist.cover_url ? (
                    <img src={playlist.cover_url} alt={playlist.title} className="w-full h-full object-cover" />
                  ) : (
                    <ListMusic className="w-5 h-5 text-white" />
                  )}
                </motion.div>
              </NavLink>
            ))}

            <SocialDropdown />
          </>
        )}

        {showArtistAdminSection ? (
          <>
            {(showLibrarySection || mainNav.length > 0) && <div className="w-px h-8 bg-white/30 mx-0.5" />}

            {user?.role === 'artist' && (
              <NavItem to="/artist/dashboard" icon={Mic} />
            )}

            {user?.role === 'admin' && (
              <NavItem to="/admin" icon={Shield} />
            )}
          </>
        ) : null}

        {(showLibrarySection || showArtistAdminSection) && showMoreSection && <div className="w-px h-8 bg-white/30 mx-0.5" />}

        {showMoreSection && (
          <Dropdown icon={MoreHorizontal} items={[
            { to: '/tickets', icon: Ticket, label: 'Билеты' },
            { to: '/settings', icon: Settings, label: 'Настройки' },
            { to: '/achievements', icon: Award, label: 'Достижения' },
            { to: '/login', icon: LogOut, label: 'Выйти', action: handleLogout },
          ]} label="Ещё" />
        )}
      </div>
    </aside>
  )
}
