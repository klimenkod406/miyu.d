import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Calendar, Clock, MapPin, Mic, Ticket, Download, Share2, Loader2, Check } from 'lucide-react'
import { concertsApi } from '../api/concerts'
import { useAuth } from '../hooks/AuthContext'
import html2canvas from 'html2canvas'

interface TicketDetail {
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
  country: string
  address: string
  event_date: string
  event_time: string
  artist: {
    id: number
    name: string
    avatar_url?: string
  }
  seat_row?: string
  seat_number?: string
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const qrBlockRef = useRef<HTMLDivElement>(null)
  const detailsBlockRef = useRef<HTMLDivElement>(null)

  function handleDownload(e: React.MouseEvent) {
    console.log('[TicketDownload] CLICKED')
    e.preventDefault()
    e.stopPropagation()
    doDownload()
  }

  async function doDownload() {
    if (!ticket) {
      console.log('[TicketDownload] no ticket')
      return
    }
    console.log('[TicketDownload] starting...')
    try {
      const safeTitle = (ticket.concert_title || 'ticket').replace(/[/\\:*?"<>|]+/g, '_').replace(/\s+/g, '_')
      const fileName = "ticket_" + ticket.ticket_id + "_" + safeTitle + ".png"

      const block1 = qrBlockRef.current
      const block2 = detailsBlockRef.current
      console.log('[TicketDownload] blocks:', !!block1, !!block2)
      if (!block1 || !block2) {
        throw new Error('Content blocks not found')
      }

      const [canvas1, canvas2] = await Promise.all([
        html2canvas(block1, { scale: 2, useCORS: true, backgroundColor: '#0f0f1a' }),
        html2canvas(block2, { scale: 2, useCORS: true, backgroundColor: '#0f0f1a' })
      ])
      console.log('[TicketDownload] canvases:', canvas1.width, canvas2.width)

      const gap = 20 * 2
      const combinedW = Math.max(canvas1.width, canvas2.width)
      const combinedH = canvas1.height + gap + canvas2.height

      const combined = document.createElement('canvas')
      combined.width = combinedW
      combined.height = combinedH
      const ctx = combined.getContext('2d')
      if (!ctx) throw new Error('Canvas context not available')

      ctx.drawImage(canvas1, 0, 0)
      ctx.drawImage(canvas2, 0, canvas1.height + gap)

      const blob = await new Promise<Blob | null>(resolve => combined.toBlob(resolve, 'image/png'))
      if (!blob) {
        throw new Error('Failed to create blob')
      }
      console.log('[TicketDownload] blob size:', blob.size)

      if ('showSaveFilePicker' in window) {
        console.log('[TicketDownload] using showSaveFilePicker')
        try {
          const opts = {
            suggestedName: fileName,
            types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }]
          }
          const handle = await (window as any).showSaveFilePicker(opts)
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()
          window.dispatchEvent(new CustomEvent('show-toast', {
            detail: { message: 'Билет сохранён', type: 'success' }
          }))
          return
        } catch (pickerErr: any) {
          if (pickerErr?.name === 'AbortError') return
          console.warn('[TicketDownload] showSaveFilePicker failed:', pickerErr)
        }
      }

      console.log('[TicketDownload] fallback to ObjectURL')
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
      }, 200)

      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: 'Билет сохранён', type: 'success' }
      }))
    } catch (err) {
      console.error('[TicketDownload] failed:', err)
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: 'Не удалось скачать билет', type: 'error' }
      }))
    }
  }

  const handleShare = useCallback(async () => {
    if (!ticket) return
    const shareUrl = window.location.href
    const shareTitle = ticket.concert_title || 'Билет на концерт'
    const shareText = `Билет на ${shareTitle} — ${ticket.artist?.name || ''}`

    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: shareTitle, text: shareText, url: shareUrl })
          return
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') return
        }
      }
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: 'Ссылка скопирована', type: 'success' }
        }))
        setTimeout(() => setCopied(false), 2000)
        return
      }
      const textarea = document.createElement('textarea')
      textarea.value = shareUrl
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Share failed:', err)
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: 'Не удалось поделиться', type: 'error' }
      }))
    }
  }, [ticket])

  useEffect(() => {
    if (!accessToken || !id) {
      setError('Требуется авторизация')
      setLoading(false)
      return
    }

    const fetchTicket = async () => {
      try {
        setLoading(true)
        const data = await concertsApi.getTicketById(accessToken, id)
        setTicket(data)
      } catch (err: any) {
        setError(err.message || 'Не удалось загрузить билет')
      } finally {
        setLoading(false)
      }
    }

    fetchTicket()
  }, [accessToken, id])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-40">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-4">Ошибка: {error || 'Билет не найден'}</p>
        <Link to="/tickets" className="text-purple-400 hover:underline">
          Вернуться к билетам
        </Link>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto pb-20">
      <Link to="/tickets" className="inline-flex items-center gap-2 text-white/40 hover:text-white mb-6 transition">
        <ChevronLeft size={20} /> К билетам
      </Link>

      <div className="glass rounded-2xl p-8">
        {/* Status Badge */}
        <div className="flex items-center justify-between mb-6">
          <span className={`inline-block px-4 py-2 text-sm rounded-full font-medium ${
            ticket.ticket_status === 'valid'
              ? 'bg-green-500/20 text-green-400'
              : ticket.ticket_status === 'used'
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {ticket.ticket_status === 'valid' ? 'Действителен' : ticket.ticket_status === 'used' ? 'Использован' : 'Недействителен'}
          </span>
          <Ticket className="w-8 h-8 text-white/40" />
        </div>

        {/* Block 1: QR + Concert Info */}
        <div ref={qrBlockRef}>
          {/* QR Code */}
          <div className="flex justify-center mb-8">
            <div className="bg-white p-6 rounded-2xl">
              <img src={ticket.qr_code} alt="QR Code" className="w-64 h-64" />
            </div>
          </div>

          {/* Concert Info */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">{ticket.concert_title}</h1>
            <div className="flex items-center justify-center gap-2 text-white/60">
              <Mic size={16} />
              <span>{ticket.artist.name}</span>
            </div>
          </div>
        </div>

        {/* Block 2: Details */}
        <div ref={detailsBlockRef}>
          <div className="space-y-4 mb-8">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5">
            <Calendar className="w-5 h-5 text-white/40 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-white/40 mb-1">Дата и время</p>
              <p className="font-medium">
                {new Date(ticket.event_date).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
              <p className="text-white/60">{ticket.event_time}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5">
            <MapPin className="w-5 h-5 text-white/40 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-white/40 mb-1">Место проведения</p>
              <p className="font-medium">{ticket.venue}</p>
              <p className="text-white/60">{ticket.address}</p>
              <p className="text-white/60">{ticket.city}, {ticket.country}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-sm text-white/40 mb-1">Тип билета</p>
              <p className="font-medium">{ticket.ticket_type_name}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-sm text-white/40 mb-1">Цена</p>
              <p className="font-medium">{ticket.price.toLocaleString()} ₽</p>
            </div>
          </div>

          {(ticket.seat_row || ticket.seat_number) && (
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-sm text-white/40 mb-1">Место</p>
              <p className="font-medium">
                {ticket.seat_row && `Ряд ${ticket.seat_row}`}
                {ticket.seat_row && ticket.seat_number && ', '}
                {ticket.seat_number && `Место ${ticket.seat_number}`}
              </p>
            </div>
          )}

          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-sm text-white/40 mb-1">Дата покупки</p>
            <p className="font-medium">
              {new Date(ticket.purchased_at).toLocaleString('ru-RU')}
            </p>
          </div>
        </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDownload}
            className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Скачать
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition flex items-center justify-center gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            {copied ? 'Скопировано' : 'Поделиться'}
          </button>
        </div>

        {/* Warning */}
        {ticket.ticket_status === 'valid' && (
          <div className="mt-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-sm text-yellow-400">
              Не показывайте QR-код посторонним. Билет можно использовать только один раз.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
