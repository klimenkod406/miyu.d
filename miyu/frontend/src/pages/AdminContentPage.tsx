import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Award, Users, FileAudio, Album, Activity, Plus, Check, X, Clock, Calendar, MapPin, Ticket, Eye, Play, Pause, FileVideo, Loader2, ChevronDown, ChevronRight, Search, Filter, AlertTriangle, Sparkles } from 'lucide-react'
import { AreaChart, Area, PieChart, Pie, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { adminApi } from '../api/admin'
import { getStoredTokens } from '../api/auth'
import AIAnalysisPanel from '../components/AIAnalysisPanel'
import TrackModerationModal from '../components/TrackModerationModal'

const COLORS = {
  gold: '#fbbf24',
  silver: '#94a3b8',
  bronze: '#b45309',
  blue: '#3b82f6',
  purple: '#a855f7',
  red: '#ef4444',
  green: '#22c55e',
  pink: '#ec4899',
  cyan: '#06b6d4',
  orange: '#f97316',
}

export default function AdminContentPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'overview' | 'tracks' | 'albums' | 'videos' | 'concerts'>('overview')
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return
    try {
      const data = await adminApi.getStats(tokens.accessToken)
      setStats(data)
    } catch (err) {
      console.error('Failed to load stats:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string }>; label?: string }) => {
    if (!active || !payload) return null
    return (
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-3 shadow-2xl">
        <p className="text-white/60 text-xs mb-2">{label}</p>
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <span className="text-white/40">{entry.name}</span>
            <span className="text-white font-medium ml-auto">{entry.value?.toLocaleString()}</span>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-xl glass-hover">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Контент</h1>
            <p className="text-white/40 text-sm">Статистика и управление контентом</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'overview', label: 'Обзор', icon: Activity },
          { id: 'tracks', label: 'Треки', icon: FileAudio },
          { id: 'albums', label: 'Альбомы', icon: Album },
          { id: 'videos', label: 'Клипы', icon: FileVideo },
          { id: 'concerts', label: 'Концерты', icon: Ticket },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              tab === t.id
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-white/[0.02] text-white/40 hover:text-white border border-white/[0.05]'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-2 mb-1">
                <FileAudio className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-white/40">Треки</span>
              </div>
              <p className="text-2xl font-bold">{stats.totalTracks}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-2 mb-1">
                <Album className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-white/40">Альбомы</span>
              </div>
              <p className="text-2xl font-bold">{stats.totalAlbums}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-green-400" />
                <span className="text-xs text-white/40">Артисты</span>
              </div>
              <p className="text-2xl font-bold">{stats.totalArtists}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-white/40">Пользователи</span>
              </div>
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <h3 className="text-sm font-medium mb-4">Статус контента</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.02] text-center">
                <p className="text-2xl font-bold" style={{ color: COLORS.orange }}>{stats.pendingTracks}</p>
                <p className="text-xs text-white/40">На проверке</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] text-center">
                <p className="text-2xl font-bold" style={{ color: COLORS.green }}>{stats.approvedTracks}</p>
                <p className="text-xs text-white/40">Одобрено</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] text-center">
                <p className="text-2xl font-bold" style={{ color: COLORS.red }}>{stats.rejectedTracks}</p>
                <p className="text-xs text-white/40">Отклонено</p>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'tracks' && <ModerationTracks />}
      {tab === 'albums' && <ModerationAlbums />}
      {tab === 'videos' && <ModerationVideos />}
      {tab === 'concerts' && <ModerationConcerts />}
    </div>
  )
}

