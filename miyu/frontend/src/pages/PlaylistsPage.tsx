import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Music, Plus, Pin } from 'lucide-react'
import { getStoredTokens } from '../api/auth'

interface Playlist {
  id: number
  title: string
  cover_url: string | null
  is_pinned: boolean
  created_at: string
}

export default function PlaylistsPage() {
  const navigate = useNavigate()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadPlaylists()
  }, [])

  const loadPlaylists = () => {
    const tokens = getStoredTokens()
    if (!tokens) return

    fetch('/api/playlists', {
      headers: { Authorization: `Bearer ${tokens.accessToken}` }
    })
      .then(res => res.json())
      .then(data => {
        setPlaylists(Array.isArray(data) ? data.filter((playlist) => !(playlist as any).is_system) : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  const handleCreatePlaylist = async () => {
    const tokens = getStoredTokens()
    if (!tokens || creating) return
    setCreating(true)

    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`
        },
        body: JSON.stringify({ title: 'Новый плейлист' })
      })

      if (res.ok) {
        const playlist = await res.json()
        navigate(`/profile/playlist/${playlist.id}`)
      }
    } catch (err) {
      console.error('Create playlist error:', err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Мои плейлисты</h1>
        <button
          onClick={handleCreatePlaylist}
          disabled={creating}
          className="px-4 py-2 rounded-full font-medium text-sm glass-accent transition disabled:opacity-50"
        >
          {creating ? 'Создание...' : 'Создать плейлист'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <button
          onClick={handleCreatePlaylist}
          disabled={creating}
          className="aspect-square rounded-xl border border-dashed border-white/20 hover:border-white/40 transition flex flex-col items-center justify-center gap-2 disabled:opacity-50"
        >
          <Plus size={40} className="text-white/30 group-hover:text-white transition" />
          <span className="text-sm text-white/50">Создать</span>
        </button>
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          playlists.map((playlist) => (
            <Link
              key={playlist.id}
              to={`/profile/playlist/${playlist.id}`}
              className="group"
            >
              <div className="aspect-square rounded-xl bg-white/[0.02] border border-white/[0.05] group-hover:border-white/10 transition overflow-hidden relative mb-3">
                {playlist.cover_url ? (
                  <img loading="lazy"
                    src={playlist.cover_url}
                    alt={playlist.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(236,72,153,0.18), rgba(59,130,246,0.12))',
                    }}
                  >
                    <Music size={40} className="text-white/30 group-hover:text-white/50 transition" />
                  </div>
                )}
                {playlist.is_pinned && (
                  <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-yellow-500/80 backdrop-blur-sm">
                    <Pin size={12} className="text-white" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-100 transition-opacity group-hover:from-black/85" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="line-clamp-2 break-words text-sm font-medium leading-snug text-white drop-shadow-lg">
                    {playlist.title}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
