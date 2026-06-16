import { Link, useParams } from 'react-router-dom'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { usePlayer } from '../hooks/PlayerContext'
import { getStoredTokens } from '../api/auth'
import { Music, Pause, Play, Heart, FileText, Mic, ListMusic, X, Disc, ArrowRight } from 'lucide-react'
import SimilarTracks from '../components/SimilarTracks'
import { ExplicitBadge } from '../components/ExplicitBadge'
import { AnimatePresence, motion } from 'framer-motion'
import { useLockBodyScroll } from '../hooks/useLockBodyScroll'

export default function TrackPage() {
  const { id } = useParams()
  const [track, setTrack] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isLiked, setIsLiked] = useState(false)
  const [showLyrics, setShowLyrics] = useState(false)
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false)
  const [trackPlaylistIds, setTrackPlaylistIds] = useState<number[]>([])
  const [catalogTracks, setCatalogTracks] = useState<any[]>([])
  const player = usePlayer()
  useLockBodyScroll(showLyrics)
  const trackIdRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    setShowPlaylistMenu(false)
    setTrackPlaylistIds([])
    setTrack(null)
    setError('')
    setIsLiked(false)
    setLoading(true)

    async function fetchTrack() {
      try {
        const res = await fetch(`/api/track/${id}`)
        if (!res.ok) throw new Error('Трек не найден')
        const data = await res.json()
        if (cancelled) return
        setTrack(data)

        const catalogRes = await fetch('/api/tracks')
        if (catalogRes.ok) {
          const catalogData = await catalogRes.json()
          if (!cancelled) setCatalogTracks(Array.isArray(catalogData) ? catalogData : [])
        }

        const tokens = getStoredTokens()
        if (tokens) {
          const likeRes = await fetch(`/api/likes/check/${id}`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` }
          })
          const likeData = await likeRes.json()
          if (!cancelled) setIsLiked(likeData.liked)
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchTrack()

    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    trackIdRef.current = track?.id ?? null
  }, [track?.id])

  useEffect(() => {
    if (!track?.id || player.playlists.length === 0) {
      setTrackPlaylistIds([])
      return
    }

    const tokens = getStoredTokens()
    if (!tokens) {
      setTrackPlaylistIds([])
      return
    }

    let cancelled = false

    Promise.all(player.playlists.map((playlist) =>
      fetch(`/api/playlists/${playlist.id}/has-track/${track.id}`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      })
        .then((res) => res.ok ? res.json() : { exists: false })
        .then((result) => result.exists ? playlist.id : -1)
        .catch(() => -1)
    )).then((results) => {
      if (!cancelled) setTrackPlaylistIds(results.filter((playlistId) => playlistId > 0))
    })

    return () => { cancelled = true }
  }, [track?.id, player.playlists])

  const toggleLike = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return
    try {
      const res = await fetch(`/api/likes/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      })
      const data = await res.json()
      setIsLiked(data.liked)

      // Show achievement notifications
      if (data.unlockedAchievements && data.unlockedAchievements.length > 0) {
        window.dispatchEvent(new CustomEvent('show-achievement', {
          detail: { achievements: data.unlockedAchievements }
        }))
      }
    } catch (err) {
      console.error('Failed to toggle like:', err)
    }
  }

  const isCurrentTrack = player.currentTrack?.id === Number(id)
  const isPlaying = player.isPlaying && isCurrentTrack

  const handlePlay = () => {
    if (track) {
      if (isCurrentTrack && isPlaying) {
        player.pause()
      } else {
        player.setTrack(track, true)
      }
    }
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const toggleTrackPlaylist = (playlistId: number) => {
    if (!track?.id) return

    const trackId = track.id
    const tokens = getStoredTokens()
    if (!tokens) return

    const isInPlaylist = trackPlaylistIds.includes(playlistId)
    const method = isInPlaylist ? 'DELETE' : 'POST'

    fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, {
      method,
      headers: { Authorization: `Bearer ${tokens.accessToken}` }
    })
      .then((res) => {
        if (res.ok && trackIdRef.current === trackId) {
          setTrackPlaylistIds((prev) => isInPlaylist ? prev.filter((id) => id !== playlistId) : [...prev, playlistId])
          window.dispatchEvent(new CustomEvent('show-toast', {
            detail: { message: isInPlaylist ? 'Трек удалён из плейлиста' : 'Трек добавлен в плейлист', type: isInPlaylist ? 'info' : 'success' }
          }))
          window.dispatchEvent(new Event('playlist-updated'))
        }
      })
      .catch((err) => console.error(isInPlaylist ? 'Remove from playlist error:' : 'Add to playlist error:', err))
  }

  const coverUrl = track?.cover_url
  const sameArtistTracks = useMemo(() => {
    if (!track) return []
    return catalogTracks
      .filter((item) => item.id !== track.id && item.artist_id === track.artist_id)
      .slice(0, 6)
  }, [catalogTracks, track])

  const discoveryTracks = useMemo(() => {
    if (!track) return []
    return catalogTracks
      .filter((item) => item.id !== track.id && item.artist_id !== track.artist_id)
      .filter((item) => !track.genre || item.genre === track.genre)
      .slice(0, 6)
  }, [catalogTracks, track])

  const suggestedArtists = useMemo(() => {
    if (!track) return []
    const seen = new Set<number>()
    return catalogTracks
      .map((item) => item.artist)
      .filter((artist) => artist && artist.id !== track.artist_id && !seen.has(artist.id) && seen.add(artist.id))
      .slice(0, 5)
  }, [catalogTracks, track])

  const queueTrack = (item: any, queue: any[]) => {
    player.setTrack(item)
    player.setQueue(queue)
    player.play()
  }

  if (loading) {
    return null
  }

  if (error || !track) {
    return <div className="text-center py-20 text-red-400">{error || 'Трек не найден'}</div>
  }

  return (
    <div className="relative">
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 mb-8">
        <div className="w-40 md:w-52 md:h-52 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center flex-shrink-0 overflow-hidden">
          {coverUrl ? (
            <img loading="lazy" src={coverUrl} alt={track.title} className="w-full h-full object-cover" />
          ) : (
            <Music size={80} className="text-white/30" />
          )}
        </div>

        <div className="flex-1 flex flex-col">
          <div className="mb-4">
            <p className="text-sm text-white/40">ТРЕК</p>
            <h1 className="text-3xl md:text-4xl font-bold mb-2"><span className="inline-flex items-center gap-1">{track.title}<ExplicitBadge is_explicit={track.is_explicit} size="xs" /></span></h1>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Link to={`/artist/${track.artist_id}`} className="font-medium hover:text-white transition">
                {track.artist_name}
              </Link>
              {track.album_id && (
                <>
                  <span className="text-white/30">•</span>
                  <Link to={`/album/${track.album_id}`} className="text-white/40 hover:text-white transition">
                    {track.album?.title || 'Альбом'}
                  </Link>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-white/40">
              {track.genre && <span>{track.genre}</span>}
              <span>•</span>
              <span>{formatDuration(track.duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-auto">
            <button
              onClick={handlePlay}
              className="w-14 h-14 bg-white text-black hover:bg-gray-200 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition"
            >
              {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
            </button>
            <button
              onClick={toggleLike}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition duration-200 ${
                isLiked ? 'text-white bg-white/10' : 'bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/10'
              }`}
            >
              <Heart className={isLiked ? 'w-5 h-5 fill-current' : 'w-5 h-5'} />
            </button>
            {track.lyrics && (
              <button 
                onClick={() => setShowLyrics(!showLyrics)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition duration-200 ${
                  showLyrics ? 'bg-white/10 text-white' : 'bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/10'
                }`}
              >
                <FileText className="w-5 h-5" />
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setShowPlaylistMenu((open) => !open)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition duration-200 ${
                  showPlaylistMenu ? 'bg-white/10 text-white' : 'bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/10'
                }`}
                title="Добавить в плейлист"
              >
                <ListMusic className="w-5 h-5" />
              </button>

              {showPlaylistMenu && (
                <div className="absolute left-0 top-full z-30 mt-3 w-56 rounded-2xl border border-white/10 bg-black/90 p-2 shadow-2xl backdrop-blur">
                  <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                    Добавить в плейлист
                  </p>
                  {player.playlists.length > 0 ? (
                    <div className="max-h-56 overflow-y-auto">
                      {player.playlists.map((playlist) => {
                        const isInPlaylist = trackPlaylistIds.includes(playlist.id)
                        return (
                          <button
                            key={playlist.id}
                            onClick={() => {
                              toggleTrackPlaylist(playlist.id)
                              setShowPlaylistMenu(false)
                            }}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                              isInPlaylist ? 'text-purple-300' : 'text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span className="truncate">{playlist.title}</span>
                            {isInPlaylist && <span className="text-xs text-purple-300">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="px-3 py-2 text-sm text-white/40">У тебя пока нет плейлистов</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {(sameArtistTracks.length > 0 || suggestedArtists.length > 0 || discoveryTracks.length > 0) && (
        <div className="mb-8 space-y-8">
          {sameArtistTracks.length > 0 && (
            <section>
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Ещё от {track.artist_name}</h2>
                  <p className="mt-1 text-sm text-white/40">Треки того же артиста, чтобы не прерывать настроение</p>
                </div>
                <Link to={`/artist/${track.artist_id}`} className="text-sm text-white/45 transition hover:text-white">Страница артиста</Link>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sameArtistTracks.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => queueTrack(item, sameArtistTracks)}
                    className="group flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 text-left transition hover:border-white/10 hover:bg-white/[0.04]"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/[0.03]">
                      {item.cover_url ? <img loading="lazy" src={item.cover_url} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Music className="h-5 w-5 text-white/25" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white transition group-hover:text-purple-300"><span className="inline-flex items-center gap-1">{item.title}<ExplicitBadge is_explicit={item.is_explicit} size="xs" /></span></p>
                      <p className="truncate text-sm text-white/40">{item.genre || 'Трек артиста'}</p>
                    </div>
                    <Play className="h-4 w-4 shrink-0 text-white/35" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {suggestedArtists.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="text-2xl font-bold">Похожие артисты</h2>
                <p className="mt-1 text-sm text-white/40">Пять случайных исполнителей из каталога, которые могут зацепить следующим звучанием</p>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                {suggestedArtists.map((artist) => (
                  <Link
                    key={artist.id}
                    to={`/artist/${artist.id}`}
                    className="group rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 transition hover:border-white/10 hover:bg-white/[0.04]"
                  >
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.03]">
                      {artist.avatar_url ? <img loading="lazy" src={artist.avatar_url} alt={artist.username} className="h-full w-full object-cover" /> : <Mic className="h-8 w-8 text-white/25" />}
                    </div>
                    <p className="truncate text-center font-semibold text-white transition group-hover:text-purple-300">{artist.username}</p>
                    <p className="mt-1 truncate text-center text-xs text-white/40">Открыть артиста</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {discoveryTracks.length > 0 && (
            <section className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-5">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Рекомендуемые треки других артистов</h2>
                  <p className="mt-1 text-sm text-white/40">Треки похожего жанра от исполнителей, которых здесь ещё не было</p>
                </div>
                <Disc className="h-5 w-5 text-white/30" />
              </div>
              <div className="space-y-3">
                {discoveryTracks.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-black/10 p-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/[0.03]">
                      {item.cover_url ? <img loading="lazy" src={item.cover_url} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Music className="h-5 w-5 text-white/25" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link to={`/track/${item.id}`} className="block truncate font-medium text-white transition hover:text-purple-300"><span className="inline-flex items-center gap-1">{item.title}<ExplicitBadge is_explicit={item.is_explicit} size="xs" /></span></Link>
                      <p className="truncate text-sm text-white/40">{item.artist?.username || item.artist_name || 'Артист'} • {item.genre || 'Музыка'}</p>
                    </div>
                    <button
                      onClick={() => queueTrack(item, discoveryTracks)}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                      Слушать
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <SimilarTracks trackId={Number(id)} limit={10} />

      <AnimatePresence>
        {track.lyrics && showLyrics && createPortal((
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLyrics(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -56, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -36, scale: 0.97 }}
              transition={{ type: 'spring', damping: 26, stiffness: 360 }}
              className="w-[calc(100%-1.5rem)] max-w-2xl overflow-hidden rounded-[1.75rem] border border-white/12 bg-black/80 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(168,85,247,0.18),rgba(59,130,246,0.08),transparent_70%)]" />
              <div className="relative flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/35">lyrics</p>
                  <h3 className="truncate text-lg font-semibold text-white">Текст песни</h3>
                </div>
                <button
                  onClick={() => setShowLyrics(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/70 transition hover:bg-white/14 hover:text-white"
                  aria-label="Закрыть текст песни"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="relative max-h-[min(70vh,34rem)] overflow-y-auto px-5 py-4">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-white/72">
                  {track.lyrics}
                </pre>
              </div>
            </motion.div>
          </motion.div>
        ), document.body)}
      </AnimatePresence>
    </div>
  )
}
