import { useState, useMemo, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { UserPlus, UserCheck, Heart, Music, Award, Loader2, UserX, AlertTriangle, Clock, Shield, Disc, Radio, PlayCircle } from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useUserPresence } from '../hooks/useUserPresence'
import { getStoredTokens } from '../api/auth'
import OnlineStatus from '../components/OnlineStatus'
import type { User, Track, Album, Playlist } from '../types'
import { extractColorsFromImage } from '../utils/colorExtractor'

interface ProfileAchievement {
  id: number
  code: string
  title: string
  description: string
  icon: string
  requirement_type: string
  requirement_value: number
  progress?: number
  current?: number
  unlocked?: boolean
  unlocked_at?: string
}

interface ProfileUser {
  id: number
  username: string
  role: string
  avatar_url: string | null
  bio: string | null
  is_verified: boolean
  is_premium: boolean
  created_at: string
  is_profile_public: boolean
  show_history: boolean
  show_likes: boolean
  show_achievements: boolean
  show_favorite_artists: boolean
  show_favorite_albums: boolean
  show_playlists: boolean
  show_favorite_tracks: boolean
  palette_mode?: string
  palette_primary?: string
  palette_secondary?: string
  palette_tertiary?: string
  palette_accent?: string
}

const colorPalettes = [
  ['#8B5CF6', '#EC4899', '#3B82F6'],
  ['#F59E0B', '#EF4444', '#EC4899'],
  ['#10B981', '#06B6D4', '#3B82F6'],
  ['#F97316', '#EF4444', '#8B5CF6'],
  ['#6366F1', '#8B5CF6', '#EC4899'],
  ['#14B8A6', '#06B6D4', '#3B82F6'],
  ['#F43F5E', '#EC4899', '#8B5CF6'],
  ['#84CC16', '#22C55E', '#10B981'],
]

function getColorPalette(user: ProfileUser): string[] {
  // If user has custom palette, use it
  if (user.palette_mode === 'custom' && user.palette_primary && user.palette_secondary && user.palette_tertiary) {
    return [user.palette_primary, user.palette_secondary, user.palette_tertiary]
  }

  // Otherwise generate from username
  let hash = 0
  for (let i = 0; i < user.username.length; i++) {
    hash = user.username.charCodeAt(i) + ((hash << 5) - hash)
  }
  const palette = colorPalettes[Math.abs(hash) % colorPalettes.length]
  return palette
}

