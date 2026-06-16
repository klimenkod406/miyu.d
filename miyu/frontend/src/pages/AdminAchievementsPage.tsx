import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Plus, X, Trash2, Award, Save,
  Heart, Music, Play, Star, Zap, Clock,
  Users, Crown, MessageCircle, Target, Diamond, Sparkles
} from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'
import { achievementsApi } from '../api/achievements'
import FilterPills from '../components/FilterPills'

// Функция для получения компонента иконки
const getIconComponent = (iconName: string) => {
  const icons: Record<string, any> = {
    heart: Heart,
    music: Music,
    play: Play,
    star: Star,
    award: Award,
    zap: Zap,
    clock: Clock,
    users: Users,
    crown: Crown,
    message: MessageCircle,
    target: Target,
    diamond: Diamond,
    sparkles: Sparkles,
  }
  return icons[iconName] || Award
}

interface AchievementForm {
  id?: number
  code: string
  title: string
  description: string
  icon: string
  requirement_type: string
  requirement_value: number
  rarity: string
  is_secret: number
  unlock_count?: number
}

const conditionTypes = [
  { type: 'tracks_played', label: 'Треков прослушано' },
  { type: 'total_minutes', label: 'Минут прослушано' },
  { type: 'playlists_created', label: 'Плейлистов создано' },
  { type: 'friends_added', label: 'Друзей добавлено' },
  { type: 'new_artists', label: 'Новых артистов' },
  { type: 'premium', label: 'Premium подписка' },
]

const requirementTypes = [
  { value: 'likes', label: 'Лайков' },
  { value: 'tracks_played', label: 'Треков прослушано' },
  { value: 'playlists_created', label: 'Плейлистов создано' },
  { value: 'friends_added', label: 'Друзей добавлено' },
  { value: 'total_minutes', label: 'Минут прослушано' },
  { value: 'premium', label: 'Premium подписка' },
  { value: 'albums_liked', label: 'Альбомов лайкнуто' },
  { value: 'artists_followed', label: 'Артистов отслеживается' },
  { value: 'tickets_purchased', label: 'Билетов куплено' },
  { value: 'videos_watched', label: 'Видео просмотрено' },
  { value: 'night_owl', label: 'Ночных прослушиваний' },
  { value: 'early_bird', label: 'Утренних прослушиваний' },
]

const iconOptions = [
  { value: 'heart', label: 'Heart' },
  { value: 'music', label: 'Music' },
  { value: 'play', label: 'Play' },
  { value: 'star', label: 'Star' },
  { value: 'award', label: 'Award' },
  { value: 'zap', label: 'Zap' },
  { value: 'clock', label: 'Clock' },
  { value: 'users', label: 'Users' },
  { value: 'crown', label: 'Crown' },
  { value: 'message', label: 'Message' },
  { value: 'target', label: 'Target' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'sparkles', label: 'Sparkles' },
]

const colorOptions = [
  '#ef4444', '#f97316', '#fbbf24', '#22c55e', '#06b6d2d', 
  '#3b82f6', '#a855f7', '#ec4899', '#94a3b8', '#b45309'
]

const rarityOptions = [
  { value: 'common', label: 'Обычное', color: '#94a3b8' },
  { value: 'rare', label: 'Редкое', color: '#3b82f6' },
  { value: 'epic', label: 'Эпическое', color: '#a855f7' },
  { value: 'legendary', label: 'Легендарное', color: '#fbbf24' },
]

