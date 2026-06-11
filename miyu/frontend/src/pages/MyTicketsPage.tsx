import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, Ticket, Calendar, Clock, MapPin, Mic, ChevronRight } from 'lucide-react'
import { concertsApi } from '../api/concerts'
import { useAuth } from '../hooks/AuthContext'
import ConcertCover from '../components/ConcertCover'

interface MyTicket {
  ticket_id: number
  qr_code: string
  ticket_status: 'valid' | 'used' | 'cancelled'
  purchased_at: string
  ticket_type_name: string
  price: number
  concert_id: number
  concert_title: string
  venue: string
  city: string
  event_date: string
  event_time: string
  cover_url?: string | null
  artist: { id: number; name: string; avatar_url?: string | null }
}

interface ConcertGroup {
  concert_id: number
  concert_title: string
  venue: string
  city: string
  event_date: string
  event_time: string
  cover_url?: string | null
  artist: MyTicket['artist']
  tickets: MyTicket[]
  totalPrice: number
  hasValid: boolean
}

function ConcertGroupCard({ group }: { group: ConcertGroup }) {
  const isPast = new Date(group.event_date) < new Date()

  return (
    <Link to={`/tickets/concert/${group.concert_id}`}>
      <motion.div
        whileHover={{ y: -2 }}
        className="group flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/15 hover:bg-white/[0.04] transition cursor-pointer"
      >
        {/* Cover */}
        <div className="relative w-32 h-32 md:w-40 md:h-40 flex-shrink-0 rounded-xl overflow-hidden bg-white/[0.03]">
          <ConcertCover src={group.cover_url} alt={group.concert_title} iconSize={40} />
          {isPast && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
              <span className="text-xs text-white/70 font-medium">Прошёл</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-lg font-bold truncate group-hover:text-purple-400 transition">
                {group.concert_title}
              </h3>
              <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition flex-shrink-0" />
            </div>
            <div className="flex items-center gap-2 text-sm text-white/60 mb-1">
              <Mic size={14} className="text-white/40" />
              <span className="truncate">{group.artist.name}</span>
            </div>
          </div>

          <div className="space-y-1 text-xs text-white/50">
            <div className="flex items-center gap-1.5">
              <Calendar size={12} />
              <span>{new Date(group.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <Clock size={12} className="ml-1" />
              <span>{group.event_time}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin size={12} />
              <span className="truncate">{group.venue}, {group.city}</span>
            </div>
          </div>

          {/* Tickets summary */}
          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <Ticket size={14} className="text-purple-400" />
              <span className="text-sm font-medium">
                {group.tickets.length} {pluralize(group.tickets.length, 'билет', 'билета', 'билетов')}
              </span>
            </div>
            <span className="text-sm font-semibold">
              {group.totalPrice.toLocaleString()} ₽
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

function pluralize(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<MyTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const { accessToken } = useAuth()

  useEffect(() => {
    if (!accessToken) {
      setError('Требуется авторизация для просмотра билетов.')
      setLoading(false)
      return
    }

    const fetchTickets = async () => {
      try {
        setLoading(true)
        const data = await concertsApi.getMyTickets(accessToken)
        setTickets(data)
      } catch (err: any) {
        setError(err.message || 'Не удалось загрузить билеты.')
      } finally {
        setLoading(false)
      }
    }
    fetchTickets()
  }, [accessToken])

  // Group tickets by concert
  const groups: ConcertGroup[] = useMemo(() => {
    const map = new Map<number, ConcertGroup>()
    for (const t of tickets) {
      const existing = map.get(t.concert_id)
      if (existing) {
        existing.tickets.push(t)
        existing.totalPrice += t.price
        if (t.ticket_status === 'valid') existing.hasValid = true
      } else {
        map.set(t.concert_id, {
          concert_id: t.concert_id,
          concert_title: t.concert_title,
          venue: t.venue,
          city: t.city,
          event_date: t.event_date,
          event_time: t.event_time,
          cover_url: t.cover_url,
          artist: t.artist,
          tickets: [t],
          totalPrice: t.price,
          hasValid: t.ticket_status === 'valid',
        })
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
    )
  }, [tickets])

  const now = new Date()
  const filtered = useMemo(() => {
    if (filter === 'all') return groups
    if (filter === 'upcoming') return groups.filter(g => new Date(g.event_date) >= now)
    return groups.filter(g => new Date(g.event_date) < now)
  }, [groups, filter])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-40">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    )
  }

  if (error) {
    return <div className="text-center py-20 text-red-400">Ошибка: {error}</div>
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1">Мои билеты</h1>
          <p className="text-sm text-white/40">
            {groups.length} {pluralize(groups.length, 'концерт', 'концерта', 'концертов')} • {tickets.length}{' '}
            {pluralize(tickets.length, 'билет', 'билета', 'билетов')}
          </p>
        </div>

        {groups.length > 0 && (
          <div className="flex gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            {(['upcoming', 'past', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-sm transition ${
                  filter === f ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                {f === 'upcoming' ? 'Предстоящие' : f === 'past' ? 'Прошедшие' : 'Все'}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
          <Ticket className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h3 className="text-xl font-medium mb-2">
            {groups.length === 0
              ? 'У вас пока нет билетов'
              : filter === 'upcoming'
              ? 'Нет предстоящих концертов'
              : 'Нет прошедших концертов'}
          </h3>
          {groups.length === 0 && (
            <>
              <p className="text-white/40 mb-6">Самое время это исправить!</p>
              <Link
                to="/concerts"
                className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full font-medium transition"
              >
                К концертам
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(group => (
            <ConcertGroupCard key={group.concert_id} group={group} />
          ))}
        </div>
      )}
    </div>
  )
}
