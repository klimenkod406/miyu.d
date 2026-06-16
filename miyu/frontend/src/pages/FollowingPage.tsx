import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, UserCheck, Loader2, UserMinus } from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import OnlineStatus from '../components/OnlineStatus'
import type { User } from '../types'

function getStoredTokens() {
  const token = localStorage.getItem('accessToken')
  return token ? { accessToken: token } : null
}

export default function FollowingPage() {
  const { id } = useParams()
  const { isAuthenticated, user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [following, setFollowing] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [unfollowing, setUnfollowing] = useState<number | null>(null)

  const isOwnProfile = !id || String(id) === String(user?.id)

  // Get online status for all following users
  const onlineStatus = useOnlineStatus(following.map(u => u.id))

  useEffect(() => {
    loadFollowing()
  }, [id])

  const loadFollowing = async () => {
    const tokens = getStoredTokens()
    const targetId = id || user?.id
    
    if (!targetId) {
      setLoading(false)
      return
    }

    try {
      const url = isAuthenticated && isOwnProfile
        ? '/api/following'
        : `/api/user/${targetId}/following`
      
      const headers: HeadersInit = tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}
      const res = await fetch(url, { headers })
      
      if (res.ok) {
        const data = await res.json()
        setFollowing(data)
      }
    } catch (err) {
      console.error('Failed to load following:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUnfollow = async (userId: number) => {
    if (!isOwnProfile) return
    
    setUnfollowing(userId)
    const tokens = getStoredTokens()
    if (!tokens) return

    try {
      const res = await fetch('/api/following/unfollow', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}` 
        },
        body: JSON.stringify({ userId })
      })
      if (res.ok) {
        setFollowing(prev => prev.filter(u => u.id !== userId))
      }
    } catch (err) {
      console.error('Failed to unfollow:', err)
    } finally {
      setUnfollowing(null)
    }
  }

  const filteredFollowing = searchQuery
    ? following.filter(f => f.username.toLowerCase().includes(searchQuery.toLowerCase()))
    : following

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {id && (
        <div className="flex items-center gap-4">
          <Link to={`/user/${id}`} className="text-purple-400 hover:underline">
            ← Назад к профилю
          </Link>
        </div>
      )}

      <h1 className="text-2xl font-bold">Подписки</h1>
      <p className="text-white/40">{following.length} подписок</p>

      {following.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск подписок..."
            className="w-full pl-10 pr-4 py-3 glass rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>
      )}

      <div className="space-y-2">
        {filteredFollowing.map((user, index) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition"
          >
            <Link to={`/user/${user.id}`} className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative">
                <img loading="lazy"
                  src={user.avatar_url ? `${user.avatar_url}` : '/default-avatar.svg'}
                  alt={user.username}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <OnlineStatus isOnline={onlineStatus[user.id]} className="absolute bottom-0 right-0" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">@{user.username}</p>
                {user.bio && (
                  <p className="text-sm text-white/40 truncate">{user.bio}</p>
                )}
              </div>
            </Link>
            {isOwnProfile && (
              <button
                onClick={() => handleUnfollow(user.id)}
                disabled={unfollowing === user.id}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition text-sm disabled:opacity-50"
              >
                <UserMinus className="w-4 h-4" />
                Отписаться
              </button>
            )}
          </motion.div>
        ))}
      </div>

      {filteredFollowing.length === 0 && (
        <div className="text-center py-12 text-white/40">
          <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Нет подписок</p>
        </div>
      )}
    </div>
  )
}
