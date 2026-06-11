import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Award,
  Heart, Music, Play, Star, Zap, Clock,
  Users, Crown, MessageCircle, Target, Diamond, Sparkles
} from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'
import { achievementsApi } from '../api/achievements'

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

const COLORS = {
  gold: '#fbbf24',
  silver: '#94a3b8',
  bronze: '#b45309',
  blue: '#3b82f6',
  purple: '#a855f7',
  red: '#ef4444',
  green: '#22c55e',
  pink: '#ec4899',
}

interface Achievement {
  id: number
  code: string
  title: string
  description: string
  icon: string
  requirement_type: string
  requirement_value: number
  is_secret?: number
  progress?: number
  current?: number
  unlocked?: boolean
  unlocked_at?: string
  rarity?: string
  unlock_percentage?: number
}

function getRarityColor(rarity: string) {
  switch (rarity) {
    case 'common': return COLORS.silver
    case 'rare': return '#3b82f6'
    case 'epic': return COLORS.purple
    case 'legendary': return COLORS.gold
    default: return COLORS.silver
  }
}

function getRarityLabel(rarity: string) {
  switch (rarity) {
    case 'common': return 'Обычное'
    case 'rare': return 'Редкое'
    case 'epic': return 'Эпическое'
    case 'legendary': return 'Легендарное'
    default: return 'Обычное'
  }
}

function determineRarity(achievement: Achievement): string {
  // Используем rarity из базы данных, если оно есть
  if (achievement.rarity) {
    return achievement.rarity
  }

  // Fallback на старую логику, если rarity не указано
  const val = achievement.requirement_value
  if (achievement.code === 'first_track' || achievement.code === 'register') return 'common'
  if (val >= 1000) return 'epic'
  if (val >= 100) return 'rare'
  return 'common'
}

