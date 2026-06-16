import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Music, Shield, FileAudio, Loader2, Ticket, Award, TrendingUp, Disc, Mic2, RussianRuble, LifeBuoy } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts'
import { adminApi } from '../api/admin'
import { getStoredTokens } from '../api/auth'
import { ExplicitBadge } from '../components/ExplicitBadge'

const COLORS = {
  blue: '#3b82f6',
  yellow: '#facc15',
  green: '#22c55e',
  purple: '#a855f7',
  red: '#ef4444',
  cyan: '#06b6d4',
  orange: '#f97316',
}

const CHART_COLORS = [COLORS.blue, COLORS.purple, COLORS.green, COLORS.yellow, COLORS.red, COLORS.cyan, COLORS.orange, '#94a3b8']

export default function AdminPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const [stats, setStats] = useState<any>(null)
  const [charts, setCharts] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90

  const fetchData = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return

    try {
      const [statsData, chartsData] = await Promise.all([
        adminApi.getStats(tokens.accessToken),
        adminApi.getCharts(tokens.accessToken, days),
      ])
      setStats(statsData)
      setCharts(chartsData)
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [days])

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const statsData = [
    { label: 'Пользователи', value: formatValue(stats?.totalUsers || 0), icon: Users },
    { label: 'Артисты', value: formatValue(stats?.totalArtists || 0), icon: TrendingUp },
    { label: 'Треки', value: formatValue(stats?.totalTracks || 0), icon: FileAudio },
    { label: 'На проверке', value: formatValue(stats?.pendingTracks || 0), icon: Shield },
    { label: 'Доход сервиса', value: `${formatValue(Math.round(stats?.totalRevenue || 0))} ₽`, icon: RussianRuble },
  ]

  const sections = [
    { title: 'Пользователи', description: 'Управление пользователями, ролями и правами', to: '/admin/users', icon: Users },
    { title: 'Артисты', description: 'Каталог артистов сервиса и переход к их статистике', to: '/admin/artists', icon: Mic2 },
    { title: 'Поддержка', description: 'Обращения пользователей и ответы администрации', to: '/admin/support', icon: LifeBuoy },
    { title: 'Контент', description: 'Модерация треков, альбомов, клипов и концертов', to: '/admin/content', icon: Music },
    { title: 'Импорт аудио', description: 'Массовая загрузка MP3 по шаблону Artist - Track.mp3', to: '/admin/upload', icon: FileAudio },
    { title: 'Концерты', description: 'Управление афишей, баннером и билетами', to: '/admin/concerts', icon: Ticket },
    { title: 'Достижения', description: 'Создание и настройка достижений платформы', to: '/admin/achievements', icon: Award },
  ]

  const revenueByDayData = charts?.revenueByDay?.map((d: any) => ({
    date: formatDate(d.date),
    revenue: Math.round(d.total || 0),
  })) || []

  const usersByDayData = charts?.usersByDay?.map((d: any) => ({
    date: formatDate(d.date),
    users: d.count,
  })) || []

  const genreData = charts?.tracksByGenre?.map((g: any, i: number) => ({
    name: g.genre || 'Без жанра',
    value: g.count,
    color: CHART_COLORS[i % CHART_COLORS.length],
  })) || []

  const hourlyData = Array.from({ length: 24 }, (_, i) => {
    const hourData = charts?.playsByHour?.find((h: any) => h.hour === i)
    return {
      hour: `${i}:00`,
      plays: hourData?.count || 0,
    }
  })

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number }>; label?: string }) => {
    if (!active || !payload) return null

    return (
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-3 shadow-2xl">
        <p className="text-white/60 text-xs mb-2">{label}</p>
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <span className="text-white/40">{entry.name}</span>
            <span className="text-white font-medium ml-auto">{formatValue(entry.value)}</span>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-2">Админ-панель</h1>
          <p className="text-white/40">Единый дашборд управления платформой Miyu</p>
        </div>

        <div className="flex gap-2">
          {['7d', '30d', '90d'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p as typeof period)}
              className={`px-2.5 py-1 rounded-lg text-xs transition ${
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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statsData.map((stat) => (
          <div key={stat.label} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className="w-5 h-5 text-white/40" />
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-white/40">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <button
              key={section.to}
              onClick={() => navigate(section.to)}
              className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-purple-500/30 transition text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center group-hover:bg-purple-500/20 transition shrink-0">
                  <Icon className="w-5 h-5 text-white/60 group-hover:text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{section.title}</p>
                  <p className="text-xs text-white/40 leading-relaxed">{section.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4" style={{ color: COLORS.blue }} />
          </div>
          <p className="text-2xl font-bold">{formatValue(stats?.totalUsers || 0)}</p>
          <p className="text-xs text-white/40">Пользователи</p>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center gap-2 mb-2">
            <Music className="w-4 h-4" style={{ color: COLORS.green }} />
          </div>
          <p className="text-2xl font-bold">{formatValue(stats?.totalTracks || 0)}</p>
          <p className="text-xs text-white/40">Треки</p>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center gap-2 mb-2">
            <Disc className="w-4 h-4" style={{ color: COLORS.purple }} />
          </div>
          <p className="text-2xl font-bold">{formatValue(stats?.totalAlbums || 0)}</p>
          <p className="text-xs text-white/40">Альбомы</p>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4" style={{ color: COLORS.yellow }} />
          </div>
          <p className="text-2xl font-bold">{formatValue(stats?.totalArtists || 0)}</p>
          <p className="text-xs text-white/40">Артисты</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <h3 className="text-sm font-medium mb-4">Доходность по дням</h3>
          <div className="h-48">
            {revenueByDayData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueByDayData}>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#ffffff30', fontSize: 10 }} interval={Math.floor(revenueByDayData.length / 5)} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Доход" stroke={COLORS.green} fill={COLORS.green} fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-white/40">Нет данных</div>
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <h3 className="text-sm font-medium mb-4">Новые пользователи</h3>
          <div className="h-48">
            {usersByDayData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={usersByDayData}>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#ffffff30', fontSize: 10 }} interval={Math.floor(usersByDayData.length / 5)} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="users" stroke={COLORS.green} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-white/40">Нет данных</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <h3 className="text-sm font-medium mb-4">По жанрам</h3>
          <div className="h-48">
            {genreData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={genreData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value">
                    {genreData.map((entry: any, idx: number) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-white/40">Нет данных</div>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {genreData.slice(0, 4).map((g: any) => (
              <div key={g.name} className="flex items-center gap-1 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                <span className="text-white/60">{g.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <h3 className="text-sm font-medium mb-4">По часам</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#ffffff30', fontSize: 8 }} interval={3} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="plays" fill={COLORS.purple} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <h3 className="text-sm font-medium mb-4">Статус контента</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white/60">На проверке</span>
              <span className="font-bold" style={{ color: COLORS.orange }}>{stats?.pendingTracks || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Одобрено</span>
              <span className="font-bold" style={{ color: COLORS.green }}>{stats?.approvedTracks || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Отклонено</span>
              <span className="font-bold" style={{ color: COLORS.red }}>{stats?.rejectedTracks || 0}</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <h3 className="text-sm font-medium mb-4">Доходы</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white/60">Подписки</span>
              <span className="font-bold" style={{ color: COLORS.green }}>{Math.round(stats?.subscriptionRevenue || 0).toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Билеты валом</span>
              <span className="font-bold" style={{ color: COLORS.blue }}>{Math.round(stats?.ticketRevenueGross || 0).toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Комиссия 2%</span>
              <span className="font-bold" style={{ color: COLORS.yellow }}>{Math.round(stats?.platformCommission || 0).toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Выплачено артистам</span>
              <span className="font-bold" style={{ color: COLORS.purple }}>{Math.round(stats?.artistTicketEarnings || 0).toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>
        </div>
      </div>

      {charts?.topTracks?.length > 0 && (
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <h3 className="text-sm font-medium mb-4">Популярные треки</h3>
          <div className="space-y-2">
            {charts.topTracks.slice(0, 5).map((track: any, idx: number) => (
              <div key={track.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02]">
                <span className="w-6 text-center text-white/40">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{track.title} <ExplicitBadge is_explicit={track.is_explicit} size="xs" /></p>
                  <p className="text-xs text-white/40">{track.artist_name}</p>
                </div>
                <span className="text-purple-400">{formatValue(track.play_count)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
