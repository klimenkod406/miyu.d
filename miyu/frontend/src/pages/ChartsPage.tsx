import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crown, Heart, Loader2, Music, Play, Radio, TrendingUp } from 'lucide-react'
import { usePlayer } from '../hooks/PlayerContext'
import { getStoredTokens } from '../api/auth'
import type { Track } from '../types'

function formatDuration(seconds: number) {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const rankPalettes = [
  'from-fuchsia-500/16 via-pink-500/10 to-transparent',
  'from-cyan-500/16 via-sky-500/10 to-transparent',
  'from-amber-500/16 via-orange-500/10 to-transparent',
  'from-violet-500/14 via-indigo-500/10 to-transparent',
]

function ChartCard({
  track,
  rank,
  tracks,
  isLiked,
  onToggleLike,
}: {
  track: Track
  rank: number
  tracks: Track[]
  isLiked: boolean
  onToggleLike: (trackId: number) => void
}) {
  const player = usePlayer()
  const coverUrl = track.cover_url || track.album?.cover_url
  const palette = rankPalettes[(rank - 1) % rankPalettes.length]

  const playTrack = () => {
    player.setTrack(track)
    player.setQueue(tracks)
    player.play()
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 transition hover:border-white/10 hover:bg-white/[0.04]">
      <div className={`absolute inset-0 bg-gradient-to-br ${palette}`} />
      <div className="relative flex items-center gap-3">
        <div className="flex w-8 shrink-0 flex-col items-center justify-center text-center">
          <span className="text-sm font-semibold text-white/45">{rank}</span>
          {rank === 1 && <Crown className="mt-1 h-3.5 w-3.5 text-amber-400" />}
        </div>

        <button type="button" onClick={playTrack} className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/[0.03] text-left">
          {coverUrl ? (
            <img loading="lazy" src={coverUrl} alt={track.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_45%),linear-gradient(135deg,rgba(99,102,241,0.28),rgba(236,72,153,0.2),rgba(34,197,94,0.16))]">
              <Music className="h-6 w-6 text-white/60" />
            </div>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{track.title}</p>
              <p className="truncate text-xs text-white/45">{track.artist?.username}</p>
            </div>
            <span className="text-sm text-white/45">{formatDuration(track.duration)}</span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <button type="button" onClick={playTrack} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/15">
                <Play className="ml-0.5 h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => onToggleLike(track.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/6 text-white/65 transition hover:bg-white/12 hover:text-white">
                <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-white text-white' : ''}`} />
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChartsPage() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [likedTrackIds, setLikedTrackIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/tracks/popular')
        const data = await res.json()
        const list = Array.isArray(data) ? data.slice(0, 20) : []
        setTracks(list)

        const tokens = getStoredTokens()
        if (tokens) {
          const checks = await Promise.all(list.map(async (track: Track) => {
            try {
              const likeRes = await fetch(`/api/likes/check/${track.id}`, { headers: { Authorization: `Bearer ${tokens.accessToken}` } })
              const likeData = await likeRes.json()
              return likeData.liked ? track.id : null
            } catch {
              return null
            }
          }))
          setLikedTrackIds(new Set(checks.filter((id): id is number => id !== null)))
        }
      } catch (err) {
        console.error('Failed to load charts:', err)
        setTracks([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const columns = useMemo(() => {
    return [tracks.slice(0, 10), tracks.slice(10, 20)]
  }, [tracks])

  const toggleLike = async (trackId: number) => {
    const tokens = getStoredTokens()
    if (!tokens) return
    try {
      const res = await fetch(`/api/likes/${trackId}`, { method: 'POST', headers: { Authorization: `Bearer ${tokens.accessToken}` } })
      const data = await res.json()
      setLikedTrackIds(prev => {
        const next = new Set(prev)
        if (data.liked) next.add(trackId)
        else next.delete(trackId)
        return next
      })
    } catch (err) {
      console.error('Failed to toggle like:', err)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>

  if (tracks.length === 0) {
    return (
      <div className="rounded-[2rem] border border-white/[0.06] bg-white/[0.02] p-10 text-center">
        <Music className="mx-auto mb-4 h-10 w-10 text-white/25" />
        <h1 className="text-2xl font-bold">Чарты скоро появятся</h1>
        <p className="mt-2 text-white/45">Когда система соберёт достаточно данных, здесь появится рейтинг популярных треков.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/[0.06] bg-[linear-gradient(135deg,rgba(10,10,10,0.98),rgba(24,24,27,0.96)_35%,rgba(37,99,235,0.26)_75%,rgba(88,28,135,0.34))] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-white/55">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2"><TrendingUp className="h-4 w-4 text-emerald-300" />Обновляется по прослушиваниям</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2"><Radio className="h-4 w-4 text-cyan-300" />Текущий срез популярности</span>
        </div>
        <h1 className="text-4xl font-bold md:text-5xl">Чарты</h1>
        <p className="mt-3 max-w-2xl text-white/60">Главные треки момента собраны в одном ритме: здесь легко увидеть, что звучит громче всего сегодня и к чему хочется возвращаться снова.</p>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className="rounded-[2rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 backdrop-blur-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-white/40">chart column {columnIndex + 1}</p>
                <h2 className="mt-2 text-2xl font-bold">{columnIndex === 0 ? 'Места 1–10' : 'Места 11–20'}</h2>
              </div>
              <span className="rounded-full bg-white/8 px-3 py-1.5 text-xs text-white/60">{column.length} треков</span>
            </div>

            <div className="space-y-3">
              {column.map((track, index) => {
                const rank = columnIndex * 10 + index + 1

                return (
                  <ChartCard
                    key={track.id}
                    track={track}
                    rank={rank}
                    tracks={tracks}
                    isLiked={likedTrackIds.has(track.id)}
                    onToggleLike={toggleLike}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { title: 'Трек №1', value: tracks[0]?.title || '—', accent: 'from-fuchsia-500/18 to-transparent' },
          { title: 'Самый заметный артист', value: tracks[0]?.artist?.username || '—', accent: 'from-cyan-500/18 to-transparent' },
          { title: 'Треков в витрине', value: String(tracks.length), accent: 'from-amber-500/18 to-transparent' },
        ].map((item) => (
          <div key={item.title} className="relative overflow-hidden rounded-[1.6rem] border border-white/[0.06] bg-black/10 p-5 backdrop-blur-xl">
            <div className={`absolute inset-0 bg-gradient-to-br ${item.accent}`} />
            <div className="relative">
              <p className="text-sm text-white/40">{item.title}</p>
              <p className="mt-2 text-xl font-semibold">{item.value}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="flex justify-end">
        <Link to="/" className="text-sm text-white/40 transition hover:text-white">На главную</Link>
      </div>
    </div>
  )
}
