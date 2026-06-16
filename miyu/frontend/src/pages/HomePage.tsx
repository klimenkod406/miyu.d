import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Music, Play, Guitar, Mic2, Piano, Headphones, Gauge, Disc, Loader2, Sparkles, Zap, TrendingUp, Calendar, Users, Radio, Waves, ListMusic, Heart, History, Star, AlertCircle, Crown, Sunrise, Flame, Ticket } from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'
import { usePlayer } from '../hooks/PlayerContext'
import PaymentSuccessModal from '../components/PaymentSuccessModal'
import AudioVisualizer from '../components/AudioVisualizer'
import type { Track, User } from '../types'
import { getStoredTokens } from '../api/auth'
import { recsysApi, type PersonalizedHomeArtist, type PersonalizedHomePlaylist } from '../api/recsys'
import { ExplicitBadge } from '../components/ExplicitBadge'

const genreIcons: Record<string, typeof Guitar> = {
  'Рок': Guitar,
  'Поп': Mic2,
  'Электроника': Piano,
  'Хип-хоп': Headphones,
  'Джаз': Gauge,
  'Классика': Music,
}

function formatDuration(seconds: number) {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function TrackCard({ track, tracks, canNavigate }: { track: Track; tracks: Track[]; canNavigate: boolean }) {
  const player = usePlayer()
  const isCurrentTrack = player.currentTrack?.id === track.id
  const isPlaying = player.isPlaying && isCurrentTrack

  const handlePlay = () => {
    player.setTrack(track)
    player.setQueue(tracks)
    player.play()
  }

  const coverPath = track.cover_url || track.album?.cover_url
  const coverUrl = coverPath ? coverPath : undefined

  return (
    <div
      onClick={handlePlay}
      className="group relative cursor-pointer"
    >
      <div className="aspect-square rounded-xl mb-3 overflow-hidden relative bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition duration-200">
        {coverUrl ? (
          <img loading="lazy" src={coverUrl} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Music className="w-16 h-16 text-white/20" />
          </div>
        )}
        {isPlaying && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="flex items-end gap-0.5 h-8">
              <div className="w-1 bg-white rounded-full animate-music-bar-1"></div>
              <div className="w-1 bg-white rounded-full mx-0.5 animate-music-bar-2"></div>
              <div className="w-1 bg-white rounded-full animate-music-bar-3"></div>
            </div>
          </div>
        )}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent ${!isCurrentTrack ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} transition-all duration-300 flex items-center justify-center`}>
          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-full flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform">
            {isPlaying ? (
              <div className="flex items-end gap-0.5 h-6">
                <div className="w-1 bg-white rounded-full animate-music-bar-1"></div>
                <div className="w-1 bg-white rounded-full mx-0.5 animate-music-bar-2"></div>
                <div className="w-1 bg-white rounded-full animate-music-bar-3"></div>
              </div>
            ) : (
              <Play className="w-6 h-6 text-white ml-1" />
            )}
          </div>
        </div>
      </div>
      {canNavigate ? (
        <Link
          to={`/track/${track.id}`}
          onClick={(e) => e.stopPropagation()}
          className="block"
        >
          <h3 className={`font-medium text-sm truncate transition-colors ${isCurrentTrack ? 'text-white' : 'group-hover:text-purple-400'}`}>
            <span className="inline-flex items-center gap-1">{track.title}<ExplicitBadge is_explicit={track.is_explicit} size="xs" /></span>
          </h3>
        </Link>
      ) : (
        <h3 className={`font-medium text-sm truncate transition-colors ${isCurrentTrack ? 'text-white' : 'group-hover:text-purple-400'}`}>
          <span className="inline-flex items-center gap-1">{track.title}<ExplicitBadge is_explicit={track.is_explicit} size="xs" /></span>
        </h3>
      )}
      <p className="text-sm text-white/40 truncate">{track.artist?.username}</p>
    </div>
  )
}


function GenreCard({ genre, onClick }: { genre: { name: string; color: string }; onClick: (genreName: string) => void }) {
  const IconComp = genreIcons[genre.name] || Disc
  return (
    <button
      type="button"
      onClick={() => onClick(genre.name)}
      className="group relative h-36 w-full overflow-hidden rounded-2xl border border-white/[0.05] text-left transition-all duration-300"
    >
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${genre.color} opacity-90 group-hover:opacity-100 transition-opacity duration-300`} />

      {/* Animated reverse gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-tr ${genre.color} opacity-0 group-hover:opacity-50 transition-opacity duration-500`} />

      {/* Dot pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJub25lIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-40" />

      {/* Shine effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>

      {/* Decorative icon in corner — large and faded */}
      <IconComp className="absolute -bottom-3 -right-3 w-24 h-24 text-white/10 group-hover:text-white/20 group-hover:rotate-12 transition-all duration-500" />

      <div className="relative h-full p-4 flex flex-col justify-between">
        <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg">
          <IconComp className="w-5 h-5 text-white drop-shadow-lg" />
        </div>
        <div>
          <p className="font-bold text-lg text-white drop-shadow-lg group-hover:translate-x-1 transition-transform duration-300">
            {genre.name}
          </p>
        </div>
      </div>
    </button>
  )
}