export default function PublicProfilePage() {
  const { id } = useParams()
  const { user, accessToken } = useAuth()
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isFriend, setIsFriend] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userAchievements, setUserAchievements] = useState<ProfileAchievement[]>([])
  const [isLoadingAchievements, setIsLoadingAchievements] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [likedTracks, setLikedTracks] = useState<any[]>([])
  const [likedAlbums, setLikedAlbums] = useState<any[]>([])
  const [favoriteArtists, setFavoriteArtists] = useState<any[]>([])
  const [stats, setStats] = useState({ followers: 0, following: 0, plays: 0 })
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [isProfilePublic, setIsProfilePublic] = useState(true)
  const [bannerColors, setBannerColors] = useState<string[]>(['#8B5CF6', '#EC4899', '#3B82F6'])
  const [accentColor, setAccentColor] = useState<string>('#8B5CF6')
  const [likedTrackIds, setLikedTrackIds] = useState<Set<number>>(new Set())

  const isOwnProfile = user?.id === Number(id)

  // Get online status for the profile user
  const onlineStatus = useOnlineStatus(profileUser ? [profileUser.id] : [])
  const { presence } = useUserPresence(profileUser ? [profileUser.id] : [])
  const profilePresence = profileUser ? presence[profileUser.id] : undefined

  // Set colors based on palette mode
  useEffect(() => {
    if (!profileUser) return

    const paletteMode = profileUser.palette_mode || 'auto'

    if (paletteMode === 'custom' && profileUser.palette_primary && profileUser.palette_secondary && profileUser.palette_tertiary) {
      // Use custom colors
      setBannerColors([profileUser.palette_primary, profileUser.palette_secondary, profileUser.palette_tertiary])
      setAccentColor(profileUser.palette_accent || profileUser.palette_primary)
    } else if (profileUser.avatar_url) {
      // Auto mode: extract from avatar for banner, white for accents
      const avatarUrl = `${profileUser.avatar_url}`
      extractColorsFromImage(avatarUrl).then(colors => {
        setBannerColors(colors)
        setAccentColor('#FFFFFF')
      }).catch(() => {
        const defaultPalette = getColorPalette(profileUser)
        setBannerColors(defaultPalette)
        setAccentColor('#FFFFFF')
      })
    } else {
      const defaultPalette = getColorPalette(profileUser)
      setBannerColors(defaultPalette)
      setAccentColor('#FFFFFF')
    }
  }, [profileUser?.avatar_url, profileUser?.palette_mode, profileUser?.palette_primary, profileUser?.palette_secondary, profileUser?.palette_tertiary, profileUser?.palette_accent, profileUser?.username])

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      const tokens = getStoredTokens()
      
      try {
        const res = await fetch(`/api/user/${id}`)
        if (res.ok) {
          const data = await res.json()
          setProfileUser(data)
          setIsProfilePublic(data.is_profile_public !== false)
          console.log('Profile loaded:', { show_likes: data.show_likes, show_favorite_tracks: data.show_favorite_tracks })
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setLoading(false)
      }
    }
    
    if (id) {
      loadProfile()
    }
  }, [id])

  // Helper to check if content should be shown
  const canShowContent = (setting: boolean | undefined) => {
    return isOwnProfile || setting !== false
  }

  useEffect(() => {
    async function loadSocialStatus() {
      if (!accessToken || !id || isOwnProfile) {
        setIsFollowing(false)
        setIsFriend(false)
        setRequestSent(false)
        return
      }
      
      try {
        const friendStatusRes = await fetch(`/api/friends/status/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        
        if (friendStatusRes.ok) {
          const friendData = await friendStatusRes.json()
          setIsFriend(friendData.is_friend)
          setRequestSent(friendData.request_sent)
          setIsFollowing(friendData.is_following)
        }
      } catch (err) {
        console.error('Failed to load social status:', err)
      }
    }
    
    loadSocialStatus()
  }, [accessToken, id, isOwnProfile])

  useEffect(() => {
    async function loadAchievements() {
      if (!id) return
      setIsLoadingAchievements(true)
      try {
        const res = await fetch(`/api/user/${id}/achievements`)
        if (res.ok) {
          const data = await res.json()
          setUserAchievements(data)
        }
      } catch (e) {
        console.error('Failed to load achievements:', e)
      } finally {
        setIsLoadingAchievements(false)
      }
    }
    loadAchievements()
  }, [id])

  useEffect(() => {
    async function loadStats() {
      if (!id) return
      try {
        const res = await fetch(`/api/user/${id}/count`)
        if (res.ok) {
          const data = await res.json()
          setStats(prev => ({ ...prev, following: data.following, followers: data.followers }))
        }
      } catch (e) {
        console.error('Failed to load stats:', e)
      }
    }
    loadStats()
  }, [id])

  useEffect(() => {
    async function loadPlaylists() {
      if (!id) return
      try {
        const res = await fetch(`/api/playlists/user/${id}`)
        if (res.ok) {
          const data = await res.json()
          setPlaylists(data)
        } else {
          console.error('Playlists API error:', res.statusText)
        }
      } catch (err) {
        console.error('Failed to load playlists:', err)
      }
    }
    loadPlaylists()
  }, [id])

  useEffect(() => {
    async function loadLikedTracks() {
      if (!id) return
      try {
        const res = await fetch(`/api/likes/user/${id}`)
        if (res.ok) {
          const data = await res.json()
          setLikedTracks(data)
        }
      } catch (err) {
        console.error('Failed to load liked tracks:', err)
      }
    }
    loadLikedTracks()
  }, [id])

  useEffect(() => {
    async function loadLikedAlbums() {
      if (!id) return
      try {
        const res = await fetch(`/api/likes/albums/user/${id}`)
        if (res.ok) {
          const data = await res.json()
          setLikedAlbums(data)
        }
      } catch (err) {
        console.error('Failed to load liked albums:', err)
      }
    }
    loadLikedAlbums()
  }, [id])

  useEffect(() => {
    async function loadFavoriteArtists() {
      if (!id) return
      try {
        const res = await fetch(`/api/user/${id}/following`)
        if (res.ok) {
          const data = await res.json()
          setFavoriteArtists(data.filter((u: any) => u.role === 'artist'))
        }
      } catch (err) {
        console.error('Failed to load favorite artists:', err)
      }
    }
    loadFavoriteArtists()
  }, [id])

  useEffect(() => {
    async function loadLikedStatus() {
      if (!accessToken || likedTracks.length === 0) return

      try {
        const likedIds = new Set<number>()
        for (const track of likedTracks) {
          const res = await fetch(`/api/likes/check/${track.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
          if (res.ok) {
            const data = await res.json()
            if (data.liked) {
              likedIds.add(track.id)
            }
          }
        }
        setLikedTrackIds(likedIds)
      } catch (err) {
        console.error('Failed to load liked status:', err)
      }
    }
    loadLikedStatus()
  }, [likedTracks, accessToken])

  const handleToggleLike = async (trackId: number) => {
    if (!accessToken) return

    try {
      const res = await fetch(`/api/likes/${trackId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      })

      if (res.ok) {
        const data = await res.json()
        setLikedTrackIds(prev => {
          const newSet = new Set(prev)
          if (data.liked) {
            newSet.add(trackId)
          } else {
            newSet.delete(trackId)
          }
          return newSet
        })
      }
    } catch (err) {
      console.error('Failed to toggle like:', err)
    }
  }

  const handleFollow = async () => {
    if (!accessToken || !id) return
    setSubmitting(true)
    
    try {
      if (isFollowing) {
        await fetch('/api/following/unfollow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ userId: Number(id) })
        })
        setIsFollowing(false)
      } else {
        await fetch('/api/following/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ userId: Number(id) })
        })
        setIsFollowing(true)
      }
    } catch (err) {
      console.error('Follow error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddFriend = async () => {
    if (!accessToken || !id) return
    setSubmitting(true)
    
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userId: parseInt(id, 10) })
      })
      if (res.ok) {
        setRequestSent(true)
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
      console.error('Add friend error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveFriend = async () => {
    if (!accessToken || !id) return
    setSubmitting(true)
    
    try {
      const res = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userId: parseInt(id, 10) })
      })
      if (res.ok) {
        setIsFriend(false)
        setShowRemoveDialog(false)
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: 'Пользователь удален из друзей', type: 'success' }
        }))
      }
    } catch (err) {
      console.error('Remove friend error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const palette = useMemo(() => {
    if (!profileUser) return colorPalettes[0]
    return getColorPalette(profileUser)
  }, [profileUser])
  const [primary, secondary, tertiary] = palette

  const unlockedCount = userAchievements.filter(a => a.unlocked).length
  
  const achievementColors: Record<string, string> = {
    '🎵': '#ec4899',
    '🎧': '#3b82f6',
    '📋': '#22c55e',
    '👥': '#8b5cf6',
    '🔍': '#06b6d4',
    '❤️': '#ef4444',
    '👑': '#fbbf24',
    '📚': '#f59e0b',
    '⏰': '#6366f1',
    '🤝': '#f97316',
    '🎤': '#10b981',
    '🏆': '#fbbf24',
  }

  const getAchievementColor = (icon: string) => achievementColors[icon] || '#94a3b8'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  if (!profileUser) {
    return (
      <div className="text-center py-20 text-white/40">
        <UserX className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <p>Пользователь не найден</p>
      </div>
    )
  }

  if (!isProfilePublic && !isOwnProfile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto">
            <Shield className="w-10 h-10 text-white/30" />
          </div>
          <h2 className="text-xl font-bold text-white">Доступ ограничен</h2>
          <p className="text-white/40 max-w-md mx-auto">
            Этот пользователь ограничил доступ к своей публичной странице.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="relative">
        <div
          className="h-40 rounded-2xl relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${bannerColors[0]}40, ${bannerColors[1]}40, ${bannerColors[2]}40)`,
          }}
        >
          <div className="absolute inset-0 opacity-30" style={{
            background: `radial-gradient(circle at 20% 80%, ${bannerColors[0]}60 0%, transparent 50%),
                        radial-gradient(circle at 80% 20%, ${bannerColors[1]}60 0%, transparent 50%),
                        radial-gradient(circle at 40% 40%, ${bannerColors[2]}40 0%, transparent 40%)`,
          }} />
        </div>
        
        <div className="absolute -bottom-12 left-6 flex items-end gap-4">
          <div className="relative">
            <img loading="lazy"
              src={profileUser.avatar_url ? `${profileUser.avatar_url}` : '/default-avatar.svg'}
              alt={profileUser.username}
              className="w-24 h-24 rounded-full object-cover border-4 border-black"
            />
            <OnlineStatus
              isOnline={onlineStatus[profileUser.id]}
              size="lg"
              className="absolute bottom-1 right-1"
            />
          </div>
        </div>
      </div>

      <div className="pt-8 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">@{profileUser.username}</h1>
              {profileUser.is_verified && (
                <span className="text-blue-400" style={{ color: accentColor }}>✓</span>
              )}
              {profileUser.is_premium && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}, ${bannerColors[1]})`,
                  }}
                >
                  Plus / Fan
                </span>
              )}
            </div>
            {profileUser.bio && (
              <p className="text-white/60 mt-1">{profileUser.bio}</p>
            )}
          </div>
          
          {!isOwnProfile && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleFollow}
                disabled={submitting}
                className={`flex flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2 transition disabled:opacity-50 ${
                  isFollowing 
                    ? 'bg-white/5 text-white hover:bg-white/10' 
                    : 'bg-purple-500 hover:bg-purple-600 text-white'
                }`}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="w-4 h-4" />
                    Подписан
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Подписаться
                  </>
                )}
              </button>
              
              <button
                onClick={isFriend ? () => setShowRemoveDialog(true) : handleAddFriend}
                disabled={submitting || requestSent}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition disabled:opacity-50 ${
                  isFriend
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : requestSent
                    ? 'bg-yellow-500/20 text-yellow-400 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isFriend ? (
                  <>
                    <UserCheck className="h-4 w-4" />
                    <span className="max-[414px]:hidden">В друзьях</span>
                  </>
                ) : requestSent ? (
                  <>
                    <Clock className="h-4 w-4" />
                    <span className="max-[414px]:hidden">Запрос отправлен</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span className="max-[414px]:hidden">Добавить в друзья</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {profilePresence?.listeningTo && (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(34,197,94,0.12),rgba(59,130,246,0.08),rgba(168,85,247,0.12))] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                <Radio className="h-3.5 w-3.5" />
                Сейчас слушает
              </div>
              <PlayCircle className="h-4 w-4 text-white/30" />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10">
                {profilePresence.listeningTo.track.cover_url ? (
                  <img loading="lazy" src={profilePresence.listeningTo.track.cover_url} alt={profilePresence.listeningTo.track.title} className="h-full w-full object-cover" />
                ) : (
                  <Music className="h-7 w-7 text-white/40" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-white">{profilePresence.listeningTo.track.title}</p>
                <p className="truncate text-sm text-white/60">{profilePresence.listeningTo.track.artist?.username || 'Артист'}</p>
                {profilePresence.listeningTo.context?.title && (
                  <p className="mt-1 truncate text-xs text-white/35">
                    {profilePresence.listeningTo.context.type === 'album' ? 'Из альбома' : 'Из плейлиста'}: {profilePresence.listeningTo.context.title}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-6 text-sm">
          <Link to={`/user/${id}/followers`} className="hover:underline">
            <span className="font-bold">{stats.followers}</span>
            <span className="text-white/40 ml-1">подписчиков</span>
          </Link>
          <Link to={`/user/${id}/following`} className="hover:underline">
            <span className="font-bold">{stats.following}</span>
            <span className="text-white/40 ml-1">подписок</span>
          </Link>
          <span>
            <span className="font-bold">{stats.plays.toLocaleString()}</span>
            <span className="text-white/40 ml-1">прослушиваний</span>
          </span>
        </div>
      </div>

      <section className="mb-6">
        {profileUser?.show_achievements !== false && userAchievements.filter((a: any) => a.in_showcase).length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5" style={{ color: accentColor }} />
                <span className="text-lg font-medium">Достижения</span>
              </div>
            </div>
            {isLoadingAchievements ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {userAchievements.filter((a: any) => a.in_showcase).slice(0, 6).map((achievement: any, idx: number) => {
                  const color = getAchievementColor(achievement.icon)
                  return (
                    <motion.div
                      key={achievement.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-4 rounded-2xl text-center transition-all duration-300 hover:scale-105"
                      style={{ 
                        background: `linear-gradient(135deg, ${color}12, ${color}06)`,
                        border: `1px solid ${color}20`,
                        boxShadow: `0 4px 20px ${color}10`
                      }}
                    >
                      <motion.div 
                        className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                        style={{ 
                          background: `linear-gradient(135deg, ${color}30, ${color}15)`,
                          boxShadow: `0 4px 15px ${color}30`
                        }}
                      >
                        <Award className="w-6 h-6" style={{ color }} />
                      </motion.div>
                      <p className="text-sm font-medium mb-1">{achievement.title}</p>
                      <p className="text-xs text-white/50">{achievement.unlock_percentage || 0}% получили</p>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </>
        )}
        {profileUser?.show_achievements === false && !isOwnProfile && (
          <div className="text-center py-8 text-white/40">
            <Award className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Достижения скрыты</p>
          </div>
        )}
      </section>

      {profileUser?.show_playlists !== false && playlists.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Плейлисты</h2>
            <span className="text-sm text-white/40">{playlists.length} плейлист{playlists.length === 1 ? '' : playlists.length < 5 ? 'а' : 'ов'}</span>
          </div>
          <div className="overflow-x-auto scrollbar-hide -mx-6 px-6">
            <div className="flex gap-4 pb-2">
              {playlists.map((playlist, index) => (
                <motion.div
                  key={playlist.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex-shrink-0 w-40"
                >
                  <Link to={`/playlist/${playlist.id}`}>
                    <div className="group relative rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/20 transition overflow-hidden">
                      <div className="aspect-square relative overflow-hidden">
                        {playlist.cover_url ? (
                          <img loading="lazy"
                            src={playlist.cover_url}
                            alt={playlist.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{
                              background: `linear-gradient(135deg, ${bannerColors[0]}40, ${bannerColors[1]}30, ${bannerColors[2]}20)`,
                            }}
                          >
                            <Music className="w-10 h-10 text-white/30 group-hover:text-white/50 transition" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="p-3">
                        <p className="font-medium text-sm truncate">{playlist.title}</p>
                        <p className="text-xs text-white/40">
                          {playlist.track_count ?? 0} трек{playlist.track_count === 1 ? '' : (playlist.track_count ?? 0) < 5 ? 'а' : 'ов'}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {profileUser?.show_playlists === false && !isOwnProfile && playlists.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-medium mb-4">Плейлисты</h2>
          <div className="text-center py-12 text-white/40">
            <Music className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Плейлисты скрыты</p>
          </div>
        </section>
      )}

      {profileUser?.show_favorite_albums !== false && likedAlbums.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Любимые альбомы</h2>
            <span className="text-sm text-white/40">{likedAlbums.length} альбом{likedAlbums.length === 1 ? '' : likedAlbums.length < 5 ? 'а' : 'ов'}</span>
          </div>
          <div className="overflow-x-auto scrollbar-hide -mx-6 px-6">
            <div className="flex gap-4 pb-2">
              {likedAlbums.map((album: any, index: number) => (
                <motion.div
                  key={album.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex-shrink-0 w-40"
                >
                  <Link to={`/album/${album.id}`}>
                    <div className="group relative rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/20 transition overflow-hidden">
                      <div className="aspect-square relative overflow-hidden">
                        {album.cover_url ? (
                          <img loading="lazy"
                            src={album.cover_url}
                            alt={album.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{
                              background: `linear-gradient(135deg, ${bannerColors[0]}40, ${bannerColors[1]}30, ${bannerColors[2]}20)`,
                            }}
                          >
                            <Disc className="w-10 h-10 text-white/30 group-hover:text-white/50 transition" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="p-3">
                        <p className="font-medium text-sm truncate">{album.title}</p>
                        <p className="text-xs text-white/40">{album.artist?.username}</p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {profileUser?.show_favorite_artists !== false && favoriteArtists.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Любимые артисты</h2>
            <span className="text-sm text-white/40">{favoriteArtists.length} артист{favoriteArtists.length === 1 ? '' : favoriteArtists.length < 5 ? 'а' : 'ов'}</span>
          </div>
          <div className="overflow-x-auto scrollbar-hide -mx-6 px-6">
            <div className="flex gap-4 pb-2">
              {favoriteArtists.map((artist: any, index: number) => (
                <motion.div
                  key={artist.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex-shrink-0 w-40"
                >
                  <Link to={`/artist/${artist.id}`}>
                    <div className="group relative rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/20 transition overflow-hidden">
                      <div className="aspect-square relative overflow-hidden">
                        {artist.avatar_url ? (
                          <img loading="lazy"
                            src={`${artist.avatar_url}`}
                            alt={artist.username}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{
                              background: `linear-gradient(135deg, ${bannerColors[0]}40, ${bannerColors[1]}30, ${bannerColors[2]}20)`,
                            }}
                          >
                            <UserCheck className="w-10 h-10 text-white/30 group-hover:text-white/50 transition" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="p-3">
                        <p className="font-medium text-sm truncate">{artist.username}</p>
                        <p className="text-xs text-white/40">Артист</p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {playlists.length === 0 && !loading && (
        <section className="mb-8">
          <h2 className="text-lg font-medium mb-4">Плейлисты</h2>
          <div className="text-center py-12 text-white/40">
            <Music className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>У этого пользователя пока нет плейлистов</p>
          </div>
        </section>
      )}

      {profileUser?.show_favorite_tracks !== false && likedTracks.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Избранное</h2>
            {likedTracks.length > 10 && (
              <Link to={`/user/${id}/liked`} className="text-sm text-white/40 hover:text-white transition">
                Показать все ({likedTracks.length})
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {likedTracks.slice(0, 10).map((track, index) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition group"
              >
                {track.cover_url ? (
                  <img loading="lazy"
                    src={track.cover_url.startsWith('http') ? track.cover_url : `${track.cover_url}`}
                    alt={track.title}
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${accentColor}33` }}
                  >
                    <Music className="w-4 h-4" style={{ color: accentColor }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{track.title}</p>
                  <p className="text-xs text-white/40">{track.artist?.username}</p>
                </div>
                <button
                  onClick={() => handleToggleLike(track.id)}
                  disabled={!accessToken}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-white/10 flex-shrink-0 disabled:cursor-not-allowed"
                >
                  <Heart className={`w-4 h-4 ${likedTrackIds.has(track.id) ? 'fill-white text-white' : 'text-white/60'}`} />
                </button>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {profileUser?.show_favorite_tracks === false && !isOwnProfile && likedTracks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-medium mb-4">Избранное</h2>
          <div className="text-center py-12 text-white/40">
            <Heart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Избранное скрыто</p>
          </div>
        </section>
      )}

      {showRemoveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-6 w-full max-w-sm mx-4"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Удалить из друзей?</h3>
                <p className="text-sm text-white/60">
                  @{profileUser?.username} будет удален из вашего списка друзей
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRemoveDialog(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleRemoveFriend}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Удалить'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
