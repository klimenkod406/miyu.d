import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { UserPlus, Check, X, Search, UserCheck, Clock, Loader2, Pin, EyeOff, Eye } from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import AchievementToast from '../components/AchievementToast'
import OnlineStatus from '../components/OnlineStatus'
import type { User } from '../types'

interface Achievement {
  id: number
  code: string
  title: string
  description: string
  icon: string
  rarity: string
}

interface FriendRequest {
  id: number
  from_user_id: number
  user_id: number
  from_user?: User
  status: string
  created_at: string
}

function UserCard({ user, action, isOnline }: { user: User & { is_friend?: boolean; request_sent?: boolean }; action?: React.ReactNode; isOnline?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition">
      <Link to={`/user/${user.id}`} className="relative">
        <img loading="lazy"
          src={user.avatar_url ? `${user.avatar_url}` : '/default-avatar.svg'}
          alt={user.username}
          className="w-12 h-12 rounded-full object-cover"
        />
        <OnlineStatus isOnline={isOnline} className="absolute bottom-0 right-0" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link to={`/user/${user.id}`}>
          <p className="font-medium hover:underline">@{user.username}</p>
        </Link>
        {user.bio && (
          <p className="text-sm text-white/40 truncate">{user.bio}</p>
        )}
      </div>
      {user.is_friend && (
        <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-lg">Друг</span>
      )}
      {user.request_sent && !user.is_friend && (
        <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded-lg">Запрос отправлен</span>
      )}
      {action}
    </div>
  )
}

