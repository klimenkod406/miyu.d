import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Music, Play, Pause, Clock, Loader2, Trash2 } from 'lucide-react'
import { usePlayer } from '../hooks/PlayerContext'
import { getStoredTokens } from '../api/auth'

export default function LikedPage() {
  const [tracks, setTracks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const player = usePlayer()

  useEffect(() => {
    async function fetchLikedTracks() {
      const tokens = getStoredTokens()
      if (!tokens) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/likes', {
          headers: { Authorization: `Bearer ${tokens.accessToken}` }
        })
        const data = await res.json()
        setTracks(data || [])
      } catch (err) {
        console.error('Failed to load liked tracks:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchLikedTracks()
  }, [])

  const isCurrentTrack = (trackId: number) => player.currentTrack?.id === trackId
  const isLikedPlaying = player.isPlaying && tracks.some(t => isCurrentTrack(t.track_id))

  const handlePlayAll = () => {
    if (tracks.length === 0) return
    
    const trackData = tracks.map(t => ({
      id: t.track_id,
      title: t.title,
      artist_id: t.artist_id,
      artist: { id: t.artist_id, username: t.artist_name, email: '', role: 'artist' as const, is_verified: false, is_premium: false, created_at: '' },
      duration: t.duration || 0,
      file_path: t.file_path || '',
      cover_url: t.cover_url,
      is_explicit: false,
      is_premium: false,
      status: 'approved' as const,
      created_at: ''
    }))
    
    const isCurrentlyPlaying = player.isPlaying && tracks.some(t => player.currentTrack?.id === t.track_id)
    
    if (isCurrentlyPlaying) {
      player.pause()
    } else if (player.currentTrack && tracks.some(t => t.track_id === player.currentTrack?.id)) {
      player.play()
    } else {
      player.setTrack(trackData[0], true)
      player.setQueue(trackData)
    }
  }

  const handlePlayTrack = (track: any, index: number) => {
    const allTracks = tracks.map(t => ({
      id: t.track_id,
      title: t.title,
      artist_id: t.artist_id,
      artist: { id: t.artist_id, username: t.artist_name, email: '', role: 'artist' as const, is_verified: false, is_premium: false, created_at: '' },
      duration: t.duration || 0,
      file_path: t.file_path || '',
      cover_url: t.cover_url,
      is_explicit: false,
      is_premium: false,
      status: 'approved' as const,
      created_at: ''
    }))

    const trackData = allTracks[index]

    player.setQueue(allTracks)
    player.setTrack(trackData, true)
  }

  const handleRemoveLike = async (trackId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const tokens = getStoredTokens()
    if (!tokens) return
    try {
      await fetch(`/api/likes/${trackId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      })
      setTracks(tracks.filter(t => t.track_id !== trackId))
      if (player.currentTrack?.id === trackId) {
        player.refreshLikeStatus()
      }
    } catch (err) {
      console.error('Failed to remove like:', err)
    }
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0)
  const formatTotalDuration = () => {
    const hours = Math.floor(totalDuration / 3600)
    const mins = Math.floor((totalDuration % 3600) / 60)
    if (hours > 0) return `${hours} ч ${mins} мин`
    return `${mins} мин`
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  return (
    <div className="text-white">
      <div className="relative mb-6 overflow-hidden rounded-2xl">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-600/40 via-purple-600/30 to-dark-900" />
        </div>
        
        <div className="relative z-10 flex items-center gap-6 p-8 max-[414px]:gap-4 max-[414px]:p-4 max-[414px]:items-start max-[375px]:gap-3 max-[375px]:p-3.5">
          <div className="flex h-48 w-48 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 shadow-2xl max-[414px]:h-24 max-[414px]:w-24 max-[375px]:h-20 max-[375px]:w-20">
            <Heart size={64} className="text-white max-[414px]:h-9 max-[414px]:w-9 max-[375px]:h-8 max-[375px]:w-8" fill="currentColor" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-wider text-white/60 max-[414px]:text-[11px]">ИЗБРАННОЕ</p>
            <h1 className="my-3 text-5xl font-black tracking-tight max-[414px]:my-2 max-[414px]:text-3xl max-[375px]:text-[1.65rem]">Избранное</h1>
            <div className="flex items-center gap-2 text-sm text-white/70 max-[414px]:flex-wrap max-[414px]:gap-1.5 max-[414px]:text-xs">
              <span>{tracks.length} треков</span>
              <span>•</span>
              <span className="text-white/50">{formatTotalDuration()}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-8 pt-0 max-[414px]:px-0 max-[414px]:pb-0">
        <div className="mb-8 flex items-center gap-4 max-[414px]:mb-6 max-[414px]:px-1">
          <button 
            onClick={handlePlayAll}
            disabled={tracks.length === 0}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg transition transform hover:scale-105 hover:bg-gray-200 disabled:opacity-50 disabled:hover:scale-100 max-[414px]:h-12 max-[414px]:w-12"
          >
            {isLikedPlaying ? (
              <Pause className="ml-0.5 h-7 w-7 text-black max-[414px]:h-6 max-[414px]:w-6" />
            ) : (
              <Play className="ml-1 h-7 w-7 text-black max-[414px]:h-6 max-[414px]:w-6" />
            )}
          </button>
        </div>

        <div className="space-y-1">
          <div className="mb-2 grid grid-cols-[3rem_1fr_auto] gap-4 border-b border-white/10 px-4 pb-3 text-sm text-white/40 max-[414px]:grid-cols-[2rem_1fr_auto] max-[414px]:gap-2.5 max-[414px]:px-2 max-[414px]:text-xs">
            <span className="text-center">#</span>
            <span>Название</span>
            <Clock className="h-4 w-4 max-[414px]:h-3.5 max-[414px]:w-3.5" />
          </div>
          {tracks.map((track, index) => {
            const isCurrent = isCurrentTrack(track.track_id)
            return (
              <div
                key={track.track_id}
                onClick={() => handlePlayTrack(track, index)}
                className={`group grid grid-cols-[3rem_1fr_auto] gap-4 rounded-lg px-4 py-3 transition cursor-pointer max-[414px]:grid-cols-[2rem_1fr_auto] max-[414px]:gap-2.5 max-[414px]:px-2 max-[414px]:py-2.5 ${
                  isCurrent ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-center">
                  {isCurrent && player.isPlaying ? (
                    <div className="w-4 h-4 flex items-center justify-center">
                      <div className="w-1 h-4 bg-white rounded-full animate-music-bar-1"></div>
                      <div className="w-1 h-3 bg-white rounded-full mx-0.5 animate-music-bar-2"></div>
                      <div className="w-1 h-4 bg-white rounded-full animate-music-bar-3"></div>
                    </div>
                  ) : (
                    <span className="text-white/40 group-hover:hidden max-[414px]:text-xs">{index + 1}</span>
                  )}
                  {!isCurrent && <Play className="w-4 h-4 hidden group-hover:block text-white/60" />}
                </div>
                <div className="flex min-w-0 items-center gap-3 max-[414px]:gap-2.5">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/5 max-[414px]:h-8 max-[414px]:w-8">
                    {track.cover_url ? (
                      <img loading="lazy" src={track.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Music className="h-5 w-5 text-white/40 max-[414px]:h-4 max-[414px]:w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate font-medium max-[414px]:text-sm ${isCurrent ? 'text-white' : 'text-white'}`}>{track.title}</p>
                    <Link to={`/artist/${track.artist_id}`} className="block truncate text-sm text-white/40 hover:text-white max-[414px]:text-xs">{track.artist_name}</Link>
                  </div>
                </div>
                <div className="flex items-center gap-3 max-[414px]:gap-1.5">
                  <button 
                    onClick={(e) => handleRemoveLike(track.track_id, e)}
                    className="rounded-lg p-2 text-red-400 opacity-0 transition hover:bg-red-500/20 group-hover:opacity-100 max-[414px]:p-1.5"
                  >
                    <Trash2 className="h-4 w-4 max-[414px]:h-3.5 max-[414px]:w-3.5" />
                  </button>
                  <span className="w-12 text-right text-sm text-white/60 max-[414px]:w-10 max-[414px]:text-xs">
                    {formatDuration(track.duration)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {tracks.length === 0 && (
          <div className="text-center py-20">
            <Heart className="w-16 h-16 mx-auto mb-4 text-white/20" />
            <p className="text-white/40 text-lg">У вас пока нет избранных треков</p>
            <p className="text-white/30 text-sm mt-2">Треки, которые вам понравятся, появятся здесь</p>
          </div>
        )}
      </div>
    </div>
  )
}