const genreColors: Record<string, string> = {
  'Рок': 'from-red-500 via-rose-600 to-orange-700',
  'Поп': 'from-pink-500 via-fuchsia-500 to-purple-600',
  'Электроника': 'from-purple-500 via-violet-600 to-indigo-700',
  'Хип-хоп': 'from-orange-500 via-amber-600 to-red-700',
  'Джаз': 'from-blue-500 via-indigo-600 to-purple-700',
  'Классика': 'from-yellow-500 via-amber-500 to-orange-600',
  'Метал': 'from-slate-700 via-zinc-800 to-black',
  'Инди': 'from-teal-500 via-cyan-600 to-blue-700',
  'Кантри': 'from-amber-600 via-yellow-700 to-orange-800',
  'Рэгги': 'from-green-500 via-emerald-600 to-teal-700',
  'Блюз': 'from-blue-700 via-indigo-800 to-slate-900',
  'R&B': 'from-fuchsia-600 via-pink-700 to-rose-800',
}

function PromoBlock({ title, subtitle, gradient, icon: Icon }: {
  title: string
  subtitle: string
  gradient: string
  icon: typeof Sparkles
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl h-48 border border-white/[0.12] transition-all duration-300">
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-70 group-hover:opacity-85 transition-opacity duration-300`} />

      {/* Glass morph overlay — frosted blur like sidebars */}
      <div className="absolute inset-0 bg-white/[0.07] backdrop-blur-2xl backdrop-saturate-[1.8]" />

      {/* Animated gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-tr ${gradient} opacity-0 group-hover:opacity-30 transition-opacity duration-500`} />

      {/* Dot pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJub25lIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-30" />

      {/* Shine effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>

      <div className="absolute inset-0 p-6 flex flex-col justify-between">
        <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg">
          <Icon className="w-7 h-7 text-white drop-shadow-lg" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-lg group-hover:translate-x-1 transition-transform duration-300">{title}</h3>
          <p className="text-sm text-white/90 drop-shadow group-hover:translate-x-1 transition-transform duration-300 delay-75">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

function QuickAccessCard({
  to,
  title,
  subtitle,
  gradient,
  icon: Icon,
}: {
  to: string
  title: string
  subtitle: string
  gradient: string
  icon: typeof Sparkles
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.05] transition-all duration-300 hover:border-white/15"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90 transition-opacity duration-300 group-hover:opacity-100`} />
      <div className={`absolute inset-0 bg-gradient-to-tr ${gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-40`} />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJub25lIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-35" />
      <div className="relative flex min-h-[10rem] flex-col justify-between p-5 max-[414px]:min-h-[9rem] max-[414px]:p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:rotate-6">
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="mb-2 text-xl font-bold text-white drop-shadow-lg transition-transform duration-300 group-hover:translate-x-1">{title}</h3>
          <p className="text-sm text-white/85 transition-transform duration-300 delay-75 group-hover:translate-x-1">{subtitle}</p>
        </div>
      </div>
    </Link>
  )
}

type PopularArtist = Pick<User, 'id' | 'username' | 'avatar_url' | 'bio' | 'is_verified' | 'is_premium'> & {
  track_count?: number
  play_count?: number
}

function formatListenedTime(seconds?: number) {
  if (!seconds) return 'Новый акцент для вас'
  const hours = seconds / 3600
  if (hours >= 1) return `${hours.toFixed(1).replace('.0', '')} ч прослушивания`
  return `${Math.max(1, Math.round(seconds / 60))} мин прослушивания`
}

function PersonalizedArtistCard({ artist }: { artist: PersonalizedHomeArtist }) {
  return (
    <Link
      to={`/artist/${artist.id}`}
      className="group rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 transition duration-200 hover:border-white/10 hover:bg-white/[0.03]"
    >
      <div className="relative mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.03] shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition duration-300 group-hover:scale-[1.03] group-hover:border-white/15">
        {artist.avatar_url ? (
          <img loading="lazy" src={artist.avatar_url} alt={artist.username} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-500/40 via-amber-500/30 to-rose-500/30">
            <Music className="h-9 w-9 text-white/35" />
          </div>
        )}
      </div>

      <div className="space-y-2 text-center">
        <div>
          <h3 className="truncate text-sm font-semibold transition-colors group-hover:text-orange-300">{artist.username}</h3>
          <p className="mt-1 text-[11px] text-orange-200/80">{artist.reason}</p>
        </div>
        <p className="line-clamp-2 text-xs text-white/40">{artist.bio || artist.genre || 'Подходит под ваш текущий музыкальный вкус'}</p>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] text-white/55">
          <Flame className="h-3.5 w-3.5 text-orange-300" />
          {formatListenedTime(artist.listened_seconds)}
        </div>
      </div>
    </Link>
  )
}

function PersonalizedPlaylistCard({ playlist, accent = 'violet' }: { playlist: PersonalizedHomePlaylist; accent?: 'violet' | 'orange' }) {
  const titleClass = accent === 'orange' ? 'group-hover:text-orange-300' : 'group-hover:text-purple-300'

  return (
    <Link
      to={`/playlist/${playlist.id}`}
      className="group block rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 transition duration-200 hover:border-white/10 hover:bg-white/[0.03]"
    >
      <div className="mb-3 aspect-square overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]">
        {playlist.cover_url ? (
          <img loading="lazy" src={playlist.cover_url} alt={playlist.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-600/40 to-pink-500/30">
            <ListMusic className="h-10 w-10 text-white/35" />
          </div>
        )}
      </div>
      <h3 className={`truncate text-sm font-semibold transition-colors ${titleClass}`}>{playlist.title}</h3>
      <p className="mt-1 line-clamp-2 text-xs text-white/40">{playlist.description || 'Персональная подборка для вашего дня'}</p>
      <p className="mt-2 text-[11px] text-white/30">{playlist.track_count} треков</p>
    </Link>
  )
}

function PlaylistOfDayPromo({
  playlist,
}: {
  playlist: PersonalizedHomePlaylist
}) {
  const [timeUntilRefresh, setTimeUntilRefresh] = useState('24:00:00')

  useEffect(() => {
    const formatTime = (totalSeconds: number) => {
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60
      return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
    }

    const updateTimer = () => {
      const now = new Date()
      const nextRefresh = new Date(now)
      nextRefresh.setHours(24, 0, 0, 0)
      const diffSeconds = Math.max(0, Math.floor((nextRefresh.getTime() - now.getTime()) / 1000))
      setTimeUntilRefresh(formatTime(diffSeconds))
    }

    updateTimer()
    const intervalId = window.setInterval(updateTimer, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <section>
      <div className="group relative overflow-hidden rounded-3xl border border-orange-300/30 transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600 via-amber-500 to-orange-300 opacity-70 transition-opacity duration-300 group-hover:opacity-85" />
        {/* Glass morph overlay — frosted blur like sidebars */}
        <div className="absolute inset-0 bg-white/[0.07] backdrop-blur-2xl backdrop-saturate-[1.8]" />

        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-orange-700 via-orange-500 to-yellow-200 opacity-0 transition-opacity duration-500 group-hover:opacity-25" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJub25lIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMTIiLz4KPC9zdmc+')] opacity-35" />
        <div className="absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full transition-transform duration-1000 group-hover:translate-x-full" />
        </div>

        <div className="relative grid gap-6 p-6 md:grid-cols-[1.1fr_280px] md:items-center max-[414px]:p-4">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md max-[414px]:px-3 max-[414px]:py-1.5 max-[414px]:text-xs">
              <Sunrise className="h-4 w-4 text-orange-50" />
              Плейлист дня
            </div>
            <h2 className="mb-3 text-3xl font-bold text-white drop-shadow-lg max-[414px]:text-2xl">{playlist.title}</h2>
            <p className="max-w-2xl text-base text-white/90 max-[414px]:text-sm">
              {playlist.description || '50 треков, собранных специально для вас на сегодня.'}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/85">
              <span className="rounded-full bg-white/18 px-3 py-1.5 backdrop-blur-sm">Для вашего настроения</span>
              <span className="rounded-full bg-white/18 px-3 py-1.5 backdrop-blur-sm">Обновится через {timeUntilRefresh}</span>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to={`/playlist/${playlist.id}`}
                className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
              >
                Открыть плейлист
              </Link>
            </div>
          </div>

          <Link to={`/playlist/${playlist.id}`} className="mx-auto block w-full max-w-[280px]">
            <div className="overflow-hidden rounded-[2rem] border border-white/25 bg-white/[0.07] p-3 shadow-2xl backdrop-blur-2xl transition duration-300 group-hover:scale-[1.02]">
              <div className="aspect-square overflow-hidden rounded-[1.5rem] bg-white/10">
                {playlist.cover_url ? (
                  <img loading="lazy" src={playlist.cover_url} alt={playlist.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-500/70 to-amber-300/60">
                    <ListMusic className="h-14 w-14 text-white/60" />
                  </div>
                )}
              </div>
            </div>
          </Link>
        </div>
      </div>
    </section>
  )
}

