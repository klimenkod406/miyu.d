import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Disc, Play, Loader2 } from 'lucide-react'
import { artistApi } from '../api/artist'
import { getStoredTokens } from '../api/auth'
import Button from '../components/Button'

interface Album {
  id: number
  title: string
  type: string
  genre: string | null
  release_year: number | null
  cover_url: string | null
  track_count: number
  total_duration: number | null
  status: string
  created_at: string
}

export default function ArtistAlbumsPage() {
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAlbums = async () => {
    const tokens = getStoredTokens()
    if (!tokens) {
      setError('Вы не авторизованы')
      setLoading(false)
      return
    }

    try {
      const data = await artistApi.getAlbums(tokens.accessToken)
      setAlbums(data)
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlbums()
  }, [])

  const handleDelete = async (albumId: number, e: React.MouseEvent) => {
    e.preventDefault()
    if (!confirm('Вы уверены, что хотите удалить альбом и все его треки?')) return

    const tokens = getStoredTokens()
    if (!tokens) return

    try {
      await artistApi.deleteAlbum(tokens.accessToken, albumId)
      setAlbums(albums.filter(a => a.id !== albumId))
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления')
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0 мин'
    const mins = Math.floor(seconds / 60)
    return `${mins} мин`
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'album': return 'Альбом'
      case 'single': return 'Сингл'
      case 'ep': return 'EP'
      default: return type
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Мои альбомы</h1>
        <Button as="link" to="/artist/albums/new" variant="primary" size="sm">
          Создать альбом
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {albums.length === 0 ? (
        <div className="text-center py-20">
          <Disc className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/40 mb-4">У вас пока нет альбомов</p>
          <Link to="/artist/albums/new" className="text-purple-400 hover:text-purple-300">
            Создать первый альбом
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {albums.map((album) => (
            <div key={album.id} className="group relative">
              <Link to={`/album/${album.id}`}>
                <div className="aspect-square rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 mb-3 flex items-center justify-center overflow-hidden transition duration-200 relative">
                  {album.cover_url ? (
                    <img loading="lazy" src={album.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Disc size={36} className="text-white/30" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition flex items-end justify-end p-2">
                    <button className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                      <Play className="w-4 h-4 ml-0.5" />
                    </button>
                  </div>
                </div>
                <p className="font-medium text-sm truncate group-hover:text-purple-400 transition">{album.title}</p>
                <p className="text-xs text-white/40">
                  {getTypeLabel(album.type)} • {album.track_count || 0} треков
                </p>
              </Link>
              <button
                onClick={(e) => handleDelete(album.id, e)}
                className="absolute top-2 right-2 p-2 rounded-lg bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
