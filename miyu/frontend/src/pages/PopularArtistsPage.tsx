import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Loader2, Mic2, Radio, Sparkles, Star, TrendingUp, Users } from 'lucide-react'
import type { User } from '../types'

type PopularArtist = Pick<User, 'id' | 'username' | 'avatar_url' | 'bio' | 'is_verified' | 'is_premium'> & {
  track_count?: number
  play_count?: number
  monthly_listeners?: string
  mood?: string
}

function formatCompactNumber(value?: number) {
  if (!value) return '0'
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(value)
}

function formatArtist(artist: any, index: number): PopularArtist {
  const plays = Number(artist.play_count || 0)
  const tracks = Number(artist.track_count || 0)
  const listenerEstimate = Math.max(plays > 0 ? Math.round(plays / 4.2) : tracks * 420, 0)

  const moods = [
    'Мягкий неон',
    'Городские сумерки',
    'Пульс улиц',
    'Большая сцена',
    'Ночное движение',
    'Холодный свет',
  ]

  return {
    id: artist.id,
    username: artist.username,
    avatar_url: artist.avatar_url || null,
    bio: artist.bio || 'Артист, который сейчас формирует настроение сцены Miyu.',
    is_verified: Boolean(artist.is_verified),
    is_premium: Boolean(artist.is_premium),
    track_count: tracks,
    play_count: plays,
    monthly_listeners: formatCompactNumber(listenerEstimate),
    mood: moods[index % moods.length],
  }
}

function ArtistAvatar({ artist, size = 'medium' }: { artist: PopularArtist; size?: 'large' | 'medium' | 'small' }) {
  const sizeClass = size === 'large' ? 'h-36 w-36' : size === 'medium' ? 'h-20 w-20' : 'h-14 w-14'
  const iconSize = size === 'large' ? 'h-12 w-12' : size === 'medium' ? 'h-7 w-7' : 'h-5 w-5'

  return (
    <div className={`${sizeClass} overflow-hidden rounded-full border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_45%),linear-gradient(135deg,rgba(99,102,241,0.35),rgba(236,72,153,0.25),rgba(34,197,94,0.2))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]`}>
      {artist.avatar_url ? (
        <img src={artist.avatar_url} alt={artist.username} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Mic2 className={`${iconSize} text-white/65`} />
        </div>
      )}
    </div>
  )
}