function ModerationConcerts() {
  const [concerts, setConcerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)

  const fetchConcerts = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return
    try {
      setLoading(true)
      const data = await adminApi.getPendingConcerts(tokens.accessToken)
      setConcerts(data)
    } catch (err) {
      console.error('Failed to load pending concerts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConcerts()
  }, [])

  const handleApprove = async (id: number) => {
    const tokens = getStoredTokens()
    if (!tokens) return
    setProcessingId(id)
    try {
      await adminApi.approveConcert(tokens.accessToken, id)
      setConcerts(concerts.filter(c => c.id !== id))
    } catch (err) {
      console.error('Failed to approve concert:', err)
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (id: number) => {
    const tokens = getStoredTokens()
    if (!tokens) return
    if (!confirm('Отклонить концерт? Обложка будет удалена.')) return
    setProcessingId(id)
    try {
      await adminApi.rejectConcert(tokens.accessToken, id)
      setConcerts(concerts.filter(c => c.id !== id))
    } catch (err) {
      console.error('Failed to reject concert:', err)
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Концерты на модерации</h2>
        <button
          onClick={fetchConcerts}
          className="px-4 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] transition flex items-center gap-2"
        >
          <Clock className="w-4 h-4" />
          Обновить
        </button>
      </div>

      <div className="space-y-3">
        {concerts.map((c) => {
          const totalSeats = (c.ticket_types || []).reduce((s: number, t: any) => s + (t.quantity || 0), 0)
          const minPrice = (c.ticket_types || []).reduce((m: number, t: any) => Math.min(m, t.price || Infinity), Infinity)
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition"
            >
              <div className="flex items-start gap-4">
                {/* Cover */}
                <div className="w-24 h-24 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {c.cover_url ? (
                    <img src={c.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Ticket className="w-8 h-8 text-purple-400/60" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold truncate">{c.title}</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-400">
                      На проверке
                    </span>
                  </div>
                  <p className="text-sm text-white/50 mb-2">{c.artist_name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/40">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(c.event_date).toLocaleDateString('ru-RU')}</span>
                    {c.event_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.event_time}</span>}
                    {(c.venue || c.city) && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.venue}{c.venue && c.city ? ', ' : ''}{c.city}</span>
                    )}
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{totalSeats.toLocaleString()} мест</span>
                    {minPrice !== Infinity && <span>от {minPrice.toLocaleString()} ₽</span>}
                  </div>
                  {c.description && (
                    <p className="text-xs text-white/40 mt-2 line-clamp-2">{c.description}</p>
                  )}
                  {c.ticket_types && c.ticket_types.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {c.ticket_types.map((tt: any) => (
                        <span key={tt.id} className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-white/60">
                          {tt.name}: {tt.price.toLocaleString()}₽ × {tt.quantity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(c.id)}
                    disabled={processingId === c.id}
                    className="px-3 py-2 rounded-lg bg-green-500/15 hover:bg-green-500/25 text-green-400 transition flex items-center gap-1 text-sm disabled:opacity-50"
                  >
                    {processingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Одобрить
                  </button>
                  <button
                    onClick={() => handleReject(c.id)}
                    disabled={processingId === c.id}
                    className="px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition flex items-center gap-1 text-sm disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Отклонить
                  </button>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {concerts.length === 0 && (
        <div className="text-center py-12">
          <Check className="w-12 h-12 mx-auto mb-4 text-green-400/50" />
          <p className="text-white/40">Нет концертов на модерации</p>
        </div>
      )}
    </div>
  )
}

const FLAG_LABELS_SHORT: Record<string, string> = {
  hate: 'Hate',
  hate_slur: 'Slur',
  toxic: 'Toxic',
  explicit_lyrics: 'Explicit',
  explicit_heavy: 'Heavy',
  drug_reference: 'Drugs',
  nsfw_cover: 'NSFW',
  suggestive_cover: 'Suggestive',
  invalid_audio: 'Invalid audio',
  possible_duplicate: 'Duplicate',
}

function ModerationTracks() {
  const [tracks, setTracks] = useState<any[]>([])
  const [approvedTracks, setApprovedTracks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [archiveLoading, setArchiveLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [counts, setCounts] = useState<{ all: number; pending: number; ai_flagged: number; flags: Record<string, number> }>({
    all: 0, pending: 0, ai_flagged: 0, flags: {}
  })
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'ai_flagged'>('all')
  const [filterFlag, setFilterFlag] = useState<string>('')
  const [sort, setSort] = useState<'priority' | 'recent' | 'score'>('priority')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [archiveQuery, setArchiveQuery] = useState('')
  const [debouncedArchiveQuery, setDebouncedArchiveQuery] = useState('')
  const [selectedTrack, setSelectedTrack] = useState<any | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedArchiveQuery(archiveQuery), 300)
    return () => clearTimeout(t)
  }, [archiveQuery])

  const fetchTracks = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return
    setLoading(true)
    try {
      const data = await adminApi.getPendingTracks(tokens.accessToken, {
        status: filterStatus,
        flag: filterFlag || undefined,
        sort,
        q: debouncedQuery || undefined,
      })
      setTracks(data)
    } catch (err) {
      console.error('Failed to load tracks:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchApprovedTracks = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return
    setArchiveLoading(true)
    try {
      const data = await adminApi.getApprovedTracks(tokens.accessToken, {
        q: debouncedArchiveQuery || undefined,
      })
      setApprovedTracks(data)
    } catch (err) {
      console.error('Failed to load approved tracks archive:', err)
    } finally {
      setArchiveLoading(false)
    }
  }

  const fetchCounts = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return
    try {
      const data = await adminApi.getTrackCounts(tokens.accessToken)
      setCounts(data)
    } catch (err) {
      console.error('Failed to load counts:', err)
    }
  }

  useEffect(() => {
    fetchTracks()
    fetchCounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterFlag, sort, debouncedQuery])

  useEffect(() => {
    fetchApprovedTracks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedArchiveQuery])

  const handleApprove = async (trackId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const tokens = getStoredTokens()
    if (!tokens) return
    setProcessingId(trackId)
    try {
      await adminApi.approveTrack(tokens.accessToken, trackId)
      setTracks(tracks.filter(t => t.id !== trackId))
      fetchCounts()
    } catch (err) {
      console.error('Failed to approve:', err)
    } finally {
      setProcessingId(null)
    }
  }

  const handleQuickReject = async (trackId: number, e: React.MouseEvent) => {
    // Быстрый reject — открывает модаль (комментарий рекомендуем).
    e.stopPropagation()
    const t = tracks.find(x => x.id === trackId)
    if (t) setSelectedTrack(t)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Треки на модерации</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setArchiveOpen(v => !v)}
            className={`px-4 py-2 rounded-xl border transition flex items-center gap-2 ${archiveOpen ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.05] text-white/70'}`}
          >
            {archiveOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Архив одобренных
            <span className="text-xs opacity-60">{approvedTracks.length}</span>
          </button>
          <button
            onClick={() => { fetchTracks(); fetchCounts(); fetchApprovedTracks() }}
            className="px-4 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] transition flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            Обновить
          </button>
        </div>
      </div>

      {archiveOpen && (
        <div className="rounded-2xl border border-green-500/15 bg-green-500/[0.03] overflow-hidden">
          <div className="p-4 border-b border-white/[0.05] flex items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-green-300">Архив модерации</h3>
              <p className="text-sm text-white/40">Одобренные треки с полным AI-анализом и источником решения</p>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                value={archiveQuery}
                onChange={e => setArchiveQuery(e.target.value)}
                placeholder="Поиск по архиву..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-sm placeholder-white/20 focus:outline-none focus:border-white/15 transition"
              />
            </div>
          </div>

          {archiveLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-green-400" />
            </div>
          ) : approvedTracks.length === 0 ? (
            <div className="text-center py-10 text-white/40">Архив одобренных треков пока пуст</div>
          ) : (
            <div className="p-3 space-y-3 max-h-[32rem] overflow-y-auto">
              {approvedTracks.map((track) => (
                <motion.div
                  key={`approved-${track.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedTrack(track)}
                  className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 hover:bg-white/[0.03] transition cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {track.cover_url ? (
                        <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <FileAudio className="w-6 h-6 text-green-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold truncate">{track.title}</h3>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/15 text-green-400">
                          Одобрен
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${track.approved_by_type === 'moderator' ? 'bg-blue-500/15 text-blue-300' : 'bg-purple-500/15 text-purple-300'}`}>
                          {track.approved_by_type === 'moderator'
                            ? `Модератор: ${track.approved_by_username || `#${track.approved_by_id}`}`
                            : 'Одобрено AI'}
                        </span>
                        {track.ai_score != null && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${
                            track.ai_score < 0.2 ? 'bg-green-500/15 text-green-400' :
                            track.ai_score < 0.7 ? 'bg-yellow-500/15 text-yellow-400' :
                            'bg-red-500/15 text-red-400'
                          }`}>
                            {track.ai_score.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white/50 truncate">
                        {track.artist_name} • {formatDuration(track.duration)}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-white/35">
                        <span>{track.genre || 'Жанр не указан'}</span>
                        <span>•</span>
                        <span>{track.analysis_summary || 'Без summary анализа'}</span>
                      </div>
                      <p className="text-xs text-white/30 mt-1">
                        Одобрен: {formatDate(track.approved_at || track.updated_at || track.created_at)}
                      </p>
                    </div>
                  </div>

                  <div onClick={e => e.stopPropagation()}>
                    <AIAnalysisPanel track={track} onReanalyzed={fetchApprovedTracks} />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { id: 'all',         label: 'Все',          count: counts.all },
          { id: 'pending',     label: 'На проверке', count: counts.pending },
          { id: 'ai_flagged',  label: 'AI flagged',  count: counts.ai_flagged },
        ] as const).map(c => (
          <button
            key={c.id}
            onClick={() => { setFilterStatus(c.id); setFilterFlag('') }}
            className={`px-3 py-1.5 rounded-full text-sm transition flex items-center gap-2 ${
              filterStatus === c.id
                ? c.id === 'ai_flagged' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-white/10 text-white border border-white/20'
                : 'bg-white/[0.03] text-white/60 hover:text-white border border-white/[0.06]'
            }`}
          >
            {c.id === 'ai_flagged' && <AlertTriangle className="w-3.5 h-3.5" />}
            {c.label}
            <span className="text-[10px] opacity-60">{c.count}</span>
          </button>
        ))}
      </div>

      {/* Flag chips */}
      {Object.keys(counts.flags).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-white/30 uppercase tracking-wide">Флаги:</span>
          {Object.entries(counts.flags)
            .sort((a, b) => b[1] - a[1])
            .map(([f, n]) => (
              <button
                key={f}
                onClick={() => setFilterFlag(filterFlag === f ? '' : f)}
                className={`px-2.5 py-1 rounded-full text-xs transition ${
                  filterFlag === f
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'bg-white/[0.03] text-white/50 hover:text-white/80 border border-white/[0.06]'
                }`}
              >
                {FLAG_LABELS_SHORT[f] || f} <span className="opacity-60">{n}</span>
              </button>
            ))}
          {filterFlag && (
            <button
              onClick={() => setFilterFlag('')}
              className="px-2 py-1 rounded-full text-xs text-white/40 hover:text-white/70 transition"
            >
              <X className="w-3 h-3 inline" /> сбросить
            </button>
          )}
        </div>
      )}

      {/* Search + Sort */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск по названию или артисту..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-sm placeholder-white/20 focus:outline-none focus:border-white/15 transition"
          />
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as any)}
          className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-sm focus:outline-none"
        >
          <option value="priority" className="bg-black">По приоритету</option>
          <option value="recent" className="bg-black">Свежие</option>
          <option value="score" className="bg-black">По ai_score ↓</option>
        </select>
      </div>

      <div className="space-y-3">
        {tracks.map((track) => (
          <motion.div
            key={track.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setSelectedTrack(track)}
            className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 hover:bg-white/[0.03] transition cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0 overflow-hidden">
                {track.cover_url ? (
                  <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <FileAudio className="w-6 h-6 text-blue-400" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-bold truncate">{track.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    track.moderation_status === 'ai_flagged'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    {track.moderation_status === 'ai_flagged' ? 'AI flagged' : 'На проверке'}
                  </span>
                  {track.ai_score != null && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${
                      track.ai_score < 0.2 ? 'bg-green-500/15 text-green-400' :
                      track.ai_score < 0.7 ? 'bg-yellow-500/15 text-yellow-400' :
                      'bg-red-500/15 text-red-400'
                    }`}>
                      {track.ai_score.toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/50 truncate">
                  {track.artist_name} • {formatDuration(track.duration)}
                </p>
                {track.genre && (
                  <p className="text-xs text-white/40">{track.genre}</p>
                )}
                <p className="text-xs text-white/30 mt-1">{formatDate(track.created_at)}</p>
              </div>

              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setSelectedTrack(track)}
                  className="px-3 py-2 rounded-lg text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white transition flex items-center gap-1.5"
                  title="Открыть детальный режим"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Детально
                </button>
                <button 
                  onClick={(e) => handleApprove(track.id, e)}
                  disabled={processingId === track.id}
                  className="p-2 rounded-lg hover:bg-green-500/20 text-green-400 transition disabled:opacity-50"
                  title="Быстрое одобрение"
                >
                  {processingId === track.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                </button>
                <button 
                  onClick={(e) => handleQuickReject(track.id, e)}
                  disabled={processingId === track.id}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition disabled:opacity-50"
                  title="Отклонить (в детальном режиме)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div onClick={e => e.stopPropagation()}>
              <AIAnalysisPanel track={track} onReanalyzed={fetchTracks} />
            </div>
          </motion.div>
        ))}
      </div>

      {tracks.length === 0 && !loading && (
        <div className="text-center py-12">
          <Check className="w-12 h-12 mx-auto mb-4 text-green-400/50" />
          <p className="text-white/40">Нет треков по выбранным фильтрам</p>
        </div>
      )}

      {selectedTrack && (
        <TrackModerationModal
          track={selectedTrack}
          onClose={() => setSelectedTrack(null)}
          onResolved={() => { fetchTracks(); fetchCounts() }}
        />
      )}
    </div>
  )
}

function ModerationAlbums() {
  const [albums, setAlbums] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [albumTracks, setAlbumTracks] = useState<any[]>([])
  const [loadingTracks, setLoadingTracks] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)

  const fetchAlbums = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return
    try {
      const data = await adminApi.getPendingAlbums(tokens.accessToken)
      setAlbums(data)
    } catch (err) {
      console.error('Failed to load albums:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlbums()
  }, [])

  const toggleExpand = async (albumId: number) => {
    if (expandedId === albumId) {
      setExpandedId(null)
      setAlbumTracks([])
      return
    }
    setExpandedId(albumId)
    setLoadingTracks(true)
    const tokens = getStoredTokens()
    if (!tokens) return
    try {
      const data = await adminApi.getAlbumTracks(tokens.accessToken, albumId)
      setAlbumTracks(data)
    } catch (err) {
      console.error('Failed to load album tracks:', err)
    } finally {
      setLoadingTracks(false)
    }
  }

  const handleApprove = async (albumId: number) => {
    const tokens = getStoredTokens()
    if (!tokens) return
    setProcessingId(albumId)
    try {
      await adminApi.approveAlbum(tokens.accessToken, albumId)
      setAlbums(albums.filter(a => a.id !== albumId))
    } catch (err) {
      console.error('Failed to approve:', err)
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (albumId: number) => {
    const tokens = getStoredTokens()
    if (!tokens) return
    setProcessingId(albumId)
    try {
      await adminApi.rejectAlbum(tokens.accessToken, albumId)
      setAlbums(albums.filter(a => a.id !== albumId))
    } catch (err) {
      console.error('Failed to reject:', err)
    } finally {
      setProcessingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Альбомы на модерации</h2>
        <button
          onClick={fetchAlbums}
          className="px-4 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] transition flex items-center gap-2"
        >
          <Clock className="w-4 h-4" />
          Обновить
        </button>
      </div>

      <div className="space-y-3">
        {albums.map((album) => (
          <motion.div
            key={album.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-white/[0.02] border border-white/[0.05] overflow-hidden"
          >
            <div 
              className="p-4 flex items-start gap-4 cursor-pointer hover:bg-white/[0.02] transition"
              onClick={() => toggleExpand(album.id)}
            >
              <div className="w-16 h-16 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0 overflow-hidden">
                {album.cover_url ? (
                  <img src={album.cover_url.startsWith('http') ? album.cover_url : album.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Album className="w-8 h-8 text-purple-400" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold">{album.title}</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-400">
                    На проверке
                  </span>
                </div>
                <p className="text-sm text-white/50">
                  {album.artist_name} • {album.track_count} треков
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                  <span>{album.type === 'single' ? 'Сингл' : album.type === 'ep' ? 'EP' : 'Альбом'}</span>
                  <span>{album.release_year}</span>
                  <span>{formatDate(album.created_at)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {expandedId === album.id ? (
                  <ChevronDown className="w-5 h-5 text-white/40" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-white/40" />
                )}
              </div>
            </div>

            {expandedId === album.id && (
              <div className="border-t border-white/5">
                {loadingTracks ? (
                  <div className="p-4 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                  </div>
                ) : (
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm text-white/40 mb-2">
                      <span>Треки альбома</span>
                      <span>{albumTracks.length}</span>
                    </div>
                    {albumTracks.map((track, idx) => (
                      <div key={track.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02]">
                        <span className="w-6 text-center text-white/40 text-sm">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{track.title}</p>
                          <p className="text-xs text-white/40">{track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : ''}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          track.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          track.status === 'pending' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {track.status === 'approved' ? 'Одобрен' : track.status === 'pending' ? 'На проверке' : 'Отклонен'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="p-4 border-t border-white/5 flex justify-end gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleReject(album.id) }}
                    disabled={processingId === album.id}
                    className="px-4 py-2 rounded-lg hover:bg-red-500/20 text-red-400 transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {processingId === album.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    Отклонить
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleApprove(album.id) }}
                    disabled={processingId === album.id}
                    className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    Одобрить все
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {albums.length === 0 && (
        <div className="text-center py-12">
          <Check className="w-12 h-12 mx-auto mb-4 text-green-400/50" />
          <p className="text-white/40">Нет альбомов на модерации</p>
        </div>
      )}
    </div>
  )
}

function ModerationVideos() {
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [previewVideo, setPreviewVideo] = useState<any | null>(null)

  const fetchVideos = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return
    try {
      const data = await adminApi.getPendingVideos(tokens.accessToken)
      setVideos(data)
    } catch (err) {
      console.error('Failed to load videos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVideos()
  }, [])

  const handleApprove = async (videoId: number) => {
    const tokens = getStoredTokens()
    if (!tokens) return
    setProcessingId(videoId)
    try {
      await adminApi.approveVideo(tokens.accessToken, videoId)
      setVideos(videos.filter(v => v.id !== videoId))
    } catch (err) {
      console.error('Failed to approve:', err)
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (videoId: number) => {
    const tokens = getStoredTokens()
    if (!tokens) return
    setProcessingId(videoId)
    try {
      await adminApi.rejectVideo(tokens.accessToken, videoId)
      setVideos(videos.filter(v => v.id !== videoId))
    } catch (err) {
      console.error('Failed to reject:', err)
    } finally {
      setProcessingId(null)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Клипы на модерации</h2>
        <button
          onClick={fetchVideos}
          className="px-4 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] transition flex items-center gap-2"
        >
          <Clock className="w-4 h-4" />
          Обновить
        </button>
      </div>

      <div className="space-y-3">
        {videos.map((video) => (
          <motion.div
            key={video.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition"
          >
            <div className="flex items-start gap-4">
              <div 
                className="w-48 h-28 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer relative group"
                onClick={() => setPreviewVideo(video)}
              >
                {video.thumbnail_url ? (
                  <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <FileVideo className="w-8 h-8 text-purple-400" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <Play className="w-10 h-10 text-white" />
                </div>
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-xs">
                  {formatDuration(video.duration)}
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold truncate">{video.title}</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-400">
                    На проверке
                  </span>
                </div>
                <p className="text-sm text-white/50 truncate">
                  {video.artist_name} • {formatDuration(video.duration)}
                </p>
                {video.track_title && (
                  <p className="text-xs text-white/40">Трек: {video.track_title}</p>
                )}
                {video.description && (
                  <p className="text-xs text-white/30 mt-1 line-clamp-2">{video.description}</p>
                )}
                <p className="text-xs text-white/30 mt-1">{formatDate(video.created_at)}</p>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => handleApprove(video.id)}
                  disabled={processingId === video.id}
                  className="p-2 rounded-lg hover:bg-green-500/20 text-green-400 transition disabled:opacity-50"
                >
                  {processingId === video.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                </button>
                <button 
                  onClick={() => handleReject(video.id)}
                  disabled={processingId === video.id}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {videos.length === 0 && (
        <div className="text-center py-12">
          <Check className="w-12 h-12 mx-auto mb-4 text-green-400/50" />
          <p className="text-white/40">Нет клипов на модерации</p>
        </div>
      )}

      {previewVideo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPreviewVideo(null)}>
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="aspect-video bg-black">
              <video 
                src={`/uploads/videos/${previewVideo.file_path}`} 
                controls 
                autoPlay 
                className="w-full h-full"
              />
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-bold">{previewVideo.title}</h3>
                <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-400">На проверке</span>
              </div>
              <p className="text-white/60 text-sm mb-2">{previewVideo.artist_name}</p>
              {previewVideo.track_title && (
                <p className="text-white/40 text-sm mb-2">Трек: {previewVideo.track_title}</p>
              )}
              {previewVideo.description && (
                <p className="text-white/40 text-sm">{previewVideo.description}</p>
              )}
              <div className="flex gap-3 mt-4">
                <button 
                  onClick={() => { handleApprove(previewVideo.id); setPreviewVideo(null) }}
                  disabled={processingId === previewVideo.id}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-green-500/20 border border-white/[0.08] hover:border-green-500/30 text-white/80 hover:text-green-400 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Одобрить
                </button>
                <button 
                  onClick={() => { handleReject(previewVideo.id); setPreviewVideo(null) }}
                  disabled={processingId === previewVideo.id}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-red-500/20 border border-white/[0.08] hover:border-red-500/30 text-white/80 hover:text-red-400 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Отклонить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
