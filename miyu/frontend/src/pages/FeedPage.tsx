import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Play, Music, Clock, Loader2, Users, UserPlus, Mic2 } from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'
import { usePlayer } from '../hooks/PlayerContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import OnlineStatus from '../components/OnlineStatus'
import type { User as UserType, Track, Album } from '../types'
import { ExplicitBadge } from '../components/ExplicitBadge'

interface FeedItem {
  id: number
  type: 'listen' | 'release_track' | 'release_album'
  user: UserType
  artist?: UserType
  track?: Track & { artist?: { id: number; username: string }; album?: { title: string; cover_url: string } }
  album?: Album & { artist?: { id: number; username: string } } | null
  created_at: string
  audiences?: FeedAudienceFilter[]
}

type FeedAudienceFilter = 'all' | 'friends' | 'following' | 'artists'

type FeedItemWithAudience = FeedItem & {
  audiences: FeedAudienceFilter[]
}

function getStoredTokens() {
  const token = localStorage.getItem('accessToken')
  return token ? { accessToken: token } : null
}

function getAuthHeaders(): Record<string, string> {
  const tokens = getStoredTokens()
  return tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}
}

function ActivityIcon({ type }: { type: FeedItem['type'] }) {
  switch (type) {
    case 'listen': return <Play className="w-3 h-3 text-green-400" />
    case 'release_track': return <Music className="w-3 h-3 text-purple-300" />
    case 'release_album': return <Mic2 className="w-3 h-3 text-pink-300" />
    default: return null
  }
}

function getActivityText(type: FeedItem['type']): string {
  switch (type) {
    case 'listen': return 'слушал'
    case 'release_track': return 'выпустил трек'
    case 'release_album': return 'выпустил альбом'
    default: return ''
  }
}

function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diff < 60) return 'только что'
    if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
    return `${Math.floor(diff / 86400)} дн назад`
  } catch {
    return ''
  }
}

