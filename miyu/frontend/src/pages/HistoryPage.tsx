import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Music, Film, Calendar, Trash2, Play, Loader2, ListMusic } from 'lucide-react'
import { usePlayer } from '../hooks/PlayerContext'
import type { Track } from '../types'

type TabType = 'tracks' | 'videos'

interface HistoryItem {
  id: number
  playedAt: string
  playDuration: number
  completed: boolean
  playlistId?: number | null
  playlist?: {
    id: number
    title: string
  } | null
  track: Track
}

interface PlaylistGroup {
  playlistId: number | null
  playlistTitle: string | null
  items: HistoryItem[]
}

interface GroupedHistory {
  label: string
  date: string
  isToday?: boolean
  isYesterday?: boolean
  items: HistoryItem[]
  playlistGroups?: PlaylistGroup[]
}

function groupByPlaylist(items: HistoryItem[]): PlaylistGroup[] {
  const groups: PlaylistGroup[] = []
  let currentGroup: PlaylistGroup | null = null

  items.forEach(item => {
    const playlistId = item.playlistId || null
    const playlistTitle = item.playlist?.title || null

    // Если это первый элемент или плейлист изменился
    if (!currentGroup || currentGroup.playlistId !== playlistId) {
      currentGroup = {
        playlistId,
        playlistTitle,
        items: [item]
      }
      groups.push(currentGroup)
    } else {
      // Добавляем в текущую группу
      currentGroup.items.push(item)
    }
  })

  return groups
}

