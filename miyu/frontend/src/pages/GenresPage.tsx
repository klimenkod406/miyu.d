import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Compass, Disc3, Flame, Headphones, Loader2, Music2, Sparkles, TrendingUp, Waves } from 'lucide-react'

const genreColors: Record<string, string> = {
  'Поп': 'from-pink-400/85 via-fuchsia-500/75 to-violet-500/65',
  'Рок': 'from-orange-400/85 via-rose-500/75 to-red-500/65',
  'Электроника': 'from-cyan-400/85 via-violet-500/78 to-indigo-500/68',
  'Хип-хоп': 'from-amber-400/85 via-orange-500/75 to-pink-500/62',
  'Джаз': 'from-sky-400/82 via-blue-500/74 to-violet-500/64',
  'Инди': 'from-teal-400/82 via-cyan-500/74 to-blue-500/64',
  'Классика': 'from-yellow-300/82 via-amber-400/72 to-orange-400/60',
  'R&B': 'from-fuchsia-400/84 via-pink-500/76 to-rose-500/66',
}

type GenreApiItem = {
  genre: string
  count: number
}

type EnrichedGenre = {
  genre: string
  tracks: number
  listeners: string
  growth: string
  vibe: string
  releases: string
}

const genreCopy: Record<string, { vibe: string; growth: string; releaseFactor: number; listenerFactor: number }> = {
  'Поп': {
    vibe: 'Мелодии, к которым хочется возвращаться вечером',
    growth: '+18%',
    releaseFactor: 0.18,
    listenerFactor: 38,
  },
  'Электроника': {
    vibe: 'Неоновые ночи, пульс и плотный ритм',
    growth: '+14%',
    releaseFactor: 0.17,
    listenerFactor: 34,
  },
  'Хип-хоп': {
    vibe: 'Ритм улиц, энергия движения и прямой голос',
    growth: '+12%',
    releaseFactor: 0.16,
    listenerFactor: 31,
  },
  'Рок': {
    vibe: 'Живые гитары, драйв и широкие припевы',
    growth: '+9%',
    releaseFactor: 0.15,
    listenerFactor: 27,
  },
  'Инди': {
    vibe: 'Тёплая камерность и новые музыкальные имена',
    growth: '+16%',
    releaseFactor: 0.17,
    listenerFactor: 24,
  },
  'Джаз': {
    vibe: 'Ночная свобода, дыхание и тонкие детали',
    growth: '+7%',
    releaseFactor: 0.13,
    listenerFactor: 18,
  },
  'R&B': {
    vibe: 'Плавный грув, мягкий вокал и близкая атмосфера',
    growth: '+11%',
    releaseFactor: 0.14,
    listenerFactor: 17,
  },
  'Классика': {
    vibe: 'Пространство, глубина и музыка без спешки',
    growth: '+5%',
    releaseFactor: 0.1,
    listenerFactor: 12,
  },
}

const defaultCopy = {
  vibe: 'Жанр со своим настроением и музыкальной атмосферой',
  growth: '+8%',
  releaseFactor: 0.12,
  listenerFactor: 16,
}

function formatCompact(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(value)
}

