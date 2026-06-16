import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ListMusic, Music, Disc, Mic, Heart, Plus, Play, Pause, Settings, Award, Loader2, Pin, X, GripVertical, Trophy } from 'lucide-react'
import { useTheme } from '../hooks/ThemeContext'
import { useAuth } from '../hooks/AuthContext'
import { usePlayer } from '../hooks/PlayerContext'
import { getStoredTokens } from '../api/auth'
import { achievementsApi } from '../api/achievements'
import { extractColorsFromImage } from '../utils/colorExtractor'
import { ExplicitBadge } from '../components/ExplicitBadge'

const RARITY_COLORS = {
  common: '#94a3b8',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#fbbf24',
}

function getRarityColor(rarity: string) {
  return RARITY_COLORS[rarity as keyof typeof RARITY_COLORS] || RARITY_COLORS.common
}

export default function ProfilePage() {
  const { user } = useAuth()
  const { getPalette } = useTheme()
  const player = usePlayer()
  const navigate = useNavigate()

  const username = user?.username || 'Пользователь'
  const canCustomizeProfile = Boolean(user?.is_premium)
  const palette = getPalette(username)
  const [primary, secondary, tertiary] = palette
  const [bannerColors, setBannerColors] = useState<string[]>([primary, secondary, tertiary])
  const [accentColor, setAccentColor] = useState<string>(primary)

  const [likedTracks, setLikedTracks] = useState<any[]>([])
  const [favoriteArtists, setFavoriteArtists] = useState<any[]>([])
  const [playlists, setPlaylists] = useState<any[]>([])
  const [likedPlaylists, setLikedPlaylists] = useState<any[]>([])
  const [likedAlbums, setLikedAlbums] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showcase, setShowcase] = useState<any[]>([])
  const [userAchievements, setUserAchievements] = useState<any[]>([])
  const [showcaseEdit, setShowcaseEdit] = useState(false)

  // Set colors based on palette mode
  useEffect(() => {
    console.log('ProfilePage user data:', {
      palette_mode: user?.palette_mode,
      palette_primary: user?.palette_primary,
      palette_secondary: user?.palette_secondary,
      palette_tertiary: user?.palette_tertiary,
      palette_accent: user?.palette_accent
    })

    const paletteMode = user?.palette_mode || 'auto'

    if (paletteMode === 'custom' && user?.palette_primary && user?.palette_secondary && user?.palette_tertiary) {
      // Use custom colors
      console.log('Using custom colors')
      setBannerColors([user.palette_primary, user.palette_secondary, user.palette_tertiary])
      setAccentColor(user.palette_accent || user.palette_primary)
    } else if (user?.avatar_url) {
      // Auto mode: extract from avatar for banner, white for accents
      console.log('Using auto mode - extracting from avatar')
      const avatarUrl = `${user.avatar_url}`
      extractColorsFromImage(avatarUrl).then(colors => {
        setBannerColors(colors)
        setAccentColor('#FFFFFF')
      }).catch(() => {
        setBannerColors([primary, secondary, tertiary])
        setAccentColor('#FFFFFF')
      })
    } else {
      console.log('Using default colors')
      setBannerColors([primary, secondary, tertiary])
      setAccentColor('#FFFFFF')
    }
  }, [user?.avatar_url, user?.palette_mode, user?.palette_primary, user?.palette_secondary, user?.palette_tertiary, user?.palette_accent, primary, secondary, tertiary])

  useEffect(() => {
    async function fetchData() {
      const tokens = getStoredTokens()
      console.log('Tokens:', tokens)
      if (!tokens) {
        console.log('No tokens, setting loading false')
        setLoading(false)
        return
      }
      try {
        const [likesRes, favoriteArtistsRes, playlistsRes, likedPlaylistsRes, likedAlbumsRes, showcaseRes, achievementsRes] = await Promise.all([
          fetch('/api/likes', { headers: { Authorization: `Bearer ${tokens.accessToken}` } }),
          fetch('/api/user/me/favorite-artists', { headers: { Authorization: `Bearer ${tokens.accessToken}` } }),
          fetch('/api/playlists', { headers: { Authorization: `Bearer ${tokens.accessToken}` } }),
          fetch('/api/playlists/liked/all', { headers: { Authorization: `Bearer ${tokens.accessToken}` } }),
          fetch('/api/likes/albums', { headers: { Authorization: `Bearer ${tokens.accessToken}` } }),
          fetch('/api/achievements/showcase', { headers: { Authorization: `Bearer ${tokens.accessToken}` } }),
          fetch('/api/achievements', { headers: { Authorization: `Bearer ${tokens.accessToken}` } })
        ])
        
        const likesData = await likesRes.json()
        const favoriteArtistsData = favoriteArtistsRes.ok ? await favoriteArtistsRes.json() : []
        const playlistsData = playlistsRes.ok ? await playlistsRes.json() : []
        const likedPlaylistsData = likedPlaylistsRes.ok ? await likedPlaylistsRes.json() : []
        const likedAlbumsData = likedAlbumsRes.ok ? await likedAlbumsRes.json() : []
        const showcaseData = showcaseRes.ok ? await showcaseRes.json() : []
        const achievementsData = achievementsRes.ok ? await achievementsRes.json() : []
        
        setLikedTracks(Array.isArray(likesData) ? likesData : [])
        setFavoriteArtists(Array.isArray(favoriteArtistsData) ? favoriteArtistsData : [])
        setPlaylists(Array.isArray(playlistsData) ? playlistsData.filter((playlist: any) => !playlist.is_system) : [])
        setLikedPlaylists(Array.isArray(likedPlaylistsData) ? likedPlaylistsData : [])
        setLikedAlbums(Array.isArray(likedAlbumsData) ? likedAlbumsData : [])
        setShowcase(showcaseData)
        setUserAchievements(achievementsData)
      } catch (err) {
        console.error('Failed to load profile data:', err)
        setShowcase([])
        setUserAchievements([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const toggleLike = async (trackId: number) => {
    const tokens = getStoredTokens()
    if (!tokens) return

    try {
      const res = await fetch(`/api/likes/${trackId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      })
      const data = await res.json()

      // Если лайк был удален, убираем трек из списка
      if (!data.liked) {
        setLikedTracks(prev => prev.filter(t => t.track_id !== trackId))
      }
    } catch (err) {
      console.error('Failed to toggle like:', err)
    }
  }

  const isLiked = (trackId: number) => likedTracks.some(t => t.track_id === trackId)

  const handleCreatePlaylist = async () => {
    setCreating(true)
    const tokens = getStoredTokens()
    if (!tokens) return

    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`
        },
        body: JSON.stringify({ title: 'Новый плейлист' })
      })
      if (res.ok) {
        const data = await res.json()
        setPlaylists([data, ...playlists].filter((playlist: any) => !playlist.is_system))
        if (data.unlockedAchievements && data.unlockedAchievements.length > 0) {
          window.dispatchEvent(new CustomEvent('show-achievement', {
            detail: { achievements: data.unlockedAchievements }
          }))
        }
        navigate(`/playlist/${data.id}`)
      }
    } catch (err) {
      console.error('Failed to create playlist:', err)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-[414px]:space-y-6">
      <div className="relative">
        <div
          className="relative h-40 overflow-hidden rounded-2xl max-[414px]:h-36"
          style={{
            background: `linear-gradient(135deg, ${bannerColors[0]}40, ${bannerColors[1]}40, ${bannerColors[2]}40)`,
          }}
        >
          <div className="absolute inset-0 opacity-30" style={{
            background: `radial-gradient(circle at 20% 80%, ${bannerColors[0]}60 0%, transparent 50%), radial-gradient(circle at 80% 20%, ${bannerColors[1]}60 0%, transparent 50%), radial-gradient(circle at 40% 40%, ${bannerColors[2]}40 0%, transparent 40%)`
          }} />
        </div>
        
        <div className="absolute -bottom-12 left-6 flex items-end gap-4 max-[414px]:left-4 max-[414px]:-bottom-10">
          <img loading="lazy"
            src={user?.avatar_url ? `${user.avatar_url}` : '/default-avatar.svg'}
            alt={username}
            className="h-24 w-24 rounded-full border-4 border-black object-cover max-[414px]:h-20 max-[414px]:w-20"
          />
        </div>

        <div className="absolute -bottom-10 right-0 flex gap-2 max-[414px]:right-4 max-[414px]:-bottom-8">
          <Link to="/settings?section=account" className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 transition duration-200 hover:border-white/10 hover:bg-white/[0.06] max-[414px]:p-2.5">
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </div>

      <div className="space-y-4 pt-8 max-[414px]:pt-6">
        <div className="flex items-start justify-between max-[414px]:flex-col max-[414px]:gap-3">
          <div>
            <div className="flex items-center gap-2 max-[414px]:flex-wrap">
              <h1 className="text-2xl font-bold max-[414px]:text-xl">@{username}</h1>
              {user?.is_verified && (
                <span style={{ color: accentColor }}>✓</span>
              )}
              {user?.is_premium && (
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
            {user?.bio && (
              <p className="mt-1 text-white/60 max-[414px]:text-sm">{user.bio}</p>
            )}
          </div>
        </div>
      </div>

      {(userAchievements.length > 0 || showcaseEdit) && (
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-3 max-[414px]:items-start">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5" style={{ color: accentColor }} />
              <span className="text-lg font-medium text-white max-[414px]:text-base">Витрина достижений</span>
            </div>
            {canCustomizeProfile ? (
              <button 
                onClick={() => setShowcaseEdit(!showcaseEdit)}
                className="text-sm px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition"
              >
                {showcaseEdit ? 'Готово' : 'Редактировать'}
              </button>
            ) : (
              <Link
                to="/premium"
                className="text-sm px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 transition"
              >
                В Plus и Fan
              </Link>
            )}
          </div>
          {!showcaseEdit && userAchievements.filter((a: any) => a.unlocked).length === 0 && (
            <p className="text-white/40 text-sm mb-4">У вас пока нет разблокированных достижений. Продолжайте слушать музыку!</p>
          )}
          <div className="grid grid-cols-2 gap-3 max-[414px]:gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {userAchievements.filter((a: any) => a.unlocked).slice(0, 6).map((achievement: any, idx: number) => {
              const showcaseIds = showcase.map((s: any) => s.achievement_id)
              const isSelected = showcaseIds.includes(achievement.id)
              const rarityColor = getRarityColor(achievement.rarity || 'common')
              const isLegendary = achievement.rarity === 'legendary'

              const handleToggle = async () => {
                if (!showcaseEdit) return
                const tokens = getStoredTokens()
                if (!tokens) return

                let newShowcase: number[]
                if (isSelected) {
                  newShowcase = showcaseIds.filter((id: number) => id !== achievement.id)
                } else {
                  newShowcase = [...showcaseIds, achievement.id]
                }

                try {
                  await achievementsApi.updateShowcase(tokens.accessToken, newShowcase)
                  setShowcase(newShowcase.map((id: number) => ({ achievement_id: id })))
                } catch (err) {
                  console.error('Failed to save showcase:', err)
                }
              }

              return (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={canCustomizeProfile ? handleToggle : undefined}
                  className="p-4 rounded-2xl text-center transition-all duration-300 hover:scale-105 cursor-pointer relative overflow-hidden"
                  style={{
                    background: isSelected
                      ? `linear-gradient(135deg, ${rarityColor}20, ${rarityColor}10)`
                      : `linear-gradient(135deg, ${rarityColor}08, ${rarityColor}03)`,
                    border: `1px solid ${isSelected ? rarityColor + '60' : rarityColor + '20'}`,
                    boxShadow: isSelected
                      ? isLegendary
                        ? `0 0 25px ${rarityColor}40, 0 4px 20px ${rarityColor}20`
                        : `0 4px 20px ${rarityColor}20`
                      : 'none'
                  }}
                >
                  {/* Animated background for legendary */}
                  {isLegendary && isSelected && (
                    <motion.div
                      className="absolute inset-0 opacity-20"
                      style={{
                        background: `radial-gradient(circle at 50% 50%, ${rarityColor}50, transparent 70%)`,
                      }}
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.2, 0.3, 0.2],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  )}

                  <motion.div
                    className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center relative z-10"
                    style={{
                      background: `linear-gradient(135deg, ${rarityColor}40, ${rarityColor}20)`,
                      boxShadow: isLegendary && isSelected
                        ? `0 0 20px ${rarityColor}50, 0 4px 15px ${rarityColor}30`
                        : `0 4px 15px ${rarityColor}30`
                    }}
                  >
                    {isLegendary && isSelected && (
                      <motion.div
                        className="absolute inset-0 rounded-2xl"
                        style={{
                          background: `linear-gradient(135deg, ${rarityColor}50, transparent)`,
                        }}
                        animate={{
                          rotate: [0, 360],
                        }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          ease: "linear"
                        }}
                      />
                    )}
                    <Award className="w-6 h-6 relative z-10" style={{ color: rarityColor }} />
                    {showcaseEdit && (
                      <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center z-20 ${isSelected ? 'bg-green-500' : 'bg-white/20'}`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    )}
                  </motion.div>
                  <p
                    className="text-sm font-medium mb-1 relative z-10"
                    style={{
                      color: isLegendary && isSelected ? rarityColor : 'white'
                    }}
                  >
                    {achievement.title}
                  </p>
                  <p className="text-xs text-white/50 relative z-10">{achievement.progress}%</p>
                </motion.div>
              )
            })}
          </div>
        </section>
      )}

      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-3 max-[414px]:items-start">
          <h2 className="text-lg font-medium text-white"><Link to="/profile/library/liked" className="hover:opacity-80 transition">Любимые треки</Link></h2>
          <Link to="/profile/library/liked" className="text-sm text-white/40 transition hover:text-white max-[414px]:text-xs">Смотреть все</Link>
        </div>
        {likedTracks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {likedTracks.slice(0, 6).map((track) => {
              const isCurrentTrack = player.currentTrack?.id === track.track_id
              const isPlaying = player.isPlaying && isCurrentTrack
              
              const handlePlay = () => {
                player.setTrack({
                  id: track.track_id,
                  title: track.title,
                  artist_id: track.artist_id,
                  artist: { id: track.artist_id, username: track.artist_name, email: '', role: 'artist', is_verified: false, is_premium: false, created_at: '' },
                  duration: track.duration || 0,
                  file_path: track.file_path || '',
                  cover_url: track.cover_url,
                  is_explicit: track.is_explicit,
                  is_premium: false,
                  status: 'approved',
                  created_at: ''
                }, true)
              }
              
              return (
                <div key={track.track_id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/10 transition duration-200 group">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden relative"
                    style={{ backgroundColor: `${accentColor}33` }}
                  >
                    {track.cover_url ? (
                      <img loading="lazy" src={track.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Music size={18} className="text-white/50" />
                    )}
                    <div 
                      onClick={handlePlay}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer"
                    >
                      {isPlaying ? (
                        <Pause size={16} className="text-white" />
                      ) : (
                        <Play size={16} className="text-white ml-0.5" />
                      )}
                    </div>
                    {isPlaying && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="flex items-end gap-0.5 h-4">
                          <div className="w-0.5 bg-white rounded-full animate-music-bar-1"></div>
                          <div className="w-0.5 bg-white rounded-full mx-0.5 animate-music-bar-2"></div>
                          <div className="w-0.5 bg-white rounded-full animate-music-bar-3"></div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/track/${track.track_id}`} className={`font-medium truncate text-sm block ${isCurrentTrack ? 'text-white' : 'group-hover:text-white'}`}><span className="inline-flex items-center gap-1">{track.title}<ExplicitBadge is_explicit={track.is_explicit} size="xs" /></span></Link>
                    <Link to={`/artist/${track.artist_id}`} className="text-xs text-white/40 truncate hover:text-white transition block">{track.artist_name}</Link>
                  </div>
                  <button 
                    onClick={() => toggleLike(track.track_id)}
                    className="p-1 hover:scale-110 transition"
                  >
                    <Heart className={`w-4 h-4 ${isLiked(track.track_id) ? 'fill-white text-white' : 'text-white/30 group-hover:text-white'}`} />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-white/40">
            <Heart className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>У вас пока нет любимых треков</p>
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-3 max-[414px]:items-start">
          <h2 className="text-lg font-medium text-white"><Link to="/profile/library/liked-playlists" className="hover:opacity-80 transition">Понравившиеся плейлисты</Link></h2>
          <Link to="/profile/library/liked-playlists" className="text-sm text-white/40 transition hover:text-white max-[414px]:text-xs">Смотреть все</Link>
        </div>
        {likedPlaylists.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 max-[414px]:gap-2.5 sm:grid-cols-3 md:grid-cols-5">
            {likedPlaylists.slice(0, 5).map((playlist) => (
              <Link key={playlist.id} to={`/playlist/${playlist.id}`} className="group">
                <div className="aspect-square rounded-xl bg-white/[0.02] border border-white/[0.05] group-hover:border-white/10 transition overflow-hidden relative">
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
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="font-medium text-sm truncate text-white drop-shadow-lg">{playlist.title}</p>
                    <p className="text-xs text-white/60 truncate">@{playlist.owner_name}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-white/40">
            <ListMusic className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>У вас пока нет понравившихся плейлистов</p>
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-3 max-[414px]:items-start">
          <h2 className="text-lg font-medium text-white"><Link to="/profile/library/playlists" className="hover:opacity-80 transition">Мои плейлисты</Link></h2>
          <Link to="/profile/library/playlists" className="text-sm text-white/40 transition hover:text-white max-[414px]:text-xs">Смотреть все</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 max-[414px]:gap-2.5 sm:grid-cols-3 md:grid-cols-5">
          <button
            onClick={handleCreatePlaylist}
            disabled={creating}
            className="aspect-square rounded-xl border border-dashed border-white/20 hover:border-white/40 transition flex flex-col items-center justify-center gap-2"
          >
            <Plus className="w-8 h-8 text-white/40" />
            <span className="text-sm text-white/40">Создать</span>
          </button>
          {playlists.slice(0, 4).map((playlist) => (
            <Link key={playlist.id} to={`/playlist/${playlist.id}`} className="group">
              <div className="aspect-square rounded-xl bg-white/[0.02] border border-white/[0.05] group-hover:border-white/10 transition overflow-hidden relative">
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
                {playlist.is_pinned && (
                  <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-yellow-500/80 backdrop-blur-sm">
                    <Pin className="w-3 h-3 text-white" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="font-medium text-sm truncate text-white drop-shadow-lg">{playlist.title}</p>
                </div>
              </div>
            </Link>
          ))}
          {playlists.length === 0 && (
            <p className="col-span-4 text-center text-white/40 text-sm py-4">У вас пока нет плейлистов</p>
          )}
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">Любимые артисты</h2>
        </div>
        {favoriteArtists.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 max-[414px]:gap-2.5 sm:grid-cols-3 md:grid-cols-5">
            {favoriteArtists.slice(0, 5).map((artist) => (
              <Link key={artist.id} to={`/artist/${artist.id}`} className="group">
                <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 transition group-hover:border-white/10 group-hover:bg-white/[0.04]">
                  <div className="mb-3 aspect-square overflow-hidden rounded-xl bg-white/[0.03]">
                    {artist.avatar_url ? (
                      <img loading="lazy"
                        src={artist.avatar_url}
                        alt={artist.stage_name || artist.username}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Mic className="h-8 w-8 text-white/30" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="truncate font-medium text-white">
                      {artist.stage_name || artist.username}
                    </div>
                    {artist.genre && (
                      <div className="truncate text-sm text-white/40">{artist.genre}</div>
                    )}
                    <div className="text-xs text-white/30">
                      {Math.round((Number(artist.listened_seconds) || 0) / 60)} мин прослушивания
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-white/40">
            <Mic className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>У вас пока нет любимых артистов</p>
            <p className="text-xs mt-2 text-white/30">Они появятся здесь, когда вы прослушаете треки одного артиста суммарно не менее 2 часов.</p>
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-white"><Link to="/profile/library/albums" className="hover:opacity-80 transition">Любимые альбомы</Link></h2>
          <Link to="/profile/library/albums" className="text-sm text-white/40 transition hover:text-white max-[414px]:text-xs">Смотреть все</Link>
        </div>
        {likedAlbums.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 max-[414px]:gap-2.5 sm:grid-cols-3 md:grid-cols-5">
            {likedAlbums.slice(0, 5).map((album) => (
              <Link key={album.album_id} to={`/album/${album.album_id}`} className="group">
                <div className="aspect-square rounded-xl bg-white/[0.02] border border-white/[0.05] group-hover:border-white/10 transition overflow-hidden relative">
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
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="font-medium text-sm truncate text-white drop-shadow-lg">{album.title}</p>
                    <p className="text-xs text-white/60 truncate">@{album.artist_name}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-white/40">
            <Disc className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>У вас пока нет любимых альбомов</p>
          </div>
        )}
      </section>
    </div>
  )
}
