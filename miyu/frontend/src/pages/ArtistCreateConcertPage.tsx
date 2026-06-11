import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Upload, MapPin, Calendar, Clock, Ticket, DollarSign, Users, Image, X, AlertTriangle, Globe, Lock, CheckCircle, Building2, Loader2, Search, UserPlus } from 'lucide-react'
import { venuePlans, VenuePlanPreview, type VenuePlan } from '../components/VenuePlans'
import { concertsApi } from '../api/concerts'
import { useAuth } from '../hooks/AuthContext'

interface ArtistOption {
  id: number
  username: string
  avatar_url?: string | null
}

const COUNTRIES = [
  'Россия', 'Украина', 'Беларусь', 'Казахстан', 'США', 'Великобритания', 'Германия', 
  'Франция', 'Италия', 'Испания', 'Япония', 'Южная Корея', 'Другое'
]

const CITIES: Record<string, string[]> = {
  'Россия': ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Сочи', 'Краснодар'],
  'США': ['Нью-Йорк', 'Лос-Анджелес', 'Чикаго', 'Майами', 'Сиэтл'],
  'Украина': ['Киев', 'Одесса', 'Львов', 'Харьков'],
}

interface TicketTier {
  id: number
  name: string
  price: number
  totalSeats: number
  zoneId: string
}

