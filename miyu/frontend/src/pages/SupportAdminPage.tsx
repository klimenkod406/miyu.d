import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getStoredTokens } from '../api/auth'

type SupportStatus = 'open' | 'closed'
type Tab = 'active' | 'archive'

interface SupportTicket {
  id: number
  user_id: number
  username: string
  email: string
  issue_area: string
  description: string
  attachments: string[]
  status: SupportStatus
  admin_response?: string | null
  created_at: string
}

export default function SupportAdminPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('active')
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [responseText, setResponseText] = useState('')
  const [closingTicketId, setClosingTicketId] = useState<number | null>(null)

  const fetchTickets = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return

    const response = await fetch('/api/support/admin', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error('Не удалось загрузить обращения поддержки')
    }

    const data = await response.json()
    setTickets(data)
  }

  useEffect(() => {
    const load = async () => {
      try {
        await fetchTickets()
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const filteredTickets = useMemo(() => {
    const byStatus = tickets.filter((ticket) => (tab === 'active' ? ticket.status === 'open' : ticket.status === 'closed'))
    const value = query.trim().toLowerCase()
    if (!value) return byStatus
    return byStatus.filter((ticket) =>
      ticket.username.toLowerCase().includes(value) ||
      ticket.email.toLowerCase().includes(value) ||
      ticket.issue_area.toLowerCase().includes(value) ||
      ticket.description.toLowerCase().includes(value),
    )
  }, [tickets, tab, query])

  const closeTicket = async () => {
    const tokens = getStoredTokens()
    if (!tokens || !selectedTicket || !responseText.trim()) return

    setClosingTicketId(selectedTicket.id)
    try {
      const response = await fetch(`/api/support/admin/${selectedTicket.id}/close`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({ response: responseText.trim() }),
      })

      const text = await response.text()
      if (!response.ok) {
        throw new Error(text || 'Не удалось закрыть заявку')
      }

      setSelectedTicket(null)
      setResponseText('')
      await fetchTickets()
    } catch (err) {
      console.error(err)
    } finally {
      setClosingTicketId(null)
    }
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
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/admin')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Поддержка</h1>
          <p className="text-white/40 text-sm">Актуальные и закрытые обращения пользователей</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2">
          <button onClick={() => setTab('active')} className={`px-4 py-2 rounded-xl text-sm transition ${tab === 'active' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/[0.02] border border-white/[0.05] text-white/50 hover:text-white'}`}>
            Актуальные
          </button>
          <button onClick={() => setTab('archive')} className={`px-4 py-2 rounded-xl text-sm transition ${tab === 'archive' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/[0.02] border border-white/[0.05] text-white/50 hover:text-white'}`}>
            Архив
          </button>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск обращений..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-sm placeholder-white/20 focus:outline-none focus:border-white/15 transition"
          />
        </div>
      </div>

      <div className="space-y-4">
        {filteredTickets.map((ticket) => (
          <button key={ticket.id} onClick={() => { setSelectedTicket(ticket); setResponseText(ticket.admin_response || '') }} className="w-full text-left p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition">
            <div className="flex items-center justify-between gap-4 mb-2">
              <div>
                <p className="font-medium">{ticket.username}</p>
                <p className="text-sm text-white/40">{ticket.email}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs ${ticket.status === 'open' ? 'bg-yellow-500/15 text-yellow-300' : 'bg-green-500/15 text-green-300'}`}>
                {ticket.status === 'open' ? 'Не решено' : 'Решено'}
              </span>
            </div>
            <p className="text-sm text-purple-300 mb-2">{ticket.issue_area}</p>
            <p className="text-sm text-white/55 line-clamp-2">{ticket.description}</p>
          </button>
        ))}

        {filteredTickets.length === 0 && (
          <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] text-center text-white/40">
            Обращения не найдены
          </div>
        )}
      </div>

      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[#0a0a0a] border border-white/10 p-6 space-y-5 max-h-[90vh] overflow-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Обращение поддержки</h2>
                <p className="text-sm text-white/40">{selectedTicket.username} • {selectedTicket.issue_area}</p>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">Закрыть</button>
            </div>

            <div>
              <p className="text-xs text-white/35 mb-2">Описание</p>
              <p className="text-sm text-white/70 whitespace-pre-wrap">{selectedTicket.description}</p>
            </div>

            {selectedTicket.attachments?.length > 0 && (
              <div>
                <p className="text-xs text-white/35 mb-2">Скриншоты</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedTicket.attachments.map((attachment) => (
                    <a key={attachment} href={attachment} target="_blank" rel="noreferrer" className="rounded-xl overflow-hidden border border-white/[0.05] bg-white/[0.02]">
                      <img src={attachment} alt="support attachment" className="w-full h-48 object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {selectedTicket.status === 'open' ? (
              <div>
                <p className="text-xs text-white/35 mb-2">Ответ пользователю</p>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.05] outline-none resize-none"
                  placeholder="Опишите принятые меры и решение проблемы"
                />
                <div className="flex justify-end mt-4">
                  <button onClick={closeTicket} disabled={!responseText.trim() || closingTicketId === selectedTicket.id} className="px-4 py-3 rounded-xl bg-green-500/15 border border-green-500/25 text-green-300 disabled:opacity-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {closingTicketId === selectedTicket.id ? 'Закрытие...' : 'Закрыть заявку'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-white/35 mb-2">Ответ администратора</p>
                <p className="text-sm text-white/70 whitespace-pre-wrap">{selectedTicket.admin_response || 'Ответ не указан'}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
