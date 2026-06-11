import { useState, useEffect } from 'react'
import { Music, Loader2, Image, X, Sparkles } from 'lucide-react'
import { artistApi } from '../api/artist'
import { getStoredTokens } from '../api/auth'

interface Album {
  id: number
  title: string
}

export default function ArtistUploadPage() {
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [albumId, setAlbumId] = useState('')
  const [albums, setAlbums] = useState<Album[]>([])
  const [duration, setDuration] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const loadAlbums = async () => {
      const tokens = getStoredTokens()
      if (!tokens) {
        return
      }
      try {
        const data = await artistApi.getAlbums(tokens.accessToken)
        setAlbums(data)
      } catch (err: any) {
        console.error('Failed to load albums:', err)
      }
    }
    loadAlbums()
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      const audio = new Audio(URL.createObjectURL(selectedFile))
      audio.onloadedmetadata = () => {
        setDuration(Math.round(audio.duration))
      }
    }
  }

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setCoverFile(selectedFile)
      const reader = new FileReader()
      reader.onload = () => setCoverPreview(reader.result as string)
      reader.readAsDataURL(selectedFile)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type.startsWith('audio/')) {
      setFile(droppedFile)
      const audio = new Audio(URL.createObjectURL(droppedFile))
      audio.onloadedmetadata = () => {
        setDuration(Math.round(audio.duration))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!file || !title || !duration) {
      setError('Заполните все обязательные поля')
      return
    }

    const tokens = getStoredTokens()
    if (!tokens) {
      setError('Вы не авторизованы')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('track', file)
      formData.append('title', title)
      formData.append('duration', duration.toString())
      if (albumId) formData.append('album_id', albumId)
      if (coverFile) formData.append('cover', coverFile)

      await artistApi.uploadTrack(tokens.accessToken, formData)
      setSuccess(true)
      setFile(null)
      setCoverFile(null)
      setCoverPreview(null)
      setTitle('')
      setAlbumId('')
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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Загрузить трек</h1>

      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400">
          Трек успешно загружен и отправлен на модерацию!
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6 mb-6">
        <div>
          <label className="block text-sm mb-2 text-white/70">Обложка</label>
          <div className="w-40 h-40 rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 transition bg-white/[0.02] overflow-hidden relative group">
            {coverPreview ? (
              <>
                <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setCoverFile(null); setCoverPreview(null) }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                <Image className="w-8 h-8 text-white/30 mb-1" />
                <span className="text-xs text-white/50">Загрузить</span>
                <span className="text-xs text-white/30">JPG, PNG</span>
                <input type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
              </label>
            )}
          </div>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex-1 border-2 border-dashed rounded-xl p-8 text-center transition duration-200 ${
            dragOver ? 'border-purple-500 bg-purple-500/10' : 'border-white/10'
          }`}
        >
          <div className="flex justify-center mb-4">
            <Music size={48} className="text-white/30" />
          </div>
          {file ? (
            <div>
              <p className="text-lg font-medium mb-2">{file.name}</p>
              <p className="text-white/40 text-sm">{formatDuration(duration)}</p>
            </div>
          ) : (
            <>
              <p className="text-lg font-medium mb-2">Перетащите файл сюда</p>
              <p className="text-white/40 text-sm mb-4">или нажмите для выбора</p>
            </>
          )}
          <input 
            type="file" 
            accept="audio/*" 
            className="hidden" 
            id="audio-input"
            onChange={handleFileSelect}
          />
          <label htmlFor="audio-input" className="px-6 py-2 rounded-full font-medium text-sm bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/10 transition cursor-pointer">
            {file ? 'Заменить файл' : 'Выбрать файл'}
          </label>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-2 text-white/70">Название трека *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Введите название"
            className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-xl text-white placeholder-white/30 focus:border-purple-500 outline-none transition"
          />
        </div>

        <div>
          <label className="block text-sm mb-2 text-white/70">Альбом</label>
          <select 
            value={albumId} 
            onChange={(e) => setAlbumId(e.target.value)}
            className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-xl text-white focus:border-purple-500 outline-none transition"
          >
            <option value="">Без альбома</option>
            {albums.map(album => (
              <option key={album.id} value={album.id}>{album.title}</option>
            ))}
          </select>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs text-white/60">
          <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
          <span>
            <span className="text-purple-300 font-medium">Жанр, 18+ и прочие характеристики</span> будут
            автоматически определены AI-анализатором после загрузки.
          </span>
        </div>

        <button 
          type="submit"
          disabled={uploading || !file || !title}
          className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-medium transition flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Загрузка...
            </>
          ) : (
            'Загрузить'
          )}
        </button>
      </form>
    </div>
  )
}