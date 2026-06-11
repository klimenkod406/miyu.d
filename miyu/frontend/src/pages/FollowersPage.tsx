import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { UserCheck, Search, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import OnlineStatus from '../components/OnlineStatus'
import type { User } from '../types'

function getStoredTokens() {
  const token = localStorage.getItem('accessToken')
  return token ? { accessToken: token } : null
}

export default function FollowersPage() {
  const { id } = useParams()
  const { isAuthenticated, user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [followers, setFollowers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Get online status for all followers
  const onlineStatus = useOnlineStatus(followers.map(f => f.id))

  useEffect(() => {
    loadFollowers()
  }, [id])

  const loadFollowers = async () => {
    const tokens = getStoredTokens()
    const targetId = id || user?.id
    
    if (!targetId) {
      setLoading(false)
      return
    }

    try {
      const url = isAuthenticated && id === String(user?.id)
        ? '/api/following/followers'
        : `/api/user/${targetId}/followers`
      
      const headers: HeadersInit = tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}
      const res = await fetch(url, { headers })
      
      if (res.ok) {
        const data = await res.json()
        setFollowers(data)
      }
    } catch (err) {
      console.error('Failed to load followers:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredFollowers = searchQuery
    ? followers.filter(f => f.username.toLowerCase().includes(searchQuery.toLowerCase()))
    : followers

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

      <h1 className="text-2xl font-bold">Подписчики</h1>
      <p className="text-white/40">{followers.length} подписчиков</p>

      {followers.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск подписчиков..."
            className="w-full pl-10 pr-4 py-3 glass rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>
      )}

      <div className="space-y-2">
        {filteredFollowers.map((user, index) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Link
              to={`/user/${user.id}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition"
            >
              <div className="relative">
                <img
                  src={user.avatar_url ? `${user.avatar_url}` : '/default-avatar.svg'}
                  alt={user.username}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <OnlineStatus isOnline={onlineStatus[user.id]} className="absolute bottom-0 right-0" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">@{user.username}</p>
                {user.bio && (
                  <p className="text-sm text-white/40 truncate">{user.bio}</p>
                )}
              </div>
              {user.role === 'artist' && (
                <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">
                  Артист
                </span>
              )}
            </Link>
          </motion.div>
        ))}
      </div>

      {filteredFollowers.length === 0 && (
        <div className="text-center py-12 text-white/40">
          <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Нет подписчиков</p>
        </div>
      )}
    </div>
  )
}
