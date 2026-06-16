import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clapperboard, Eye, Film, Flame, Loader2, Play, Sparkles, Clock3 } from 'lucide-react'
import type { Video } from '../types'

type ClipListItem = Video & {
  artist_name?: string
  description?: string | null
  thumbnail_url?: string | null
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatViews(count: number) {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}

function VideoCard({ video, priority = false }: { video: ClipListItem; priority?: boolean }) {
  return (
    <Link to={`/video/${video.id}`} className="group block">
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] transition duration-300 hover:border-white/15">
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt={video.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading={priority ? 'eager' : 'lazy'} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-fuchsia-950 via-violet-950 to-slate-950">
            <Film className="h-12 w-12 text-white/25" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent opacity-90" />
        <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs text-white/80 backdrop-blur-md">
          <Clapperboard className="h-3.5 w-3.5" />
          <span>Клип</span>
        </div>
        <div className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-1 text-xs text-white/85 backdrop-blur-sm">
          {formatDuration(video.duration)}
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/15 backdrop-blur-md transition duration-300 group-hover:scale-110 group-hover:bg-white/20">
            <Play className="ml-0.5 h-6 w-6 text-white" />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="truncate text-base font-semibold text-white transition group-hover:text-fuchsia-200">{video.title}</h3>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-white/60">
            <span className="truncate">{video.artist?.username || video.artist_name || 'Артист Miyu'}</span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Eye className="h-3.5 w-3.5" />
              {formatViews(video.views_count)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function ClipsPage() {
  const [videos, setVideos] = useState<ClipListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch('/api/videos')
        if (!response.ok) {
          throw new Error('Не удалось загрузить клипы')
        }

        const data = await response.json()
        const items: ClipListItem[] = Array.isArray(data) ? data : []
        setVideos(items.filter((video) => video.status !== 'rejected'))
      } catch (err: any) {
        setError(err.message || 'Не удалось загрузить клипы')
      } finally {
        setLoading(false)
      }
    }

    fetchVideos()
  }, [])

  const featuredVideo = videos[0] || null

  const trendingVideos = useMemo(
    () => [...videos].sort((a, b) => b.views_count - a.views_count).slice(0, 6),
    [videos]
  )

  const freshVideos = useMemo(
    () => [...videos].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 8),
    [videos]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
        {error}
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] px-6 py-16 text-center">
        <Film className="mx-auto mb-4 h-16 w-16 text-white/20" />
        <h1 className="mb-2 text-2xl font-bold">Главная клипов пока пуста</h1>
        <p className="text-white/45">Когда артисты опубликуют первые клипы, они появятся здесь.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-[414px]:space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-fuchsia-900/70 via-violet-950/80 to-black px-6 py-7 max-[414px]:px-4 max-[414px]:py-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.18),transparent_30%)]" />
        <div className="relative">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white/85 backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-fuchsia-200" />
              <span>Музыкальные клипы Miyu</span>
            </div>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight max-[414px]:text-3xl">
              Главная страница клипов Miyu
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/60 max-[414px]:text-[0.95rem]">
              Премьеры, визуальные релизы и самые просматриваемые музыкальные видео собраны в одном потоке.
            </p>
          </div>
        </div>
      </section>

      {featuredVideo && (
        <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Link to={`/video/${featuredVideo.id}`} className="group relative block overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.03] min-h-[22rem]">
            {featuredVideo.thumbnail_url ? (
              <img loading="lazy" src={featuredVideo.thumbnail_url} alt={featuredVideo.title} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-fuchsia-900/60 to-black" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent" />
            <div className="relative flex h-full flex-col justify-between p-6 max-[414px]:p-4">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-sm text-white/85 backdrop-blur-md">
                <Flame className="h-4 w-4 text-orange-300" />
                <span>В фокусе</span>
              </div>

              <div className="max-w-xl">
                <h2 className="text-3xl font-bold max-[414px]:text-2xl">{featuredVideo.title}</h2>
                <p className="mt-3 line-clamp-3 text-sm text-white/65">
                  {featuredVideo.description || 'Музыкальный клип с атмосферной визуальной подачей, доступный для просмотра прямо сейчас.'}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/70">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                    <Eye className="h-4 w-4" />
                    {formatViews(featuredVideo.views_count)} просмотров
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                    <Clock3 className="h-4 w-4" />
                    {formatDuration(featuredVideo.duration)}
                  </span>
                </div>
              </div>
            </div>
          </Link>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Почему сюда заходят</p>
              <div className="mt-4 space-y-3 text-sm text-white/65">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">Премьеры артистов и свежие визуальные релизы в одном разделе.</div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">Быстрый переход из витрины сразу в полноэкранный просмотр клипа.</div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">Подборка по просмотрам помогает быстро найти то, что уже цепляет аудиторию.</div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Для пользователей</p>
              <h3 className="mt-3 text-xl font-bold">Открывай новые клипы</h3>
              <p className="mt-2 text-sm text-white/60">Следи за премьерами, возвращайся к трендам и находи новые визуальные релизы в одном разделе.</p>
              <Link to="/search" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                <Sparkles className="h-4 w-4" />
                Искать музыку и клипы
              </Link>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Тренды</h2>
            <p className="mt-1 text-sm text-white/45">Клипы, которые набирают больше всего просмотров</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trendingVideos.map((video, index) => (
            <div key={video.id} className="space-y-3 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-3">
              <div className="flex items-center justify-between px-1 pt-1 text-xs uppercase tracking-[0.18em] text-white/35">
                <span>#{index + 1}</span>
                <span>{formatViews(video.views_count)} views</span>
              </div>
              <VideoCard video={video} priority={index < 2} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Свежие публикации</h2>
            <p className="mt-1 text-sm text-white/45">Недавние клипы, которые только появились в каталоге</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {freshVideos.map((video, index) => (
            <VideoCard key={video.id} video={video} priority={index < 2} />
          ))}
        </div>
      </section>
    </div>
  )
}
