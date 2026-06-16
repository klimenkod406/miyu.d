import { useState, useMemo } from 'react'
import { Music, Check, X, AlertTriangle, Zap, Shield, Clock, Globe, Copyright, Mic, Volume2, TrendingUp, FileAudio, Play, Pause, Disc, Album } from 'lucide-react'

interface TrackAnalysis {
  id: number
  title: string
  artist: string
  type: 'track' | 'album' | 'cover'
  status: 'pending' | 'approved' | 'rejected'
  duration: string
  bpm: number
  genre: string
  mood: string[]
  language: string
  key: string
  hasExplicit: boolean
  hasCopyright: boolean
  coverUrl: string
  audioUrl: string
  uploadedAt: string
  aiScore: number
  analysis: {
    audioQuality: number
    loudness: number
    dynamicRange: number
    hasNoise: boolean
    hasDistortion: boolean
    vocalsDetected: boolean
    instrumentals: string[]
    sentiment: string
    tags: string[]
    matchPercent: number
    copyrightIssue: boolean
    copyrightSource: string
    isOriginal: boolean
    detectedLyrics: boolean
    explicitWords: string[]
    ageRestriction: number
  }
}

function generateAnalysis(id: number): TrackAnalysis {
  const moods = ['Энергичный', 'Спокойный', 'Романтический', 'Грустный', 'Вдохновляющий', 'Танцевальный']
  const genres = ['Поп', 'Рок', 'Электроника', 'Хип-хоп', 'Русский рэп', 'Классика', 'Джаз', 'Инди']
  const languages = ['Русский', 'Английский', 'Смешанный', 'Без слов']
  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const instrumentals = ['Синтезатор', 'Гитара', 'Барабаны', 'Бас', 'Струнные', 'Пианино']
  const tags = ['Хит', 'Новинка', 'Ретро', 'dance', 'chill', 'workout', 'road', 'party', 'sleep', 'focus']

  const hasExplicit = Math.random() > 0.7
  const hasCopyright = Math.random() > 0.2
  const audioQuality = Math.round(60 + Math.random() * 40)
  const isOriginal = !hasCopyright || Math.random() > 0.3

  return {
    id,
    title: `Трек ${id}`,
    artist: `Артист ${id}`,
    type: id % 3 === 0 ? 'track' : id % 3 === 1 ? 'album' : 'cover',
    status: id < 4 ? 'pending' : id < 7 ? 'approved' : 'rejected',
    duration: `${Math.floor(2 + Math.random() * 3)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
    bpm: Math.round(80 + Math.random() * 80),
    genre: genres[Math.floor(Math.random() * genres.length)],
    mood: [moods[Math.floor(Math.random() * moods.length)]],
    language: languages[Math.floor(Math.random() * languages.length)],
    key: keys[Math.floor(Math.random() * keys.length)],
    hasExplicit,
    hasCopyright,
    coverUrl: `https://picsum.photos/seed/cover${id}/300/300`,
    audioUrl: `#`,
    uploadedAt: `${2024}-${Math.floor(1 + Math.random() * 11).toString().padStart(2, '0')}-${Math.floor(1 + Math.random() * 28).toString().padStart(2, '0')}`,
    aiScore: Math.round(50 + Math.random() * 50),
    analysis: {
      audioQuality,
      loudness: Math.round(-30 + Math.random() * 20),
      dynamicRange: Math.round(5 + Math.random() * 10),
      hasNoise: Math.random() > 0.7,
      hasDistortion: Math.random() > 0.8,
      vocalsDetected: Math.random() > 0.2,
      instrumentals: instrumentals.sort(() => Math.random() - 0.5).slice(0, 3),
      sentiment: moods[Math.floor(Math.random() * moods.length)],
      tags: tags.sort(() => Math.random() - 0.5).slice(0, 4),
      matchPercent: Math.round(Math.random() * 30),
      copyrightIssue: !hasCopyright || !isOriginal,
      copyrightSource: isOriginal ? 'Original' : 'Unknown source',
      isOriginal,
      detectedLyrics: Math.random() > 0.3,
      explicitWords: hasExplicit ? ['fuck', 'shit', 'damn'].sort(() => Math.random() - 0.5).slice(0, Math.floor(1 + Math.random() * 3)) : [],
      ageRestriction: hasExplicit ? 16 : 0,
    },
  }
}

