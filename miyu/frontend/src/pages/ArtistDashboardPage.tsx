import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Upload, Music, Disc, BarChart, Calendar, Video, Loader2 } from 'lucide-react'
import { artistApi } from '../api/artist'
import { getStoredTokens } from '../api/auth'

export default function ArtistDashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      const tokens = getStoredTokens()
      if (!tokens) return
      try {
        const data = await artistApi.getStats(tokens.accessToken)
        setStats(data)
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const quickActions: { to: string; icon: ReactNode; label: string }[] = [
    { to: '/artist/upload', icon: <Upload size={28} />, label: 'Загрузить трек' },
    { to: '/artist/tracks', icon: <Music size={28} />, label: 'Мои треки' },
    { to: '/artist/albums', icon: <Disc size={28} />, label: 'Альбомы' },
    { to: '/artist/concerts', icon: <Calendar size={28} />, label: 'Концерты' },
    { to: '/artist/videos', icon: <Video size={28} />, label: 'Клипы' },
    { to: '/artist/stats', icon: <BarChart size={28} />, label: 'Статистика' },
  ]

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Панель артиста</h1>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-white/40 mb-1">Прослушивания</p>
              <p className="text-2xl font-bold">{formatValue(stats?.totalPlays || 0)}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-white/40 mb-1">Минут</p>
              <p className="text-2xl font-bold">{formatValue(stats?.totalMinutes || 0)}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-white/40 mb-1">Треки</p>
              <p className="text-2xl font-bold">{stats?.totalTracks || 0}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-white/40 mb-1">Альбомы</p>
              <p className="text-2xl font-bold">{stats?.totalAlbums || 0}</p>
            </div>
           <div className="glass rounded-xl p-4">
             <p className="text-sm text-white/40 mb-1">Клипы</p>
             <p className="text-2xl font-bold">{stats?.totalVideos || 0}</p>
           </div>
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-white/40 mb-1">Баланс</p>
              <p className="text-2xl font-bold">{(stats?.balance || 0).toLocaleString('ru-RU')} ₽</p>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-4 mb-8">
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="glass rounded-xl p-6 flex flex-col items-center gap-3 hover:bg-white/[0.06] transition duration-200 group"
              >
                <div className="text-white/50 group-hover:text-purple-400 transition">{action.icon}</div>
                <span className="font-medium text-center">{action.label}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
