import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { usePlayer } from '../hooks/PlayerContext'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, 
  Heart, Plus, Sliders, X, Music, Volume2, VolumeX, Volume1, Type, Waves, Clapperboard
} from 'lucide-react'
import { aiApi } from '../api/ai'
import { getStoredTokens } from '../api/auth'
import type { Video } from '../types'

type PopupType = 'eq' | 'volume' | 'playlist' | null
type ViewMode = 'player' | 'lyrics'

interface LyricsSegment {
  start: number
  end: number
  text: string
}

export default function ExpandedPlayer() {
  const {
    currentTrack,
    currentPlaylist,
    isWaveActive,
    isPlaying,
    togglePlay,
    toggleExpanded,
    progress,
    duration,
    volume,
    setVolume,
    repeatMode,
    cycleRepeatMode,
    isShuffled,
    toggleShuffle,
    isLiked,
    toggleLike,
    eqPreset,
    setEqPreset,
    eqBands,
    setEqBand,
    playlists,
    nextTrack,
    prevTrack,
    seekTo,
    addOrRemoveFromPlaylist,
    isTrackInPlaylist,
  } = usePlayer()

  const [activePopup, setActivePopup] = useState<PopupType>(null)
  const [draggingBand, setDraggingBand] = useState<number | null>(null)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [showPresetMenu, setShowPresetMenu] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('player')
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [lyricsText, setLyricsText] = useState('')
  const [lyricsSegments, setLyricsSegments] = useState<LyricsSegment[]>([])
  const [trackClip, setTrackClip] = useState<Video | null>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const lyricsContainerRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<Array<HTMLDivElement | null>>([])
  const [lyricsOffset, setLyricsOffset] = useState(0)

  const eqPresets = ['По умолчанию', 'Басы', 'Вокал', 'Электроника', 'Рок', 'Классика', 'Поп', 'Хип-хоп', 'Пользовательский']

  useEffect(() => {
    if (draggingBand === null) return
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingBand === -1) {
        const target = document.querySelector('[data-volume]') as HTMLElement
        if (!target) return
        const rect = target.getBoundingClientRect()
        const percent = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height))
        setVolume(Math.round(percent * 100))
      } else {
        const target = document.querySelector(`[data-band="${draggingBand}"]`) as HTMLElement
        if (!target) return
        const rect = target.getBoundingClientRect()
        const percent = 1 - (e.clientY - rect.top) / rect.height
        const newValue = Math.round(percent * 24 - 12)
        setEqBand(draggingBand, Math.max(-12, Math.min(12, newValue)))
      }
    }
    const handleMouseUp = () => setDraggingBand(null)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingBand, setEqBand, setVolume])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showPresetMenu) {
        const target = e.target as HTMLElement
        if (!target.closest('.preset-menu-container')) {
          setShowPresetMenu(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPresetMenu])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isScrubbing || !progressBarRef.current) return
      const rect = progressBarRef.current.getBoundingClientRect()
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      seekTo(percent * duration)
    }
    const handleMouseUp = () => setIsScrubbing(false)
    
    if (isScrubbing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isScrubbing, duration, seekTo])

  useEffect(() => {
    setViewMode('player')
    setLyricsText('')
    setLyricsSegments([])
    setLyricsOffset(0)

    const trackId = currentTrack?.id
    if (!trackId) return

    const tokens = getStoredTokens()
    if (!tokens?.accessToken) return

    let cancelled = false
    setLyricsLoading(true)

    aiApi.getTrackLyrics(tokens.accessToken, trackId)
      .then((data) => {
        if (cancelled) return
        setLyricsText(data.lyrics_text || '')
        setLyricsSegments((data.segments || []).filter(seg => seg.text?.trim()))
      })
      .catch(() => {
        if (cancelled) return
        setLyricsText(currentTrack?.lyrics || '')
        setLyricsSegments([])
      })
      .finally(() => {
        if (!cancelled) setLyricsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentTrack?.id, currentTrack?.lyrics])

  useEffect(() => {
    const trackId = currentTrack?.id
    setTrackClip(null)

    if (!trackId) return

    let cancelled = false

    fetch('/api/videos')
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load videos')
        return response.json()
      })
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return

        const clip = data.find((video: Video) => {
          const videoTrackId = typeof video.track_id === 'number' ? video.track_id : Number(video.track_id)
          return video.status === 'approved' && videoTrackId === trackId
        })

        setTrackClip(clip || null)
      })
      .catch(() => {
        if (!cancelled) setTrackClip(null)
      })

    return () => {
      cancelled = true
    }
  }, [currentTrack?.id])

  const activeSegmentIndex = lyricsSegments.findIndex((segment) => progress >= segment.start && progress < segment.end)

  useEffect(() => {
    if (viewMode !== 'lyrics') return
    const container = lyricsContainerRef.current
    if (!container) return

    const items = lineRefs.current
    const activeLine = items[activeSegmentIndex >= 0 ? activeSegmentIndex : 0]
    if (!activeLine) return

    const containerHeight = container.clientHeight
    const lineCenter = activeLine.offsetTop + activeLine.offsetHeight / 2
    const nextOffset = Math.max(0, lineCenter - containerHeight / 2)
    setLyricsOffset(nextOffset)
  }, [activeSegmentIndex, viewMode, lyricsSegments])

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return
    setIsScrubbing(true)
    const rect = progressBarRef.current.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekTo(percent * duration)
  }

  const closePopup = (popup: PopupType) => {
      setActivePopup(popup === activePopup ? null : popup)
  }

  const coverPath = currentTrack?.cover_url || currentTrack?.album?.cover_url
  const coverUrl = coverPath ? coverPath : undefined
  const hasLyrics = lyricsSegments.length > 0 || lyricsText.trim().length > 0
  const metadataLinkClass = 'rounded-sm text-gray-400 transition hover:text-white focus:outline-none focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-black'
  const artistId = currentTrack?.artist?.id ?? currentTrack?.artist_id
  const albumId = currentTrack?.album?.id ?? currentTrack?.album_id
  const artistLinkTarget = typeof artistId === 'number' && Number.isFinite(artistId) && artistId > 0 ? `/artist/${artistId}` : null
  const playlistLinkTarget = currentPlaylist?.mode === 'playlist' && !currentPlaylist.is_system && typeof currentPlaylist.id === 'number' && Number.isFinite(currentPlaylist.id) && currentPlaylist.id > 0 ? `/playlist/${currentPlaylist.id}` : null
  const albumLinkTarget = currentPlaylist?.mode === 'album' && typeof currentPlaylist.id === 'number' && Number.isFinite(currentPlaylist.id) && currentPlaylist.id > 0
    ? `/album/${currentPlaylist.id}`
    : !currentPlaylist && typeof albumId === 'number' && Number.isFinite(albumId) && albumId > 0
      ? `/album/${albumId}`
      : null
  const trackLinkTarget = typeof currentTrack?.id === 'number' && Number.isFinite(currentTrack.id) && currentTrack.id > 0 ? `/track/${currentTrack.id}` : null
  const clipLinkTarget = trackClip?.id ? `/video/${trackClip.id}` : null

  const handlePlayerNavigation = () => {
    setActivePopup(null)
    setShowPresetMenu(false)
    toggleExpanded()
  }

  const fallbackLyricsLines = lyricsText
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)

  return (
    <div className="fixed bottom-28 left-1/2 z-40 w-[680px] max-w-[calc(100vw-2rem)] -translate-x-1/2 animate-slide-up rounded-2xl shadow-2xl glass max-[414px]:bottom-[5.25rem] max-[414px]:w-[calc(100vw-1rem)] max-[414px]:max-w-[calc(100vw-1rem)] max-[414px]:rounded-[20px]">
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <AnimatePresence>
          {coverUrl && (
            <motion.img
              key={coverUrl}
              src={coverUrl}
              initial={{ opacity: 0, scale: 1.2 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.0 }}
              className="absolute inset-0 w-full h-full object-cover filter blur-3xl"
            />
          )}
        </AnimatePresence>
      </div>

      <div className="relative p-5 max-[414px]:p-3.5 max-[375px]:p-3">
        {viewMode !== 'lyrics' && (
          <button
            onClick={toggleExpanded}
            className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition hover:bg-white/8 hover:text-white"
            aria-label="Закрыть плеер"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className={`flex gap-6 max-[414px]:flex-col max-[414px]:gap-3.5 ${viewMode === 'lyrics' ? 'items-start max-[414px]:items-center' : ''}`}>
          <div className={`flex flex-shrink-0 ${viewMode === 'lyrics' ? 'w-48 flex-col items-center gap-4 max-[414px]:w-36' : ''}`}>
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              className={`flex items-center justify-center overflow-hidden rounded-xl bg-white/10 shadow-lg ${viewMode === 'lyrics' ? 'h-48 w-48 max-[414px]:h-36 max-[414px]:w-36' : 'h-40 w-40 max-[414px]:mx-auto max-[414px]:h-32 max-[414px]:w-32'}`}
            >
              {coverUrl ? (
                <img src={coverUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Music className="w-16 h-16 text-white/60" />
              )}
            </motion.div>

            {viewMode === 'lyrics' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.24 }}
                className="flex w-full flex-col gap-2.5"
              >
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={prevTrack}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white transition hover:bg-white/10"
                    aria-label="Предыдущий трек"
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-gray-900 transition hover:scale-105"
                    aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                  </button>
                  <button
                    onClick={nextTrack}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white transition hover:bg-white/10"
                    aria-label="Следующий трек"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center justify-between px-2">
                  <button
                    onClick={toggleShuffle}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${isShuffled ? 'text-pink-500 bg-pink-500/20' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                    aria-label="Перемешать"
                  >
                    <Shuffle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={cycleRepeatMode}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${repeatMode !== 'off' ? 'text-pink-500 bg-pink-500/20' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                    aria-label="Режим повтора"
                  >
                    {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          <motion.div layout className="flex-1 min-w-0 flex flex-col self-stretch">
            {viewMode === 'lyrics' ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key="lyrics-view"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={{ duration: 0.28 }}
                  className="flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/20 backdrop-blur-sm"
                >
                  <button
                    onClick={() => setViewMode('player')}
                    className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white/55 transition hover:bg-white/10 hover:text-white max-[414px]:right-3 max-[414px]:top-3"
                    aria-label="Закрыть текст"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="flex h-full flex-col justify-center">
                    <div ref={lyricsContainerRef} className="relative h-[26rem] overflow-hidden px-6 py-8 max-[414px]:h-[20rem] max-[414px]:px-4">
                      {lyricsLoading ? (
                        <div className="flex h-full items-center justify-center text-sm text-white/40">
                          Загружаем текст...
                        </div>
                      ) : lyricsSegments.length > 0 ? (
                        <motion.div
                          animate={{ y: -lyricsOffset }}
                          transition={{ type: 'spring', stiffness: 120, damping: 24, mass: 0.8 }}
                          className="space-y-3 py-[9rem] max-[414px]:py-[7rem]"
                        >
                          {lyricsSegments.map((segment, index) => {
                            const isActive = index === activeSegmentIndex || (activeSegmentIndex === -1 && progress >= segment.start && index === lyricsSegments.length - 1)
                            return (
                              <motion.div
                                key={`${segment.start}-${index}`}
                                ref={(node) => { lineRefs.current[index] = node }}
                                animate={{
                                  opacity: isActive ? 1 : 0.28,
                                  scale: isActive ? 1.04 : 0.98,
                                  y: isActive ? 0 : 2,
                                }}
                                transition={{ duration: 0.25 }}
                                className={`rounded-2xl px-4 py-3 text-center text-2xl leading-relaxed max-[414px]:text-lg ${isActive ? 'bg-white/10 text-white shadow-lg shadow-purple-500/10' : 'text-white/55'}`}
                              >
                                {segment.text}
                              </motion.div>
                            )
                          })}
                        </motion.div>
                      ) : fallbackLyricsLines.length > 0 ? (
                        <div className="flex h-full items-center">
                          <div className="w-full space-y-3 py-8">
                            {fallbackLyricsLines.map((line, index) => (
                              <motion.div
                                key={`${line}-${index}`}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 0.8, y: 0 }}
                                transition={{ delay: index * 0.02 }}
                                className="rounded-2xl px-4 py-3 text-center text-xl leading-relaxed text-white/75 max-[414px]:text-base"
                              >
                                {line}
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-white/40">
                          Текст для этого трека пока недоступен
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <>
                <div className="mb-3">
                  <h3 className="truncate text-xl font-bold max-[414px]:text-center max-[414px]:text-lg">
                    {trackLinkTarget ? (
                      <Link
                        to={trackLinkTarget}
                        onClick={handlePlayerNavigation}
                        className="rounded-sm transition hover:text-purple-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                      >
                        {currentTrack?.title || 'Трек не выбран'}
                      </Link>
                    ) : (
                      currentTrack?.title || 'Трек не выбран'
                    )}
                  </h3>
                  <p className="truncate text-sm text-gray-400 max-[414px]:text-center max-[414px]:text-xs">
                    {artistLinkTarget ? (
                      <Link
                        to={artistLinkTarget}
                        onClick={handlePlayerNavigation}
                        className={metadataLinkClass}
                      >
                        {currentTrack?.artist?.username || 'Артист'}
                      </Link>
                    ) : (
                      currentTrack?.artist?.username || 'Артист'
                    )}
                    {currentPlaylist && currentPlaylist.mode !== 'album' && (
                      <>
                        {' • '}
                        {playlistLinkTarget ? (
                          <Link
                            to={playlistLinkTarget}
                            onClick={handlePlayerNavigation}
                            className={metadataLinkClass}
                          >
                            {currentPlaylist.title}
                          </Link>
                        ) : (
                          currentPlaylist.title
                        )}
                      </>
                    )}
                    {currentPlaylist?.mode === 'album' && (
                      <>
                        {' • '}
                        {albumLinkTarget ? (
                          <Link
                            to={albumLinkTarget}
                            onClick={handlePlayerNavigation}
                            className={metadataLinkClass}
                          >
                            {currentPlaylist.title}
                          </Link>
                        ) : (
                          currentPlaylist.title
                        )}
                      </>
                    )}
                    {!currentPlaylist && currentTrack?.album?.title && (
                      <>
                        {' • '}
                        {albumLinkTarget ? (
                          <Link
                            to={albumLinkTarget}
                            onClick={handlePlayerNavigation}
                            className={metadataLinkClass}
                          >
                            {currentTrack.album.title}
                          </Link>
                        ) : (
                          currentTrack.album.title
                        )}
                      </>
                    )}
                  </p>
                  {isWaveActive && (
                    <div className="mt-2 flex justify-start max-[414px]:justify-center">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                        <Waves className="h-3.5 w-3.5" />
                        Волна Miyu
                      </span>
                    </div>
                  )}
                </div>

                <div
                  ref={progressBarRef}
                  onMouseDown={handleProgressMouseDown}
                  className="h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer mb-2 group/progress"
                >
                  <div
                    className="h-full bg-white rounded-full relative transition-all"
                    style={{ width: `${progressPercent}%` }}
                  >
                    <div className="h-3 w-3 bg-white rounded-full absolute -right-1.5 -top-1 opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg" />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mb-4">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>

                <div className="mb-5 flex items-center justify-center gap-3 max-[414px]:gap-2">
                  <button
                    onClick={toggleShuffle}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition ${isShuffled ? 'text-pink-500 bg-pink-500/20' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                  >
                    <Shuffle className="w-5 h-5" />
                  </button>

                  <button
                    onClick={prevTrack}
                    className="w-12 h-12 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition"
                  >
                    <SkipBack className="w-7 h-7" />
                  </button>

                  <button
                    onClick={togglePlay}
                    className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center text-gray-900 hover:scale-105 transition"
                  >
                    {isPlaying ? (
                      <Pause className="w-7 h-7" />
                    ) : (
                      <Play className="w-7 h-7 ml-1" />
                    )}
                  </button>

                  <button
                    onClick={nextTrack}
                    className="w-12 h-12 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition"
                  >
                    <SkipForward className="w-7 h-7" />
                  </button>

                  <button
                    onClick={cycleRepeatMode}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition ${repeatMode !== 'off' ? 'text-pink-500 bg-pink-500/20' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                  >
                    {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                  </button>
                </div>

                <div className="mt-auto flex items-center justify-between max-[414px]:flex-wrap max-[414px]:gap-2.5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={toggleLike}
                      className={`w-10 h-10 flex items-center justify-center rounded-xl transition`}
                    >
                      <Heart className={`w-5 h-5 ${isLiked ? 'fill-white text-white' : 'text-gray-400 hover:text-white'}`} />
                    </button>

                    <div className="relative">
                      <button
                        onClick={() => closePopup('playlist')}
                        className={`w-10 h-10 flex items-center justify-center rounded-xl transition ${activePopup === 'playlist' ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                      {activePopup === 'playlist' && (
                        <div
                          className="absolute bottom-full mb-2 left-0 rounded-xl p-2 shadow-xl min-w-36 z-50 max-h-48 overflow-y-auto"
                          style={{
                            background: 'rgba(0, 0, 0, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                        >
                          {playlists.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => { addOrRemoveFromPlaylist(p.id); setActivePopup(null) }}
                              className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between ${isTrackInPlaylist(p.id) ? 'text-purple-400' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                            >
                              <span className="truncate">{p.title}</span>
                              {isTrackInPlaylist(p.id) && <span className="text-xs">✓</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setViewMode('lyrics')}
                      disabled={!hasLyrics && !lyricsLoading}
                      className="w-10 h-10 flex items-center justify-center rounded-xl transition text-gray-400 hover:text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Текст песни"
                    >
                      <Type className="w-5 h-5" />
                    </button>

                    {clipLinkTarget && (
                      <Link
                        to={clipLinkTarget}
                        onClick={handlePlayerNavigation}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                        title="Открыть клип"
                        aria-label="Открыть клип к треку"
                      >
                        <Clapperboard className="h-5 w-5" />
                      </Link>
                    )}
                  </div>

                  <div className="flex items-center gap-3 max-[414px]:ml-auto max-[414px]:gap-2">
                    <div className="relative group/volume">
                      <button
                        className="w-10 h-10 flex items-center justify-center rounded-xl transition text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
                      >
                        {volume === 0 ? <VolumeX /> : volume < 50 ? <Volume1 /> : <Volume2 />}
                      </button>
                      <div className="absolute bottom-full left-0 right-0 h-2 opacity-0 group-hover/volume:opacity-100 pointer-events-auto" />
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 pointer-events-none group-hover/volume:opacity-100 group-hover/volume:pointer-events-auto transition-opacity duration-150">
                        <div
                          className="rounded-xl p-3 shadow-xl z-50"
                          style={{
                            background: 'rgba(0, 0, 0, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                        >
                          <div
                            data-volume
                            className="w-1 h-24 bg-white/20 rounded-full cursor-pointer relative"
                            onMouseDown={() => setDraggingBand(-1)}
                          >
                            <div
                              className="absolute bottom-0 left-0 w-full bg-white rounded-full transition-all pointer-events-none"
                              style={{ height: `${volume}%` }}
                            />
                            <div
                              className="absolute left-0 right-0 bg-white rounded-full h-2 shadow-lg pointer-events-none"
                              style={{ bottom: `calc(${volume}% - 4px)` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => {
                          setActivePopup(activePopup === 'eq' ? null : 'eq')
                        }}
                        className={`w-10 h-10 flex items-center justify-center rounded-xl transition cursor-pointer ${activePopup === 'eq' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                      >
                        <Sliders className="w-5 h-5" />
                      </button>
                      <AnimatePresence>
                        {activePopup === 'eq' && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute bottom-full left-1/2 z-50 mb-3 w-80 -translate-x-1/2 rounded-2xl p-5 shadow-2xl max-[414px]:right-0 max-[414px]:left-auto max-[414px]:w-[calc(100vw-2rem)] max-[414px]:max-w-[320px] max-[414px]:translate-x-0 max-[375px]:w-[calc(100vw-1.25rem)]"
                            style={{
                              background: 'linear-gradient(180deg, rgba(14, 14, 22, 0.92), rgba(6, 6, 12, 0.88))',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              boxShadow: '0 24px 80px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
                            }}
                          >
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-white">Эквалайзер</h4>
                            <button onClick={() => setActivePopup(null)} className="text-gray-400 hover:text-white transition cursor-pointer">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="relative mb-5 preset-menu-container">
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-white/60">Пресет</span>
                              <button
                                onClick={() => setShowPresetMenu(!showPresetMenu)}
                                className="bg-white/10 text-sm text-white rounded-xl px-3 py-2 flex-1 border border-white/10 hover:border-white/20 transition cursor-pointer text-left flex items-center justify-between"
                              >
                                <span>{eqPreset}</span>
                                <motion.span
                                  animate={{ rotate: showPresetMenu ? 180 : 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="text-xs text-white/60"
                                >
                                  ▼
                                </motion.span>
                              </button>
                            </div>
                            <AnimatePresence>
                              {showPresetMenu && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                  transition={{ duration: 0.15 }}
                                  className="absolute top-full mt-2 left-0 right-0 rounded-xl shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-white/30"
                                  style={{
                                    background: 'rgba(0, 0, 0, 0.8)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                  }}
                                >
                                  {eqPresets.map((preset: string) => (
                                    <button
                                      key={preset}
                                      onClick={() => {
                                        setEqPreset(preset)
                                        setShowPresetMenu(false)
                                      }}
                                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                        eqPreset === preset
                                          ? 'bg-white/20 text-white font-medium'
                                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                                      }`}
                                    >
                                      {preset}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                          <div className="flex items-end justify-between gap-3 pt-4 border-t border-white/10">
                            {eqBands.map((value, index) => {
                              const freqLabels = ['60Hz', '230Hz', '910Hz', '4kHz', '14kHz']
                              const bandLabels = ['Sub', 'Low', 'Mid', 'Presence', 'Air']
                              const percent = ((value + 12) / 24) * 100
                              return (
                                <div key={index} className="flex flex-col items-center gap-2 flex-1">
                                  <span className={`min-w-9 rounded-full px-2 py-0.5 text-center text-[10px] font-medium transition-colors ${value !== 0 ? 'bg-white/10 text-white' : 'bg-white/[0.04] text-white/40'}`}>
                                    {value > 0 ? '+' : ''}{value}dB
                                  </span>
                                  <div
                                    data-band={index}
                                    className="group relative flex h-28 w-7 cursor-pointer select-none items-center justify-center"
                                    onMouseDown={() => setDraggingBand(index)}
                                  >
                                    <div className="relative h-full w-3 overflow-hidden rounded-full border border-white/10 bg-white/[0.045] transition group-hover:border-white/25">
                                      <div
                                        className="absolute bottom-0 left-0 right-0 rounded-full bg-gradient-to-t from-cyan-200/75 via-violet-200/80 to-white/90 transition-all duration-150"
                                        style={{ height: `${percent}%` }}
                                      />
                                      <div
                                        className="pointer-events-none absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.45)] transition-all"
                                        style={{ bottom: `calc(${percent}% - 5px)` }}
                                      />
                                    </div>
                                  </div>
                                  <div className="text-center leading-tight">
                                    <span className="block text-[10px] font-medium text-white/45">{freqLabels[index]}</span>
                                    <span className="block text-[9px] text-white/25">{bandLabels[index]}</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