export default function AchievementsPage() {
  const navigate = useNavigate()
  const { user, accessToken } = useAuth()
  const primary = COLORS.purple
  const secondary = COLORS.pink

  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unlocked'>('all')

  useEffect(() => {
    async function loadAchievements() {
      try {
        if (accessToken && user) {
          const data = await achievementsApi.getUserAchievements(accessToken)
          setAchievements(data)
        } else {
          const data = await achievementsApi.getAll()
          setAchievements(data.map((a: any) => ({ ...a, unlocked: false, progress: 0 })))
        }
      } catch (error) {
        console.error('Failed to load achievements:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadAchievements()
  }, [accessToken, user])

  const myAchievements = useMemo(() => achievements.map(a => ({
    ...a,
    unlocked: a.unlocked || false,
  })).filter(a => {
    if (a.is_secret && !a.unlocked) return false;
    return true;
  }), [achievements])

  const unlockedCount = myAchievements.filter(a => a.unlocked).length

  const visibleAchievements = useMemo(() => {
    let filtered = myAchievements
    if (filter === 'unlocked') {
      filtered = filtered.filter(a => a.unlocked)
    }
    return filtered
  }, [myAchievements, filter])

  const rarityStats = useMemo(() => [
    { label: 'Обычные', count: visibleAchievements.filter(a => a.unlocked && determineRarity(a) === 'common').length, color: COLORS.silver },
    { label: 'Редкие', count: visibleAchievements.filter(a => a.unlocked && determineRarity(a) === 'rare').length, color: COLORS.blue },
    { label: 'Эпические', count: visibleAchievements.filter(a => a.unlocked && determineRarity(a) === 'epic').length, color: COLORS.purple },
    { label: 'Легендарные', count: visibleAchievements.filter(a => a.unlocked && determineRarity(a) === 'legendary').length, color: COLORS.gold },
  ], [visibleAchievements, filter])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-xl glass-hover">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Достижения</h1>
          <p className="text-white/40 text-sm">Разблокируй достижения и соревнуйся с друзьями</p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
        <div className="flex items-center gap-3">
          <Award className="w-8 h-8 text-yellow-400" />
          <div>
            <p className="text-xl font-bold">{unlockedCount} / {achievements.length}</p>
            <p className="text-sm text-white/60">достижений разблокировано</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { id: 'all', label: 'Все' },
          { id: 'unlocked', label: 'Разблокированные' },
        ].map((f) => (
          <button 
            key={f.id}
            onClick={() => setFilter(f.id as typeof filter)}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
              filter === f.id 
                ? 'shadow-lg' 
                : 'bg-white/[0.03] text-white/50 hover:text-white hover:bg-white/[0.06]'
            }`}
            style={filter === f.id ? { 
              background: `linear-gradient(135deg, ${primary}, ${secondary})`,
              boxShadow: `0 4px 20px ${primary}40`
            } : undefined}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {rarityStats.map((stat, idx) => (
          <div key={idx} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.color }} />
              <span className="text-xs text-white/40">{stat.label}</span>
            </div>
            <p className="text-xl font-bold">{stat.count}</p>
            <p className="text-xs text-white/30">разблокировано</p>
          </div>
        ))}
      </div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {visibleAchievements.map((achievement, idx) => {
          const rarity = determineRarity(achievement)
          const color = getRarityColor(rarity)
          const progress = achievement.progress || 0
          const unlockedCount = achievement.current || 0

          return (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className={`p-4 rounded-xl border transition-all duration-300 group relative overflow-hidden ${
                achievement.unlocked
                  ? 'bg-white/[0.02] hover:border-opacity-60'
                  : 'bg-black/[0.02] border-white/[0.02] opacity-60'
              }`}
              style={achievement.unlocked ? {
                background: `linear-gradient(135deg, ${color}15, ${color}05)`,
                borderColor: `${color}40`,
                boxShadow: rarity === 'legendary' ? `0 0 20px ${color}30` : undefined,
              } : undefined}
            >
              {/* Animated background for legendary */}
              {achievement.unlocked && rarity === 'legendary' && (
                <motion.div
                  className="absolute inset-0 opacity-20"
                  style={{
                    background: `radial-gradient(circle at 50% 50%, ${color}40, transparent 70%)`,
                  }}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.2, 0.3, 0.2],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              )}

              <div className="flex flex-col items-center text-center relative z-10">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 relative"
                  style={{
                    background: achievement.unlocked
                      ? `linear-gradient(135deg, ${color}30, ${color}15)`
                      : 'rgba(255,255,255,0.05)',
                    boxShadow: achievement.unlocked && rarity === 'legendary'
                      ? `0 0 15px ${color}50`
                      : undefined,
                  }}
                >
                  {achievement.unlocked && rarity === 'legendary' && (
                    <motion.div
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: `linear-gradient(135deg, ${color}40, transparent)`,
                      }}
                      animate={{
                        rotate: [0, 360],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                    />
                  )}
                  {(() => {
                    const IconComponent = getIconComponent(achievement.icon)
                    return <IconComponent
                      className="w-6 h-6 relative z-10"
                      style={{ color: achievement.unlocked ? color : '#ffffff40' }}
                    />
                  })()}
                </div>
                <h3
                  className="font-medium text-sm mb-1"
                  style={{
                    color: achievement.unlocked && rarity === 'legendary' ? color : 'white'
                  }}
                >
                  {achievement.title}
                </h3>
                <p className="text-xs text-white/40 mb-2">{achievement.description}</p>
                {achievement.unlock_percentage !== undefined && achievement.unlock_percentage > 0 && (
                  <span className="text-[10px] text-white/30 mb-2">
                    {achievement.unlock_percentage}% получили
                  </span>
                )}

                <div className="w-full mt-2">
                  <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: achievement.unlocked
                          ? `linear-gradient(90deg, ${color}, ${color}80)`
                          : '#ffffff20',
                        boxShadow: achievement.unlocked && rarity === 'legendary'
                          ? `0 0 8px ${color}`
                          : undefined,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ delay: idx * 0.05 + 0.2, duration: 0.6 }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-white/40">{unlockedCount}/{achievement.requirement_value}</span>
                    <span style={{ color }}>{progress}%</span>
                  </div>
                </div>

                {achievement.unlocked && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium mt-2"
                    style={{
                      background: `${color}20`,
                      color: color,
                      boxShadow: rarity === 'legendary' ? `0 0 10px ${color}40` : undefined,
                    }}
                  >
                    {getRarityLabel(rarity)}
                  </span>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}