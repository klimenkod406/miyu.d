import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, Play, Users, Star, Loader2, Disc, Clock, Download, Music } from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { artistApi } from '../api/artist'
import { getStoredTokens } from '../api/auth'
import { useAuth } from '../hooks/AuthContext'
import { ExplicitBadge } from '../components/ExplicitBadge'

const CHART_COLORS = ['#3b82f6', '#a855f7', '#22c55e', '#facc15', '#ef4444', '#06b6d4', '#f97316', '#94a3b8']

export default function ArtistStatsPage() {
  const { id } = useParams<{ id?: string }>()
  const { user } = useAuth()
  const [artist, setArtist] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('30d')

  const getCutoffDate = (value: string) => {
    const now = new Date()
    const days = value === '7d' ? 7 : value === '30d' ? 30 : 90
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  }

  const isWithinPeriod = (dateValue?: string | number | null) => {
    if (!dateValue) return false
    const cutoff = getCutoffDate(period)
    const date = new Date(String(dateValue))
    return !Number.isNaN(date.getTime()) && date >= cutoff
  }

  useEffect(() => {
    const fetchStats = async () => {
      const tokens = getStoredTokens()
      if (!tokens) {
        setError('Вы не авторизованы')
        setLoading(false)
        return
      }

      try {
        if (id) {
          const [artistRes, countRes, tracksRes, albumsRes] = await Promise.all([
            fetch(`/api/user/${id}`),
            fetch(`/api/user/${id}/count`),
            fetch(`/api/tracks?artist_id=${id}`),
            fetch(`/api/albums?artist_id=${id}`),
          ])

          const artistData = artistRes.ok ? await artistRes.json() : null
          const countData = countRes.ok ? await countRes.json() : { followers: 0, following: 0 }
          const tracksData = tracksRes.ok ? await tracksRes.json() : []
          const albumsData = albumsRes.ok ? await albumsRes.json() : []
          const totalPlaySeconds = Array.isArray(tracksData)
            ? tracksData.reduce((sum: number, track: any) => sum + (track.play_count || 0), 0)
            : 0

          setArtist(artistData)
          setStats({
            totalTracks: Array.isArray(tracksData) ? tracksData.length : 0,
            totalAlbums: Array.isArray(albumsData) ? albumsData.length : 0,
            totalPlays: totalPlaySeconds,
            totalMinutes: Math.round(totalPlaySeconds / 60),
            followers: countData.followers || 0,
            following: countData.following || 0,
            topTracks: Array.isArray(tracksData) ? tracksData.slice(0, 5) : [],
            latestAlbums: Array.isArray(albumsData) ? albumsData.slice(0, 4) : [],
            tracksData: Array.isArray(tracksData) ? tracksData : [],
            albumsData: Array.isArray(albumsData) ? albumsData : [],
            balance: Number(artistData?.total_earnings || 0),
            ticketRevenueGross: Number(artistData?.ticket_revenue_gross || 0),
          })
        } else {
          const [data, tracksRes, albumsRes] = await Promise.all([
            artistApi.getStats(tokens.accessToken),
            user?.id ? fetch(`/api/tracks?artist_id=${user.id}`) : Promise.resolve(null),
            user?.id ? fetch(`/api/albums?artist_id=${user.id}`) : Promise.resolve(null),
          ])
          const tracksData = tracksRes && 'ok' in tracksRes && tracksRes.ok ? await tracksRes.json() : []
          const albumsData = albumsRes && 'ok' in albumsRes && albumsRes.ok ? await albumsRes.json() : []
          setArtist(user)
          setStats({
            ...data,
            followers: 0,
            following: 0,
            topTracks: Array.isArray(tracksData) ? tracksData.slice(0, 5) : [],
            latestAlbums: Array.isArray(albumsData) ? albumsData.slice(0, 4) : [],
            tracksData: Array.isArray(tracksData) ? tracksData : [],
            albumsData: Array.isArray(albumsData) ? albumsData : [],
            balance: Number(data.balance || 0),
            ticketRevenueGross: Number(data.ticketRevenueGross || 0),
          })
        }
      } catch (err: any) {
        setError(err.message || 'Ошибка загрузки')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [id, user])

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
  }

  const filteredTracks = useMemo(() => {
    const tracks = stats?.tracksData || []
    if (!tracks.length) return []
    return tracks.filter((track: any) => isWithinPeriod(track.created_at))
  }, [stats?.tracksData, period])

  const filteredAlbums = useMemo(() => {
    const albums = stats?.albumsData || []
    if (!albums.length) return []
    return albums.filter((album: any) => {
      if (album.created_at && isWithinPeriod(album.created_at)) return true
      if (album.release_date && isWithinPeriod(album.release_date)) return true
      if (album.release_year) return isWithinPeriod(`${album.release_year}-01-01`)
      return false
    })
  }, [stats?.albumsData, period])

  const displayStats = useMemo(() => {
    const totalTracks = filteredTracks.length || 0
    const totalAlbums = filteredAlbums.length || 0
    const totalPlays = filteredTracks.reduce((sum: number, track: any) => sum + (track.play_count || 0), 0)
    const totalMinutes = Math.round(filteredTracks.reduce((sum: number, track: any) => sum + (track.duration || 0), 0) / 60)

    return {
      totalTracks,
      totalAlbums,
      totalPlays,
      totalMinutes,
      followers: stats?.followers || 0,
      following: stats?.following || 0,
      balance: stats?.balance || 0,
      ticketRevenueGross: stats?.ticketRevenueGross || 0,
      platformCommission: Math.max(0, Number(stats?.ticketRevenueGross || 0) - Number(stats?.balance || 0)),
    }
  }, [filteredTracks, filteredAlbums, stats?.followers, stats?.following, stats?.balance, stats?.ticketRevenueGross])

  const genreData = Object.entries(
    filteredTracks.reduce((acc: Record<string, number>, track: any) => {
      const genre = track.genre || 'Без жанра'
      acc[genre] = (acc[genre] || 0) + 1
      return acc
    }, {}),
  ).map(([name, value], idx) => ({ name, value, color: CHART_COLORS[idx % CHART_COLORS.length] }))

  const albumsByYearData = Object.entries(
    filteredAlbums.reduce((acc: Record<string, number>, album: any) => {
      const year = String(album.release_year || 'Без даты')
      acc[year] = (acc[year] || 0) + 1
      return acc
    }, {}),
  )
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, count]) => ({ year, count }))

  const trackDurationData = filteredTracks
    .slice(0, 8)
    .map((track: any) => ({
      name: track.title.length > 14 ? `${track.title.slice(0, 14)}...` : track.title,
      duration: Math.round((track.duration || 0) / 60),
    }))

  const contentMixData = [
    { name: 'Треки', value: displayStats.totalTracks || 0, color: CHART_COLORS[0] },
    { name: 'Альбомы', value: displayStats.totalAlbums || 0, color: CHART_COLORS[1] },
  ].filter((item) => item.value > 0)

  const visibleTopTracks = filteredTracks.slice(0, 5)
  const visibleAlbums = filteredAlbums.slice(0, 4)

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number }>; label?: string }) => {
    if (!active || !payload) return null

    return (
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-3 shadow-2xl">
        <p className="text-white/60 text-xs mb-2">{label}</p>
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <span className="text-white/40">{entry.name}</span>
            <span className="text-white font-medium ml-auto">{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }

  const [downloading, setDownloading] = useState(false)

  const handleDownloadAllTracks = async () => {
    if (!stats?.tracksData || stats.tracksData.length === 0) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: 'У артиста пока нет треков для скачивания', type: 'info' }
      }))
      return
    }

    setDownloading(true)
    const tracksToDownload = stats.tracksData
    const artistName = artist?.username || user?.username || 'artist'
    let successCount = 0

    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: `Скачивание ${tracksToDownload.length} треков...`, type: 'info' }
    }))

    for (const track of tracksToDownload) {
      try {
        if (!track.file_path) continue
        const res = await fetch(track.file_path)
        if (!res.ok) continue
        const blob = await res.blob()
        const safeTitle = (track.title || 'track').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_')
        const fileName = `${artistName} - ${safeTitle}.mp3`

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }, 100)
        successCount++
        await new Promise(r => setTimeout(r, 350))
      } catch (err) {
        console.error('Failed to download track:', track.id, err)
      }
    }

    setDownloading(false)
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: {
        message: successCount > 0
          ? `Скачано треков: ${successCount} из ${tracksToDownload.length}`
          : 'Не удалось скачать треки',
        type: successCount > 0 ? 'success' : 'error'
      }
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <button onClick={() => window.history.back()} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
              {artist?.avatar_url ? (
                <img src={`${artist.avatar_url}`} alt={artist?.username || ''} className="h-full w-full object-cover" />
              ) : (
                <Music className="h-7 w-7 text-white/40" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {artist?.username || user?.username || 'Артист'}
                {artist?.is_verified && <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />}
              </h1>
              <p className="text-white/40 text-sm">{id ? 'Статистика выбранного артиста' : 'Личная статистика артиста'}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadAllTracks}
              disabled={downloading || !stats?.tracksData || stats.tracksData.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Скачивание...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Скачать все треки
                </>
              )}
            </button>
            <div className="flex gap-2">
              {['7d', '30d', '90d'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition ${
                    period === p
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'bg-white/[0.02] text-white/40 hover:text-white border border-white/[0.05]'
                  }`}
                >
                  {p === '7d' ? '7 дней' : p === '30d' ? '30 дней' : '90 дней'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center justify-between mb-2">
            <Play className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-bold">{formatValue(displayStats.totalPlays || 0)}</p>
          <p className="text-xs text-white/40">Прослушивания</p>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-xl font-bold">{displayStats.followers || 0}</p>
          <p className="text-xs text-white/40">Подписчики</p>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center justify-between mb-2">
            <Disc className="w-4 h-4 text-yellow-400" />
          </div>
          <p className="text-xl font-bold">{displayStats.totalAlbums || 0}</p>
          <p className="text-xs text-white/40">Альбомы</p>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-xl font-bold">{displayStats.totalMinutes || 0}</p>
          <p className="text-xs text-white/40">Минут прослушано</p>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center justify-between mb-2">
            <Disc className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-xl font-bold">{Number(displayStats.ticketRevenueGross || 0).toLocaleString('ru-RU')} ₽</p>
          <p className="text-xs text-white/40">Продажи билетов</p>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center justify-between mb-2">
            <Star className="w-4 h-4 text-yellow-400" />
          </div>
          <p className="text-xl font-bold">{Number(displayStats.balance || 0).toLocaleString('ru-RU')} ₽</p>
          <p className="text-xs text-white/40">Баланс артиста</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
          <h2 className="text-lg font-semibold mb-4">Основные показатели</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span className="text-white/50">Треков</span><span>{displayStats.totalTracks || 0}</span></div>
            <div className="flex items-center justify-between"><span className="text-white/50">Альбомов</span><span>{displayStats.totalAlbums || 0}</span></div>
            <div className="flex items-center justify-between"><span className="text-white/50">Подписчики</span><span>{displayStats.followers || 0}</span></div>
            <div className="flex items-center justify-between"><span className="text-white/50">Подписок</span><span>{displayStats.following || 0}</span></div>
            <div className="flex items-center justify-between"><span className="text-white/50">Валовый доход с билетов</span><span>{Number(displayStats.ticketRevenueGross || 0).toLocaleString('ru-RU')} ₽</span></div>
            <div className="flex items-center justify-between"><span className="text-white/50">Комиссия сервиса 2%</span><span>{Number(displayStats.platformCommission || 0).toLocaleString('ru-RU')} ₽</span></div>
            <div className="flex items-center justify-between"><span className="text-white/50">Доступный баланс</span><span>{Number(displayStats.balance || 0).toLocaleString('ru-RU')} ₽</span></div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
          <h2 className="text-lg font-semibold mb-4">Описание</h2>
          <p className="text-sm text-white/50 leading-relaxed">
            {artist?.bio || 'У этого артиста пока нет описания. Здесь можно отслеживать базовые показатели активности и наполнения каталога.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
          <h2 className="text-lg font-semibold mb-4">Жанры треков</h2>
          <div className="h-64">
            {genreData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={genreData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {genreData.map((entry, idx) => (
                      <Cell key={entry.name} fill={entry.color || CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-white/40">Недостаточно данных</div>
            )}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
          <h2 className="text-lg font-semibold mb-4">Структура каталога</h2>
          <div className="h-64">
            {contentMixData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={contentMixData} dataKey="value" cx="50%" cy="50%" outerRadius={85}>
                    {contentMixData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-white/40">Недостаточно данных</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
          <h2 className="text-lg font-semibold mb-4">Альбомы по годам</h2>
          <div className="h-64">
            {albumsByYearData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={albumsByYearData}>
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#ffffff45', fontSize: 10 }} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-white/40">Недостаточно данных</div>
            )}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
          <h2 className="text-lg font-semibold mb-4">Длительность треков</h2>
          <div className="h-64">
            {trackDurationData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trackDurationData} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#ffffff45', fontSize: 10 }} width={95} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="duration" fill={CHART_COLORS[2]} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-white/40">Недостаточно данных</div>
            )}
          </div>
        </div>
      </div>

      {visibleTopTracks.length > 0 && (
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
          <h2 className="text-lg font-semibold mb-4">Треки артиста</h2>
          <div className="space-y-2">
            {visibleTopTracks.map((track: any, idx: number) => (
              <div key={track.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                <span className="w-6 text-center text-white/40">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="font-medium truncate">{track.title}</p>
                    <ExplicitBadge is_explicit={track.is_explicit} size="xs" />
                  </div>
                  <p className="text-xs text-white/40">{track.genre || 'Без жанра'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {visibleAlbums.length > 0 && (
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
          <h2 className="text-lg font-semibold mb-4">Альбомы артиста</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {visibleAlbums.map((album: any) => (
              <div key={album.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                <p className="font-medium truncate">{album.title}</p>
                <p className="text-xs text-white/40 mt-1">{album.release_year || 'Без даты'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
