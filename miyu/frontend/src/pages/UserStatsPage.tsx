import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Heart, Clock, Music, Users, Loader2, Mic, ListMusic } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getStoredTokens } from '../api/auth'

const COLORS = {
  blue: '#3b82f6',
  yellow: '#facc15',
  green: '#22c55e',
  purple: '#a855f7',
  red: '#ef4444',
  cyan: '#06b6d4',
  orange: '#f97316',
  pink: '#ec4899',
}

const CHART_COLORS = [COLORS.blue, COLORS.purple, COLORS.green, COLORS.yellow, COLORS.red, COLORS.cyan, COLORS.orange, COLORS.pink]

export default function UserStatsPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90

  useEffect(() => {
    const fetchStats = async () => {
      const tokens = getStoredTokens()
      if (!tokens) {
        setError('Требуется авторизация')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/user/me/stats?days=${days}`, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          throw new Error('Не удалось загрузить статистику')
        }

        const data = await response.json()
        setStats(data)
      } catch (err: any) {
        setError(err.message || 'Не удалось загрузить статистику')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [days])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const summaryCards = useMemo(() => [
    { id: 'minutes', label: 'Минут прослушано', value: stats?.summary?.total_minutes || 0, icon: Clock, color: COLORS.purple },
    { id: 'plays', label: 'Прослушиваний', value: stats?.summary?.total_plays || 0, icon: Play, color: COLORS.blue },
    { id: 'artists', label: 'Артистов', value: stats?.summary?.artists_count || 0, icon: Mic, color: COLORS.green },
    { id: 'likes', label: 'Лайков', value: stats?.summary?.likes_count || 0, icon: Heart, color: COLORS.red },
    { id: 'following', label: 'Подписок', value: stats?.summary?.following_count || 0, icon: Users, color: COLORS.cyan },
    { id: 'playlists', label: 'Плейлистов', value: stats?.summary?.playlists_count || 0, icon: ListMusic, color: COLORS.yellow },
  ], [stats])

  const playsByDayData = (stats?.playsByDay || []).map((entry: any) => ({
    date: formatDate(entry.date),
    plays: entry.plays,
    minutes: Math.round((entry.minutes || 0) / 60),
  }))

  const topGenresData = (stats?.topGenres || []).map((entry: any, idx: number) => ({
    name: entry.genre,
    value: Math.round((entry.listened_seconds || 0) / 60),
    color: CHART_COLORS[idx % CHART_COLORS.length],
  }))

  const topArtistsData = (stats?.topArtists || []).slice(0, 6).map((artist: any) => ({
    name: artist.username,
    minutes: Math.round((artist.listened_seconds || 0) / 60),
  }))

  const topTracksData = stats?.topTracks || []
  const recentActivity = stats?.recentActivity || []

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  if (error) {
    return <div className="text-center py-20 text-red-400">{error}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Ваша статистика</h1>
            <p className="text-white/40 text-sm">Реальные данные по прослушиваниям, артистам и активности</p>
          </div>
        </div>

        <div className="flex gap-2">
          {['7d', '30d', '90d'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p as typeof period)}
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

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {summaryCards.map((card) => (
          <div key={card.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center justify-between mb-2">
              <card.icon className="w-4 h-4" style={{ color: card.color }} />
            </div>
            <p className="text-xl font-bold">{card.value}</p>
            <p className="text-xs text-white/40">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
          <h3 className="text-sm font-medium mb-4">Прослушивания по дням</h3>
          <div className="h-64">
            {playsByDayData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={playsByDayData}>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#ffffff30', fontSize: 10 }} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="plays" name="Прослушивания" stroke={COLORS.blue} fill={COLORS.blue} fillOpacity={0.25} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-white/40">Недостаточно данных</div>
            )}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
          <h3 className="text-sm font-medium mb-4">Любимые жанры</h3>
          <div className="h-64">
            {topGenresData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={topGenresData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {topGenresData.map((entry: { name: string; value: number; color: string }, idx: number) => (
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
          <h3 className="text-sm font-medium mb-4">Топ артистов</h3>
          <div className="h-64">
            {topArtistsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topArtistsData} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#ffffff45', fontSize: 10 }} width={90} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="minutes" name="Минуты" fill={COLORS.green} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-white/40">Недостаточно данных</div>
            )}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
          <h3 className="text-sm font-medium mb-4">Недавняя активность</h3>
          <div className="space-y-3">
            {recentActivity.length > 0 ? recentActivity.map((item: any, idx: number) => (
              <div key={`${item.created_at}-${idx}`} className="flex items-start justify-between gap-3 py-2 border-b border-white/[0.04] last:border-0">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{item.title}</p>
                  <p className="text-xs text-white/40 truncate">{item.artist_name}</p>
                </div>
                <span className="text-xs text-white/35 shrink-0">{Math.round((item.play_duration || 0) / 60)} мин</span>
              </div>
            )) : (
              <div className="text-white/40">Недостаточно данных</div>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
        <h3 className="text-sm font-medium mb-4">Любимые артисты</h3>
        <div className="space-y-2">
          {(stats?.topArtists || []).length > 0 ? (
            stats.topArtists.map((artist: any, idx: number) => (
              <div key={artist.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                <span className="w-6 text-center text-white/40">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{artist.username}</p>
                  <p className="text-xs text-white/40">{Math.round((artist.listened_seconds || 0) / 60)} мин прослушивания</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-white/40">Недостаточно данных</div>
          )}
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
        <h3 className="text-sm font-medium mb-4">Топ треков</h3>
        <div className="space-y-2">
          {topTracksData.length > 0 ? (
            topTracksData.map((track: any, idx: number) => (
              <div key={track.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                <span className="w-6 text-center text-white/40">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{track.title}</p>
                  <p className="text-xs text-white/40">{track.artist_name}</p>
                </div>
                <span className="text-xs text-white/40 shrink-0">{Math.round((track.listened_seconds || 0) / 60)} мин</span>
              </div>
            ))
          ) : (
            <div className="text-white/40">Недостаточно данных</div>
          )}
        </div>
      </div>
    </div>
  )
}
