import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, X, Image, Play, Loader2, FileVideo, Music, Clock, AlertCircle } from 'lucide-react'
import { artistApi } from '../api/artist'
import { getStoredTokens } from '../api/auth'

interface ApprovedTrack {
  id: number
  title: string
  duration: number
  cover_url?: string
  album_title?: string
}

interface ApprovedAlbum {
  id: number
  title: string
  cover_url?: string
}

export default function ArtistUploadVideoPage() {
  const navigate = useNavigate()
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    track_id: '',
    album_id: '',
    duration: 0,
  })

  const [tracks, setTracks] = useState<ApprovedTrack[]>([])
  const [albums, setAlbums] = useState<ApprovedAlbum[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      const tokens = getStoredTokens()
      if (!tokens) {
        setError('Вы не авторизованы')
        setLoading(false)
        return
      }

      try {
        const [tracksData, albumsData] = await Promise.all([
          artistApi.getApprovedTracks(tokens.accessToken),
          artistApi.getApprovedAlbums(tokens.accessToken),
        ])
        setTracks(tracksData)
        setAlbums(albumsData)
      } catch (err: any) {
        console.error('Failed to load data:', err)
        setError('Не удалось загрузить данные')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setThumbnailFile(file)
      const reader = new FileReader()
      reader.onload = () => setThumbnailPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setVideoFile(file)
      setVideoPreview(file.name)
      
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        setFormData({ ...formData, duration: Math.round(video.duration) })
      }
      video.src = URL.createObjectURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    const tokens = getStoredTokens()
    if (!tokens) {
      setError('Вы не авторизованы')
      return
    }

    if (!formData.title || !videoFile || !formData.duration) {
      setError('Заполните все обязательные поля')
      return
    }

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('video', videoFile)
      fd.append('title', formData.title)
      fd.append('duration', formData.duration.toString())
      if (formData.description) fd.append('description', formData.description)
      if (formData.track_id && formData.track_id !== '') fd.append('track_id', formData.track_id)
      if (formData.album_id && formData.album_id !== '') fd.append('album_id', formData.album_id)
      if (thumbnailFile) fd.append('thumbnail', thumbnailFile)

      const result = await artistApi.uploadVideo(tokens.accessToken, fd)
      setSuccess(true)
      
      setTimeout(() => {
        navigate('/artist/videos')
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Ошибка при загрузке')
    } finally {
      setUploading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

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
          <h1 className="text-2xl font-bold">Загрузить клип</h1>
          <p className="text-white/40 text-sm">Добавьте видео к вашему треку</p>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400">
          Клип успешно загружен и отправлен на модерацию!
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
          <div className="flex items-center gap-2 text-orange-400">
            <Clock className="w-5 h-5" />
            <span className="font-medium">Модерация</span>
          </div>
          <p className="text-sm text-white/60 mt-1">
            Видео будет отправлено на модерацию. После одобрения оно появится на сайте.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium mb-3">Превью</label>
            <div className="w-72 h-40 rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 transition bg-white/[0.02] overflow-hidden relative group">
              {thumbnailPreview ? (
                <>
                  <img src={thumbnailPreview} alt="Thumbnail" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setThumbnailFile(null); setThumbnailPreview(null) }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                  <Image className="w-12 h-12 text-white/30 mb-2" />
                  <span className="text-sm text-white/50">Загрузить превью</span>
                  <span className="text-xs text-white/30 mt-1">JPG, PNG</span>
                  <input type="file" accept="image/*" onChange={handleThumbnailSelect} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Название видео *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Official Video, Live Session, etc."
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/15 focus:border-purple-500 focus:outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <Music className="w-4 h-4 inline mr-1" />
                Трек (только одобренные)
              </label>
              <select
                value={formData.track_id}
                onChange={(e) => setFormData({ ...formData, track_id: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/15 focus:border-purple-500 focus:outline-none transition"
              >
                <option value="">Выберите трек</option>
                {tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.title} ({formatDuration(track.duration)})
                    {track.album_title ? ` - ${track.album_title}` : ''}
                  </option>
                ))}
              </select>
              {tracks.length === 0 && (
                <p className="text-xs text-white/40 mt-1">Нет одобренных треков</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Альбом</label>
              <select
                value={formData.album_id}
                onChange={(e) => setFormData({ ...formData, album_id: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/15 focus:border-purple-500 focus:outline-none transition"
              >
                <option value="">Без альбома</option>
                {albums.map((album) => (
                  <option key={album.id} value={album.id}>{album.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Описание</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Опишите видео..."
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/15 focus:border-purple-500 focus:outline-none transition resize-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-3">Видео файл *</label>
          <div className="p-6 rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 transition bg-white/[0.02]">
            <input 
              type="file" 
              accept="video/*" 
              onChange={handleVideoSelect} 
              className="hidden" 
              id="video-upload"
            />
            <label 
              htmlFor="video-upload"
              className="flex flex-col items-center justify-center cursor-pointer"
            >
              {videoPreview ? (
                <div className="flex items-center gap-3">
                  <Play className="w-8 h-8 text-purple-400" />
                  <div>
                    <p className="font-medium">{videoPreview}</p>
                    <p className="text-sm text-white/40">Длительность: {formatDuration(formData.duration)}</p>
                  </div>
                </div>
              ) : (
                <>
                  <FileVideo className="w-12 h-12 text-white/30 mb-3" />
                  <p className="text-lg font-medium mb-1">Загрузите видео</p>
                  <p className="text-sm text-white/40">Перетащите файл или нажмите для выбора</p>
                  <p className="text-xs text-white/30 mt-2">MP4, MOV • макс. 500 МБ</p>
                </>
              )}
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.05]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] transition"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={uploading || !formData.title || !videoFile}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Загрузка...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Отправить на модерацию
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
