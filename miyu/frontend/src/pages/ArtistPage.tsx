import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mic, Play, Music, Disc, MoreHorizontal, Loader2, Pause } from 'lucide-react'
import { useState, useEffect } from 'react'
import { usePlayer } from '../hooks/PlayerContext'
import { extractColorsFromImage } from '../utils/colorExtractor'
import { getStoredTokens } from '../api/auth'
import { ExplicitBadge } from '../components/ExplicitBadge'

const DEFAULT_ARTIST_PALETTE = ['#a855f7', '#ec4899', '#3b82f6']

interface Artist {
  id: number
  username: string
  role: string
  avatar_url: string | null
  bio: string | null
  is_verified: boolean
  is_premium: boolean
  created_at: string
  palette_mode?: string
  palette_primary?: string
  palette_secondary?: string
  palette_tertiary?: string
  palette_accent?: string
}

interface Track {
  id: number
  title: string
  artist_id?: number
  artist_name?: string
  artist?: {
    id: number
    username: string
    email?: string
    role?: 'user' | 'artist' | 'moderator' | 'admin'
    avatar_url?: string | null
    is_verified?: boolean
    is_premium?: boolean
    created_at?: string
  } | null
  duration: number
  file_path: string
  cover_url: string | null
  is_explicit?: boolean
  created_at: string
}

interface Album {
  id: number
  title: string
  artist_id: number
  cover_url: string | null
  release_date: string
  type: string
}