export default function AdminAchievementsPage() {
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const [achievements, setAchievements] = useState<AchievementForm[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<AchievementForm>({
    code: '',
    title: '',
    description: '',
    icon: 'award',
    requirement_type: 'tracks_played',
    requirement_value: 1,
    rarity: 'common',
    is_secret: 0,
  })
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [filterRarity, setFilterRarity] = useState<string>('all')
  const [filterSecret, setFilterSecret] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadAchievements()
  }, [])

  async function loadAchievements() {
    try {
      if (!accessToken) return
      const data = await achievementsApi.getAdminAchievements(accessToken)
      setAchievements(data)
    } catch (err) {
      console.error('Failed to load achievements:', err)
      setError('Ошибка загрузки')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (achievement: AchievementForm) => {
    setForm(achievement)
    setEditingId(achievement.id || null)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!accessToken || !confirm('Удалить достижение?')) return
    try {
      await achievementsApi.deleteAchievement(accessToken, id)
      setAchievements(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      console.error('Failed to delete:', err)
      setError('Ошибка удаления')
    }
  }

  const handleSave = async () => {
    if (!accessToken) return
    setError('')
    try {
      // Автоматически делаем легендарные достижения секретными
      const achievementData = {
        ...form,
        is_secret: form.rarity === 'legendary' ? 1 : 0
      }

      if (editingId) {
        await achievementsApi.updateAchievement(accessToken, editingId, achievementData)
      } else {
        await achievementsApi.createAchievement(accessToken, achievementData)
      }
      await loadAchievements()
      setShowForm(false)
      setEditingId(null)
      setForm({
        code: '',
        title: '',
        description: '',
        icon: 'award',
        requirement_type: 'tracks_played',
        requirement_value: 1,
    rarity: 'common',
    is_secret: 0,
      })
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения')
    }
  }

  const updateForm = (field: Partial<AchievementForm>) => {
    setForm(prev => ({ ...prev, ...field }))
  }

  const filteredAchievements = achievements.filter(achievement => {
    // Фильтр по редкости
    if (filterRarity !== 'all' && achievement.rarity !== filterRarity) {
      return false
    }

    // Фильтр по секретности
    if (filterSecret === 'secret' && achievement.is_secret !== 1) {
      return false
    }
    if (filterSecret === 'public' && achievement.is_secret === 1) {
      return false
    }

    // Поиск по названию, описанию или коду
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        achievement.title.toLowerCase().includes(query) ||
        achievement.description.toLowerCase().includes(query) ||
        achievement.code.toLowerCase().includes(query)
      )
    }

    return true
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-xl glass-hover">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Управление достижениями</h1>
            <p className="text-white/40 text-sm">Создавай и редактируй достижения</p>
          </div>
        </div>
        <button
          onClick={() => { 
            setShowForm(true)
            setEditingId(null)
            setForm({
              code: '',
              title: '',
              description: '',
              icon: 'award',
              requirement_type: 'tracks_played',
              requirement_value: 1,
    rarity: 'common',
    is_secret: 0,
            })
          }}
          className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 transition flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Новое достижение
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {!showForm && (
        <>
          {/* Фильтры */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по названию, описанию или коду..."
                className="flex-1 min-w-[200px] px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] focus:border-purple-500/50 outline-none text-sm"
              />

              <FilterPills
                options={[
                  { id: 'all', label: 'Все редкости' },
                  ...rarityOptions.map(r => ({ id: r.value, label: r.label }))
                ]}
                selected={filterRarity}
                onChange={(id) => setFilterRarity(id)}
                multi={false}
              />

              <FilterPills
                options={[
                  { id: 'all', label: 'Все типы' },
                  { id: 'public', label: 'Обычные' },
                  { id: 'secret', label: 'Секретные' },
                ]}
                selected={filterSecret}
                onChange={(id) => setFilterSecret(id)}
                multi={false}
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-white/40">
              <span>Найдено: {filteredAchievements.length} из {achievements.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAchievements.map((achievement, idx) => {
              const rarityColor = rarityOptions.find(r => r.value === achievement.rarity)?.color || '#94a3b8'
              const isLegendary = achievement.rarity === 'legendary'

              return (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-5 rounded-2xl border transition-all duration-300 hover:scale-[1.02] relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${rarityColor}10, ${rarityColor}05)`,
                    borderColor: `${rarityColor}40`,
                    boxShadow: isLegendary ? `0 0 20px ${rarityColor}20` : undefined,
                  }}
                >
                  {/* Animated background for legendary */}
                  {isLegendary && (
                    <motion.div
                      className="absolute inset-0 opacity-10"
                      style={{
                        background: `radial-gradient(circle at 50% 50%, ${rarityColor}40, transparent 70%)`,
                      }}
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.2, 0.1],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  )}

                  <div className="flex items-start justify-between mb-3 relative z-10">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${rarityColor}30, ${rarityColor}15)`,
                        boxShadow: isLegendary ? `0 0 15px ${rarityColor}40` : undefined,
                      }}
                    >
                      {(() => {
                        const IconComponent = getIconComponent(achievement.icon)
                        return <IconComponent className="w-6 h-6" style={{ color: rarityColor }} />
                      })()}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(achievement)}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition"
                      >
                        <span className="text-xs">✎</span>
                      </button>
                      <button
                        onClick={() => handleDelete(achievement.id!)}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                  <h3
                    className="font-bold text-lg mb-1 relative z-10"
                    style={{
                      color: isLegendary ? rarityColor : 'white'
                    }}
                  >
                    {achievement.title}
                  </h3>
                  <p className="text-sm text-white/50 mb-3 relative z-10">{achievement.description}</p>
                  <div className="flex items-center gap-2 text-xs flex-wrap relative z-10">
                    <span
                      className="px-2 py-1 rounded-full font-medium"
                      style={{
                        backgroundColor: `${rarityColor}25`,
                        color: rarityColor,
                        boxShadow: isLegendary ? `0 0 10px ${rarityColor}30` : undefined,
                      }}
                    >
                      {rarityOptions.find(r => r.value === achievement.rarity)?.label || achievement.rarity}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-white/5">
                      × {achievement.requirement_value}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-white/5">
                      {achievement.unlock_count || 0} получено
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </>
      )}

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Форма слева */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingId ? 'Редактировать' : 'Создать'} достижение</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-sm text-white/50 mb-2 block">Код (уникальный)</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => updateForm({ code: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] focus:border-purple-500/50 outline-none"
                placeholder="Например: first_track"
              />
            </div>

            <div>
              <label className="text-sm text-white/50 mb-2 block">Название</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateForm({ title: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] focus:border-purple-500/50 outline-none"
                placeholder="Например: Первый лайк"
              />
            </div>

            <div>
              <label className="text-sm text-white/50 mb-2 block">Описание</label>
              <textarea
                value={form.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] focus:border-purple-500/50 outline-none resize-none h-24"
                placeholder="Опиши условие получения"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-white/50 mb-2 block">Иконка</label>
                <select
                  value={form.icon}
                  onChange={(e) => updateForm({ icon: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] appearance-none cursor-pointer"
                >
                  {iconOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-white/50 mb-2 block">Тип условия</label>
                <select
                  value={form.requirement_type}
                  onChange={(e) => updateForm({ requirement_type: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] appearance-none cursor-pointer"
                >
                  {requirementTypes.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm text-white/50 mb-2 block">Значение (требуемое количество)</label>
              <input
                type="number"
                value={form.requirement_value}
                onChange={(e) => updateForm({ requirement_value: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] outline-none"
                min={1}
              />
            </div>

            <div>
              <label className="text-sm text-white/50 mb-2 block">Редкость</label>
              <select
                value={form.rarity}
                onChange={(e) => updateForm({ rarity: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] appearance-none cursor-pointer"
              >
                {rarityOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {form.rarity === 'legendary' && (
                <p className="text-xs text-yellow-400 mt-2">
                  💡 Легендарные достижения автоматически скрыты до разблокировки
                </p>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={!form.code || !form.title}
              className="w-full py-3 rounded-xl bg-purple-500 hover:bg-purple-600 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {editingId ? 'Сохранить' : 'Создать'}
            </button>
          </div>

          {/* Предпросмотр справа */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white/70">Предпросмотр</h3>

            <motion.div
              key={`${form.title}-${form.rarity}-${form.requirement_value}`}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: `${rarityOptions.find(r => r.value === form.rarity)?.color}20`
                  }}
                >
                  {(() => {
                    const IconComponent = getIconComponent(form.icon)
                    return <IconComponent
                      className="w-6 h-6"
                      style={{ color: rarityOptions.find(r => r.value === form.rarity)?.color }}
                    />
                  })()}
                </div>
              </div>

              <h3 className="text-lg font-bold mb-1">
                {form.title || 'Название достижения'}
              </h3>
              <p className="text-sm text-white/50 mb-3">
                {form.description || 'Описание достижения'}
              </p>

              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span
                  className="px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: `${rarityOptions.find(r => r.value === form.rarity)?.color}20`,
                    color: rarityOptions.find(r => r.value === form.rarity)?.color
                  }}
                >
                  {rarityOptions.find(r => r.value === form.rarity)?.label || form.rarity}
                </span>
                <span className="px-2 py-1 rounded-full bg-white/5">
                  {requirementTypes.find(t => t.value === form.requirement_type)?.label || form.requirement_type}
                </span>
                <span className="px-2 py-1 rounded-full bg-white/5">
                  × {form.requirement_value}
                </span>
              </div>

              {/* Прогресс бар для демонстрации */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-white/50">Прогресс</span>
                  <span className="text-white/70">0 / {form.requirement_value}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: '0%',
                      backgroundColor: rarityOptions.find(r => r.value === form.rarity)?.color
                    }}
                  />
                </div>
              </div>
            </motion.div>

            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-400">
                💡 Так будет выглядеть достижение для пользователей
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}