export default function FeedPage() {
  const { isAuthenticated } = useAuth()
  const player = usePlayer()
  const [filter, setFilter] = useState<FeedAudienceFilter>('all')
  const [feed, setFeed] = useState<FeedItemWithAudience[]>([])
  const [loading, setLoading] = useState(true)

  // Get online status for all users in feed
  const userIds = feed.map(item => item.user.id)
  const onlineStatus = useOnlineStatus(userIds)

  useEffect(() => {
    loadFeed()
  }, [isAuthenticated])

  const loadFeed = async () => {
    try {
      if (!isAuthenticated) {
        const res = await fetch('/api/feed/global')
        if (res.ok) {
          const data: FeedItem[] = await res.json()
          setFeed(data.map(item => ({ ...item, audiences: ['all'] })))
        }
        return
      }

      const headers = getAuthHeaders()
      const res = await fetch('/api/feed', { headers })
      if (res.ok) {
        const data: FeedItem[] = await res.json()
        setFeed(data.map(item => ({ ...item, audiences: item.audiences?.length ? item.audiences : ['all'] })))
      }
    } catch (err) {
      console.error('Failed to load feed:', err)

      if (isAuthenticated) {
        try {
          const fallbackRes = await fetch('/api/feed', { headers: getAuthHeaders() })
          if (fallbackRes.ok) {
            const fallbackData: FeedItem[] = await fallbackRes.json()
            setFeed(fallbackData.map(item => ({ ...item, audiences: ['all'] })))
          }
        } catch (fallbackErr) {
          console.error('Failed to load fallback feed:', fallbackErr)
        }
      } else {
        try {
          const fallbackRes = await fetch('/api/feed/global')
          if (fallbackRes.ok) {
            const fallbackData: FeedItem[] = await fallbackRes.json()
            setFeed(fallbackData.map(item => ({ ...item, audiences: ['all'] })))
          }
        } catch (fallbackErr) {
          console.error('Failed to load fallback feed:', fallbackErr)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const filteredFeed = filter === 'all'
    ? feed
    : feed.filter((item) => item.audiences.includes(filter))

  const handlePlay = (track?: FeedItem['track']) => {
    if (!track) return
    const queue = filteredFeed
      .map(f => f.track)
      .filter((item): item is NonNullable<FeedItem['track']> => Boolean(item))

    player.setTrack(track)
    player.setQueue(queue)
    player.play()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Лента активности</h1>
      </div>

      {isAuthenticated && (
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 text-sm text-white/60">
          Лента собирает активность ваших друзей, пользователей из подписок и любимых артистов.
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'all', label: 'Все' },
          { id: 'friends', label: 'Друзья' },
          { id: 'following', label: 'Подписки' },
          { id: 'artists', label: 'Артисты' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as FeedAudienceFilter)}
            className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap transition ${
              filter === f.id 
                ? 'glass-accent text-white' 
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredFeed.map((item, index) => {
          const actor = item.artist || item.user
          const actorTarget = actor.role === 'artist' ? `/artist/${actor.id}` : `/user/${actor.id}`

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition"
            >
              <div className="flex items-start gap-3">
                <Link to={actorTarget} className="relative">
                  <img loading="lazy"
                    src={actor.avatar_url ? `${actor.avatar_url}` : '/default-avatar.svg'}
                    alt={actor.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <OnlineStatus isOnline={onlineStatus[actor.id]} size="sm" className="absolute bottom-0 right-0" />
                </Link>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link to={actorTarget} className="font-medium hover:underline">
                      @{actor.username}
                    </Link>
                    {actor.is_verified && (
                      <span className="text-xs text-purple-400">✓</span>
                    )}
                    <span className="text-white/40 text-sm">
                      {getActivityText(item.type)}
                    </span>
                    <ActivityIcon type={item.type} />
                  </div>

                  <div className="text-xs text-white/30 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(item.created_at)}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.audiences.includes('friends') && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
                        <Users className="h-3 w-3" />
                        Друг
                      </span>
                    )}
                    {item.audiences.includes('following') && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-300">
                        <UserPlus className="h-3 w-3" />
                        Подписка
                      </span>
                    )}
                    {item.audiences.includes('artists') && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] text-fuchsia-300">
                        <Mic2 className="h-3 w-3" />
                        Артист
                      </span>
                    )}
                  </div>

                  {item.track && (
                    <div className="mt-3 p-3 rounded-lg bg-white/[0.03] flex items-center gap-3">
                      <img loading="lazy"
                        src={item.track.cover_url || item.track.album?.cover_url || '/default-cover.svg'}
                        alt={item.track.title}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <Link to={`/track/${item.track.id}`} className="font-medium hover:underline truncate block">
                          <span className="inline-flex items-center gap-1">{item.track.title}<ExplicitBadge is_explicit={item.track.is_explicit} size="xs" /></span>
                        </Link>
                        <div className="text-sm text-white/40 truncate">
                          {item.track.artist?.username || item.artist?.username || 'Артист'}
                          {item.track.album?.title && ` • ${item.track.album.title}`}
                        </div>
                      </div>
                      <button
                        onClick={() => handlePlay(item.track)}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
                        aria-label="Воспроизвести трек"
                      >
                        <Play className="w-4 h-4" fill="currentColor" />
                      </button>
                    </div>
                  )}

                  {!item.track && item.album && (
                    <Link to={`/album/${item.album.id}`} className="mt-3 p-3 rounded-lg bg-white/[0.03] flex items-center gap-3 transition hover:bg-white/[0.06]">
                      <img loading="lazy"
                        src={item.album.cover_url || '/default-cover.svg'}
                        alt={item.album.title}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block">{item.album.title}</span>
                        <div className="text-sm text-white/40 truncate">
                          {item.album.artist?.username || item.artist?.username || 'Артист'} • {item.album.type || 'album'}
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {filteredFeed.length === 0 && (
        <div className="text-center py-12 text-white/40">
          <p>Нет активности</p>
          {isAuthenticated && (
            <p className="text-sm mt-2">Добавьте друзей, подписки или любимых артистов, чтобы видеть их активность</p>
          )}
        </div>
      )}
    </div>
  )
}
