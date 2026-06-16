import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Music, Play, Trash2, Edit, Loader2 } from 'lucide-react'
import { artistApi } from '../api/artist'
import { getStoredTokens } from '../api/auth'
import { usePlayer } from '../hooks/PlayerContext'
import type { Track } from '../types'

export default function ArtistTracksPage() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const player = usePlayer()

  const fetchTracks = async () => {
    const tokens = getStoredTokens()
    if (!tokens) {
      setError('Вы не авторизованы')
      setLoading(false)
      return
    }

    try {
      const data = await artistApi.getTracks(tokens.accessToken)
      setTracks(data)
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTracks()
  }, [])

  const handleDelete = async (trackId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот трек?')) return

    const tokens = getStoredTokens()
    if (!tokens) return

    setDeletingId(trackId)
    try {
      await artistApi.deleteTrack(tokens.accessToken, trackId)
      setTracks(tracks.filter(t => t.id !== trackId))
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления')
    } finally {
      setDeletingId(null)
    }
  }
  
  const handlePlay = (track: Track) => {
    player.setTrack(track)
    player.setQueue(tracks)
    player.play()
  }

  const formatDuration = (seconds: number) => {
    if (isNaN(seconds) || seconds === null) return '0:00';
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Мои треки</h1>
        <Link to="/artist/upload" className="px-4 py-2 rounded-full font-medium text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transition">
          Загрузить
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {tracks.length === 0 ? (
        <div className="text-center py-20">
          <Music className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/40 mb-4">У вас пока нет треков</p>
          <Link to="/artist/upload" className="text-purple-400 hover:text-purple-300">
            Загрузить первый трек
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          {tracks.map((track, i) => {
            const coverPath = track.cover_url || track.album?.cover_url
            const coverUrl = coverPath ? coverPath : undefined
            const isCurrentTrack = player.currentTrack?.id === track.id
            const isPlaying = player.isPlaying && isCurrentTrack
            
            return (
              <div
                key={track.id}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/[0.04] bg-white/[0.02] border border-transparent hover:border-white/[0.05] transition duration-200 group ${isCurrentTrack ? 'border-white/10' : ''}`}
              >
                <div className="w-8 text-center">
                  {isPlaying ? (
                    <div className="flex items-end gap-0.5 h-4">
                      <div className="w-0.5 bg-white rounded-full animate-music-bar-1"></div>
                      <div className="w-0.5 bg-white rounded-full mx-0.5 animate-music-bar-2"></div>
                      <div className="w-0.5 bg-white rounded-full animate-music-bar-3"></div>
                    </div>
                  ) : (
                    <span className="text-white/30">{i + 1}</span>
                  )}
                </div>
                <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {coverUrl ? (
                    <img loading="lazy" src={coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Music className="w-5 h-5 text-white/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate transition ${isCurrentTrack ? 'text-white' : 'group-hover:text-purple-400'}`}>{track.title}</p>
                  {track.album?.title && (
                    <p className="text-sm text-white/40 truncate">{track.album.title}</p>
                  )}
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    track.status === 'approved'
                      ? 'bg-green-500/20 text-green-400'
                      : track.status === 'pending'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {track.status === 'approved' ? 'Одобрен' : track.status === 'pending' ? 'На проверке' : 'Отклонен'}
                </span>
                <span className="text-white/30 text-sm">{track.genre || '-'}</span>
                <span className="text-white/30 text-sm">{formatDate(track.created_at)}</span>
                <span className="text-white/30 text-sm w-12 text-right">{formatDuration(track.duration)}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => handlePlay(track)} className="p-2 rounded-lg hover:bg-white/10"><Play className="w-4 h-4" /></button>
                  <button className="p-2 rounded-lg hover:bg-white/10"><Edit className="w-4 h-4" /></button>
                  <button 
                    onClick={() => handleDelete(track.id)}
                    disabled={deletingId === track.id}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 disabled:opacity-50"
                  >
                    {deletingId === track.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