export default function FriendsPage() {
  const { isAuthenticated } = useAuth()
  const [tab, setTab] = useState<'friends' | 'requests' | 'search'>('friends')
  const [searchQuery, setSearchQuery] = useState('')
  const [friends, setFriends] = useState<User[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<number | null>(null)
  const [searching, setSearching] = useState(false)
  const [unlockedAchievements, setUnlockedAchievements] = useState<Achievement[]>([])

  // Get online status for all visible users
  const allUserIds = [
    ...friends.map(f => f.id),
    ...requests.map(r => r.from_user_id),
    ...searchResults.map(s => s.id)
  ]
  const onlineStatus = useOnlineStatus(allUserIds)

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    loadFriends()
  }, [isAuthenticated])

  useEffect(() => {
    if (tab === 'requests') {
      loadRequests()
    }
  }, [tab])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        loadRequests()
        loadFriends()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const intervalId = setInterval(() => {
      if (isAuthenticated) {
        loadRequests()
      }
    }, 10000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(intervalId)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (tab !== 'search') return
    const timer = setTimeout(() => {
      searchUsers()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, tab])

  const getStoredTokens = () => {
    const token = localStorage.getItem('accessToken')
    return token ? { accessToken: token } : null
  }

  const loadFriends = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return
    
    try {
      const res = await fetch('/api/friends', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
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

  const loadRequests = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return
    
    try {
      const res = await fetch('/api/friends/requests', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        setRequests(data.map((r: any) => ({
          id: r.id,
          from_user_id: r.from_user_id || r.user_id,
          user_id: r.from_user_id || r.user_id,
          from_user: {
            id: r.user_id,
            username: r.username,
            avatar_url: r.avatar_url,
            bio: r.bio,
            is_verified: r.is_verified,
            is_premium: r.is_premium,
            role: r.role,
            created_at: ''
          },
          status: 'pending',
          created_at: r.created_at
        })))
      }
    } catch (err) {
      console.error('Failed to load requests:', err)
    }
  }

  const searchUsers = async () => {
    const tokens = getStoredTokens()
    if (!tokens || searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    
    setSearching(true)
    try {
      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data)
      }
    } catch (err) {
      console.error('Failed to search:', err)
    } finally {
      setSearching(false)
    }
  }

  const handleAccept = async (requestId: number) => {
    setSubmitting(requestId)
    const tokens = getStoredTokens()
    if (!tokens) return

    try {
      const res = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`
        },
        body: JSON.stringify({ requestId })
      })
      if (res.ok) {
        const data = await res.json()
        setRequests(prev => prev.filter(r => r.id !== requestId))
        loadFriends()
        window.dispatchEvent(new Event('refresh-friends-sidebar'))

        // Show achievement notifications
        if (data.unlockedAchievements && data.unlockedAchievements.length > 0) {
          setUnlockedAchievements(data.unlockedAchievements)
        }
      }
    } catch (err) {
      console.error('Failed to accept:', err)
    } finally {
      setSubmitting(null)
    }
  }

  const handleReject = async (requestId: number) => {
    setSubmitting(requestId)
    const tokens = getStoredTokens()
    if (!tokens) return
    
    try {
      const res = await fetch('/api/friends/reject', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}` 
        },
        body: JSON.stringify({ requestId })
      })
      if (res.ok) {
        setRequests(prev => prev.filter(r => r.id !== requestId))
      }
    } catch (err) {
      console.error('Failed to reject:', err)
    } finally {
      setSubmitting(null)
    }
  }

  const handleAddFriend = async (userId: number) => {
    setSubmitting(userId)
    const tokens = getStoredTokens()
    if (!tokens) return

    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`
        },
        body: JSON.stringify({ userId })
      })
      if (res.ok) {
        setSearchResults(prev => prev.map(u =>
          u.id === userId ? { ...u, request_sent: true } : u
        ))
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: 'Запрос отправлен', type: 'success' }
        }))
      } else {
        const data = await res.json()
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: data.error || 'Ошибка', type: 'error' }
        }))
      }
    } catch (err) {
      console.error('Failed to add friend:', err)
    } finally {
      setSubmitting(null)
    }
  }

  const handleTogglePin = async (userId: number, isPinned: boolean) => {
    const tokens = getStoredTokens()
    if (!tokens) return

    try {
      const endpoint = isPinned ? '/api/friends/unpin-sidebar' : '/api/friends/pin-sidebar'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`
        },
        body: JSON.stringify({ userId })
      })
      if (res.ok) {
        setFriends(prev => prev.map(f =>
          f.id === userId ? { ...f, is_pinned_in_sidebar: !isPinned } : f
        ))
        window.dispatchEvent(new Event('refresh-friends-sidebar'))
      }
    } catch (err) {
      console.error('Failed to toggle pin:', err)
    }
  }

  const handleToggleHide = async (userId: number, isHidden: boolean) => {
    const tokens = getStoredTokens()
    if (!tokens) return

    try {
      const endpoint = isHidden ? '/api/friends/unhide-sidebar' : '/api/friends/hide-sidebar'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`
        },
        body: JSON.stringify({ userId })
      })
      if (res.ok) {
        setFriends(prev => prev.map(f =>
          f.id === userId ? { ...f, is_hidden_in_sidebar: !isHidden } : f
        ))
        window.dispatchEvent(new Event('refresh-friends-sidebar'))
      }
    } catch (err) {
      console.error('Failed to toggle hide:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-20 text-white/40">
        <UserCheck className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <p>Войдите, чтобы увидеть друзей</p>
      </div>
    )
  }

  return (
    <>
      {unlockedAchievements.map((achievement) => (
        <AchievementToast
          key={achievement.id}
          achievement={achievement}
          onClose={() => setUnlockedAchievements(prev => prev.filter(a => a.id !== achievement.id))}
        />
      ))}

      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Друзья</h1>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'friends', label: 'Друзья', icon: UserCheck, count: friends.length },
          { id: 'requests', label: 'Запросы', icon: Clock, count: requests.length },
          { id: 'search', label: 'Найти', icon: Search },
        ].map((t) => {
          const tabCount = 'count' in t ? t.count : undefined
          return (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm whitespace-nowrap transition ${
              tab === t.id 
                ? 'glass-accent text-white' 
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {tabCount !== undefined && tabCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-purple-500 text-xs flex items-center justify-center">
                {tabCount}
              </span>
            )}
          </button>
        )})}
      </div>

      {tab === 'search' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск пользователей..."
              className="w-full pl-10 pr-4 py-3 glass rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {searchQuery.length < 2 && (
            <div className="text-center py-12 text-white/40">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Введите минимум 2 символа для поиска</p>
            </div>
          )}

          {searchQuery.length >= 2 && searching && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          )}

          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <div className="text-center py-12 text-white/40">
              <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Пользователи не найдены</p>
            </div>
          )}

          {searchQuery.length >= 2 && searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-white/40">Результаты поиска ({searchResults.length}):</p>
              {searchResults.map((user: any) => (
                <UserCard
                  key={user.id}
                  user={user}
                  isOnline={onlineStatus[user.id]}
                  action={
                    user.is_friend ? null : user.request_sent ? (
                      <button
                        disabled
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 opacity-50"
                      >
                        <Clock className="w-4 h-4" />
                        Ожидание
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleAddFriend(user.id)}
                        disabled={submitting === user.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition disabled:opacity-50"
                      >
                        <UserPlus className="w-4 h-4" />
                        Добавить
                      </button>
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Нет запросов в друзья</p>
            </div>
          ) : (
            requests.map((request) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]"
              >
                <Link to={`/user/${request.from_user_id}`}>
                  <img loading="lazy"
                    src={request.from_user?.avatar_url ? `${request.from_user.avatar_url}` : '/default-avatar.svg'}
                    alt={request.from_user?.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/user/${request.from_user_id}`}>
                    <p className="font-medium hover:underline">@{request.from_user?.username}</p>
                  </Link>
                  <p className="text-xs text-white/30">{new Date(request.created_at).toLocaleDateString('ru')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAccept(request.id)}
                    disabled={submitting === request.id}
                    className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center justify-center transition disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleReject(request.id)}
                    disabled={submitting === request.id}
                    className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {tab === 'friends' && (
        <div className="space-y-3">
          {friends.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>У вас пока нет друзей</p>
              <Link to="/friends?tab=search" className="text-purple-400 hover:underline text-sm mt-2 block">
                Найти друзей
              </Link>
            </div>
          ) : (
            friends.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <UserCard
                  user={user}
                  isOnline={onlineStatus[user.id]}
                  action={
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePin(user.id, !!user.is_pinned_in_sidebar)}
                        className={`p-2 rounded-lg transition ${
                          user.is_pinned_in_sidebar
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                        }`}
                        title={user.is_pinned_in_sidebar ? 'Открепить' : 'Закрепить'}
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleHide(user.id, !!user.is_hidden_in_sidebar)}
                        className={`p-2 rounded-lg transition ${
                          user.is_hidden_in_sidebar
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                        }`}
                        title={user.is_hidden_in_sidebar ? 'Показать' : 'Скрыть'}
                      >
                        {user.is_hidden_in_sidebar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  }
                />
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
    </>
  )
}