function AnalysisItem({ icon: Icon, label, value, warning }: { icon: React.ElementType; label: string; value: string | number | boolean; warning?: boolean }) {
  return (
    <div className={`flex items-center justify-between p-2 rounded-lg ${warning ? 'bg-red-500/10' : 'bg-white/[0.02]'}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${warning ? 'text-red-400' : 'text-white/40'}`} />
        <span className="text-sm text-white/60">{label}</span>
      </div>
      {typeof value === 'boolean' ? (
        <span className={`text-sm ${value ? 'text-green-400' : 'text-red-400'}`}>
          {value ? 'Да' : 'Нет'}
        </span>
      ) : (
        <span className={`text-sm ${warning ? 'text-red-400' : 'text-white'}`}>{value}</span>
      )}
    </div>
  )
}

function AnalysisModal({ item, onClose, onApprove, onReject }: { item: TrackAnalysis; onClose: () => void; onApprove: (id: number) => void; onReject: (id: number) => void }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeTab, setActiveTab] = useState<'analysis' | 'preview'>('analysis')

  const scoreColor = item.aiScore >= 80 ? 'text-green-400' : item.aiScore >= 60 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto glass rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-white/5 glass">
          <div className="flex items-center gap-4">
            <img loading="lazy" src={item.coverUrl} alt={item.title} className="w-16 h-16 rounded-xl object-cover" />
            <div>
              <h2 className="text-xl font-bold">{item.title}</h2>
              <p className="text-white/40">{item.artist}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded text-xs ${scoreColor} bg-white/10`}>
                  AI: {item.aiScore}%
                </span>
                <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/60">
                  {item.duration}
                </span>
                <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/60">
                  {item.bpm} BPM
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10">
            ✕
          </button>
        </div>

        <div className="flex gap-2 p-4 border-b border-white/5">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-4 py-2 rounded-lg text-sm transition ${activeTab === 'analysis' ? 'bg-purple-500/20 text-purple-400' : 'text-white/40 hover:text-white'}`}
          >
            Анализ
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-lg text-sm transition ${activeTab === 'preview' ? 'bg-purple-500/20 text-purple-400' : 'text-white/40 hover:text-white'}`}
          >
            Превью
          </button>
        </div>

        {activeTab === 'analysis' ? (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-white/40">Основная информация</h3>
                <AnalysisItem icon={FileAudio} label="Жанр" value={item.genre} />
                <AnalysisItem icon={Globe} label="Язык" value={item.language} />
                <AnalysisItem icon={Music} label="Ключ" value={item.key} />
                <AnalysisItem icon={TrendingUp} label="Настроение" value={item.mood[0]} />
                <AnalysisItem icon={Mic} label="Вокал" value={item.analysis.vocalsDetected} />
                <AnalysisItem icon={Volume2} label="Эксплицит" value={item.hasExplicit} warning={item.hasExplicit} />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-white/40">Технический анализ</h3>
                <AnalysisItem icon={Zap} label="Качество аудио" value={`${item.analysis.audioQuality}%`} />
                <AnalysisItem icon={Volume2} label="Громкость" value={`${item.analysis.loudness} LUFS`} />
                <AnalysisItem icon={TrendingUp} label="Динамический диапазон" value={`${item.analysis.dynamicRange} dB`} />
                <AnalysisItem icon={AlertTriangle} label="Шум" value={!item.analysis.hasNoise} warning={item.analysis.hasNoise} />
                <AnalysisItem icon={AlertTriangle} label="Искажения" value={!item.analysis.hasDistortion} warning={item.analysis.hasDistortion} />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-white/40">Авторские права</h3>
              <div className="grid grid-cols-2 gap-2">
                <AnalysisItem icon={Shield} label="Оригинал" value={item.analysis.isOriginal} warning={!item.analysis.isOriginal} />
                <AnalysisItem icon={Copyright} label="Проблема" value={!item.analysis.copyrightIssue} warning={item.analysis.copyrightIssue} />
              </div>
              {!item.analysis.isOriginal && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">Внимание: обнаружено сходство {item.analysis.matchPercent}% с {item.analysis.copyrightSource}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-white/40">Инструменты</h3>
              <div className="flex flex-wrap gap-2">
                {item.analysis.instrumentals.map((inst) => (
                  <span key={inst} className="px-3 py-1 rounded-full bg-white/10 text-sm">
                    {inst}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-white/40">Теги</h3>
              <div className="flex flex-wrap gap-2">
                {item.analysis.tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-sm">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {item.analysis.explicitWords.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-red-400">Обнаруженные слова</h3>
                <div className="flex flex-wrap gap-2">
                  {item.analysis.explicitWords.map((word) => (
                    <span key={word} className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-sm">
                      {word}
                    </span>
                  ))}
                </div>
                {item.analysis.ageRestriction > 0 && (
                  <p className="text-sm text-red-400">Возрастное ограничение: {item.analysis.ageRestriction}+</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-center">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-20 h-20 rounded-full bg-purple-500 flex items-center justify-center hover:bg-purple-600 transition"
              >
                {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </button>
            </div>
            <div className="text-center">
              <p className="text-white/60 text-sm">Превью недоступно</p>
              <p className="text-white/40 text-xs">Для прослушивания требуется полная версия</p>
            </div>
          </div>
        )}

        <div className="sticky bottom-0 flex items-center justify-between p-4 border-t border-white/5 glass">
          <button
            onClick={() => onReject(item.id)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
          >
            <X className="w-5 h-5" />
            Отклонить
          </button>
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <Clock className="w-4 h-4" />
            Загружено: {item.uploadedAt}
          </div>
          <button
            onClick={() => onApprove(item.id)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 transition"
          >
            <Check className="w-5 h-5" />
            Одобрить
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ModerationPage() {
  const [filter, setFilter] = useState('pending')
  const [items, setItems] = useState<TrackAnalysis[]>(() => Array.from({ length: 15 }, (_, i) => generateAnalysis(i + 1)))
  const [selectedItem, setSelectedItem] = useState<TrackAnalysis | null>(null)

  const filteredItems = filter === 'all' ? items : filter === 'pending' ? items.filter((item) => item.status === 'pending') : items.filter((item) => item.status === 'approved')

  const pendingCount = items.filter((i) => i.status === 'pending').length
  const approvedCount = items.filter((i) => i.status === 'approved').length

  const handleApprove = (id: number) => {
    setItems(items.map((item) => item.id === id ? { ...item, status: 'approved' } : item))
    setSelectedItem(null)
  }

  const handleReject = (id: number) => {
    setItems(items.map((item) => item.id === id ? { ...item, status: 'rejected' } : item))
    setSelectedItem(null)
  }

  const stats = useMemo(() => ({
    tracks: items.filter(i => i.type === 'track').length,
    albums: items.filter(i => i.type === 'album').length,
    covers: items.filter(i => i.type === 'cover').length,
    avgScore: Math.round(items.reduce((sum, i) => sum + i.aiScore, 0) / items.length),
    totalDuration: items.reduce((sum, i) => {
      const [min, sec] = i.duration.split(':').map(Number)
      return sum + min * 60 + sec
    }, 0),
  }), [items])

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center gap-2 mb-1">
            <Music className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-white/40">Треки</span>
          </div>
          <p className="text-2xl font-bold">{stats.tracks}</p>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center gap-2 mb-1">
            <Album className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-white/40">Альбомы</span>
          </div>
          <p className="text-2xl font-bold">{stats.albums}</p>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center gap-2 mb-1">
            <Disc className="w-4 h-4 text-pink-400" />
            <span className="text-xs text-white/40">Обложки</span>
          </div>
          <p className="text-2xl font-bold">{stats.covers}</p>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs text-white/40">Средний балл</span>
          </div>
          <p className="text-2xl font-bold">{stats.avgScore}%</p>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-white/40">Общая длит.</span>
          </div>
          <p className="text-2xl font-bold">{Math.floor(stats.totalDuration / 60)}ч {stats.totalDuration % 60}м</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Модерация</h1>
          <p className="text-white/40 text-sm">
            В ожидании: {pendingCount} | Одобрено: {approvedCount}
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white"
        >
          <option value="pending">На проверке</option>
          <option value="approved">Одобренные</option>
          <option value="all">Все</option>
        </select>
      </div>

      <div className="space-y-2">
        {filteredItems.map((item) => {
          const scoreColor = item.aiScore >= 80 ? 'text-green-400' : item.aiScore >= 60 ? 'text-yellow-400' : 'text-red-400'
          const statusColor = item.status === 'pending' ? 'text-yellow-400' : item.status === 'approved' ? 'text-green-400' : 'text-red-400'
          
          return (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition duration-200 text-left"
            >
              <img loading="lazy" src={item.coverUrl} alt={item.title} className="w-14 h-14 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.title}</p>
                <p className="text-sm text-white/40 truncate">{item.artist}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-white/40">{item.genre}</span>
                  <span className="text-xs text-white/20">•</span>
                  <span className="text-xs text-white/40">{item.duration}</span>
                  <span className="text-xs text-white/20">•</span>
                  <span className="text-xs text-white/40">{item.bpm} BPM</span>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm ${scoreColor}`}>AI: {item.aiScore}%</p>
                <p className={`text-xs ${statusColor}`}>
                  {item.status === 'pending' ? 'На проверке' : item.status === 'approved' ? 'Одобрен' : 'Отклонён'}
                </p>
              </div>
              <div className="flex gap-2">
                {item.status === 'pending' && (
                  <>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleApprove(item.id) }}
                      className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleReject(item.id) }}
                      className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-white/40">Нет элементов для модерации</p>
        </div>
      )}

      {selectedItem && (
        <AnalysisModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  )
}