import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Play, Pause, Music2, Verified, Loader2 } from 'lucide-react'
import { recsysApi, type SimilarTrack } from '../api/recsys'
import { usePlayer } from '../hooks/PlayerContext'
import { ExplicitBadge } from './ExplicitBadge'

interface Props {
  trackId: number
  limit?: number
  /** Заголовок секции; default: «Похожие треки». */
  title?: string
}

function fmtDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function SimilarTracks({ trackId, limit = 10, title = 'Похожие треки' }: Props) {
  const [tracks, setTracks] = useState<SimilarTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const player = usePlayer()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    recsysApi.getSimilarTracks(trackId, limit)
      .then(r => {
        if (cancelled) return
        setTracks(r.tracks || [])
      })
      .catch(e => {
        if (cancelled) return
        setError(e?.message || 'Ошибка загрузки')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [trackId, limit])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-white/40 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Подбираем похожие треки…
      </div>
    )
  }

  if (error || tracks.length === 0) {
    return null
  }

  const handlePlay = (t: SimilarTrack) => {
    const trackForPlayer: any = {
      id: t.id,
      title: t.title,
      artist_id: t.artist_id,
      artist: {
        id: t.artist_id,
        username: t.artist.username,
        email: '',
        role: 'artist' as const,
        is_verified: t.artist.is_verified,
        is_premium: false,
        created_at: '',
      },
      duration: t.duration,
      file_path: t.file_path || '',
      cover_url: t.cover_url || undefined,
      is_explicit: t.is_explicit,
      is_premium: false,
      status: 'approved' as const,
      created_at: '',
    }
    player.setQueue(tracks.map(x => ({ ...trackForPlayer, id: x.id, title: x.title, file_path: x.file_path || '', cover_url: x.cover_url || undefined })))
    player.setTrack(trackForPlayer, true)
  }

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-purple-400" />
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="text-xs text-white/30 ml-2">по аудио-сходству</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {tracks.map(t => {
          const isCurrent = player.currentTrack?.id === t.id
          const isPlayingThis = isCurrent && player.isPlaying
          return (
            <div
              key={t.id}
              className="group flex items-center gap-3 p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] hover:border-white/10 transition"
            >
              <div className="relative w-12 h-12 rounded-lg bg-white/[0.05] overflow-hidden flex-shrink-0">
                {t.cover_url ? (
                  <img loading="lazy" src={t.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music2 className="w-5 h-5 text-white/30" />
                  </div>
                )}
                <button
                  onClick={() => handlePlay(t)}
                  className={`absolute inset-0 flex items-center justify-center bg-black/50 transition ${
                    isPlayingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {isPlayingThis ? (
                    <Pause className="w-5 h-5 text-white" />
                  ) : (
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  )}
                </button>
              </div>

              <Link to={`/track/${t.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className={`font-medium text-sm truncate ${isCurrent ? 'text-purple-400' : 'text-white'}`}>
                    {t.title}
                    <ExplicitBadge is_explicit={t.is_explicit} size="xs" />
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-white/40">
                  <span className="truncate">{t.artist.username}</span>
                  {t.artist.is_verified && <Verified className="w-3 h-3 text-blue-400 flex-shrink-0" />}
                  <span>·</span>
                  <span>{fmtDuration(t.duration)}</span>
                </div>
              </Link>

              <div className="text-[10px] font-mono text-white/30 px-2 py-0.5 rounded bg-white/[0.03]">
                {(t.similarity * 100).toFixed(0)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