function ArtistCard({ artist, canNavigate }: { artist: PopularArtist; canNavigate: boolean }) {
  const content = (
    <>
      <div className="relative mx-auto mb-4 h-28 w-28 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.03] shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition duration-300 group-hover:scale-[1.03] group-hover:border-white/15">
        {artist.avatar_url ? (
          <img loading="lazy" src={artist.avatar_url} alt={artist.username} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500/30 via-pink-500/20 to-cyan-500/20">
            <Music className="h-10 w-10 text-white/35" />
          </div>
        )}
      </div>

      <div className="space-y-1 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <h3 className="max-w-full truncate text-sm font-semibold transition-colors group-hover:text-purple-300">
            {artist.username}
          </h3>
        </div>
        {artist.bio ? (
          <p className="line-clamp-2 text-xs text-white/40">{artist.bio}</p>
        ) : (
          <p className="text-xs text-white/30">Артист Miyu</p>
        )}
      </div>
    </>
  )

  const className = 'group rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 transition duration-200 hover:border-white/10 hover:bg-white/[0.03]'

  if (!canNavigate) {
    return <div className={className}>{content}</div>
  }

  return (
    <Link to={`/artist/${artist.id}`} className={className}>
      {content}
    </Link>
  )
}

function ChartRow({
  track,
  tracks,
  index,
  canNavigate,
  isLiked,
  onToggleLike,
}: {
  track: Track
  tracks: Track[]
  index: number
  canNavigate: boolean
  isLiked: boolean
  onToggleLike: (trackId: number) => void
}) {
  const player = usePlayer()
  const isCurrentTrack = player.currentTrack?.id === track.id
  const isPlaying = player.isPlaying && isCurrentTrack
  const coverUrl = track.cover_url || track.album?.cover_url

  const handlePlay = () => {
    if (isCurrentTrack && isPlaying) {
      player.pause()
      return
    }

    if (isCurrentTrack) {
      player.play()
      return
    }

    player.setTrack(track)
    player.setQueue(tracks)
    player.play()
  }

  return (
    <div
      onClick={handlePlay}
      className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3 py-3 transition duration-200 hover:border-white/10 hover:bg-white/[0.04]"
    >
      <div className="flex w-8 shrink-0 flex-col items-center justify-center text-center">
        <span className={`text-sm font-semibold ${isCurrentTrack ? 'text-white' : 'text-white/35'}`}>{index + 1}</span>
        {index === 0 && <Crown className="mt-1 h-3.5 w-3.5 text-amber-400" />}
        {index === 7 && <span className="mt-1 h-0 w-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent border-b-emerald-400" />}
      </div>

      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.03]">
        {coverUrl ? (
          <img loading="lazy" src={coverUrl} alt={track.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music className="h-6 w-6 text-white/25" />
          </div>
        )}
        <div className={`absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity ${isCurrentTrack ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {isPlaying ? (
            <div className="flex items-end gap-0.5 h-5">
              <div className="w-1 bg-white rounded-full animate-music-bar-1"></div>
              <div className="w-1 bg-white rounded-full mx-0.5 animate-music-bar-2"></div>
              <div className="w-1 bg-white rounded-full animate-music-bar-3"></div>
            </div>
          ) : (
            <Play className="h-4 w-4 text-white ml-0.5" />
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {canNavigate ? (
            <Link
              to={`/track/${track.id}`}
              onClick={(e) => e.stopPropagation()}
              className={`truncate text-sm font-bold transition-colors ${isCurrentTrack ? 'text-white' : 'text-white group-hover:text-purple-300'}`}
            >
              <span className="inline-flex items-center gap-1">{track.title}<ExplicitBadge is_explicit={track.is_explicit} size="xs" /></span>
            </Link>
          ) : (
            <p className={`truncate text-sm font-bold transition-colors ${isCurrentTrack ? 'text-white' : 'text-white group-hover:text-purple-300'}`}><span className="inline-flex items-center gap-1">{track.title}<ExplicitBadge is_explicit={track.is_explicit} size="xs" /></span></p>
          )}
        </div>
        <p className="truncate text-xs text-white/40">{track.artist?.username}</p>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggleLike(track.id)
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[0.06] hover:text-white"
        aria-label="Добавить в избранное"
      >
        <Heart className={`h-4 w-4 ${isLiked ? 'fill-white text-white' : ''}`} />
      </button>

      <span className="w-11 shrink-0 text-right text-sm text-white/45">{formatDuration(track.duration)}</span>
    </div>
  )
}

export default function HomePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [newTracks, setNewTracks] = useState<Track[]>([])
  const [popularTracks, setPopularTracks] = useState<Track[]>([])
  const [popularArtists, setPopularArtists] = useState<PopularArtist[]>([])
  const [featuredArtists, setFeaturedArtists] = useState<PersonalizedHomeArtist[]>([])
  const [moodPlaylists, setMoodPlaylists] = useState<PersonalizedHomePlaylist[]>([])
  const [playlistOfDay, setPlaylistOfDay] = useState<PersonalizedHomePlaylist | null>(null)
  const [likedTrackIds, setLikedTrackIds] = useState<Set<number>>(new Set())
  const [genres, setGenres] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [personalizedLoading, setPersonalizedLoading] = useState(false)
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)
  const [isGiftPayment, setIsGiftPayment] = useState(false)

  useEffect(() => {
    // Check for payment success state
    if (location.state?.paymentSuccess) {
      setShowPaymentSuccess(true)
      setIsGiftPayment(location.state?.isGift || false)
      // Clear the state
      window.history.replaceState({}, document.title)
    }
  }, [location])

  useEffect(() => {
    async function fetchData() {
      try {
        const [tracksRes, popularRes, artistsRes, genresRes] = await Promise.all([
          fetch('/api/tracks'),
          fetch('/api/tracks/popular'),
          fetch('/api/artists/popular'),
          fetch('/api/genres')
        ])
        const tracksData = await tracksRes.json()
        const popularData = await popularRes.json()
        const artistsData = await artistsRes.json()
        const genresData = await genresRes.json()
        setNewTracks(tracksData)
        setPopularTracks(popularData)
        setPopularArtists(artistsData)
        setGenres(genresData)

        const tokens = getStoredTokens()
        if (tokens && Array.isArray(popularData) && popularData.length > 0) {
          const likeChecks = await Promise.all(
            popularData.slice(0, 8).map(async (track: Track) => {
              try {
                const res = await fetch(`/api/likes/check/${track.id}`, {
                  headers: { Authorization: `Bearer ${tokens.accessToken}` },
                })
                const data = await res.json()
                return data.liked ? track.id : null
              } catch {
                return null
              }
            })
          )

          setLikedTrackIds(new Set(likeChecks.filter((id): id is number => id !== null)))
        }
      } catch (err) {
        console.error('Failed to load data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    async function loadPersonalizedHome() {
      const tokens = getStoredTokens()
      if (!isAuthenticated || !tokens) {
        setFeaturedArtists([])
        setMoodPlaylists([])
        setPlaylistOfDay(null)
        return
      }

      setPersonalizedLoading(true)
      try {
        const data = await recsysApi.getPersonalizedHome(tokens.accessToken)
        setFeaturedArtists(Array.isArray(data.featured_artists) ? data.featured_artists : [])
        setMoodPlaylists(Array.isArray(data.mood_playlists) ? data.mood_playlists : [])
        setPlaylistOfDay(data.playlist_of_day || null)
      } catch (err) {
        console.error('Failed to load personalized home:', err)
      } finally {
        setPersonalizedLoading(false)
      }
    }

    loadPersonalizedHome()
  }, [isAuthenticated])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  const genreItems = genres.map(g => ({
    name: g.genre,
    color: genreColors[g.genre] || 'from-slate-600 via-slate-700 to-slate-900'
  }))

  const handleGenreSearch = (genreName: string) => {
    navigate(`/search?genre=${encodeURIComponent(genreName)}`)
  }

  const isPremiumUser = Boolean(isAuthenticated && user?.is_premium)
  const isFreeUser = Boolean(isAuthenticated && !user?.is_premium)
  const chartTracks = popularTracks.slice(0, 8)
  const chartColumns = [chartTracks.slice(0, 4), chartTracks.slice(4, 8)]

  const handleToggleLike = async (trackId: number) => {
    const tokens = getStoredTokens()
    if (!tokens) return

    try {
      const res = await fetch(`/api/likes/${trackId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })
      const data = await res.json()

      setLikedTrackIds((prev) => {
        const next = new Set(prev)
        if (data.liked) next.add(trackId)
        else next.delete(trackId)
        return next
      })

      if (data.unlockedAchievements && data.unlockedAchievements.length > 0) {
        window.dispatchEvent(new CustomEvent('show-achievement', {
          detail: { achievements: data.unlockedAchievements }
        }))
      }
    } catch (err) {
      console.error('Failed to toggle like:', err)
    }
  }

  return (
    <div className="space-y-8 max-[414px]:space-y-6">
      <PaymentSuccessModal
        isOpen={showPaymentSuccess}
        onClose={() => setShowPaymentSuccess(false)}
        isGift={isGiftPayment}
      />

      <AudioVisualizer />

      {!isAuthenticated && (
        <section className="relative z-10 overflow-hidden rounded-2xl border border-white/[0.05] bg-gradient-to-r from-purple-900/50 via-pink-900/30 to-purple-900/50 p-8 max-[414px]:p-4 max-[375px]:p-3.5">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJub25lIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-30" />
          <div className="relative text-center">
            <h2 className="mb-3 text-3xl font-bold max-[414px]:text-2xl max-[375px]:text-[1.65rem]">Добро пожаловать в Miyu</h2>
            <p className="mb-6 text-white/50 max-[414px]:text-sm">Здесь музыка звучит непрерывно: запускайте трек с главной и знакомьтесь с атмосферой сервиса без лишних переходов.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-4xl mx-auto text-left">
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4">
                <Radio className="w-5 h-5 text-purple-300 mb-3" />
                <p className="font-medium mb-1">Режим радио</p>
                <p className="text-sm text-white/50">Нажмите play на любом треке из подборки и просто слушайте.</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4">
                <Sparkles className="w-5 h-5 text-pink-300 mb-3" />
                <p className="font-medium mb-1">Свежие подборки</p>
                <p className="text-sm text-white/50">На главной собраны новинки, популярные релизы и заметные жанры.</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4">
                <Users className="w-5 h-5 text-blue-300 mb-3" />
                <p className="font-medium mb-1">Живое музыкальное пространство</p>
                <p className="text-sm text-white/50">Артисты, концерты и музыкальная среда собраны в одном месте.</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {newTracks.length > 0 && (
        <section className="relative z-20">
          <div className="flex items-end justify-between mb-6">
            {isAuthenticated ? (
              <Link
                to="/new-releases"
                className="inline-block rounded-lg transition hover:text-purple-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
                aria-label="Перейти на страницу новинок"
              >
                <h2 className="text-2xl font-bold">Новинки</h2>
                <p className="mt-1 text-sm text-white/40">Свежие треки этой недели</p>
              </Link>
            ) : (
              <div className="inline-block">
                <h2 className="text-2xl font-bold">Новинки</h2>
                <p className="mt-1 text-sm text-white/40">Свежие треки этой недели</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 max-[414px]:gap-3 md:grid-cols-3 lg:grid-cols-6">
            {newTracks.slice(0, 6).map((track) => (
              <TrackCard key={track.id} track={track} tracks={newTracks} canNavigate={isAuthenticated} />
            ))}
          </div>
        </section>
      )}

      {isAuthenticated && (
        <section>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold">Быстрое меню</h2>
              <p className="mt-1 text-sm text-white/40">Частые действия в один переход</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <QuickAccessCard
              to="/profile/library/playlists"
              title="Плейлисты"
              subtitle="Откройте свои подборки, собранные под настроение, жанр или момент."
              gradient="from-violet-600 via-purple-500 to-fuchsia-500"
              icon={ListMusic}
            />
            <QuickAccessCard
              to="/profile/library/liked"
              title="Избранное"
              subtitle="Вернитесь к трекам, которые уже отметили и хотите включать снова."
              gradient="from-pink-600 via-rose-500 to-red-500"
              icon={Heart}
            />
            <QuickAccessCard
              to="/profile/library/history"
              title="История"
              subtitle="Продолжайте с того, что слушали недавно, без лишнего поиска."
              gradient="from-cyan-600 via-sky-500 to-blue-500"
              icon={History}
            />
          </div>
        </section>
      )}

      {isAuthenticated && playlistOfDay && (
        <PlaylistOfDayPromo playlist={playlistOfDay} />
      )}

      {isAuthenticated && (personalizedLoading || moodPlaylists.length > 0) && (
        <section>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold">Плейлисты под любое настроение</h2>
              <p className="mt-1 text-sm text-white/40">Шесть уникальных плейлистов по 20 треков, которые пересобираются раз в сутки</p>
            </div>
          </div>

          {personalizedLoading && moodPlaylists.length === 0 ? (
            <div className="flex items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.02] py-10">
              <Loader2 className="h-6 w-6 animate-spin text-white/70" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 max-[414px]:gap-3 md:grid-cols-3 lg:grid-cols-6">
              {moodPlaylists.map((playlist) => (
                <PersonalizedPlaylistCard key={playlist.id} playlist={playlist} />
              ))}
            </div>
          )}
        </section>
      )}

      {isAuthenticated && (personalizedLoading || featuredArtists.length > 0) && (
        <section>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold">Артисты специально для вас</h2>
              <p className="mt-1 text-sm text-white/40">Похожие на тех, кого вы слушаете, и те, к кому вы всё чаще возвращаетесь</p>
            </div>
          </div>

          {personalizedLoading && featuredArtists.length === 0 ? (
            <div className="flex items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.02] py-10">
              <Loader2 className="h-6 w-6 animate-spin text-white/70" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 max-[414px]:gap-3 md:grid-cols-3 lg:grid-cols-6">
              {featuredArtists.map((artist) => (
                <PersonalizedArtistCard key={artist.id} artist={artist} />
              ))}
            </div>
          )}
        </section>
      )}

      {chartTracks.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-6">
            <div>
              {isAuthenticated ? (
                <Link to="/charts" className="inline-block">
                  <h2 className="text-2xl font-bold transition hover:text-purple-300">Чарты</h2>
                </Link>
              ) : (
                <div className="inline-block">
                  <h2 className="text-2xl font-bold">Чарты</h2>
                </div>
              )}
              <p className="text-white/40 text-sm mt-1">Главные треки момента в двух колонках</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {chartColumns.map((column, columnIndex) => (
              <div key={columnIndex} className="space-y-3">
                {column.map((track, trackIndex) => {
                  const absoluteIndex = columnIndex * 4 + trackIndex

                  return (
                    <ChartRow
                      key={track.id}
                      track={track}
                      tracks={chartTracks}
                      index={absoluteIndex}
                      canNavigate={isAuthenticated}
                      isLiked={likedTrackIds.has(track.id)}
                      onToggleLike={handleToggleLike}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </section>
      )}

      {popularArtists.length > 0 && (
        <section>
          <div className="mb-6 flex items-end justify-between">
            <div>
              {isAuthenticated ? (
                <Link to="/popular-artists" className="inline-block">
                  <h2 className="text-2xl font-bold transition hover:text-purple-300">Популярные артисты</h2>
                </Link>
              ) : (
                <div className="inline-block">
                  <h2 className="text-2xl font-bold">Популярные артисты</h2>
                </div>
              )}
              <p className="mt-1 text-sm text-white/40">Те, кого чаще всего включают прямо сейчас</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 max-[414px]:gap-3 md:grid-cols-3 lg:grid-cols-6">
            {popularArtists.slice(0, 6).map((artist) => (
              <ArtistCard key={artist.id} artist={artist} canNavigate={isAuthenticated} />
            ))}
          </div>
        </section>
      )}

      <section>
        {isAuthenticated ? (
          <Link to="/concerts" className="group block">
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.05] transition-all duration-300 hover:border-white/15">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-cyan-500 to-blue-600 opacity-90 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-600 via-cyan-500 to-blue-600 opacity-0 transition-opacity duration-500 group-hover:opacity-40" />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJub25lIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-35" />
              <div className="relative flex items-center justify-between gap-6 p-8 max-[414px]:flex-col max-[414px]:items-start max-[414px]:p-4">
                <div className="max-w-2xl">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md max-[414px]:mb-3 max-[414px]:px-3 max-[414px]:py-1.5 max-[414px]:text-xs">
                    <Ticket className="h-4 w-4 text-white" />
                    Концерты Miyu
                  </div>
                  <h3 className="mb-3 text-4xl font-bold text-white drop-shadow-lg transition-transform duration-300 group-hover:translate-x-1 max-[414px]:text-2xl max-[375px]:text-[1.65rem]">
                    Откройте ближайшие концерты
                  </h3>
                  <p className="text-lg text-white/90 drop-shadow transition-transform duration-300 delay-75 group-hover:translate-x-1 max-[414px]:text-sm">
                    Следите за выступлениями любимых артистов, выбирайте события и переходите к билетам прямо из музыкальной среды Miyu.
                  </p>
                  <span className="mt-6 inline-flex items-center rounded-full bg-white/20 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition group-hover:bg-white/30 max-[414px]:mt-4">
                    Перейти к концертам
                  </span>
                </div>
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/20 shadow-2xl backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 max-[414px]:h-16 max-[414px]:w-16 max-[414px]:self-end">
                  <Ticket className="h-12 w-12 text-white drop-shadow-lg" />
                </div>
              </div>
            </div>
          </Link>
        ) : (
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.05] opacity-95">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-cyan-500 to-blue-600 opacity-90" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJub25lIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-35" />
            <div className="relative flex items-center justify-between gap-6 p-8 max-[414px]:flex-col max-[414px]:items-start max-[414px]:p-4">
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md max-[414px]:mb-3 max-[414px]:px-3 max-[414px]:py-1.5 max-[414px]:text-xs">
                  <Ticket className="h-4 w-4 text-white" />
                  Концерты Miyu
                </div>
                <h3 className="mb-3 text-4xl font-bold text-white drop-shadow-lg max-[414px]:text-2xl max-[375px]:text-[1.65rem]">
                  Откройте ближайшие концерты
                </h3>
                <p className="text-lg text-white/90 drop-shadow max-[414px]:text-sm">
                  Следите за выступлениями любимых артистов, выбирайте события и переходите к билетам прямо из музыкальной среды Miyu.
                </p>
              </div>
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/20 shadow-2xl backdrop-blur-md max-[414px]:h-16 max-[414px]:w-16 max-[414px]:self-end">
                <Ticket className="h-12 w-12 text-white drop-shadow-lg" />
              </div>
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="group relative block h-64 overflow-hidden rounded-3xl border border-white/[0.05] transition-all duration-300 max-[414px]:h-auto max-[414px]:min-h-[19rem]">
          <div className={`absolute inset-0 opacity-90 group-hover:opacity-100 transition-opacity duration-300 ${isFreeUser ? 'bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500' : 'bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500'}`} />
          <div className={`absolute inset-0 opacity-0 group-hover:opacity-40 transition-opacity duration-500 ${isFreeUser ? 'bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-pink-500' : 'bg-gradient-to-tr from-purple-600 via-pink-500 to-orange-500'}`} />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJub25lIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-40" />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          </div>

          <div className="absolute inset-0 flex items-center justify-between p-8 max-[414px]:flex-col max-[414px]:items-start max-[414px]:justify-start max-[414px]:gap-5 max-[414px]:p-4 max-[375px]:p-3.5">
            <div className="flex-1">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-md max-[414px]:mb-3 max-[414px]:px-3 max-[414px]:py-1.5">
                <Waves className="w-5 h-5 text-cyan-200" />
                <span className="text-sm font-semibold text-white max-[414px]:text-xs">{isFreeUser ? 'Подписка Miyu' : 'Музыкальное пространство'}</span>
              </div>
              <h3 className="mb-3 text-4xl font-bold text-white drop-shadow-lg transition-transform duration-300 group-hover:translate-x-1 max-[414px]:text-2xl max-[375px]:text-[1.65rem]">
                {isFreeUser ? 'Откройте Miyu без ограничений' : 'Сервис, который легко слушать'}
              </h3>
              <p className="text-lg text-white/90 drop-shadow transition-transform duration-300 delay-75 group-hover:translate-x-1 max-[414px]:text-sm">
                {isFreeUser
                  ? 'Перейдите на Plus или Fan, чтобы слушать без рекламы, получить высокое качество звука и доступ к дополнительным возможностям сервиса.'
                  : 'Miyu создан для спокойного знакомства с музыкой: меньше шума, больше атмосферы и понятные подборки на первом экране.'}
              </p>
              {isFreeUser && (
                <Link
                  to="/premium"
                  className="mt-6 inline-flex items-center rounded-full bg-white/20 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/30 max-[414px]:mt-4"
                >
                  Посмотреть подписки
                </Link>
              )}
            </div>
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/20 shadow-2xl backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 max-[414px]:h-16 max-[414px]:w-16 max-[414px]:self-end">
              {isFreeUser ? <Sparkles className="w-12 h-12 text-white drop-shadow-lg" /> : <Radio className="w-12 h-12 text-white drop-shadow-lg" />}
            </div>
          </div>
        </div>
      </section>

      {genres.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-6">
            <div>
              {isAuthenticated ? (
                <Link to="/genres" className="inline-block">
                  <h2 className="text-2xl font-bold transition hover:text-purple-300">Жанры</h2>
                </Link>
              ) : (
                <div className="inline-block">
                  <h2 className="text-2xl font-bold">Жанры</h2>
                </div>
              )}
              <p className="text-white/40 text-sm mt-1">Найди свой стиль</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 max-[414px]:gap-3 md:grid-cols-3 lg:grid-cols-6">
            {genreItems.slice(0, 6).map((genre) => (
              <GenreCard key={genre.name} genre={genre} onClick={handleGenreSearch} />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isFreeUser ? (
          <>
            <Link to="/premium" className="block">
              <PromoBlock
                title="Слушайте без рекламы"
                subtitle="Подписка Plus убирает рекламные паузы и делает прослушивание непрерывным от первого до последнего трека."
                gradient="from-blue-600 via-cyan-500 to-teal-500"
                icon={Radio}
              />
            </Link>
            <Link to="/premium" className="block">
              <PromoBlock
                title="Больше, чем просто Free"
                subtitle="320 kbps, неограниченные пропуски, расширенная статистика и оформление профиля доступны в платных тарифах."
                gradient="from-yellow-600 via-orange-500 to-red-500"
                icon={TrendingUp}
              />
            </Link>
          </>
        ) : (
          <>
            {isAuthenticated ? (
              <Link to="/new-releases" className="block">
                <PromoBlock
                  title="Музыка без перегруза"
                  subtitle="Главная страница знакомит с новыми релизами и заметными треками без лишних действий и сложной навигации."
                  gradient="from-blue-600 via-cyan-500 to-teal-500"
                  icon={Calendar}
                />
              </Link>
            ) : (
              <PromoBlock
                title="Музыка без перегруза"
                subtitle="Главная страница знакомит с новыми релизами и заметными треками без лишних действий и сложной навигации."
                gradient="from-blue-600 via-cyan-500 to-teal-500"
                icon={Calendar}
              />
            )}
            {isAuthenticated ? (
              <Link to="/genres" className="block">
                <PromoBlock
                  title="Приятно исследовать"
                  subtitle="Жанры, популярные релизы и новые имена собраны так, чтобы сервис хотелось открыть ещё раз."
                  gradient="from-yellow-600 via-orange-500 to-red-500"
                  icon={TrendingUp}
                />
              </Link>
            ) : (
              <PromoBlock
                title="Приятно исследовать"
                subtitle="Жанры, популярные релизы и новые имена собраны так, чтобы сервис хотелось открыть ещё раз."
                gradient="from-yellow-600 via-orange-500 to-red-500"
                icon={TrendingUp}
              />
            )}
          </>
        )}
      </div>

      {!isPremiumUser && (
        <section>
          <div className="group relative block h-56 overflow-hidden rounded-3xl border border-white/[0.05] transition-all duration-300 max-[414px]:h-auto max-[414px]:min-h-[17.5rem]">
            <div className={`absolute inset-0 opacity-90 group-hover:opacity-100 transition-opacity duration-300 ${isFreeUser ? 'bg-gradient-to-br from-emerald-600 via-cyan-500 to-blue-500' : 'bg-gradient-to-br from-pink-600 via-rose-500 to-red-500'}`} />
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-40 transition-opacity duration-500 ${isFreeUser ? 'bg-gradient-to-tr from-emerald-600 via-cyan-500 to-blue-500' : 'bg-gradient-to-tr from-pink-600 via-rose-500 to-red-500'}`} />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJub25lIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-40" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </div>

            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute bottom-10 left-10 text-4xl opacity-20 transition-opacity duration-500 group-hover:animate-bounce group-hover:opacity-40 max-[414px]:bottom-6 max-[414px]:left-6 max-[414px]:text-3xl">💝</div>
              <div className="absolute top-20 right-20 text-3xl opacity-20 transition-opacity duration-500 delay-100 group-hover:animate-bounce group-hover:opacity-40 max-[414px]:top-6 max-[414px]:right-6 max-[414px]:text-2xl">🎁</div>
              <div className="absolute bottom-20 right-32 text-2xl opacity-20 transition-opacity duration-500 delay-200 group-hover:animate-bounce group-hover:opacity-40 max-[414px]:bottom-10 max-[414px]:right-16 max-[414px]:text-xl">✨</div>
            </div>

            <div className="absolute inset-0 flex items-center justify-between p-8 max-[414px]:flex-col max-[414px]:items-start max-[414px]:justify-start max-[414px]:gap-5 max-[414px]:p-4 max-[375px]:p-3.5">
              <div className="flex-1">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-md max-[414px]:mb-3 max-[414px]:px-3 max-[414px]:py-1.5">
                  <Zap className="w-5 h-5 text-yellow-300" />
                  <span className="text-sm font-semibold text-white max-[414px]:text-xs">{isFreeUser ? 'Переход на Plus или Fan' : 'Атмосфера Miyu'}</span>
                </div>
                <h3 className="mb-3 text-3xl font-bold text-white drop-shadow-lg transition-transform duration-300 group-hover:translate-x-1 max-[414px]:text-2xl max-[375px]:text-[1.6rem]">
                  {isFreeUser ? 'Возвращайтесь к музыке без компромиссов' : 'Когда музыка становится привычкой'}
                </h3>
                <p className="text-base text-white/90 drop-shadow transition-transform duration-300 delay-75 group-hover:translate-x-1 max-[414px]:text-sm">
                  {isFreeUser
                    ? 'Платная подписка делает ежедневное прослушивание комфортнее: выше качество, больше свободы и доступ к fan-возможностям.'
                    : 'Сервис показывает, как удобно возвращаться к музыке каждый день: включил трек и остался в потоке.'}
                </p>
                {isFreeUser && (
                  <Link
                    to="/premium"
                    className="mt-6 inline-flex items-center rounded-full bg-white/20 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/30 max-[414px]:mt-4"
                  >
                    Выбрать тариф
                  </Link>
                )}
              </div>
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 shadow-2xl backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 max-[414px]:h-16 max-[414px]:w-16 max-[414px]:self-end">
                <Sparkles className="w-10 h-10 text-white drop-shadow-lg" />
              </div>
            </div>
          </div>
        </section>
      )}

      {newTracks.length === 0 && (
        <div className="text-center py-12 text-white/40">
          <Music className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p>Треки скоро появятся</p>
        </div>
      )}
    </div>
  )
}
