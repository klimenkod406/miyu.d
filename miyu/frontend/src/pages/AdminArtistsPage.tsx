import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Search, Star, Users, Disc, Music4, Trash2, Check, X, Camera } from 'lucide-react'
import { authApi, getStoredTokens } from '../api/auth'

interface ArtistCard {
  id: number
  username: string
  avatar_url?: string | null
  bio?: string | null
  is_verified?: boolean
  followers: number
  following: number
  tracksCount: number
  albumsCount: number
}

interface ArtistApplication {
  id: number
  user_id: number
  type: 'create' | 'delete'
  message?: string | null
  links?: string | null
  reason?: string | null
  status: 'pending' | 'approved' | 'rejected'
  username: string
  email: string
  bio?: string | null
  reviewed_by_username?: string | null
  created_at?: string
}

type Tab = 'artists' | 'applications'

export default function AdminArtistsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('artists')
  const [artists, setArtists] = useState<ArtistCard[]>([])
  const [applications, setApplications] = useState<ArtistApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [reviewingApplicationId, setReviewingApplicationId] = useState<number | null>(null)
  const [showDeleteArtistModal, setShowDeleteArtistModal] = useState(false)
  const [artistToDelete, setArtistToDelete] = useState<ArtistCard | null>(null)
  const [deleteReason, setDeleteReason] = useState('')

  const fetchArtists = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return

    const baseArtists = await authApi.getArtists(tokens.accessToken)

    const enrichedArtists = await Promise.all(
      baseArtists.map(async (artist: any) => {
        try {
          const [profileRes, countRes, tracksRes, albumsRes] = await Promise.all([
            fetch(`/api/user/${artist.id}`),
            fetch(`/api/user/${artist.id}/count`),
            fetch(`/api/tracks?artist_id=${artist.id}`),
            fetch(`/api/albums?artist_id=${artist.id}`),
          ])

          const profile = profileRes.ok ? await profileRes.json() : artist
          const counts = countRes.ok ? await countRes.json() : { followers: 0, following: 0 }
          const tracks = tracksRes.ok ? await tracksRes.json() : []
          const albums = albumsRes.ok ? await albumsRes.json() : []

          return {
            id: artist.id,
            username: profile.username || artist.username,
            avatar_url: profile.avatar_url || null,
            bio: profile.bio || '',
            is_verified: !!profile.is_verified,
            followers: counts.followers || 0,
            following: counts.following || 0,
            tracksCount: Array.isArray(tracks) ? tracks.length : 0,
            albumsCount: Array.isArray(albums) ? albums.length : 0,
          }
        } catch {
          return {
            id: artist.id,
            username: artist.username,
            avatar_url: null,
            bio: '',
            is_verified: false,
            followers: 0,
            following: 0,
            tracksCount: 0,
            albumsCount: 0,
          }
        }
      }),
    )

    setArtists(enrichedArtists)
  }

  const fetchApplications = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return
    const data = await authApi.getArtistApplications(tokens.accessToken)
    setApplications(data)
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        await Promise.all([fetchArtists(), fetchApplications()])
      } catch (err) {
        console.error('Failed to load artists data:', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const filteredArtists = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return artists
    return artists.filter((artist) =>
      artist.username.toLowerCase().includes(value) ||
      artist.bio?.toLowerCase().includes(value),
    )
  }, [artists, query])

  const filteredApplications = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return applications
    return applications.filter((app) =>
      app.username.toLowerCase().includes(value) ||
      app.email.toLowerCase().includes(value),
    )
  }, [applications, query])

  const reviewApplication = async (applicationId: number, status: 'approved' | 'rejected') => {
    const tokens = getStoredTokens()
    if (!tokens) return
    setReviewingApplicationId(applicationId)
    try {
      await authApi.reviewArtistApplication(tokens.accessToken, applicationId, status)
      await Promise.all([fetchArtists(), fetchApplications()])
    } catch (err) {
      console.error('Failed to review application:', err)
    } finally {
      setReviewingApplicationId(null)
    }
  }

  const removeArtistPage = async () => {
    const tokens = getStoredTokens()
    if (!tokens || !artistToDelete || !deleteReason.trim()) return
    try {
      const response = await fetch(`/api/admin/artists/${artistToDelete.id}/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      })

      const text = await response.text()
      if (!response.ok) {
        throw new Error(text || 'Не удалось удалить страницу артиста')
      }

      setShowDeleteArtistModal(false)
      setArtistToDelete(null)
      setDeleteReason('')
      await Promise.all([fetchArtists(), fetchApplications()])
    } catch (err) {
      console.error('Failed to remove artist page:', err)
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
          <h1 className="text-2xl font-bold">Артисты</h1>
          <p className="text-white/40 text-sm">Каталог артистов и заявки на создание или удаление страниц артистов</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2">
          <button onClick={() => setTab('artists')} className={`px-4 py-2 rounded-xl text-sm transition ${tab === 'artists' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/[0.02] border border-white/[0.05] text-white/50 hover:text-white'}`}>
            Артисты
          </button>
          <button onClick={() => setTab('applications')} className={`px-4 py-2 rounded-xl text-sm transition ${tab === 'applications' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/[0.02] border border-white/[0.05] text-white/50 hover:text-white'}`}>
            Заявки
          </button>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 'artists' ? 'Поиск по артистам...' : 'Поиск по заявкам...'}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-sm placeholder-white/20 focus:outline-none focus:border-white/15 transition"
          />
        </div>
      </div>

      {tab === 'artists' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredArtists.map((artist) => (
            <div key={artist.id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.12] transition space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
                  {artist.avatar_url ? (
                    <img src={artist.avatar_url} alt={artist.username} className="w-full h-full object-cover" />
                  ) : (
                    <Music4 className="w-7 h-7 text-white/30" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-semibold truncate">{artist.username}</h2>
                    {artist.is_verified && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 shrink-0" />}
                  </div>
                  <p className="text-sm text-white/40 line-clamp-2">{artist.bio || 'У артиста пока нет описания.'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-2 text-white/40 mb-1"><Users className="w-4 h-4" /> Подписчики</div>
                  <p className="font-semibold">{artist.followers}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-2 text-white/40 mb-1"><Users className="w-4 h-4" /> Подписки</div>
                  <p className="font-semibold">{artist.following}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-2 text-white/40 mb-1"><Music4 className="w-4 h-4" /> Треки</div>
                  <p className="font-semibold">{artist.tracksCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-2 text-white/40 mb-1"><Disc className="w-4 h-4" /> Альбомы</div>
                  <p className="font-semibold">{artist.albumsCount}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => navigate(`/admin/artists/${artist.id}/stats`)} className="flex-1 px-4 py-3 rounded-xl bg-purple-500/15 border border-purple-500/25 text-purple-300 hover:bg-purple-500/20 transition text-sm font-medium">
                  Открыть статистику
                </button>
                <button
                  onClick={() => navigate('/admin/artist-avatars')}
                  title="Загрузить аватарку"
                  className="px-3 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/20 transition text-sm font-medium"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setArtistToDelete(artist)
                    setDeleteReason('')
                    setShowDeleteArtistModal(true)
                  }}
                  className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition text-sm font-medium flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'applications' && (
        <div className="space-y-4">
          {filteredApplications.map((app) => (
            <div key={app.id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{app.username}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] ${app.type === 'delete' ? 'bg-red-500/15 text-red-300' : 'bg-cyan-500/15 text-cyan-300'}`}>
                      {app.type === 'delete' ? 'Удаление страницы' : 'Создание страницы'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] ${app.status === 'pending' ? 'bg-yellow-500/15 text-yellow-300' : app.status === 'approved' ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>
                      {app.status === 'pending' ? 'На рассмотрении' : app.status === 'approved' ? 'Одобрено' : 'Отклонено'}
                    </span>
                  </div>
                  <p className="text-sm text-white/40">{app.email}</p>
                </div>

                {app.status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => reviewApplication(app.id, 'approved')} disabled={reviewingApplicationId === app.id} className="px-3 py-2 rounded-xl text-sm bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/20 transition flex items-center gap-2">
                      <Check className="w-4 h-4" /> Одобрить
                    </button>
                    <button onClick={() => reviewApplication(app.id, 'rejected')} disabled={reviewingApplicationId === app.id} className="px-3 py-2 rounded-xl text-sm bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 transition flex items-center gap-2">
                      <X className="w-4 h-4" /> Отклонить
                    </button>
                  </div>
                )}
              </div>

              {app.message && (
                <div>
                  <p className="text-xs text-white/35 mb-1">О себе</p>
                  <p className="text-sm text-white/65">{app.message}</p>
                </div>
              )}

              {app.links && (
                <div>
                  <p className="text-xs text-white/35 mb-1">Ссылки</p>
                  <p className="text-sm text-white/65 break-words">{app.links}</p>
                </div>
              )}

              {app.reason && (
                <div>
                  <p className="text-xs text-white/35 mb-1">Причина</p>
                  <p className="text-sm text-white/65">{app.reason}</p>
                </div>
              )}
            </div>
          ))}

          {filteredApplications.length === 0 && (
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] text-center text-white/40">
              Нет заявок артистов
            </div>
          )}
        </div>
      )}

      {showDeleteArtistModal && artistToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#0a0a0a] border border-white/10 p-6">
            <h2 className="text-xl font-bold mb-3">Удалить страницу артиста</h2>
            <p className="text-white/60 mb-4">Укажите причину удаления страницы артиста @{artistToDelete.username}</p>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.05] mb-4 outline-none resize-none"
              placeholder="Причина удаления"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteArtistModal(false)} className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">Отмена</button>
              <button onClick={removeArtistPage} disabled={!deleteReason.trim()} className="px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-300 disabled:opacity-50">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
