import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Film, Play, Loader2, Trash2 } from 'lucide-react'
import { artistApi } from '../api/artist'
import { getStoredTokens } from '../api/auth'
import Button from '../components/Button'

interface Video {
  id: number
  title: string
  description: string | null
  duration: number
  thumbnail_url: string | null
  track_id: number | null
  track_title?: string
  album_id: number | null
  album_title?: string
  status: string
  views_count: number
  created_at: string
}

export default function ArtistVideosPage() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchVideos = async () => {
    const tokens = getStoredTokens()
    if (!tokens) {
      setError('Вы не авторизованы')
      setLoading(false)
      return
    }

    try {
      const data = await artistApi.getVideos(tokens.accessToken)
      setVideos(data)
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVideos()
  }, [])

  const handleDelete = async (videoId: number, e: React.MouseEvent) => {
    e.preventDefault()
    if (!confirm('Вы уверены, что хотите удалить это видео?')) return

    const tokens = getStoredTokens()
    if (!tokens) return

    try {
      await artistApi.deleteVideo(tokens.accessToken, videoId)
      setVideos(videos.filter(v => v.id !== videoId))
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления')
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">Одобрен</span>
      case 'pending':
        return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400">На модерации</span>
      case 'rejected':
        return <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">Отклонен</span>
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs bg-white/20 text-white/60">{status}</span>
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
        <h1 className="text-2xl font-bold">Мои клипы</h1>
        <Button as="link" to="/artist/videos/new" variant="primary" size="sm">
          Загрузить клип
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {videos.length === 0 ? (
        <div className="text-center py-20">
          <Film className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/40 mb-4">У вас пока нет клипов</p>
          <Link to="/artist/videos/new" className="text-purple-400 hover:text-purple-300">
            Загрузить первый клип
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {videos.map((video) => (
            <div key={video.id} className="group relative">
              <Link to={`/video/${video.id}`}>
                <div className="aspect-video rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 mb-2 flex items-center justify-center overflow-hidden transition duration-200 relative">
                  {video.thumbnail_url ? (
                    <img loading="lazy" src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Film size={36} className="text-white/30" />
                  )}
                  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-xs">
                    {formatDuration(video.duration)}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                      <Play className="w-5 h-5 ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm truncate group-hover:text-purple-400 transition">{video.title}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/40">
                  {getStatusBadge(video.status)}
                  {video.views_count > 0 && <span>{video.views_count} просмотров</span>}
                </div>
                {video.track_title && (
                  <p className="text-xs text-white/30 truncate mt-1">{video.track_title}</p>
                )}
              </Link>
              <button
                onClick={(e) => handleDelete(video.id, e)}
                className="absolute top-2 right-2 p-2 rounded-lg bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
