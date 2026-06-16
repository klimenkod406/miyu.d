import { useState, useRef, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Upload, X, Image, Disc, Plus, Trash2, GripVertical, Clock, CheckCircle, Loader2, ChevronDown, Sparkles } from 'lucide-react'
import { artistApi } from '../api/artist'
import { getStoredTokens } from '../api/auth'

const ALBUM_TYPES = [
  { id: 'album', label: 'Альбом', description: 'Полноценный альбом (10+ треков)', minTracks: 1 },
  { id: 'single', label: 'Сингл', description: '1-3 трека', minTracks: 1 },
  { id: 'ep', label: 'EP', description: '4-6 треков', minTracks: 4 },
]

interface TrackData {
  id: number
  title: string
  file: File | null
  duration: string
  status: 'pending' | 'uploading' | 'uploaded' | 'error'
}

const MemoizedTrackItem = memo(({ track, idx, updateTrack, removeTrack }: { 
  track: TrackData, 
  idx: number, 
  updateTrack: (id: number, updates: Partial<TrackData>) => void,
  removeTrack: (id: number) => void,
}) => {

  return (
    <motion.div
      key={track.id}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      layout
      className="rounded-xl bg-white/[0.02] border border-white/[0.05] group"
    >
      <div className="flex items-center gap-3 p-3">
        <GripVertical className="w-4 h-4 text-white/20 cursor-grab" />
        <span className="text-sm text-white/40 w-6">{idx + 1}</span>
        
        <div className="w-10 h-10 rounded-md bg-white/[0.05] flex-shrink-0 overflow-hidden flex items-center justify-center">
          <Disc className="w-5 h-5 text-white/20 m-auto" />
        </div>

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={track.title}
            onChange={(e) => updateTrack(track.id, { title: e.target.value })}
            className="w-full bg-transparent border-none focus:outline-none text-sm font-medium"
            placeholder="Название трека"
          />
        </div>

        <button
          type="button"
          onClick={() => removeTrack(track.id)}
          className="w-8 h-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 transition"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
});


export default function ArtistCreateAlbumPage() {
  const navigate = useNavigate()
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [tracks, setTracks] = useState<TrackData[]>([])
  const [currentStep, setCurrentStep] = useState<'info' | 'tracks'>('info')
  const trackInputRef = useRef<HTMLInputElement>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    title: '',
    type: 'album' as 'album' | 'single' | 'ep',
    description: '',
    isPublic: true,
  })

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCoverFile(file);
      const reader = new FileReader()
      reader.onload = () => setCoverPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleTrackUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const newTracks: TrackData[] = Array.from(files).map((file, idx) => ({
        id: Date.now() + idx,
        title: file.name.replace(/\.[^/.]+$/, ''),
        file,
        duration: '0:00',
        status: 'pending' as const,
      }))
      
      setTracks(prev => [...prev, ...newTracks])
      
      newTracks.forEach(track => {
        if (track.file) {
          const audio = new Audio(URL.createObjectURL(track.file))
          audio.onloadedmetadata = () => {
            const duration = Math.round(audio.duration)
            setTracks(prev => prev.map(t => 
              t.id === track.id ? { ...t, duration: formatDuration(duration) } : t
            ))
          }
        }
      })
    }
  }

  const updateTrack = (id: number, updates: Partial<TrackData>) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  const removeTrack = (id: number) => {
    setTracks(tracks.filter(t => t.id !== id))
  }

  const parseDuration = (duration: string) => {
    const parts = duration.split(':')
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1])
    }
    return 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const tokens = getStoredTokens()
    if (!tokens) {
      setError('Вы не авторизованы')
      return
    }

    if (currentStep === 'info') {
      setCurrentStep('tracks')
    } else {
      setCreating(true)
      setError('')

      try {
        const albumFormData = new FormData();
        albumFormData.append('title', formData.title);
        albumFormData.append('type', formData.type);
        albumFormData.append('description', formData.description);
        if (coverFile) {
          albumFormData.append('cover', coverFile);
        }

        const album = await artistApi.createAlbum(tokens.accessToken, albumFormData)

        for (const track of tracks) {
          if (track.file && track.title) {
            const formDataTrack = new FormData()
            formDataTrack.append('track', track.file)
            formDataTrack.append('title', track.title)
            formDataTrack.append('duration', parseDuration(track.duration).toString())
            formDataTrack.append('album_id', album.id.toString())

            await artistApi.uploadTrack(tokens.accessToken, formDataTrack)
          }
        }

        navigate('/artist/albums')
      } catch (err: any) {
        setError(err.message || 'Ошибка при создании альбома')
        setCreating(false)
      }
    }
  }

  const canProceed = !!formData.title
  const canSubmit = canProceed && tracks.length > 0
  const minTracks = ALBUM_TYPES.find(t => t.id === formData.type)?.minTracks || 1

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate(-1)} 
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Создание альбома</h1>
          <p className="text-white/40 text-sm">
            {currentStep === 'info' ? 'Заполните информацию о альбоме' : 'Добавьте треки'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-8">
        {['info', 'tracks'].map((step, idx) => (
          <div key={step} className="flex items-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
              currentStep === step ? 'bg-purple-500/20 text-purple-400' : 
              idx < ['info', 'tracks'].indexOf(currentStep) ? 'bg-green-500/20 text-green-400' : 'bg-white/[0.02] text-white/40'
            }`}>
              {idx < ['info', 'tracks'].indexOf(currentStep) ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <span className="w-4 h-4 flex items-center justify-center text-xs">{idx + 1}</span>
              )}
              {step === 'info' ? 'Информация' : 'Треки'}
            </div>
            {idx < 1 && (
              <div className={`w-8 h-0.5 mx-2 ${idx < ['info', 'tracks'].indexOf(currentStep) ? 'bg-green-500' : 'bg-white/10'}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {currentStep === 'info' && (
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium mb-3">Обложка</label>
              <div className="w-56 h-56 rounded-2xl border-2 border-dashed border-white/20 hover:border-white/40 transition bg-white/[0.02] overflow-hidden relative group">
                {coverPreview ? (
                  <>
                    <img loading="lazy" src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setCoverPreview(null); setCoverFile(null); }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                    <Image className="w-12 h-12 text-white/30 mb-2" />
                    <span className="text-sm text-white/50">Загрузить</span>
                    <span className="text-xs text-white/30 mt-1">JPG, PNG</span>
                    <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2">Название альбома</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Введите название"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/15 focus:border-purple-500 focus:outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-3">Тип альбома</label>
                <div className="grid grid-cols-3 gap-3">
                  {ALBUM_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: type.id as any })}
                      className={`p-4 rounded-xl border-2 text-left transition ${
                        formData.type === type.id
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-white/[0.08] hover:border-white/20 bg-white/[0.02]'
                      }`}
                    >
                      <p className="font-medium text-sm">{type.label}</p>
                      <p className="text-xs text-white/40 mt-1">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs text-white/60">
                <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                <span>
                  <span className="text-purple-300 font-medium">Жанр, 18+ и прочие характеристики</span> будут
                  автоматически определены AI-анализатором после загрузки треков.
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Описание</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Расскажите о альбоме..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/15 focus:border-purple-500 focus:outline-none transition resize-none"
                />
              </div>
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
              disabled={!canProceed}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              Далее
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </form>
      )}

      {currentStep === 'tracks' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
            <div className="flex items-center gap-2 text-orange-400">
              <Clock className="w-5 h-5" />
              <span className="font-medium">Модерация</span>
            </div>
            <p className="text-sm text-white/60 mt-1">
              После загрузки треки будут добавлены к альбому.
            </p>
          </div>

          <div className="p-6 rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 transition bg-white/[0.02]">
            <input 
              ref={trackInputRef}
              type="file" 
              accept="audio/*" 
              multiple 
              onChange={handleTrackUpload} 
              className="hidden" 
              id="track-input"
            />
            <label 
              htmlFor="track-input"
              className="flex flex-col items-center justify-center cursor-pointer py-4"
            >
              <Upload className="w-12 h-12 text-white/30 mb-3" />
              <p className="text-lg font-medium mb-1">Загрузите треки</p>
              <p className="text-sm text-white/40">Перетащите файлы или нажмите для выбора</p>
              <p className="text-xs text-white/30 mt-2">MP3, WAV, FLAC • минимум {minTracks} трек(ов)</p>
            </label>
          </div>

          <AnimatePresence>
            {tracks.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Треки ({tracks.length})
                    {tracks.length < minTracks && (
                      <span className="text-red-400 ml-2">• минимум {minTracks} трек(ов)</span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => trackInputRef.current?.click()}
                    className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить
                  </button>
                </div>

                <div className="space-y-2 max-h-[30rem] overflow-y-auto pr-2">
                  {tracks.map((track, idx) => (
                    <MemoizedTrackItem 
                      key={track.id}
                      track={track}
                      idx={idx}
                      updateTrack={updateTrack}
                      removeTrack={removeTrack}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-between gap-3 pt-4 border-t border-white/[0.05]">
            <button
              type="button"
              onClick={() => setCurrentStep('info')}
              className="px-6 py-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] transition flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Назад
            </button>
            <button
              type="submit"
              disabled={!canSubmit || tracks.length < minTracks || creating}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Создание...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Создать альбом
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
