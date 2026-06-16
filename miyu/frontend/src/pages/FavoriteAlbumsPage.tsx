import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Disc, Loader2 } from 'lucide-react'
import { getStoredTokens } from '../api/auth'

export default function FavoriteAlbumsPage() {
  const [albums, setAlbums] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAlbums() {
      const tokens = getStoredTokens()
      if (!tokens) {
        setLoading(false)
        return
      }

      try {
        const res = await fetch('/api/likes/albums', {
          headers: { Authorization: `Bearer ${tokens.accessToken}` }
        })
        const data = await res.json()
        setAlbums(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Failed to load favorite albums:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAlbums()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Любимые альбомы</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {albums.map((album) => (
          <Link key={album.album_id} to={`/album/${album.album_id}`} className="group">
            <div className="aspect-square rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 mb-3 flex items-center justify-center overflow-hidden relative transition duration-200">
              {album.cover_url ? (
                <img loading="lazy" src={album.cover_url} alt={album.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
              ) : (
                <Disc size={40} className="text-white/30" />
              )}
            </div>
            <p className="font-medium text-sm truncate group-hover:text-purple-400 transition">{album.title}</p>
            <p className="text-xs text-white/40 truncate">{album.artist_name}</p>
          </Link>
        ))}
      </div>
      {albums.length === 0 && (
        <div className="text-center py-16 text-white/40">
          <Disc className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>У вас пока нет любимых альбомов</p>
        </div>
      )}
    </div>
  )
}