export default function PopularArtistsPage() {
  const [artists, setArtists] = useState<PopularArtist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/artists/popular')
        const data = await res.json()
        const list = Array.isArray(data) ? data.slice(0, 20).map(formatArtist) : []
        setArtists(list)
      } catch (err) {
        console.error('Failed to load popular artists:', err)
        setArtists([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const heroArtist = artists[0]
  const topThree = useMemo(() => artists.slice(0, 3), [artists])
  const nextSeventeen = useMemo(() => artists.slice(3, 20), [artists])

  const stats = useMemo(() => {
    const totalPlays = artists.reduce((sum, artist) => sum + (artist.play_count || 0), 0)
    const totalTracks = artists.reduce((sum, artist) => sum + (artist.track_count || 0), 0)
    const verifiedCount = artists.filter((artist) => artist.is_verified).length

    return [
      { title: 'Артистов в топе', value: String(artists.length), icon: Users, note: 'полный срез витрины' },
      { title: 'Совокупные прослушивания', value: formatCompactNumber(totalPlays), icon: Radio, note: 'по текущей двадцатке' },
      { title: 'Подтверждённых профилей', value: String(verifiedCount), icon: Star, note: 'артисты с верификацией' },
      { title: 'Треков в каталоге', value: formatCompactNumber(totalTracks), icon: TrendingUp, note: 'по всем 20 артистам' },
    ]
  }, [artists])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>

  if (artists.length === 0) {
    return (
      <div className="rounded-[2rem] border border-white/[0.06] bg-white/[0.02] p-10 text-center">
        <Mic2 className="mx-auto mb-4 h-10 w-10 text-white/25" />
        <h1 className="text-2xl font-bold">Популярные артисты скоро появятся</h1>
        <p className="mt-2 text-white/45">Когда в подборке появятся данные, здесь отобразится топ-20 артистов Miyu.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/[0.06] bg-[linear-gradient(145deg,rgba(8,8,8,0.98),rgba(20,20,24,0.95)_36%,rgba(124,58,237,0.28)_70%,rgba(14,165,233,0.22))] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-white/70">
          <Sparkles className="h-4 w-4 text-cyan-300" />Витрина популярных артистов
        </div>
        <h1 className="text-4xl font-bold md:text-5xl">Популярные артисты</h1>
        <p className="mt-3 max-w-3xl text-white/60">
          Здесь собраны 20 самых заметных артистов Miyu — от главных лиц недели до новых имён, которые уже формируют настроение сцены.
          Страница построена как масштабная витрина, чтобы сразу видеть и лидеров, и полный срез текущего интереса.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        {heroArtist && (
          <Link to={`/artist/${heroArtist.id}`} className="group relative overflow-hidden rounded-[2rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-8 transition hover:-translate-y-1 hover:border-white/15">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_28%),linear-gradient(135deg,rgba(124,58,237,0.14),transparent_45%,rgba(14,165,233,0.1))]" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
              <ArtistAvatar artist={heroArtist} size="large" />
              <div className="min-w-0 flex-1">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-sm text-white/65">
                  <Sparkles className="h-4 w-4 text-pink-300" />Артист №1 прямо сейчас
                </div>
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-3xl font-bold md:text-4xl">{heroArtist.username}</h2>
                  {heroArtist.is_verified && <Star className="h-5 w-5 shrink-0 fill-yellow-400 text-yellow-400" />}
                </div>
                <p className="mt-3 max-w-2xl text-white/55">{heroArtist.bio}</p>
                <div className="mt-5 flex flex-wrap gap-3 text-sm text-white/70">
                  <span className="rounded-full bg-white/8 px-3 py-1.5">{heroArtist.monthly_listeners} слушателей</span>
                  <span className="rounded-full bg-white/8 px-3 py-1.5">{formatCompactNumber(heroArtist.play_count)} прослушиваний</span>
                  <span className="rounded-full bg-white/8 px-3 py-1.5">{heroArtist.mood}</span>
                </div>
                <div className="mt-6 inline-flex items-center gap-2 text-sm text-white/80">Открыть страницу артиста <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></div>
              </div>
            </div>
          </Link>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
          {stats.map((stat) => {
            const Icon = stat.icon

            return (
              <div key={stat.title} className="rounded-[1.6rem] border border-white/[0.06] bg-black/10 p-5 backdrop-blur-xl">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <p className="text-sm text-white/40">{stat.title}</p>
                <p className="mt-1 text-2xl font-bold">{stat.value}</p>
                <p className="mt-2 text-sm text-white/45">{stat.note}</p>
              </div>
            )
          })}
        </div>
      </section>

      {topThree.length > 0 && (
        <section>
          <div className="mb-5">
            <p className="text-sm uppercase tracking-[0.24em] text-white/40">top 3 spotlight</p>
            <h2 className="mt-2 text-2xl font-bold">Главные лица недели</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {topThree.map((artist, index) => (
              <Link key={artist.id} to={`/artist/${artist.id}`} className={`group rounded-[1.85rem] border p-5 transition hover:-translate-y-1 hover:border-white/14 ${index === 0 ? 'border-purple-400/25 bg-[linear-gradient(180deg,rgba(124,58,237,0.18),rgba(255,255,255,0.03))]' : 'border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]'}`}>
                <div className="mb-5 flex items-start justify-between">
                  <ArtistAvatar artist={artist} size="medium" />
                  <span className="rounded-full bg-white/8 px-3 py-1.5 text-xs text-white/65">#{index + 1}</span>
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-xl font-semibold">{artist.username}</h3>
                  {artist.is_verified && <Star className="h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400" />}
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-white/45">{artist.bio}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/60">
                  <span className="rounded-full bg-white/8 px-3 py-1.5">{artist.monthly_listeners} / мес</span>
                  <span className="rounded-full bg-white/8 px-3 py-1.5">{artist.mood}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {nextSeventeen.length > 0 && (
        <section className="rounded-[2rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 backdrop-blur-xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-white/40">top 20 ranking</p>
              <h2 className="mt-2 text-2xl font-bold">Полный рейтинг из 20 артистов</h2>
            </div>
            <div className="rounded-full bg-white/8 px-4 py-2 text-sm text-white/60">17 карточек + топ-3 выше</div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {nextSeventeen.map((artist, index) => {
              const rank = index + 4

              return (
                <Link key={artist.id} to={`/artist/${artist.id}`} className="group rounded-3xl border border-white/[0.06] bg-black/10 p-5 transition hover:-translate-y-1 hover:border-white/[0.12] hover:bg-white/[0.04]">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <ArtistAvatar artist={artist} size="small" />
                    <span className="rounded-full bg-white/8 px-3 py-1.5 text-xs font-medium text-white/70">#{rank}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{artist.username}</p>
                    {artist.is_verified && <Star className="h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400" />}
                  </div>

                  <p className="mt-2 line-clamp-2 text-sm text-white/45">{artist.bio}</p>

                  <div className="mt-4 space-y-2 text-xs text-white/60">
                    <div className="flex items-center justify-between">
                      <span>Слушатели</span>
                      <span>{artist.monthly_listeners}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Треки</span>
                      <span>{artist.track_count || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Настроение</span>
                      <span className="truncate pl-3 text-right">{artist.mood}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