export default function GenresPage() {
  const navigate = useNavigate()
  const [genres, setGenres] = useState<EnrichedGenre[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/genres')
        const data = await res.json()

        const normalized = (Array.isArray(data) ? data : [])
          .map((item: GenreApiItem) => {
            const meta = genreCopy[item.genre] || defaultCopy
            const listeners = Math.max(item.count * meta.listenerFactor, item.count)
            const releases = Math.max(Math.round(item.count * meta.releaseFactor), 1)

            return {
              genre: item.genre,
              tracks: item.count,
              listeners: formatCompact(listeners),
              growth: meta.growth,
              vibe: meta.vibe,
              releases: `${releases} новых релизов`,
            }
          })
          .sort((a, b) => b.tracks - a.tracks)

        setGenres(normalized)
      } catch (err) {
        console.error('Failed to load genres:', err)
        setGenres([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const featured = genres[0]
  const leaderboard = genres.slice(0, 5)

  const topFiveStats = useMemo(() => {
    const top = genres.slice(0, 5)
    const total = top.reduce((sum, item) => sum + item.tracks, 0)

    return top.map((item, index) => ({
      label: item.genre,
      share: total > 0 ? Math.max(1, Math.round((item.tracks / total) * 100)) : 0,
      accent: [
        'from-pink-500 to-purple-500',
        'from-violet-500 to-indigo-500',
        'from-orange-500 to-red-500',
        'from-rose-500 to-orange-600',
        'from-cyan-500 to-blue-500',
      ][index] || 'from-slate-500 to-slate-700',
    }))
  }, [genres])

  const quickStats = useMemo(() => {
    const totalTracks = genres.reduce((sum, item) => sum + item.tracks, 0)
    const estimatedListeners = genres.reduce((sum, item) => {
      const numeric = Number(item.listeners.replace('K', ''))
      return sum + (item.listeners.includes('K') ? numeric * 1000 : numeric)
    }, 0)

    const topGrowth = genres.slice(0, 5)
    const avgGrowth = topGrowth.length > 0
      ? Math.round(topGrowth.reduce((sum, item) => sum + Number(item.growth.replace('%', '').replace('+', '')), 0) / topGrowth.length)
      : 0

    return [
      { title: 'Всего направлений', value: String(genres.length), icon: Compass, note: 'жанров в текущей витрине' },
      { title: 'Активных слушателей', value: `${Math.round(estimatedListeners / 1000)}K+`, icon: Headphones, note: 'ориентир по жанровым срезам' },
      { title: 'Рост интереса', value: `+${avgGrowth}%`, icon: TrendingUp, note: 'средний рост по топ-5' },
      { title: 'Всего треков', value: formatCompact(totalTracks), icon: Music2, note: 'треков с заполненным жанром' },
    ]
  }, [genres])

  const totalNewReleases = useMemo(() => {
    return genres.slice(0, 5).reduce((sum, item) => sum + Number(item.releases.split(' ')[0]), 0)
  }, [genres])

  const openGenreSearch = (genre: string) => {
    navigate(`/search?genre=${encodeURIComponent(genre)}`)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/[0.06] bg-[linear-gradient(140deg,rgba(8,8,8,0.98),rgba(27,27,27,0.95)_40%,rgba(8,145,178,0.28)_82%,rgba(168,85,247,0.26))] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-white/70">
          <Compass className="h-4 w-4 text-cyan-300" />Карта музыкальных направлений
        </div>
        <h1 className="text-4xl font-bold md:text-5xl">Жанры</h1>
        <p className="mt-3 max-w-3xl text-white/60">
          У каждой музыки здесь свой воздух, свой свет и своё настроение: одни жанры ведут в ночь и неон,
          другие собирают тишину, глубину и простор. Исследуй сцену Miyu как живую карту звука — от ярких хитов
          до направлений, в которых легко потеряться и найти что-то своё.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="rounded-[2rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 backdrop-blur-xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-white/40">genre atlas</p>
              <h2 className="mt-2 text-2xl font-bold">Атлас направлений</h2>
            </div>
          </div>

          <div className="grid auto-rows-[minmax(148px,1fr)] grid-cols-2 gap-4 md:grid-cols-3">
            {genres.map((genre, index) => (
              <button
                key={genre.genre}
                type="button"
                onClick={() => openGenreSearch(genre.genre)}
                className={`group relative overflow-hidden rounded-3xl border border-white/[0.06] p-5 text-left transition hover:-translate-y-1 hover:border-white/15 ${index === 0 ? 'md:col-span-2 md:row-span-2' : ''}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${genreColors[genre.genre] || 'from-slate-400/82 via-slate-600/72 to-slate-700/60'}`} />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_40%,rgba(0,0,0,0.1))]" />
                <div className="relative flex h-full flex-col justify-between">
                  <Disc3 className="h-7 w-7 text-white/85" />
                  <div>
                    <p className="text-xl font-bold text-white">{genre.genre}</p>
                    <p className="mt-1 text-sm text-white/80">{genre.tracks} треков</p>
                    <p className="mt-3 text-sm text-white/80">{genre.vibe}</p>
                    {index === 0 && (
                      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-black/15 px-3 py-1.5 text-sm text-white/90">
                        <Flame className="h-4 w-4" />Жанр-лидер недели
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {featured && (
            <div className="rounded-[2rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-6 backdrop-blur-xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-sm text-white/65">
                <Music2 className="h-4 w-4 text-pink-300" />Главный импульс недели
              </div>
              <h2 className="text-3xl font-bold">{featured.genre}</h2>
              <p className="mt-2 text-white/55">Сейчас этот жанр звучит громче других: он собирает больше всего внимания, быстрее растёт и чаще попадает в свежие подборки.</p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-black/15 p-4">
                  <p className="text-white/35">Слушатели</p>
                  <p className="mt-1 text-xl font-semibold">{featured.listeners}</p>
                </div>
                <div className="rounded-2xl bg-black/15 p-4">
                  <p className="text-white/35">Рост</p>
                  <p className="mt-1 text-xl font-semibold text-emerald-300">{featured.growth}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            {quickStats.map((stat) => {
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
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="rounded-[2rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 backdrop-blur-xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-sm text-white/65">
                <BarChart3 className="h-4 w-4 text-cyan-300" />Жанровый лидерборд
              </div>
              <h2 className="mt-3 text-2xl font-bold">Топ-5 популярных жанров</h2>
            </div>
          </div>

          <div className="space-y-3">
            {leaderboard.map((genre, index) => (
              <div key={genre.genre} className="rounded-3xl border border-white/[0.05] bg-black/10 p-4 transition hover:border-white/[0.12] hover:bg-white/[0.04]">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8 text-lg font-bold text-white/85">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => openGenreSearch(genre.genre)} className="truncate text-left text-lg font-semibold transition hover:text-purple-300">
                        {genre.genre}
                      </button>
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">{genre.growth}</span>
                    </div>
                    <p className="mt-1 text-sm text-white/45">{genre.vibe}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
                    <p className="text-xs text-white/35">Треки</p>
                    <p className="mt-1 font-semibold">{genre.tracks}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
                    <p className="text-xs text-white/35">Слушатели</p>
                    <p className="mt-1 font-semibold">{genre.listeners}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
                    <p className="text-xs text-white/35">Релизы</p>
                    <p className="mt-1 font-semibold">{genre.releases}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/[0.06] bg-black/10 p-6 backdrop-blur-xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-sm text-white/65">
            <Waves className="h-4 w-4 text-cyan-300" />Небольшая статистика по топ-5
          </div>
          <h2 className="text-2xl font-bold">Распределение внимания</h2>
          <p className="mt-2 text-white/45">Показывает, как доля самых заметных жанров распределяется внутри текущего лидерборда.</p>

          <div className="mt-6 space-y-4">
            {topFiveStats.map((item) => (
              <button key={item.label} type="button" onClick={() => openGenreSearch(item.label)} className="block w-full text-left">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-white/80 transition hover:text-purple-300">{item.label}</span>
                  <span className="text-white/45">{item.share}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/[0.05]">
                  <div className={`h-full rounded-full bg-gradient-to-r ${item.accent}`} style={{ width: `${item.share}%` }} />
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/[0.04] p-4">
              <p className="text-sm text-white/35">Средний рост</p>
              <p className="mt-1 text-2xl font-bold text-emerald-300">{quickStats[2]?.value || '+0%'}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.04] p-4">
              <p className="text-sm text-white/35">Новых релизов</p>
              <p className="mt-1 text-2xl font-bold">{totalNewReleases}</p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-white/[0.05] bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 text-xs text-white/60">
              <Sparkles className="h-3.5 w-3.5 text-pink-300" />Mood insight
            </div>
            <p className="mt-3 text-white/70">
              Сейчас пользователи Miyu чаще тянутся к ярким, ритмичным и эмоционально насыщенным направлениям.
              Лидеры недели формируют ощущение живого, постоянно меняющегося музыкального пространства.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
