import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  Calendar,
  Clock,
  MapPin,
  Mic,
  Ticket as TicketIcon,
  ChevronRight,
  Loader2,
  Share2,
  Download,
} from 'lucide-react'
import { concertsApi } from '../api/concerts'
import { useAuth } from '../hooks/AuthContext'
import ConcertCover from '../components/ConcertCover'

interface UserTicket {
  ticket_id: number
  qr_code: string
  ticket_status: 'valid' | 'used' | 'cancelled'
  purchased_at: string
  ticket_type_name: string
  price: number
  zone_id?: string | null
  seat_row?: string | null
  seat_number?: string | null
}

interface ConcertInfo {
  id: number
  title: string
  venue: string
  city: string
  country: string
  address: string
  event_date: string
  event_time: string
  cover_url?: string | null
  artist: { id: number; name: string; avatar_url?: string | null }
}

const STATUS_LABEL: Record<UserTicket['ticket_status'], { label: string; cls: string }> = {
  valid: { label: 'Действителен', cls: 'bg-green-500/20 text-green-400' },
  used: { label: 'Использован', cls: 'bg-yellow-500/20 text-yellow-400' },
  cancelled: { label: 'Отменён', cls: 'bg-red-500/20 text-red-400' },
}

export default function ConcertTicketsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { accessToken } = useAuth()

  const [concert, setConcert] = useState<ConcertInfo | null>(null)
  const [tickets, setTickets] = useState<UserTicket[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || !id) {
      setError('Требуется авторизация')
      setLoading(false)
      return
    }
    const fetch = async () => {
      try {
        setLoading(true)
        const data = await concertsApi.getTicketsForUserConcert(accessToken, id)
        setConcert(data.concert)
        setTickets(data.tickets)
      } catch (err: any) {
        setError(err.message || 'Не удалось загрузить билеты')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [accessToken, id])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-40">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    )
  }

  if (error || !concert) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-4">Ошибка: {error || 'Не найдено'}</p>
        <Link to="/tickets" className="text-purple-400 hover:underline">
          Вернуться к билетам
        </Link>
      </div>
    )
  }

  const active = tickets[activeIdx]
  const total = tickets.length
  const totalPrice = tickets.reduce((s, t) => s + t.price, 0)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-2xl mx-auto pb-20"
    >
      <Link
        to="/tickets"
        className="inline-flex items-center gap-2 text-white/40 hover:text-white mb-6 transition"
      >
        <ChevronLeft size={20} /> К билетам
      </Link>

      {/* Concert info header */}
      <div className="relative rounded-2xl overflow-hidden mb-6 aspect-[16/7] bg-white/[0.03]">
        <ConcertCover src={concert.cover_url} alt={concert.title} iconSize={80} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">{concert.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
            <span className="flex items-center gap-1.5"><Mic size={14} />{concert.artist.name}</span>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              {new Date(concert.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1.5"><Clock size={14} />{concert.event_time}</span>
            <span className="flex items-center gap-1.5"><MapPin size={14} />{concert.venue}, {concert.city}</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between gap-4 mb-6 px-1">
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <TicketIcon size={16} className="text-purple-400" />
          <span>{total} {total === 1 ? 'билет' : total < 5 ? 'билета' : 'билетов'}</span>
        </div>
        <span className="text-sm text-white/60">
          На сумму <strong className="text-white">{totalPrice.toLocaleString()} ₽</strong>
        </span>
      </div>

      {/* QR section */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-6 md:p-8">
        {/* Status */}
        <div className="flex items-center justify-between mb-6">
          <span className={`inline-block px-4 py-1.5 text-sm rounded-full font-medium ${STATUS_LABEL[active.ticket_status].cls}`}>
            {STATUS_LABEL[active.ticket_status].label}
          </span>
          <div className="text-xs text-white/40">
            Билет {activeIdx + 1} из {total}
          </div>
        </div>

        {/* QR */}
        <div className="flex justify-center mb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.ticket_id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`bg-white p-5 rounded-2xl ${active.ticket_status !== 'valid' ? 'opacity-40 grayscale' : ''}`}
            >
              <img src={active.qr_code} alt="QR Code" className="w-56 h-56 md:w-64 md:h-64" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Ticket details */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 rounded-xl bg-white/[0.03]">
            <p className="text-xs text-white/40 mb-1">Тип билета</p>
            <p className="font-medium text-sm">{active.ticket_type_name}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03]">
            <p className="text-xs text-white/40 mb-1">Цена</p>
            <p className="font-medium text-sm">{active.price.toLocaleString()} ₽</p>
          </div>
          {(active.seat_row || active.seat_number) && (
            <div className="col-span-2 p-3 rounded-xl bg-white/[0.03]">
              <p className="text-xs text-white/40 mb-1">Место</p>
              <p className="font-medium text-sm">
                {active.seat_row && `Ряд ${active.seat_row}`}
                {active.seat_row && active.seat_number && ', '}
                {active.seat_number && `Место ${active.seat_number}`}
              </p>
            </div>
          )}
          <div className="col-span-2 p-3 rounded-xl bg-white/[0.03]">
            <p className="text-xs text-white/40 mb-1">Куплен</p>
            <p className="font-medium text-sm">{new Date(active.purchased_at).toLocaleString('ru-RU')}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition flex items-center justify-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" /> Скачать
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: concert.title,
                  text: `Билет на ${concert.title}`,
                  url: window.location.href,
                }).catch(() => {})
              }
            }}
            className="flex-1 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition flex items-center justify-center gap-2 text-sm"
          >
            <Share2 className="w-4 h-4" /> Поделиться
          </button>
        </div>

        {active.ticket_status === 'valid' && (
          <div className="mt-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300/80">
            Не показывайте QR-код посторонним. Билет можно использовать только один раз.
          </div>
        )}
      </div>

      {/* Tickets pager */}
      {total > 1 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white/60">Все билеты</h3>
            <div className="flex gap-1">
              <button
                onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
                disabled={activeIdx === 0}
                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setActiveIdx(i => Math.min(total - 1, i + 1))}
                disabled={activeIdx === total - 1}
                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {tickets.map((t, i) => (
              <button
                key={t.ticket_id}
                onClick={() => setActiveIdx(i)}
                className={`p-3 rounded-xl border text-left transition ${
                  i === activeIdx
                    ? 'bg-purple-500/15 border-purple-500/40'
                    : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                }`}
              >
                <p className="text-xs text-white/40 mb-0.5">Билет #{i + 1}</p>
                <p className="text-sm font-medium truncate">{t.ticket_type_name}</p>
                <p className="text-xs text-white/40 mt-1">{t.price.toLocaleString()} ₽</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
