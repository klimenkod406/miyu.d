import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef, useMemo } from 'react'
import { ListMusic, Music, Play, Pause, Clock, ArrowLeft, Trash2, Upload, Pin, PinOff, Heart } from 'lucide-react'
import { usePlayer } from '../hooks/PlayerContext'
import { useAuth } from '../hooks/AuthContext'
import { getStoredTokens } from '../api/auth'
import { ExplicitBadge } from '../components/ExplicitBadge'

interface Track {
  id: number
  title: string
  artist_name: string
  artist_id: number
  duration: number
  cover_url: string
  is_explicit?: boolean
}

interface Playlist {
  id: number
  title: string
  description: string | null
  cover_url: string | null
  is_public: boolean
  is_system: boolean
  is_pinned: number
  owner_name: string
  user_id: number
  is_liked?: boolean
  can_be_liked?: boolean
}

const getCoverUrl = (coverUrl: string | null | undefined): string => {
  if (!coverUrl) return ''
  if (coverUrl.startsWith('http') || coverUrl.startsWith('/uploads/')) return coverUrl
  return `/uploads/tracks/${coverUrl}`
}

export default function PlaylistPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, accessToken } = useAuth()
  const tokens = useMemo(() => getStoredTokens(), [accessToken])
  const player = usePlayer()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  const [showCoverUpload, setShowCoverUpload] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPlaylist(null)
    setTracks([])
    setLoading(true)
    if (!tokens || !id) {
      setLoading(false)
      return
    }
    loadPlaylist(() => cancelled)

    return () => {
      cancelled = true
    }
  }, [id, tokens?.accessToken, user?.id])

  const loadPlaylist = (isCancelled: () => boolean = () => false) => {
    if (!tokens || !id) return

    fetch(`/api/playlists/${id}`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (isCancelled()) return
        if (data && data.id) {
          setPlaylist(data)
          if (!editingTitle) {
            setTitleValue(data.title)
          }
          setTracks(Array.isArray(data.tracks) ? data.tracks : [])
          setIsOwner(user?.id === data.user_id)
        } else {
          setPlaylist(null)
          setTracks([])
          setIsOwner(false)
        }
        setLoading(false)
      })
      .catch(() => {
        if (isCancelled()) return
        setPlaylist(null)
        setTracks([])
        setIsOwner(false)
        setLoading(false)
      })
  }

  const handleSaveTitle = async () => {
    if (!tokens || !id || !titleValue.trim() || savingTitle || titleValue === playlist?.title) {
      setTitleValue(playlist?.title || '')
      setEditingTitle(false)
      return
    }
    setSavingTitle(true)

    try {
      await fetch(`/api/playlists/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`
        },
        body: JSON.stringify({ title: titleValue.trim() })
      })
      setPlaylist(p => p ? { ...p, title: titleValue.trim() } : null)
      setEditingTitle(false)
    } catch (err) {
      console.error('Save title error:', err)
    } finally {
      setSavingTitle(false)
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle()
    } else if (e.key === 'Escape') {
      setTitleValue(playlist?.title || '')
      setEditingTitle(false)
    }
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !tokens || !id || uploadingCover) return
    setUploadingCover(true)

    const formData = new FormData()
    formData.append('cover', file)

    try {
      const res = await fetch(`/api/playlists/${id}/cover`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        setPlaylist(p => p ? { ...p, cover_url: data.cover_url } : null)
      }
    } catch (err) {
      console.error('Upload cover error:', err)
    } finally {
      setUploadingCover(false)
      setShowCoverUpload(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePlay = () => {
    if (tracks.length === 0) return

    const isCurrentPlaylist = player.currentPlaylist?.mode === 'playlist' && player.currentPlaylist.id === playlist?.id && tracks.some(t => player.currentTrack?.id === t.id)
    if (isCurrentPlaylist && player.isPlaying) {
      player.pause()
    } else if (isCurrentPlaylist) {
      player.play()
    } else {
      player.setQueue(
        tracks.map(mapPlaylistTrackForPlayer),
        true,
        playlist ? { id: playlist.id, title: playlist.title, mode: 'playlist', is_system: playlist.is_system } : undefined,
      )
    }
  }

  const mapPlaylistTrackForPlayer = (track: Track) => ({
    ...track,
    artist: {
      id: track.artist_id,
      username: track.artist_name,
      email: '',
      role: 'artist' as const,
      is_verified: false,
      is_premium: false,
      created_at: '',
    },
    cover_url: track.cover_url || undefined,
    file_path: (track as any).file_path || '',
    is_explicit: track.is_explicit,
    is_premium: Boolean((track as any).is_premium),
    status: ((track as any).status || 'approved') as 'approved' | 'pending' | 'rejected',
    created_at: (track as any).created_at || '',
  })

  const handlePlayTrack = (track: Track) => {
    player.setTrack(
      mapPlaylistTrackForPlayer(track),
      true,
      playlist ? { id: playlist.id, title: playlist.title, mode: 'playlist', is_system: playlist.is_system } : undefined,
    )
  }

  const handleTogglePin = async () => {
    if (!tokens || !id || !playlist) return
    
    try {
      await fetch(`/api/playlists/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`
        },
        body: JSON.stringify({ is_pinned: playlist.is_pinned ? 0 : 1 })
      })
      setPlaylist(p => p ? { ...p, is_pinned: p.is_pinned === 1 ? 0 : 1 } : null)
      window.dispatchEvent(new Event('playlist-pinned'))
    } catch (err) {
      console.error('Toggle pin error:', err)
    }
  }

  const handleDelete = async () => {
    if (playlist?.is_system) return
    if (!tokens || !confirm('Удалить плейлист?')) return
    
    try {
      await fetch(`/api/playlists/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      })
      navigate('/profile/library/playlists')
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const handleToggleLikePlaylist = async () => {
    if (!tokens || !id || !playlist?.can_be_liked || likeLoading) return

    setLikeLoading(true)
    try {
      const res = await fetch(`/api/playlists/${id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      })

      if (!res.ok) return

      const data = await res.json()
      setPlaylist(prev => prev ? { ...prev, is_liked: !!data.liked } : prev)
    } catch (err) {
      console.error('Toggle playlist like error:', err)
    } finally {
      setLikeLoading(false)
    }
  }

  const handleRemoveTrack = async (trackId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!tokens || !id) return
    
    try {
      await fetch(`/api/playlists/${id}/tracks/${trackId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      })
      setTracks(tracks.filter(t => t.id !== trackId))
    } catch (err) {
      console.error('Remove track error:', err)
    }
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0)
  const isCurrentPlaylistContext = player.currentPlaylist?.mode === 'playlist' && player.currentPlaylist.id === playlist?.id
  const isCurrentPlaylistPlaying = player.isPlaying && isCurrentPlaylistContext && tracks.some(t => player.currentTrack?.id === t.id)
  const formatTotalDuration = () => {
    const hours = Math.floor(totalDuration / 3600)
    const mins = Math.floor((totalDuration % 3600) / 60)
    if (hours > 0) return `${hours} ч ${mins} мин`
    return `${mins} мин`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!playlist) {
    return <div className="p-8 text-center text-white/50">Плейлист не найден</div>
  }

  return (
    <div className="text-white">
      <button
        onClick={() => navigate(isOwner ? '/profile/library/playlists' : '/profile/library/liked-playlists')}
        className="mb-6 flex items-center gap-2 text-white/50 transition hover:text-white max-[414px]:mb-4 max-[414px]:gap-1.5 max-[414px]:text-sm"
      >
        <ArrowLeft className="max-[414px]:h-[18px] max-[414px]:w-[18px]" size={20} />
        <span>{isOwner ? 'К плейлистам' : 'К сохранённым плейлистам'}</span>
      </button>

      <div className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 z-0">
          {playlist.cover_url ? (
            <>
              <img loading="lazy" src={playlist.cover_url} alt="" className="w-full h-full object-cover blur-3xl scale-125 opacity-40" />
              <div className="absolute inset-0 bg-dark-900/60" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-900/50 to-pink-900/50" />
          )}
        </div>
        
        <div className="relative z-10 flex flex-col gap-6 p-6 max-[414px]:gap-4 max-[414px]:p-4 max-[375px]:gap-3 max-[375px]:p-3.5 md:flex-row">
          <div 
            className="relative h-48 w-48 flex-shrink-0 overflow-hidden rounded-xl shadow-2xl group max-[414px]:h-24 max-[414px]:w-24 max-[375px]:h-20 max-[375px]:w-20"
            onMouseEnter={() => isOwner && setShowCoverUpload(true)}
            onMouseLeave={() => isOwner && setShowCoverUpload(false)}
          >
            {playlist.cover_url ? (
              <img loading="lazy" src={playlist.cover_url} alt={playlist.title} className="w-full h-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white/5">
                <ListMusic size={80} className="text-white/30 max-[414px]:h-10 max-[414px]:w-10 max-[375px]:h-8 max-[375px]:w-8" />
              </div>
            )}
            {isOwner && showCoverUpload && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <label className="cursor-pointer rounded-full bg-white/20 p-3 transition hover:bg-white/30 max-[414px]:p-2.5">
                  <Upload className="max-[414px]:h-5 max-[414px]:w-5" size={24} />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    className="hidden"
                    disabled={uploadingCover}
                  />
                </label>
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col justify-end">
            <p className="text-sm text-white/40 max-[414px]:text-[11px]">ПЛЕЙЛИСТ</p>
          {isOwner && editingTitle ? (
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleSaveTitle}
              autoFocus
              disabled={savingTitle}
              className="mb-2 w-full border-b border-white/30 bg-transparent text-3xl font-bold outline-none focus:border-white/60 disabled:opacity-50 max-[414px]:text-2xl max-[375px]:text-[1.4rem]"
            />
          ) : isOwner ? (
            <h1 
              className="mb-2 truncate text-3xl font-bold transition hover:text-purple-400 cursor-pointer max-[414px]:text-2xl max-[375px]:text-[1.4rem]"
              onClick={() => setEditingTitle(true)}
            >
              {playlist.title}
            </h1>
          ) : (
            <h1 className="mb-2 truncate text-3xl font-bold max-[414px]:text-2xl max-[375px]:text-[1.4rem]">{playlist.title}</h1>
          )}
          {playlist.description && (
            <p className="mb-2 text-white/50 max-[414px]:text-sm">{playlist.description}</p>
          )}
<p className="text-sm text-white/40 max-[414px]:text-xs">
            {tracks.length} треков • {formatTotalDuration()}
          </p>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-4 px-6 pb-6 max-[414px]:gap-2.5 max-[414px]:px-4 max-[414px]:pb-4 max-[375px]:px-3.5">
          <button 
            onClick={handlePlay}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg transition transform hover:scale-105 hover:bg-gray-200 max-[414px]:h-12 max-[414px]:w-12"
          >
            {isCurrentPlaylistPlaying ? (
              <Pause className="ml-0.5 h-7 w-7 text-black max-[414px]:h-6 max-[414px]:w-6" />
            ) : (
              <Play className="ml-1 h-7 w-7 text-black max-[414px]:h-6 max-[414px]:w-6" />
            )}
          </button>
          {isOwner && (
            <button
              onClick={handleTogglePin}
              className={`flex h-10 w-10 items-center justify-center transition max-[414px]:h-9 max-[414px]:w-9 ${playlist.is_pinned === 1 ? 'text-purple-400' : 'text-white/60 hover:text-white'}`}
            >
              {playlist.is_pinned === 1 ? <PinOff className="w-6 h-6 max-[414px]:h-5 max-[414px]:w-5" /> : <Pin className="w-6 h-6 max-[414px]:h-5 max-[414px]:w-5" />}
            </button>
          )}
          {!isOwner && playlist.can_be_liked && (
            <button
              onClick={handleToggleLikePlaylist}
              disabled={likeLoading}
              className={`flex h-10 w-10 items-center justify-center transition max-[414px]:h-9 max-[414px]:w-9 ${playlist.is_liked ? 'text-white' : 'text-white/60 hover:text-white'} disabled:opacity-50`}
            >
              <Heart className={`w-6 h-6 max-[414px]:h-5 max-[414px]:w-5 ${playlist.is_liked ? 'fill-current' : ''}`} />
            </button>
          )}
          {isOwner && !playlist.is_system && (
            <button
              onClick={handleDelete}
              className="flex h-10 w-10 items-center justify-center text-white/60 transition hover:text-red-400 max-[414px]:h-9 max-[414px]:w-9"
            >
              <Trash2 className="w-6 h-6 max-[414px]:h-5 max-[414px]:w-5" />
            </button>
          )}
        </div>

        <div className="relative z-10 px-6 pb-6 max-[414px]:px-2 max-[414px]:pb-4 max-[375px]:px-1.5">
          {tracks.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              <Music size={48} className="mx-auto mb-4 opacity-30" />
              <p>В этом плейлисте пока нет треков</p>
              <p className="text-sm mt-2">Добавьте треки из альбомов или поиска</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="mb-2 grid grid-cols-[3rem_1fr_auto] gap-4 px-4 text-sm text-white/30 max-[414px]:grid-cols-[2rem_1fr_auto] max-[414px]:gap-2.5 max-[414px]:px-2 max-[414px]:text-xs">
                <span className="text-center">#</span>
                <span>Название</span>
                <Clock className="h-4 w-4 max-[414px]:h-3.5 max-[414px]:w-3.5" />
              </div>
              {tracks.map((track, index) => {
                const isCurrent = player.currentTrack?.id === track.id
                return (
                  <div
                    key={track.id}
                    onClick={() => handlePlayTrack(track)}
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
                      {track.cover_url ? (
                        <img loading="lazy" src={getCoverUrl(track.cover_url)} alt="" className="h-10 w-10 flex-shrink-0 rounded object-cover max-[414px]:h-8 max-[414px]:w-8" />
                      ) : (
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-white/[0.02] max-[414px]:h-8 max-[414px]:w-8">
                          <Music size={20} className="text-white/30 max-[414px]:h-4 max-[414px]:w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className={`truncate font-medium transition max-[414px]:text-sm ${isCurrent ? 'text-white' : 'group-hover:text-purple-400'}`}><span className="inline-flex items-center gap-1">{track.title}<ExplicitBadge is_explicit={track.is_explicit} size="xs" /></span></p>
                        <p className="truncate text-sm text-white/40 max-[414px]:text-xs">{track.artist_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 max-[414px]:gap-1.5">
                      {isOwner && (
                        <button
                          onClick={(e) => handleRemoveTrack(track.id, e)}
                          className="flex h-8 w-8 items-center justify-center text-white/30 opacity-0 transition hover:text-red-400 group-hover:opacity-100 max-[414px]:h-7 max-[414px]:w-7"
                        >
                          <Trash2 size={16} className="max-[414px]:h-3.5 max-[414px]:w-3.5" />
                        </button>
                      )}
                      <span className="text-sm text-white/60 max-[414px]:text-xs">{formatDuration(track.duration)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
