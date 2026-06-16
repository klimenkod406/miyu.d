import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, ListMusic, Music, Loader2 } from 'lucide-react'
import { getStoredTokens } from '../api/auth'

interface Playlist {
  id: number
  title: string
  description: string | null
  cover_url: string | null
  owner_name: string
  track_count: number
}

export default function LikedPlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLikedPlaylists() {
      const tokens = getStoredTokens()
      if (!tokens) {
        setLoading(false)
        return
      }

      try {
        const res = await fetch('/api/playlists/liked/all', {
          headers: { Authorization: `Bearer ${tokens.accessToken}` }
        })
        const data = await res.json()
        setPlaylists(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Failed to load liked playlists:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchLikedPlaylists()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  return (
    <div className="text-white">
      <div className="relative mb-6 overflow-hidden rounded-2xl">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/40 via-pink-600/30 to-dark-900" />
        </div>

        <div className="relative z-10 flex items-center gap-6 p-8 max-[414px]:gap-4 max-[414px]:p-4 max-[414px]:items-start max-[375px]:gap-3 max-[375px]:p-3.5">
          <div className="flex h-48 w-48 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 shadow-2xl max-[414px]:h-24 max-[414px]:w-24 max-[375px]:h-20 max-[375px]:w-20">
            <Heart size={64} className="text-white max-[414px]:h-9 max-[414px]:w-9 max-[375px]:h-8 max-[375px]:w-8" fill="currentColor" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-wider text-white/60 max-[414px]:text-[11px]">ПЛЕЙЛИСТЫ</p>
            <h1 className="my-3 text-5xl font-black tracking-tight max-[414px]:my-2 max-[414px]:text-3xl max-[375px]:text-[1.65rem]">Понравившиеся плейлисты</h1>
            <div className="flex items-center gap-2 text-sm text-white/70 max-[414px]:flex-wrap max-[414px]:gap-1.5 max-[414px]:text-xs">
              <span>{playlists.length} плейлистов</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 p-8 pt-0 max-[414px]:grid-cols-2 max-[414px]:gap-3 max-[414px]:px-0">
        {playlists.map((playlist) => (
          <Link key={playlist.id} to={`/playlist/${playlist.id}`} className="group">
            <div className="aspect-square rounded-xl bg-white/[0.02] border border-white/[0.05] group-hover:border-white/10 transition overflow-hidden relative mb-3">
              {playlist.cover_url ? (
                <img loading="lazy"
                  src={playlist.cover_url}
                  alt={playlist.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[linear-gradient(135deg,rgba(217,70,239,0.25),rgba(236,72,153,0.18),rgba(59,130,246,0.12))]">
                  <Music size={40} className="text-white/30 group-hover:text-white/50 transition" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="font-medium text-sm truncate text-white drop-shadow-lg">{playlist.title}</p>
                <p className="text-xs text-white/70 truncate">@{playlist.owner_name}</p>
                <p className="text-xs text-white/50 mt-1">{playlist.track_count} треков</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {playlists.length === 0 && (
        <div className="text-center py-20">
          <ListMusic className="w-16 h-16 mx-auto mb-4 text-white/20" />
          <p className="text-white/40 text-lg">У вас пока нет понравившихся плейлистов</p>
          <p className="text-white/30 text-sm mt-2">Лайкните чужой плейлист, и он появится здесь</p>
        </div>
      )}
    </div>
  )
}
