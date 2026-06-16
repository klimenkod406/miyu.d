import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, Loader2, Music4, Search, Star, Upload } from 'lucide-react'
import { authApi, getStoredTokens } from '../api/auth'

interface Artist {
  id: number
  username: string
  avatar_url: string | null
  bio: string | null
  is_verified: boolean
}

const MAX_FILE_SIZE = 5 * 1024 * 1024

export default function AdminArtistAvatarsPage() {
  const navigate = useNavigate()
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const [previews, setPreviews] = useState<Record<number, string>>({})
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const fetchArtists = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return
    try {
      const data = await authApi.getArtists(tokens.accessToken)
      const enriched: Artist[] = await Promise.all(
        data.map(async (artist: any) => {
          try {
            const res = await fetch(`/api/user/${artist.id}`)
            if (!res.ok) {
              return {
                id: artist.id,
                username: artist.username,
                avatar_url: null,
                bio: null,
                is_verified: false,
              }
            }
            const profile = await res.json()
            return {
              id: artist.id,
              username: profile.username || artist.username,
              avatar_url: profile.avatar_url || null,
              bio: profile.bio || null,
              is_verified: !!profile.is_verified,
            }
          } catch {
            return {
              id: artist.id,
              username: artist.username,
              avatar_url: null,
              bio: null,
              is_verified: false,
            }
          }
        }),
      )
      setArtists(enriched)
    } catch (err) {
      console.error('Failed to load artists:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArtists()
  }, [])

  const filteredArtists = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return artists
    return artists.filter((artist) =>
      artist.username.toLowerCase().includes(value) ||
      (artist.bio || '').toLowerCase().includes(value),
    )
  }, [artists, query])

  const notify = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }))
  }

  const handleFileSelected = (artistId: number, file: File | null) => {
    if (!file) return
    if (!/^image\//.test(file.type)) {
      notify('Можно загружать только изображения', 'error')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      notify('Файл больше 5 МБ', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPreviews((prev) => ({ ...prev, [artistId]: reader.result as string }))
      }
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = async (artist: Artist) => {
    const input = fileInputRefs.current[artist.id]
    const file = input?.files?.[0]
    if (!file) {
      notify('Сначала выберите файл аватарки', 'error')
      return
    }

    const tokens = getStoredTokens()
    if (!tokens) {
      notify('Не авторизован', 'error')
      return
    }

    setUploadingId(artist.id)
    try {
      const { avatar_url } = await authApi.uploadArtistAvatar(tokens.accessToken, artist.id, file)
      setArtists((prev) => prev.map((a) => (a.id === artist.id ? { ...a, avatar_url } : a)))
      setPreviews((prev) => {
        const next = { ...prev }
        delete next[artist.id]
        return next
      })
      if (input) input.value = ''
      notify(`Аватарка для @${artist.username} обновлена`, 'success')
    } catch (err: any) {
      const message = err?.message || 'Не удалось загрузить аватарку'
      notify(message, 'error')
    } finally {
      setUploadingId(null)
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
        <button onClick={() => navigate('/admin/artists')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Аватарки артистов</h1>
          <p className="text-white/40 text-sm">Загрузите или замените аватарку любого артиста платформы</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по артистам..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-sm placeholder-white/20 focus:outline-none focus:border-white/15 transition"
          />
        </div>
      </div>

      {filteredArtists.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] text-center text-white/40">
          Артисты не найдены
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredArtists.map((artist) => {
            const previewSrc = previews[artist.id]
            const displaySrc = previewSrc || artist.avatar_url
            const isUploading = uploadingId === artist.id
            return (
              <div key={artist.id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
                    {displaySrc ? (
                      <img loading="lazy" src={displaySrc} alt={artist.username} className="w-full h-full object-cover" />
                    ) : (
                      <Music4 className="w-6 h-6 text-white/30" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold truncate">{artist.username}</h2>
                      {artist.is_verified && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 shrink-0" />}
                    </div>
                    <p className="text-xs text-white/40 truncate">{artist.bio || 'Нет описания'}</p>
                  </div>
                </div>

                {previewSrc && (
                  <div className="text-xs text-purple-300 flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5" /> Новая аватарка выбрана
                  </div>
                )}

                <input
                  ref={(el) => { fileInputRefs.current[artist.id] = el }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileSelected(artist.id, e.target.files?.[0] || null)}
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[artist.id]?.click()}
                    disabled={isUploading}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.15] text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" /> Выбрать файл
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpload(artist)}
                    disabled={isUploading || !previews[artist.id]}
                    className="px-4 py-2.5 rounded-xl bg-purple-500/15 border border-purple-500/25 text-purple-300 hover:bg-purple-500/20 text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Загрузить
                  </button>
                </div>

                {!artist.avatar_url && !previewSrc && (
                  <p className="text-xs text-white/30">У артиста пока нет аватарки</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