export default function ArtistPage() {
  const { id } = useParams()
  const player = usePlayer()
  const [artist, setArtist] = useState<Artist | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [bannerColors, setBannerColors] = useState<string[]>([...DEFAULT_ARTIST_PALETTE])
  const [paletteReady, setPaletteReady] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setArtist(null)
    setTracks([])
    setAlbums([])
    setIsFollowing(false)
    setBannerColors([...DEFAULT_ARTIST_PALETTE])
    setPaletteReady(false)
    loadArtistData(() => cancelled)
    checkFollowStatus(() => cancelled)

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let cancelled = false

    const completePalette = (colors: string[]) => {
      if (cancelled) return

      const nextColors = Array.isArray(colors) && colors.length >= 3
        ? colors.slice(0, 3)
        : [...DEFAULT_ARTIST_PALETTE]

      setBannerColors(nextColors)
      window.requestAnimationFrame(() => {
        if (!cancelled) {
          setPaletteReady(true)
        }
      })
    }

    setPaletteReady(false)

    if (!artist) {
      setBannerColors([...DEFAULT_ARTIST_PALETTE])
      return () => {
        cancelled = true
      }
    }

    if (artist.palette_mode === 'custom' && artist.palette_primary && artist.palette_secondary && artist.palette_tertiary) {
      completePalette([artist.palette_primary, artist.palette_secondary, artist.palette_tertiary])
    } else if (artist.avatar_url) {
      extractColorsFromImage(`${artist.avatar_url}`)
        .then(completePalette)
        .catch(() => completePalette([...DEFAULT_ARTIST_PALETTE]))
    } else {
      completePalette([...DEFAULT_ARTIST_PALETTE])
    }

    return () => {
      cancelled = true
    }
  }, [artist])

  const loadArtistData = async (isCancelled: () => boolean = () => false) => {
    try {
      setLoading(true)

      // Load artist info
      const artistRes = await fetch(`/api/user/${id}`)
      if (isCancelled()) return
      if (artistRes.ok) {
        const artistData = await artistRes.json()
        if (isCancelled()) return
        setArtist(artistData)
      } else {
        setArtist(null)
      }

      // Load artist tracks
      const tracksRes = await fetch(`/api/tracks?artist_id=${id}`)
      if (isCancelled()) return
      if (tracksRes.ok) {
        const tracksData = await tracksRes.json()
        if (isCancelled()) return
        setTracks(tracksData.slice(0, 10))
      } else {
        setTracks([])
      }

      // Load artist albums
      const albumsRes = await fetch(`/api/albums?artist_id=${id}`)
      if (isCancelled()) return
      if (albumsRes.ok) {
        const albumsData = await albumsRes.json()
        if (isCancelled()) return
        setAlbums(albumsData.slice(0, 6))
      } else {
        setAlbums([])
      }
    } catch (err) {
      if (isCancelled()) return
      console.error('Failed to load artist data:', err)
      setArtist(null)
      setTracks([])
      setAlbums([])
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }

  const checkFollowStatus = async (isCancelled: () => boolean = () => false) => {
    const tokens = getStoredTokens()
    if (!tokens || !id) {
      if (!isCancelled()) setIsFollowing(false)
      return
    }

    try {
      const res = await fetch(`/api/following/status/${id}`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      })
      if (isCancelled()) return
      if (res.ok) {
        const data = await res.json()
        if (isCancelled()) return
        setIsFollowing(Boolean(data.is_following))
      }
    } catch (err) {
      if (!isCancelled()) console.error('Failed to check follow status:', err)
    }
  }

  const handleArtistLikeToggle = async () => {
    const tokens = getStoredTokens()
    if (!tokens || !id) return

    try {
      const endpoint = isFollowing ? '/api/following/unfollow' : '/api/following/follow'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({ userId: Number(id) }),
      })

      if (res.ok) {
        setIsFollowing((prev) => !prev)
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: {
            message: isFollowing ? 'Вы отписались от артиста' : 'Вы подписались на артиста',
            type: isFollowing ? 'info' : 'success',
          }
        }))
      }
    } catch (err) {
      console.error('Failed to toggle artist favorite:', err)
    }
  }

  const mapArtistTrackForPlayer = (track: Track) => {
    const artistId = track.artist?.id ?? track.artist_id ?? artist?.id ?? Number(id)
    const artistName = track.artist?.username ?? track.artist_name ?? artist?.username ?? 'Артист'

    return {
      id: track.id,
      title: track.title,
      artist_id: artistId,
      artist: {
        id: artistId,
        username: artistName,
        email: track.artist?.email || '',
        role: 'artist' as const,
        avatar_url: track.artist?.avatar_url || artist?.avatar_url || undefined,
        is_verified: Boolean(track.artist?.is_verified ?? artist?.is_verified),
        is_premium: Boolean(track.artist?.is_premium ?? artist?.is_premium),
        created_at: track.artist?.created_at || artist?.created_at || '',
      },
      duration: track.duration,
      file_path: track.file_path,
      cover_url: track.cover_url ?? undefined,
      is_explicit: Boolean((track as any).is_explicit),
      is_premium: false,
      status: 'approved' as const,
      created_at: track.created_at,
    }
  }

  const handlePlayTrack = (track: Track) => {
    player.setTrack(mapArtistTrackForPlayer(track), true, null)
  }

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      const trackList = tracks.map(mapArtistTrackForPlayer)
      if (hasActiveArtistTrack) {
        player.togglePlay()
        return
      }
      player.setQueue(trackList, true, null)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const shellStyle = {
    background: `radial-gradient(circle at 18% 8%, ${bannerColors[0]}34 0, transparent 32%), radial-gradient(circle at 82% 14%, ${bannerColors[1]}2d 0, transparent 30%), radial-gradient(circle at 62% 92%, ${bannerColors[2]}22 0, transparent 34%), linear-gradient(145deg, rgba(9, 7, 20, 0.96), rgba(16, 12, 31, 0.9))`
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-200px)] rounded-[2rem] border border-white/[0.08] bg-white/[0.03] flex items-center justify-center py-20 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-xl opacity-60" style={{ background: `linear-gradient(135deg, ${bannerColors[0]}, ${bannerColors[1]})` }} />
            <Loader2 className="relative w-9 h-9 animate-spin text-white" />
          </div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/35">Загружаем артиста</p>
        </div>
      </div>
    )
  }

  if (!artist) {
    return (
      <div className="min-h-[calc(100vh-200px)] rounded-[2rem] border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[1.5rem] border border-white/[0.08] bg-black/20 text-center">
          <Mic className="mb-4 h-14 w-14 text-white/20" />
          <p className="text-lg font-semibold text-white/70">Артист не найден</p>
          <p className="mt-2 max-w-sm text-sm text-white/35">Возможно, профиль был скрыт или ссылка больше не актуальна.</p>
        </div>
      </div>
    )
  }

  const hasAvatar = !!artist.avatar_url
  const hasActiveArtistTrack = Boolean(player.isPlaying && player.currentTrack && tracks.some(t => t.id === player.currentTrack?.id))

  return (
    <div
      className="relative min-h-[calc(100vh-200px)] overflow-hidden rounded-[2rem] border border-white/[0.08] p-3 text-white shadow-[0_35px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition-[background,border-color,box-shadow] duration-700 sm:p-5 md:p-6"
      style={shellStyle}
    >
      <motion.div
        className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full blur-3xl transition-colors duration-700 sm:h-[28rem] sm:w-[28rem]"
        initial={false}
        animate={{ opacity: paletteReady ? 0.68 : 0 }}
        transition={{ duration: 0.85, ease: 'easeOut' }}
        style={{ background: `radial-gradient(circle, ${bannerColors[0]} 0%, ${bannerColors[1]}90 42%, transparent 72%)` }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-36 right-[-10%] h-96 w-96 rounded-full blur-3xl transition-colors duration-700"
        initial={false}
        animate={{ opacity: paletteReady ? 0.5 : 0 }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.05 }}
        style={{ background: `radial-gradient(circle, ${bannerColors[2]} 0%, ${bannerColors[0]}70 45%, transparent 74%)` }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.08),transparent_28%,transparent_72%,rgba(255,255,255,0.05))]" />

      <div className="relative z-10 space-y-6">
        <section className="overflow-hidden rounded-[1.75rem] border border-white/[0.1] bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition-colors duration-700">
          <div className="relative p-5 sm:p-7 lg:p-8">
            <div
              className="absolute inset-0 opacity-45 transition-opacity duration-700"
              style={{ background: `linear-gradient(135deg, ${bannerColors[0]}22, ${bannerColors[1]}12 48%, ${bannerColors[2]}18)` }}
            />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start">
              <div
                className="w-40 flex-shrink-0 self-start rounded-[2rem] p-[3px] shadow-[0_22px_70px_rgba(0,0,0,0.35)] transition-[background,box-shadow] duration-700 sm:w-52 lg:mt-[42px]"
                style={{
                  background: `linear-gradient(135deg, ${bannerColors[0]}, ${bannerColors[1]} 48%, ${bannerColors[2]})`,
                  boxShadow: `0 24px 80px ${bannerColors[0]}24`
                }}
              >
                <div className="aspect-square overflow-hidden rounded-[1.8rem] bg-[#100d1c]">
                  {hasAvatar ? (
                    <img src={`${artist.avatar_url}`} alt={artist.username} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${bannerColors[0]}, ${bannerColors[1]})` }}>
                      <Mic size={78} className="text-white/90" />
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/[0.12] bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55 backdrop-blur-md">Артист</span>
                  {artist.is_premium && (
                    <span className="rounded-full border border-white/[0.12] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/65" style={{ background: `${bannerColors[1]}24` }}>Premium</span>
                  )}
                </div>

                <h1 className="flex min-w-0 flex-wrap items-center gap-3 text-4xl font-black tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">
                  <span className="break-words leading-[0.95] drop-shadow-[0_12px_28px_rgba(0,0,0,0.35)]">{artist.username}</span>
                </h1>

                {artist.bio && (
                  <p className="mt-4 max-w-3xl text-sm leading-6 text-white/64 sm:text-base">{artist.bio}</p>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-white/55">
                  <span className="rounded-full border border-white/[0.09] bg-white/[0.06] px-3 py-1.5">{tracks.length} треков</span>
                  {albums.length > 0 && <span className="rounded-full border border-white/[0.09] bg-white/[0.06] px-3 py-1.5">{albums.length} альбомов</span>}
                  <span className="rounded-full border border-white/[0.09] bg-white/[0.06] px-3 py-1.5">На Miyu с {new Date(artist.created_at).getFullYear()}</span>
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handlePlayAll}
                    disabled={tracks.length === 0}
                    className="group flex h-14 items-center gap-3 rounded-full px-5 pr-6 font-semibold text-white shadow-lg transition duration-300 hover:-translate-y-0.5 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:scale-100"
                    style={{
                      background: `linear-gradient(135deg, ${bannerColors[0]}, ${bannerColors[1]} 52%, ${bannerColors[2]})`,
                      boxShadow: `0 18px 52px ${bannerColors[0]}30`
                    }}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.18] transition group-hover:bg-white/[0.24]">
                      {hasActiveArtistTrack ? (
                        <Pause size={22} className="text-white" />
                      ) : (
                        <Play size={22} className="ml-0.5 text-white" />
                      )}
                    </span>
                    <span>{hasActiveArtistTrack ? 'Играет' : 'Слушать'}</span>
                  </button>
                  <button
                    onClick={handleArtistLikeToggle}
                    className="rounded-full border border-white/[0.12] bg-white/[0.07] px-5 py-4 text-sm font-semibold text-white/75 backdrop-blur-xl transition duration-300 hover:border-white/[0.2] hover:bg-white/[0.11] hover:text-white"
                  >
                    {isFollowing ? 'Подписан' : 'Подписаться'}
                  </button>
                  <button className="flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.07] text-white/70 backdrop-blur-xl transition duration-300 hover:border-white/[0.2] hover:bg-white/[0.11] hover:text-white">
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {tracks.length > 0 && (
          <section className="rounded-[1.6rem] border border-white/[0.09] bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl sm:p-5">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Сцена артиста</p>
                <h2 className="text-2xl font-bold tracking-[-0.03em] text-white">Популярные треки</h2>
              </div>
              <Link to={`/user/${id}`} className="whitespace-nowrap text-sm font-medium text-white/42 transition hover:text-white">Смотреть все</Link>
            </div>

            <div className="space-y-2">
              {tracks.map((track, i) => {
                const isCurrentTrack = player.currentTrack?.id === track.id
                const isPlaying = player.isPlaying && isCurrentTrack

                return (
                  <div
                    key={track.id}
                    className="group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.035] p-3 transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.07] sm:grid-cols-[auto_minmax(0,1fr)_7rem_auto_auto] sm:gap-4 sm:px-4"
                    style={{
                      background: isCurrentTrack ? `linear-gradient(90deg, ${bannerColors[0]}24, ${bannerColors[1]}14, rgba(255,255,255,0.04))` : undefined,
                      borderColor: isCurrentTrack ? `${bannerColors[0]}60` : undefined,
                      boxShadow: isCurrentTrack ? `0 18px 46px ${bannerColors[0]}16` : undefined,
                    }}
                    onClick={() => handlePlayTrack(track)}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-white/42 transition group-hover:text-white/75">
                      {i + 1}
                    </span>

                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.05]" style={{ boxShadow: isCurrentTrack ? `0 0 0 1px ${bannerColors[1]}40` : undefined }}>
                        {track.cover_url ? (
                          <img src={track.cover_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center" style={{ background: `${bannerColors[0]}18` }}>
                            <Music className="h-5 w-5 text-white/40" />
                          </div>
                        )}
                        {isPlaying && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                            <div className="flex h-4 items-end gap-0.5">
                              <div className="w-0.5 rounded-full bg-white animate-music-bar-1"></div>
                              <div className="mx-0.5 w-0.5 rounded-full bg-white animate-music-bar-2"></div>
                              <div className="w-0.5 rounded-full bg-white animate-music-bar-3"></div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Link
                            to={`/track/${track.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`truncate text-sm font-semibold transition hover:underline ${isCurrentTrack ? 'text-white' : 'text-white/78 group-hover:text-white'}`}
                          >{track.title}</Link>
                          <ExplicitBadge is_explicit={track.is_explicit} size="xs" />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-white/34">{track.artist?.username ?? track.artist_name ?? artist.username}</p>
                      </div>
                    </div>

                    <span className="hidden text-sm text-white/38 sm:block">
                      {new Date(track.created_at).toLocaleDateString('ru')}
                    </span>
                    <span className="text-right text-sm font-medium text-white/42">{formatDuration(track.duration)}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {albums.length > 0 && (
          <section className="rounded-[1.6rem] border border-white/[0.09] bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl sm:p-5">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Коллекция</p>
                <h2 className="text-2xl font-bold tracking-[-0.03em] text-white">Альбомы</h2>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 xl:grid-cols-6">
              {albums.map((album) => (
                <Link key={album.id} to={`/album/${album.id}`} className="group min-w-0 rounded-2xl border border-white/[0.08] bg-black/20 p-2.5 transition duration-300 hover:-translate-y-1 hover:border-white/[0.16] hover:bg-white/[0.07] hover:shadow-[0_20px_55px_rgba(0,0,0,0.35)]">
                  <div className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-white/[0.04]">
                    {album.cover_url ? (
                      <img src={album.cover_url} alt={album.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${bannerColors[0]}1f, ${bannerColors[2]}18)` }}>
                        <Disc size={38} className="text-white/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/80 via-black/15 to-transparent p-3 opacity-0 transition duration-300 group-hover:opacity-100">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition duration-300 group-hover:scale-105" style={{ background: `linear-gradient(135deg, ${bannerColors[0]}, ${bannerColors[1]})` }}>
                        <Play className="ml-0.5 h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>
                  <p className="truncate text-sm font-semibold text-white/82 transition group-hover:text-white">{album.title}</p>
                  <p className="mt-1 truncate text-xs text-white/38">{new Date(album.release_date).getFullYear()} • {album.type}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {tracks.length === 0 && albums.length === 0 && (
          <div className="rounded-[1.6rem] border border-white/[0.09] bg-white/[0.045] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl">
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-white/[0.12] bg-black/20 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/[0.1] bg-white/[0.06]" style={{ boxShadow: `0 18px 48px ${bannerColors[0]}14` }}>
                <Music className="h-10 w-10 text-white/28" />
              </div>
              <p className="text-lg font-semibold text-white/72">У этого артиста пока нет релизов</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-white/38">Когда появятся треки или альбомы, они засияют здесь в палитре профиля.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
