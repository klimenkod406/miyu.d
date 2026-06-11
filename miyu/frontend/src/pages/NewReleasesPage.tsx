import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Music, Pause, Play, Sparkles, Disc3, Clock3, Radio } from 'lucide-react'
import { usePlayer } from '../hooks/PlayerContext'
import { ExplicitBadge } from '../components/ExplicitBadge'
import type { Track } from '../types'

const releasePalettes = [
  'from-fuchsia-500/16 via-pink-500/10 to-transparent',
  'from-cyan-500/16 via-sky-500/10 to-transparent',
  'from-emerald-500/16 via-teal-500/10 to-transparent',
  'from-amber-500/16 via-orange-500/10 to-transparent',
]

function formatDuration(seconds: number) {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function NewReleasesPage() {
  const player = usePlayer()
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/tracks')
        const data = await res.json()
        setTracks(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Failed to load new releases:', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const featured = tracks[0]
  const secondary = useMemo(() => tracks.slice(1, 5), [tracks])
  const catalog = useMemo(() => tracks.slice(5, 17), [tracks])
  const columns = useMemo(() => [catalog.slice(0, 6), catalog.slice(6, 12)], [catalog])

  const playTrack = (track: Track) => {
    const isCurrent = player.currentTrack?.id === track.id
    if (isCurrent && player.isPlaying) {
      player.pause()
      return
    }
    if (isCurrent) {
      player.play()
      return
    }
    player.setTrack(track)
    player.setQueue(tracks)
    player.play()
  }

  const isCurrentTrack = (track: Track) => player.currentTrack?.id === track.id && player.isPlaying

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>
  }

  if (tracks.length === 0) {
    return (
      <div className="rounded-[2rem] border border-white/[0.06] bg-white/[0.02] p-10 text-center">
        <Music className="mx-auto mb-4 h-10 w-10 text-white/25" />
        <h1 className="text-2xl font-bold">Новинки скоро появятся</h1>
        <p className="mt-2 text-white/45">Когда в каталоге появятся свежие релизы, мы покажем их здесь в первую очередь.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/[0.06] bg-[linear-gradient(135deg,rgba(10,10,10,0.98),rgba(24,24,27,0.96)_35%,rgba(16,185,129,0.22)_75%,rgba(88,28,135,0.34))] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-white/55">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2"><Sparkles className="h-4 w-4 text-pink-300" />Новые релизы Miyu</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2"><Radio className="h-4 w-4 text-emerald-300" />Свежие премьеры</span>

        </div>
        <h1 className="text-4xl font-bold md:text-5xl">Новинки</h1>
        <p className="mt-3 max-w-2xl text-white/60">Свежие треки собраны в одном потоке: здесь удобно быстро включить новый релиз, посмотреть последние пополнения каталога и не пропустить заметные премьеры.</p>
      </section>

      {featured && (
        <section className="rounded-[2rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 backdrop-blur-xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-white/40">featured release</p>
              <h2 className="mt-2 text-2xl font-bold">Главная премьера</h2>
            </div>
            <span className="rounded-full bg-white/8 px-3 py-1.5 text-xs text-white/60">Слушать первым</span>
          </div>

          <button
            type="button"
            onClick={() => playTrack(featured)}
            className="group relative w-full overflow-hidden rounded-[1.6rem] border border-white/[0.05] bg-white/[0.02] p-4 text-left transition hover:border-white/10 hover:bg-white/[0.04]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/14 via-cyan-500/8 to-transparent" />
            <div className="relative grid gap-4 md:grid-cols-[220px,1fr] md:items-center">
              <div className="aspect-square overflow-hidden rounded-[1.35rem] bg-white/[0.03] shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
                {featured.cover_url || featured.album?.cover_url ? (
                  <img src={featured.cover_url || featured.album?.cover_url} alt={featured.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center"><Music className="h-14 w-14 text-white/20" /></div>
                )}
              </div>
              <div>
                <h3 className="text-3xl font-bold leading-tight md:text-4xl">{featured.title}</h3>
                <p className="mt-2 text-lg text-white/55">{featured.artist?.username}</p>
                <div className="mt-5 flex flex-wrap gap-3 text-sm text-white/55">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-2"><Disc3 className="h-4 w-4" />Свежий релиз</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-2"><Clock3 className="h-4 w-4" />{formatDuration(featured.duration)}</span>
                </div>
                <div className="mt-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition group-hover:bg-white/15">
                  {isCurrentTrack(featured) ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                </div>
              </div>
            </div>
          </button>
        </section>
      )}

      {secondary.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {secondary.map((track, index) => (
            <button
              key={track.id}
              type="button"
              onClick={() => playTrack(track)}
              className="group relative overflow-hidden rounded-[1.6rem] border border-white/[0.06] bg-black/10 p-5 text-left backdrop-blur-xl transition hover:border-white/10 hover:bg-white/[0.04]"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${releasePalettes[index % releasePalettes.length]}`} />
              <div className="relative">
                <div className="mb-4 aspect-square overflow-hidden rounded-[1.2rem] bg-white/[0.03] shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
                  {track.cover_url || track.album?.cover_url ? (
                    <img src={track.cover_url || track.album?.cover_url} alt={track.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Music className="h-10 w-10 text-white/20" /></div>
                  )}
                </div>
                <p className="text-sm text-white/40">Премьера #{index + 1}</p>
                <div className="mt-2 flex items-center gap-1.5 min-w-0">
                  <p className="truncate text-lg font-semibold">{track.title}</p>
                  <ExplicitBadge is_explicit={track.is_explicit} size="sm" />
                </div>
                <p className="truncate text-sm text-white/45">{track.artist?.username}</p>
              </div>
            </button>
          ))}
        </section>
      )}

      {catalog.length > 0 && (
        <section className="grid gap-6 xl:grid-cols-2">
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className="rounded-[2rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-white/40">new releases {columnIndex + 1}</p>
                  <h2 className="mt-2 text-2xl font-bold">{columnIndex === 0 ? 'Свежие добавления' : 'Ещё новинки'}</h2>
                </div>
                <span className="rounded-full bg-white/8 px-3 py-1.5 text-xs text-white/60">{column.length} треков</span>
              </div>

              <div className="space-y-3">
                {column.map((track, index) => {
                  const position = columnIndex * 6 + index + 1
                  const palette = releasePalettes[(position - 1) % releasePalettes.length]
                  const isCurrent = isCurrentTrack(track)

                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => playTrack(track)}
                      className="group relative w-full overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 text-left transition hover:border-white/10 hover:bg-white/[0.04]"
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${palette}`} />
                      <div className="relative flex items-center gap-3">
                        <div className="flex w-8 shrink-0 flex-col items-center justify-center text-center">
                          <span className="text-sm font-semibold text-white/45">{position}</span>
                        </div>

                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/[0.03] text-left">
                          {track.cover_url || track.album?.cover_url ? (
                            <img src={track.cover_url || track.album?.cover_url} alt={track.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_45%),linear-gradient(135deg,rgba(16,185,129,0.24),rgba(236,72,153,0.18),rgba(59,130,246,0.16))]">
                              <Music className="h-6 w-6 text-white/60" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="truncate text-sm font-semibold text-white">{track.title}</p>
                                <ExplicitBadge is_explicit={track.is_explicit} size="xs" />
                              </div>
                              <p className="truncate text-xs text-white/45">{track.artist?.username}</p>
                            </div>
                            <span className="text-sm text-white/45">{formatDuration(track.duration)}</span>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] text-white/60">Новый релиз</span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition group-hover:bg-white/15">
                              {isCurrent ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { title: 'Главная премьера', value: featured?.title || '—', accent: 'from-fuchsia-500/18 to-transparent' },
          { title: 'Новый артист в фокусе', value: featured?.artist?.username || '—', accent: 'from-cyan-500/18 to-transparent' },
          { title: 'Треков в витрине', value: String(tracks.length), accent: 'from-emerald-500/18 to-transparent' },
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