function groupByDate(items: HistoryItem[]): GroupedHistory[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const groups: { [key: string]: HistoryItem[] } = {
    today: [],
    yesterday: [],
    earlier: []
  }

  items.forEach(item => {
    const itemDate = new Date(item.playedAt)
    itemDate.setHours(0, 0, 0, 0)

    if (itemDate.getTime() === today.getTime()) {
      groups.today.push(item)
    } else if (itemDate.getTime() === yesterday.getTime()) {
      groups.yesterday.push(item)
    } else {
      groups.earlier.push(item)
    }
  })

  const result: GroupedHistory[] = []

  if (groups.today.length > 0) {
    result.push({
      label: 'Сегодня',
      date: today.toLocaleDateString('ru-RU'),
      isToday: true,
      items: groups.today,
      playlistGroups: groupByPlaylist(groups.today)
    })
  }

  if (groups.yesterday.length > 0) {
    result.push({
      label: 'Вчера',
      date: yesterday.toLocaleDateString('ru-RU'),
      isYesterday: true,
      items: groups.yesterday,
      playlistGroups: groupByPlaylist(groups.yesterday)
    })
  }

  if (groups.earlier.length > 0) {
    result.push({
      label: 'Ранее',
      date: '',
      items: groups.earlier,
      playlistGroups: groupByPlaylist(groups.earlier)
    })
  }

  return result
}

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<TabType>('tracks')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const player = usePlayer()

  useEffect(() => {
    if (activeTab === 'tracks') {
      fetchHistory()
    }
  }, [activeTab])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('accessToken')
      if (!token) {
        setError('Необходимо войти в систему')
        setLoading(false)
        return
      }

      const response = await fetch('/api/history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch history')
      }

      const data = await response.json()
      setHistory(data)
      setError('')
    } catch (err) {
      console.error('Error fetching history:', err)
      setError('Не удалось загрузить историю')
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handlePlay = (item: HistoryItem) => {
    player.setTrack(item.track)
    player.setQueue(history.map(h => h.track))
    player.play()
  }

  const handleClearHistory = async () => {
    if (!confirm('Вы уверены, что хотите очистить всю историю?')) return

    // TODO: Implement clear history API
    alert('Функция очистки истории будет реализована позже')
  }

  const items = groupByDate(history)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">История</h1>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('tracks')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition duration-200 ${
            activeTab === 'tracks'
              ? 'glass-accent text-white'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          <span className="flex items-center gap-2">
            <Music size={16} />
            <span>Прослушано</span>
          </span>
        </button>
        <button
          onClick={() => setActiveTab('videos')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition duration-200 ${
            activeTab === 'videos'
              ? 'glass-accent text-white'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          <span className="flex items-center gap-2">
            <Film size={16} />
            <span>Просмотрено</span>
          </span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-white/40">{error}</p>
        </div>
      ) : activeTab === 'videos' ? (
        <div className="text-center py-20">
          <Film className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-white/40">История видео скоро появится</p>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-20">
          <Music className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-white/40">История пуста</p>
          <p className="text-white/30 text-sm mt-2">Начните слушать музыку</p>
        </div>
      ) : (
        <>
          <div className="space-y-8">
            {items.map((group, groupIndex) => (
              <section key={group.label}>
                <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                  {group.isToday && <span className="text-purple-400"><Calendar size={18} /></span>}
                  {group.isYesterday && <span className="text-white/50"><Calendar size={18} /></span>}
                  {!group.isToday && !group.isYesterday && <span className="text-white/30"><Calendar size={18} /></span>}
                  {group.label}
                </h2>

                {/* Группировка по плейлистам */}
                {group.playlistGroups && group.playlistGroups.map((playlistGroup, pgIndex) => (
                  <div key={`pg-${pgIndex}`} className="mb-6">
                    {/* Заголовок плейлиста, если треки из плейлиста */}
                    {playlistGroup.playlistId && playlistGroup.items.length > 1 && (
                      <div className="flex items-center gap-2 px-4 py-2 mb-2">
                        <ListMusic className="w-4 h-4 text-purple-400" />
                        <Link
                          to={`/playlist/${playlistGroup.playlistId}`}
                          className="text-sm font-medium text-purple-400 hover:text-purple-300 transition"
                        >
                          {playlistGroup.playlistTitle}
                        </Link>
                        <span className="text-xs text-white/30">• {playlistGroup.items.length} треков</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      {playlistGroup.items.map((item, itemIndex) => {
                        const isCurrentTrack = player.currentTrack?.id === item.track.id
                        const isPlaying = player.isPlaying && isCurrentTrack
                        const coverUrl = item.track.cover_url || item.track.album?.cover_url

                        return (
                          <div
                            key={`${item.id}-${itemIndex}`}
                            className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/[0.04] bg-white/[0.02] border border-transparent hover:border-white/[0.05] transition duration-200 group"
                          >
                            <span className="w-8 text-center text-white/30">
                              {groupIndex === 0 && pgIndex === 0 ? itemIndex + 1 : ''}
                            </span>

                            <div
                              onClick={() => handlePlay(item)}
                              className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer bg-white/[0.05]"
                            >
                              {coverUrl ? (
                                <img src={coverUrl} alt={item.track.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Music className="w-5 h-5 text-white/40" />
                                </div>
                              )}
                              <div className={`absolute inset-0 bg-black/40 flex items-center justify-center ${isCurrentTrack ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                {isPlaying ? (
                                  <div className="flex items-end gap-0.5 h-3">
                                    <div className="w-0.5 bg-white rounded-full animate-music-bar-1"></div>
                                    <div className="w-0.5 bg-white rounded-full mx-0.5 animate-music-bar-2"></div>
                                    <div className="w-0.5 bg-white rounded-full animate-music-bar-3"></div>
                                  </div>
                                ) : (
                                  <Play className="w-4 h-4 text-white" />
                                )}
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <Link
                                to={`/track/${item.track.id}`}
                                className={`block font-medium truncate group-hover:text-purple-400 transition ${
                                  isCurrentTrack ? 'text-purple-400' : ''
                                }`}
                              >
                                {item.track.title}
                              </Link>
                              <Link
                                to={`/artist/${item.track.artist?.id}`}
                                className="block text-sm text-white/40 hover:text-white transition"
                              >
                                {item.track.artist?.username}
                              </Link>
                            </div>

                            <span className="text-sm text-white/30">{formatDuration(item.track.duration)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>

          <div className="mt-8 flex justify-between">
            <button
              onClick={handleClearHistory}
              className="px-6 py-3 rounded-full font-medium bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/10 transition duration-200 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Очистить историю
            </button>
          </div>
        </>
      )}
    </div>
  )
}
