import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Mic, Star, Clock3 } from 'lucide-react'
import { getStoredTokens } from '../api/auth'

interface FavoriteArtist {
  id: number
  username: string
  avatar_url: string | null
  bio: string | null
  is_verified: boolean
  is_premium: boolean
  stage_name?: string | null
  genre?: string | null
  total_plays?: number
  listened_seconds: number
}

function formatListenedTime(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours} ч ${minutes} мин`
  return `${minutes} мин`
}

export default function FavoriteArtistsPage() {
  const [artists, setArtists] = useState<FavoriteArtist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchArtists = async () => {
      const tokens = getStoredTokens()
      if (!tokens) {
        setError('Требуется авторизация')
        setLoading(false)
        return
      }

      try {
        const response = await fetch('/api/user/me/favorite-artists', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          throw new Error('Не удалось загрузить любимых артистов')
        }

        const data = await response.json()
        setArtists(data)
      } catch (err: any) {
        setError(err.message || 'Не удалось загрузить любимых артистов')
      } finally {
        setLoading(false)
      }
    }

    fetchArtists()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  if (error) {
    return <div className="text-center py-20 text-red-400">{error}</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Любимые артисты</h1>
        <p className="text-white/40 text-sm">Сюда попадают артисты, которых вы слушали суммарно от 2 часов</p>
      </div>

      {artists.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] py-16 px-6 text-center">
          <Mic className="w-10 h-10 mx-auto mb-4 text-white/20" />
          <h2 className="text-lg font-semibold mb-2">Пока нет любимых артистов</h2>
          <p className="text-white/40 max-w-md mx-auto">
            Артист появится здесь, когда вы в общей сумме прослушаете его треки не меньше 2 часов.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {artists.map((artist) => (
            <Link key={artist.id} to={`/artist/${artist.id}`} className="group rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 p-4 transition duration-200">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.05] overflow-hidden flex items-center justify-center shrink-0">
                  {artist.avatar_url ? (
                    <img src={artist.avatar_url} alt={artist.username} className="w-full h-full object-cover" />
                  ) : (
                    <Mic size={28} className="text-white/30" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate group-hover:text-purple-400 transition">{artist.stage_name || artist.username}</p>
                    {artist.is_verified && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 shrink-0" />}
                  </div>
                  <p className="text-xs text-white/40 truncate mb-2">@{artist.username}</p>
                  {artist.genre && <p className="text-xs text-white/35 truncate mb-2">{artist.genre}</p>}
                  <div className="inline-flex items-center gap-1.5 text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-full px-2.5 py-1">
                    <Clock3 className="w-3 h-3" />
                    {formatListenedTime(artist.listened_seconds)}
                  </div>
                </div>
              </div>

              {artist.bio && (
                <p className="text-sm text-white/40 mt-3 line-clamp-2">{artist.bio}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