export default function ArtistCreateConcertPage() {
  const navigate = useNavigate()
  const { accessToken, user } = useAuth()
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [selectedVenuePlan, setSelectedVenuePlan] = useState<VenuePlan | null>(null)
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([])
  const [isPublic, setIsPublic] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Co-artists
  const [coArtists, setCoArtists] = useState<ArtistOption[]>([])
  const [artistQuery, setArtistQuery] = useState('')
  const [artistResults, setArtistResults] = useState<ArtistOption[]>([])
  const [artistSearching, setArtistSearching] = useState(false)
  const [showArtistDropdown, setShowArtistDropdown] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (!accessToken || artistQuery.trim().length < 1) {
      setArtistResults([])
      return
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setArtistSearching(true)
        const data = await concertsApi.searchArtists(accessToken, artistQuery.trim())
        // Filter out current user and already-selected
        const ownId = user?.id
        const selectedIds = new Set(coArtists.map((a) => a.id))
        setArtistResults(
          data.filter((a) => a.id !== ownId && !selectedIds.has(a.id))
        )
      } catch {
        setArtistResults([])
      } finally {
        setArtistSearching(false)
      }
    }, 250)
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [artistQuery, accessToken, coArtists, user?.id])

  const addCoArtist = (a: ArtistOption) => {
    setCoArtists((prev) => (prev.some((x) => x.id === a.id) ? prev : [...prev, a]))
    setArtistQuery('')
    setArtistResults([])
    setShowArtistDropdown(false)
  }

  const removeCoArtist = (id: number) => {
    setCoArtists((prev) => prev.filter((a) => a.id !== id))
  }
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    country: '',
    city: '',
    venue: '',
    address: '',
    date: '',
    time: '',
    totalSeats: 0,
    ageRestriction: '0' as '0' | '6' | '12' | '16' | '18',
  })

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCoverFile(file)
      const reader = new FileReader()
      reader.onload = () => setCoverPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const addTicketTier = () => {
    if (!selectedVenuePlan) return
    setTicketTiers([
      ...ticketTiers,
      { id: Date.now(), name: '', price: 0, totalSeats: 0, zoneId: '' }
    ])
  }

  const updateTicketTier = (id: number, updates: Partial<TicketTier>) => {
    setTicketTiers(ticketTiers.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  const removeTicketTier = (id: number) => {
    setTicketTiers(ticketTiers.filter(t => t.id !== id))
  }

  const handleVenuePlanSelect = (plan: VenuePlan) => {
    setSelectedVenuePlan(plan)
    // Auto-create ticket tiers for each zone
    setTicketTiers(plan.zones.map((zone, idx) => ({
      id: Date.now() + idx,
      name: zone.name,
      price: 0,
      totalSeats: 0,
      zoneId: zone.id
    })))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accessToken || !selectedVenuePlan) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      const datetime = formData.date // ISO date YYYY-MM-DD
      await concertsApi.create(accessToken, {
        title: formData.title,
        description: formData.description,
        venue: formData.venue,
        city: formData.city,
        country: formData.country,
        address: formData.address,
        datetime,
        time: formData.time,
        venue_plan_id: selectedVenuePlan.id,
        cover: coverFile,
        ticket_types: ticketTiers
          .filter(t => t.totalSeats > 0 && t.price >= 0)
          .map(t => ({
            name: t.name,
            price: t.price,
            quantity: t.totalSeats,
            zone_id: t.zoneId
          })),
        co_artist_ids: coArtists.map(a => a.id),
      })
      navigate('/artist/concerts')
    } catch (err: any) {
      setSubmitError(err.message || 'Не удалось создать концерт')
    } finally {
      setSubmitting(false)
    }
  }

  const cities = formData.country ? CITIES[formData.country] || [] : []
  const totalSeats = ticketTiers.reduce((sum, t) => sum + (t.totalSeats || 0), 0)

  const activeTiers = ticketTiers.filter(t => t.totalSeats > 0)
  const canSubmit = !!(formData.title && formData.country && formData.city &&
    formData.venue && formData.date && formData.time && selectedVenuePlan &&
    activeTiers.length > 0 && activeTiers.every(t => t.name && t.price > 0))

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate(-1)} 
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Создание концерта</h1>
          <p className="text-white/40 text-sm">Заполните информацию о концерте</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
          <div className="flex items-center gap-2 text-orange-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Модерация</span>
          </div>
          <p className="text-sm text-white/60 mt-1">
            Концерт будет отправлен на модерацию. После одобрения он появится в каталоге и пользователи смогут приобрести билеты.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium mb-3">Афиша</label>
            <div className="w-64 h-80 rounded-2xl border-2 border-dashed border-white/20 hover:border-white/40 transition bg-white/[0.02] overflow-hidden relative group">
              {coverPreview ? (
                <>
                  <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setCoverPreview(null); setCoverFile(null); }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                  <Image className="w-12 h-12 text-white/30 mb-2" />
                  <span className="text-sm text-white/50">Загрузить</span>
                  <span className="text-xs text-white/30 mt-1">JPG, PNG</span>
                  <span className="text-xs text-white/30">16:9</span>
                  <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Название концерта</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Например: Summer Tour 2024"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/15 focus:border-purple-500 focus:outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Описание</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Расскажите о концерте, программе, особенностях..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/15 focus:border-purple-500 focus:outline-none transition resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Страна
                </label>
                <select
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value, city: '' })}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/15 focus:border-purple-500 focus:outline-none transition appearance-none"
                  required
                >
                  <option value="">Выберите страну</option>
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country} className="bg-black">{country}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Город
                </label>
                <select
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/15 focus:border-purple-500 focus:outline-none transition appearance-none"
                  disabled={!formData.country}
                  required
                >
                  <option value="">Выберите город</option>
                  {cities.map((city) => (
                    <option key={city} value={city} className="bg-black">{city}</option>
                  ))}
                  {formData.country && !cities.includes(formData.city || '') && formData.city && (
                    <option value={formData.city} className="bg-black">{formData.city}</option>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Площадка</label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                placeholder="Например: Stadium Crocus"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/15 focus:border-purple-500 focus:outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Адрес</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Улица, дом"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/15 focus:border-purple-500 focus:outline-none transition"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Дата
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/15 focus:border-purple-500 focus:outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Время
                </label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/15 focus:border-purple-500 focus:outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  <Users className="w-4 h-4 inline mr-1" />
                  Возраст
                </label>
                <select
                  value={formData.ageRestriction}
                  onChange={(e) => setFormData({ ...formData, ageRestriction: e.target.value as any })}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/15 focus:border-purple-500 focus:outline-none transition appearance-none"
                >
                  <option value="0">0+</option>
                  <option value="6">6+</option>
                  <option value="12">12+</option>
                  <option value="16">16+</option>
                  <option value="18">18+</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">Тип билеетов</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={`flex-1 p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition ${
                    isPublic
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-white/[0.08] hover:border-white/20 bg-white/[0.02]'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <span className="text-sm">Публичный</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={`flex-1 p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition ${
                    !isPublic
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-white/[0.08] hover:border-white/20 bg-white/[0.02]'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <span className="text-sm">Приватный</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Co-artists */}
        <div>
          <label className="block text-sm font-medium mb-2">
            <UserPlus className="w-4 h-4 inline mr-1" />
            Артисты на концерте
          </label>
          <p className="text-xs text-white/40 mb-3">
            Вы будете указаны автоматически. Добавьте других артистов, которые тоже выступают.
          </p>

          {/* Selected chips */}
          {coArtists.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {coArtists.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-sm"
                >
                  {a.avatar_url ? (
                    <img src={a.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                      <Users className="w-3 h-3 text-white/40" />
                    </div>
                  )}
                  <span>{a.username}</span>
                  <button
                    type="button"
                    onClick={() => removeCoArtist(a.id)}
                    className="opacity-60 hover:opacity-100 transition"
                    aria-label="Удалить"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={artistQuery}
              onChange={(e) => {
                setArtistQuery(e.target.value)
                setShowArtistDropdown(true)
              }}
              onFocus={() => setShowArtistDropdown(true)}
              onBlur={() => setTimeout(() => setShowArtistDropdown(false), 150)}
              placeholder="Введите имя артиста..."
              className="w-full pl-9 pr-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/15 focus:border-purple-500 focus:outline-none transition"
            />

            {showArtistDropdown && artistQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 z-10 max-h-64 overflow-auto rounded-xl bg-[#13102a] border border-white/[0.08] shadow-xl">
                {artistSearching ? (
                  <div className="p-3 flex items-center gap-2 text-sm text-white/40">
                    <Loader2 className="w-4 h-4 animate-spin" /> Поиск...
                  </div>
                ) : artistResults.length === 0 ? (
                  <div className="p-3 text-sm text-white/40">Ничего не найдено</div>
                ) : (
                  artistResults.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        addCoArtist(a)
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition text-left"
                    >
                      {a.avatar_url ? (
                        <img src={a.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                          <Users className="w-4 h-4 text-white/40" />
                        </div>
                      )}
                      <span className="text-sm">{a.username}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-4">
            <Building2 className="w-4 h-4 inline mr-1" />
            План площадки
          </label>

          {!selectedVenuePlan ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {venuePlans.map((plan) => (
                <motion.button
                  key={plan.id}
                  type="button"
                  onClick={() => handleVenuePlanSelect(plan)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-purple-500/50 transition text-left"
                >
                  <h3 className="font-medium mb-1">{plan.name}</h3>
                  <p className="text-sm text-white/40 mb-3">{plan.description}</p>
                  <div className="flex items-center justify-between text-xs text-white/30">
                    <span>{plan.zones.length} зон</span>
                    <span>до {plan.totalCapacity.toLocaleString()} мест</span>
                  </div>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.08]">
                <div>
                  <h3 className="font-medium">{selectedVenuePlan.name}</h3>
                  <p className="text-sm text-white/40">{selectedVenuePlan.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVenuePlan(null)
                    setTicketTiers([])
                  }}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition"
                >
                  Изменить
                </button>
              </div>

              <VenuePlanPreview
                plan={selectedVenuePlan}
                selectedZones={ticketTiers.filter(t => t.totalSeats > 0).map(t => t.zoneId)}
              />
            </div>
          )}
        </div>

        {selectedVenuePlan && (
          <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium">
              <Ticket className="w-4 h-4 inline mr-1" />
              Настройка зон и цен
            </label>
          </div>

          <div className="space-y-3">
            {ticketTiers.map((tier, idx) => {
              const zone = selectedVenuePlan.zones.find(z => z.id === tier.zoneId)
              if (!zone) return null

              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition"
                >
                  <div
                    className="w-4 h-4 rounded flex-shrink-0"
                    style={{ backgroundColor: zone.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{zone.name}</p>
                    <p className="text-xs text-white/30">Макс. {zone.maxCapacity.toLocaleString()} мест</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.05]">
                      <DollarSign className="w-4 h-4 text-white/40" />
                      <input
                        type="number"
                        value={tier.price || ''}
                        onChange={(e) => updateTicketTier(tier.id, { price: Number(e.target.value) })}
                        placeholder="Цена"
                        className="w-24 bg-transparent border-none focus:outline-none text-sm"
                      />
                      <span className="text-xs text-white/40">₽</span>
                    </div>
                    <div className="flex items-center gap-1 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.05]">
                      <Users className="w-4 h-4 text-white/40" />
                      <input
                        type="number"
                        value={tier.totalSeats || ''}
                        onChange={(e) => {
                          const value = Number(e.target.value)
                          if (value <= zone.maxCapacity) {
                            updateTicketTier(tier.id, { totalSeats: value })
                          }
                        }}
                        placeholder="Мест"
                        max={zone.maxCapacity}
                        className="w-20 bg-transparent border-none focus:outline-none text-sm"
                      />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {totalSeats > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-sm">Всего мест: <strong>{totalSeats.toLocaleString()}</strong></span>
              </div>
              <span className="text-sm text-white/60">
                Мин. цена: <strong>{Math.min(...ticketTiers.filter(t => t.price > 0).map(t => t.price))} ₽</strong>
              </span>
            </div>
          )}
        </div>
        )}

        {submitError && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {submitError}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.05]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={submitting}
            className="px-6 py-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] transition disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {submitting ? 'Создание...' : 'Отправить на модерацию'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Plus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
