import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { User, CreditCard, Play, Shield, Bell, Mic, Info, ChevronRight, Heart, HelpCircle, LogOut, Volume2 } from 'lucide-react'
import { useTheme, defaultPalettes } from '../hooks/ThemeContext'
import { useAuth } from '../hooks/AuthContext'
import { authApi, getStoredTokens } from '../api/auth'
import { usePlayer } from '../hooks/PlayerContext'

type SettingsSection = 'account' | 'subscription' | 'playback' | 'privacy' | 'notifications' | 'artist' | 'about'

interface Settings {
  volume: number
  eqEnabled: boolean
  eqPreset: string
  publicProfile: boolean
  showHistory: boolean
  showLikes: boolean
  showAchievements: boolean
  showFavoriteArtists: boolean
  showFavoriteAlbums: boolean
  showPlaylists: boolean
  showFavoriteTracks: boolean
  showOnlineStatus: boolean
  showListeningStatus: boolean
  notifyLikes: boolean
  notifyFollows: boolean
  notifyFriendRequests: boolean
  concertNotifications: boolean
  showHeaderLogo: boolean
}

function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: () => void; disabled?: any }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-all duration-300 ${
        checked ? 'bg-white' : 'bg-white/5'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/15'}`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 rounded-full shadow-lg transition-all duration-300 ${
          checked ? 'left-[22px] bg-black' : 'left-0.5 bg-white'
        }`}
      />
    </button>
  )
}

function Slider({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const percent = ((value - min) / (max - min)) * 100
  return (
    <div className="relative w-32">
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-white/30 rounded-full transition-all duration-150"
          style={{ width: `${percent}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg pointer-events-none transition-all duration-150"
        style={{ left: `calc(${percent}% - 6px)` }}
      />
    </div>
  )
}

function SettingRow({
  icon: Icon,
  title,
  description,
  action,
  onClick,
}: {
  icon?: React.ElementType
  title: React.ReactNode
  description?: string
  action: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.1] transition-all duration-300 text-left"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {Icon && <Icon className="w-4 h-4 text-white/30 flex-shrink-0" />}
        <div className="min-w-0">
          <div className="text-sm text-white/90">{title}</div>
          {description && <p className="text-xs text-white/30 mt-0.5">{description}</p>}
        </div>
      </div>
      {action}
    </button>
  )
}

function SettingSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3 px-1">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function TooltipIcon({ title, description }: { title: string; description: string }) {
  const [show, setShow] = useState(false)
  
  return (
    <div className="relative inline-flex">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="text-white/30 hover:text-white/60 transition ml-1"
      >
        <HelpCircle size={14} />
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 text-left">
          <div className="font-medium text-sm text-white mb-1">{title}</div>
          <div className="text-xs text-white/60 leading-relaxed">{description}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="w-2 h-2 bg-gray-900/95 border-r border-b border-white/10 rotate-45" />
          </div>
        </div>
      )}
    </div>
  )
}

function ColorPaletteSettings() {
  const { palette, setCustomPalette, resetToAuto, getPalette } = useTheme()
  const { user, refreshUser } = useAuth()
  const [tempPrimary, setTempPrimary] = useState(palette.primary)
  const [tempSecondary, setTempSecondary] = useState(palette.secondary)
  const [tempTertiary, setTempTertiary] = useState(palette.tertiary)
  const [tempAccent, setTempAccent] = useState(user?.palette_accent || palette.primary)
  const [mode, setMode] = useState<'auto' | 'custom'>(palette.mode)
  const [hasChanges, setHasChanges] = useState(false)
  const [autoColors, setAutoColors] = useState<string[]>([palette.primary, palette.secondary, palette.tertiary])

  // Extract colors from avatar for auto mode preview
  useEffect(() => {
    if (mode === 'auto' && user?.avatar_url) {
      import('../utils/colorExtractor').then(({ extractColorsFromImage }) => {
        const avatarUrl = `${user.avatar_url}`
        extractColorsFromImage(avatarUrl).then(colors => {
          setAutoColors(colors)
        }).catch(() => {
          setAutoColors(getPalette(user.username))
        })
      })
    } else if (mode === 'auto') {
      setAutoColors(getPalette(user?.username || 'User'))
    }
  }, [mode, user?.avatar_url, user?.username])

  const currentPreview = mode === 'auto' ? autoColors : [tempPrimary, tempSecondary, tempTertiary]
  const [previewPrimary, previewSecondary, previewTertiary] = currentPreview
  const previewAccent = mode === 'auto' ? '#FFFFFF' : tempAccent

  const handleModeChange = (newMode: 'auto' | 'custom') => {
    setMode(newMode)
    setHasChanges(true)
  }

  const applyPalette = (colors: string[]) => {
    setTempPrimary(colors[0])
    setTempSecondary(colors[1])
    setTempTertiary(colors[2])
    setTempAccent(colors[0])
    setMode('custom')
    setHasChanges(true)
  }

  const handleSave = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return

    try {
      if (mode === 'auto') {
        await fetch('/api/user/me', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`
          },
          body: JSON.stringify({
            palette_mode: 'auto',
            palette_primary: null,
            palette_secondary: null,
            palette_tertiary: null,
            palette_accent: null
          })
        })
        resetToAuto()
      } else {
        await fetch('/api/user/me', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`
          },
          body: JSON.stringify({
            palette_mode: 'custom',
            palette_primary: tempPrimary,
            palette_secondary: tempSecondary,
            palette_tertiary: tempTertiary,
            palette_accent: tempAccent
          })
        })
        setCustomPalette(tempPrimary, tempSecondary, tempTertiary)
      }
      setHasChanges(false)
      await refreshUser()
      window.location.reload()
    } catch (err) {
      console.error('Failed to save palette:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex items-center gap-3 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08]">
        <button
          onClick={() => handleModeChange('auto')}
          className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all duration-500 ${
            mode === 'auto'
              ? 'bg-white/[0.08] text-white shadow-lg shadow-white/5'
              : 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'
          }`}
        >
          Автоматически
        </button>
        <button
          onClick={() => handleModeChange('custom')}
          className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all duration-500 ${
            mode === 'custom'
              ? 'bg-white/[0.08] text-white shadow-lg shadow-white/5'
              : 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'
          }`}
        >
          Настроить
        </button>
      </div>

      {/* Preview */}
      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] transition-all duration-500">
        <p className="text-xs text-white/40 mb-4 uppercase tracking-wider">Предпросмотр профиля</p>
        <div
          className="h-32 rounded-xl relative overflow-hidden transition-all duration-700"
          style={{
            background: `linear-gradient(135deg, ${previewPrimary}40, ${previewSecondary}40, ${previewTertiary}40)`,
          }}
        >
          <div
            className="absolute inset-0 opacity-30 transition-all duration-700"
            style={{
              background: `radial-gradient(circle at 20% 80%, ${previewPrimary}60 0%, transparent 50%),
                          radial-gradient(circle at 80% 20%, ${previewSecondary}60 0%, transparent 50%),
                          radial-gradient(circle at 40% 40%, ${previewTertiary}40 0%, transparent 40%)`,
            }}
          />
          <div className="absolute -bottom-5 left-5 w-14 h-14 rounded-full border-[3px] border-[#0a0a0a] overflow-hidden shadow-xl transition-all duration-500">
            {user?.avatar_url ? (
              <img
                src={`${user.avatar_url}`}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-xl font-bold text-white transition-all duration-700"
                style={{
                  background: `linear-gradient(135deg, ${previewPrimary}, ${previewSecondary})`,
                }}
              >
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <div
            className="absolute top-4 right-4 w-9 h-9 rounded-lg flex items-center justify-center backdrop-blur-sm transition-all duration-500"
            style={{ backgroundColor: `${previewAccent}20`, border: `1px solid ${previewAccent}30` }}
          >
            <User className="w-4 h-4 transition-all duration-500" style={{ color: previewAccent }} />
          </div>
        </div>
      </div>

      {mode === 'custom' && (
        <div className="space-y-5 animate-in fade-in slide-in-from-top-4 duration-500">
          {/* Preset Palettes */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <p className="text-xs text-white/40 mb-3 uppercase tracking-wider">Готовые темы</p>
            <div className="grid grid-cols-4 gap-2">
              {defaultPalettes.map((colors, idx) => (
                <button
                  key={idx}
                  onClick={() => applyPalette(colors)}
                  className="h-10 rounded-lg overflow-hidden border border-white/[0.08] hover:border-white/20 hover:scale-105 transition-all duration-200 shadow-sm hover:shadow-md"
                  style={{
                    background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Custom Colors */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
            <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Свои цвета</p>

            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-white/60">Основной</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={tempPrimary}
                  onChange={(e) => {
                    setTempPrimary(e.target.value)
                    setHasChanges(true)
                  }}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-white/10 hover:border-white/20 transition-all duration-200"
                />
                <span className="text-[10px] text-white/20 font-mono w-16 text-right">{tempPrimary}</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-white/60">Второстепенный</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={tempSecondary}
                  onChange={(e) => {
                    setTempSecondary(e.target.value)
                    setHasChanges(true)
                  }}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-white/10 hover:border-white/20 transition-all duration-200"
                />
                <span className="text-[10px] text-white/20 font-mono w-16 text-right">{tempSecondary}</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-white/60">Акцент</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={tempTertiary}
                  onChange={(e) => {
                    setTempTertiary(e.target.value)
                    setHasChanges(true)
                  }}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-white/10 hover:border-white/20 transition-all duration-200"
                />
                <span className="text-[10px] text-white/20 font-mono w-16 text-right">{tempTertiary}</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-white/60">Иконки</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={tempAccent}
                  onChange={(e) => {
                    setTempAccent(e.target.value)
                    setHasChanges(true)
                  }}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-white/10 hover:border-white/20 transition-all duration-200"
                />
                <span className="text-[10px] text-white/20 font-mono w-16 text-right">{tempAccent}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasChanges && (
        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl text-sm font-medium bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.08] hover:border-white/[0.15] transition-all duration-200 hover:scale-[1.01] animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          Сохранить изменения
        </button>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const player = usePlayer()
  const [searchParams] = useSearchParams()
  const sectionParam = searchParams.get('section') as SettingsSection | null
  const [section, setSection] = useState<SettingsSection>(sectionParam || 'playback')
  const [subscription, setSubscription] = useState<any>(null)
  const [loadingSubscription, setLoadingSubscription] = useState(true)

  useEffect(() => {
    if (sectionParam && ['account', 'subscription', 'playback', 'privacy', 'notifications', 'artist', 'about'].includes(sectionParam)) {
      setSection(sectionParam as SettingsSection)
    }
  }, [sectionParam])

  // Load subscription data
  useEffect(() => {
    const loadSubscription = async () => {
      const token = localStorage.getItem('token')
      if (token) {
        try {
          const res = await fetch('/api/transactions/subscription', {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (res.ok) {
            const data = await res.json()
            setSubscription(data)
          }
        } catch (err) {
          console.error('Failed to load subscription:', err)
        } finally {
          setLoadingSubscription(false)
        }
      } else {
        setLoadingSubscription(false)
      }
    }
    loadSubscription()
  }, [])

  // Load settings from localStorage
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('userSettings')
    if (saved) {
      try {
        return { ...{
          volume: 80,
          eqEnabled: false,
          eqPreset: 'По умолчанию',
          publicProfile: true,
          showHistory: true,
          showLikes: true,
          showAchievements: true,
          showFavoriteArtists: true,
          showFavoriteAlbums: true,
          showPlaylists: true,
          showFavoriteTracks: true,
          showOnlineStatus: true,
          showListeningStatus: true,
          notifyLikes: true,
          notifyFollows: true,
          notifyFriendRequests: true,
          concertNotifications: true,
          showHeaderLogo: true,
        }, ...JSON.parse(saved) }
      } catch {
        // Ignore parse errors
      }
    }
    return {
      volume: 80,
      eqEnabled: false,
      eqPreset: 'По умолчанию',
      publicProfile: true,
      showHistory: true,
      showLikes: true,
      showAchievements: true,
      showFavoriteArtists: true,
      showFavoriteAlbums: true,
      showPlaylists: true,
      showFavoriteTracks: true,
      showOnlineStatus: true,
      showListeningStatus: true,
      notifyLikes: true,
      notifyFollows: true,
      notifyFriendRequests: true,
      concertNotifications: true,
      showHeaderLogo: true,
    }
  })
  const [artistApplication, setArtistApplication] = useState<any>(null)
  const [artistApplicationMessage, setArtistApplicationMessage] = useState('')
  const [artistApplicationLinks, setArtistApplicationLinks] = useState('')
  const [artistApplicationLoading, setArtistApplicationLoading] = useState(false)
  const [showArtistDeleteModal, setShowArtistDeleteModal] = useState(false)
  const [artistDeleteReason, setArtistDeleteReason] = useState('')
  const [artistDeletePassword, setArtistDeletePassword] = useState('')
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [supportIssueAreas, setSupportIssueAreas] = useState<string[]>([])
  const [supportDescription, setSupportDescription] = useState('')
  const [supportFiles, setSupportFiles] = useState<File[]>([])
  const [supportSubmitting, setSupportSubmitting] = useState(false)

  const supportAreas = [
    'Проблема с аккаунтом',
    'Подписка и платежи',
    'Музыка и воспроизведение',
    'Концерты и билеты',
    'Профиль артиста',
    'Другое',
  ]

  const supportFilePreviews = useMemo(
    () => supportFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [supportFiles],
  )

  useEffect(() => {
    setSettings((prev) => {
      const synced = {
        ...prev,
        volume: player.volume,
        eqPreset: player.eqPreset,
      }
      localStorage.setItem('userSettings', JSON.stringify(synced))
      return synced
    })
  }, [player.volume, player.eqPreset])

  useEffect(() => {
    return () => {
      supportFilePreviews.forEach((item) => URL.revokeObjectURL(item.url))
    }
  }, [supportFilePreviews])

  // Load privacy settings from backend on mount
  useEffect(() => {
    const loadPrivacySettings = async () => {
      const tokens = localStorage.getItem('accessToken')
      if (tokens) {
        try {
          const res = await fetch('/api/user/me', {
            headers: { Authorization: `Bearer ${tokens}` }
          })
          if (res.ok) {
            const userData = await res.json()
            setSettings(prev => {
              const updated = {
                ...prev,
                publicProfile: userData.is_profile_public ?? true,
                showHistory: userData.show_history ?? true,
                showLikes: userData.show_likes ?? true,
                showAchievements: userData.show_achievements ?? true,
                showFavoriteArtists: userData.show_favorite_artists ?? true,
                showFavoriteAlbums: userData.show_favorite_albums ?? true,
                showPlaylists: userData.show_playlists ?? true,
                showFavoriteTracks: userData.show_favorite_tracks ?? true,
                showOnlineStatus: userData.show_online_status ?? true,
                showListeningStatus: userData.show_listening_status ?? true,
                notifyLikes: userData.notify_likes ?? true,
                notifyFollows: userData.notify_follows ?? true,
                notifyFriendRequests: userData.notify_friend_requests ?? true,
                concertNotifications: userData.notify_concerts ?? true,
              }
              localStorage.setItem('userSettings', JSON.stringify(updated))
              return updated
            })
          }
        } catch (err) {
          console.error('Failed to load privacy settings:', err)
        }
      }
    }
    loadPrivacySettings()
  }, [])

  useEffect(() => {
    const loadArtistApplication = async () => {
      const tokens = getStoredTokens()
      if (!tokens || user?.role === 'artist') return

      try {
        const data = await authApi.getArtistApplication(tokens.accessToken)
        setArtistApplication(data)
        setArtistApplicationMessage(data?.message || '')
        setArtistApplicationLinks(data?.links || '')
      } catch {
        setArtistApplication(null)
      }
    }

    loadArtistApplication()
  }, [user?.role])

  const submitArtistApplication = async (type: 'create' | 'delete') => {
    const tokens = getStoredTokens()
    if (!tokens) return

    setArtistApplicationLoading(true)
    try {
      const data = await authApi.submitArtistApplication(tokens.accessToken, {
        type,
        message: artistApplicationMessage,
        links: artistApplicationLinks,
        reason: type === 'delete' ? artistDeleteReason : undefined,
        password: type === 'delete' ? artistDeletePassword : undefined,
      })
      setArtistApplication(data)
      if (type === 'delete') {
        setShowArtistDeleteModal(false)
        setArtistDeleteReason('')
        setArtistDeletePassword('')
      }
    } catch (err) {
      console.error('Failed to submit artist application:', err)
    } finally {
      setArtistApplicationLoading(false)
    }
  }

  const submitSupportTicket = async () => {
    const tokens = getStoredTokens()
    if (!tokens || supportIssueAreas.length === 0 || !supportDescription.trim()) return

    const formData = new FormData()
    formData.append('issue_area', supportIssueAreas.join('||'))
    formData.append('description', supportDescription.trim())
    supportFiles.forEach((file) => formData.append('screenshots', file))

    setSupportSubmitting(true)
    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: formData,
      })

      const text = await response.text()
      if (!response.ok) {
        throw new Error(text || 'Не удалось отправить обращение')
      }

      setShowSupportModal(false)
      setSupportIssueAreas([])
      setSupportDescription('')
      setSupportFiles([])
    } catch (err) {
      console.error('Failed to submit support ticket:', err)
    } finally {
      setSupportSubmitting(false)
    }
  }

  const toggleSupportArea = (area: string) => {
    setSupportIssueAreas((prev) => {
      const hasOther = prev.includes('Другое')
      if (area === 'Другое') {
        return prev.includes('Другое') ? [] : ['Другое']
      }
      if (hasOther) return prev
      return prev.includes(area) ? prev.filter((item) => item !== area) : [...prev, area]
    })
  }

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value }
      localStorage.setItem('userSettings', JSON.stringify(updated))
      window.dispatchEvent(new CustomEvent('user-settings-updated', { detail: updated }))
      return updated
    })

    // Send privacy and notification settings to backend
    if (key === 'volume') {
      player.setVolume(Number(value))
    }

    if (key === 'eqPreset') {
      player.setEqPreset(String(value))
    }

    if (key === 'eqEnabled') {
      const enabled = Boolean(value)
      player.setEqPreset(enabled ? settings.eqPreset : 'По умолчанию')
    }

    const backendKeys = ['publicProfile', 'showHistory', 'showLikes', 'showAchievements', 'showFavoriteArtists', 'showFavoriteAlbums', 'showPlaylists', 'showFavoriteTracks', 'showOnlineStatus', 'showListeningStatus', 'notifyLikes', 'notifyFollows', 'notifyFriendRequests', 'concertNotifications']
    if (backendKeys.includes(key)) {
      const tokens = localStorage.getItem('accessToken')
      if (tokens) {
        const body: Record<string, boolean> = {}
        const v = Boolean(value)
        if (key === 'publicProfile') body.is_profile_public = v
        if (key === 'showHistory') body.show_history = v
        if (key === 'showLikes') body.show_likes = v
        if (key === 'showAchievements') body.show_achievements = v
        if (key === 'showFavoriteArtists') body.show_favorite_artists = v
        if (key === 'showFavoriteAlbums') body.show_favorite_albums = v
        if (key === 'showPlaylists') body.show_playlists = v
        if (key === 'showFavoriteTracks') body.show_favorite_tracks = v
        if (key === 'showOnlineStatus') body.show_online_status = v
        if (key === 'showListeningStatus') body.show_listening_status = v
        if (key === 'notifyLikes') body.notify_likes = v
        if (key === 'notifyFollows') body.notify_follows = v
        if (key === 'notifyFriendRequests') body.notify_friend_requests = v
        if (key === 'concertNotifications') body.notify_concerts = v

        fetch('/api/user/me', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens}`
          },
          body: JSON.stringify(body)
        }).then(res => {
          if (res.ok) {
            console.log('Setting saved:', key, value)
          }
        }).catch(err => console.error('Failed to save setting:', err))
      }
    }
  }

  const sections = [
    { id: 'account' as const, icon: User, label: 'Аккаунт' },
    { id: 'subscription' as const, icon: CreditCard, label: 'Подписка' },
    { id: 'playback' as const, icon: Play, label: 'Воспроизведение' },
    { id: 'privacy' as const, icon: Shield, label: 'Конфиденциальность' },
    { id: 'notifications' as const, icon: Bell, label: 'Уведомления' },
    { id: 'artist' as const, icon: Mic, label: 'Артист' },
    { id: 'about' as const, icon: Info, label: 'О приложении' },
  ]

  const renderSection = () => {
    switch (section) {
      case 'account':
        return (
          <div>
            <SettingSection title="Профиль">
              <Link to="/profile/edit">
                <SettingRow title="Редактировать профиль" description={user?.is_premium ? 'Имя, аватар, биография' : 'На Free доступна только смена имени'} action={<ChevronRight className="w-5 h-5 text-white/30" />} />
              </Link>
              <Link to="/stats">
                <SettingRow title="Моя статистика" description="Ваша активность и достижения" action={<ChevronRight className="w-5 h-5 text-white/30" />} />
              </Link>
            </SettingSection>

            <SettingSection title="Оформление профиля">
              {user?.is_premium ? (
                <ColorPaletteSettings />
              ) : (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-sm text-white/85 mb-1">Палитра профиля доступна в Plus и Fan</p>
                  <p className="text-xs text-white/40 mb-3">На бесплатном тарифе профиль можно менять только по имени пользователя.</p>
                  <Link to="/premium" className="inline-flex px-3 py-2 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-sm transition">
                    Открыть тарифы
                  </Link>
                </div>
              )}
            </SettingSection>

            <SettingSection title="Интерфейс">
              <SettingRow
                title="Показывать логотип MiYu"
                description="Логотип с надписью в левом верхнем углу"
                action={<Toggle checked={settings.showHeaderLogo} onChange={() => updateSetting('showHeaderLogo', !settings.showHeaderLogo)} />}
              />
            </SettingSection>

            <SettingSection title="Опасная зона">
              <button
                onClick={async () => {
                  await logout()
                  navigate('/login')
                }}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/[0.02] hover:bg-red-500/10 border border-white/[0.05] hover:border-red-500/20 transition duration-200 text-left group"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="w-5 h-5 text-red-400" />
                  <div>
                    <p className="font-medium text-red-400">Выйти из аккаунта</p>
                    <p className="text-sm text-white/40">user@{user?.username}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-red-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </SettingSection>
          </div>
        )

      case 'subscription':
        return (
          <div>
            <SettingSection title="Текущий план">
              {loadingSubscription ? (
                <div className="p-5 rounded-xl glass border border-white/10 text-center text-white/40">
                  Загрузка...
                </div>
              ) : (
                <div className="p-5 rounded-xl glass border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xl font-bold">{subscription?.name || 'Free'}</p>
                    <span className="px-3 py-1 glass-accent text-xs rounded-full">
                      {subscription?.status === 'active' ? 'Активна' : 'Неактивна'}
                    </span>
                  </div>
                    <p className="text-sm text-white/50 mb-3">
                      {subscription?.features?.join(', ') || 'С рекламой, 96 kbps, ограниченные пропуски, только смена имени'}
                    </p>
                  <p className="text-2xl font-bold">
                    {subscription?.price || 0} ₽
                    {subscription?.price > 0 && <span className="text-sm font-normal text-white/40">/мес</span>}
                  </p>
                  {subscription?.expires_at && (
                    <p className="text-xs text-white/40 mt-2">
                      Действует до: {new Date(subscription.expires_at).toLocaleDateString('ru-RU')}
                    </p>
                  )}
                </div>
              )}
            </SettingSection>

            <SettingSection title="Управление">
              <Link to="/billing" className="block">
                <SettingRow title="История платежей" action={<ChevronRight className="w-5 h-5 text-white/30" />} />
              </Link>
              <Link to="/premium" className="block mt-2">
                <SettingRow title="Сменить тариф" action={<ChevronRight className="w-5 h-5 text-white/30" />} />
              </Link>
            </SettingSection>
          </div>
        )

      case 'playback':
        return (
          <div>
            <SettingSection title="Звук">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <div className="mb-3 flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-white/40" />
                  <p className="font-medium">Громкость плеера</p>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Slider value={settings.volume} min={0} max={100} onChange={(v) => updateSetting('volume', v)} />
                  <span className="w-10 text-right text-sm text-white/50">{settings.volume}%</span>
                </div>
              </div>
            </SettingSection>

            <SettingSection title="Эквалайзер">
              <SettingRow
                title={
                  <span className="flex items-center">
                    Эквалайзер
                    <TooltipIcon 
                      title="Эквалайзер" 
                      description="Настраивает частоты звука: басы, вокал, инструменты. Пример: 'Басы' - усилит низкие частоты для EDM и хип-хопа." 
                    />
                  </span>
                }
                description="Включить по умолчанию"
                action={<Toggle checked={settings.eqEnabled} onChange={() => updateSetting('eqEnabled', !settings.eqEnabled)} />}
              />
              {settings.eqEnabled && (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="relative">
                    <select
                      value={settings.eqPreset}
                      onChange={(e) => updateSetting('eqPreset', e.target.value)}
                      className="w-full bg-white/[0.03] text-white rounded-xl p-4 pr-12 appearance-none cursor-pointer border border-white/[0.08] hover:border-white/15 transition duration-200"
                    >
                      {['По умолчанию', 'Басы', 'Вокал', 'Электроника', 'Рок', 'Классика', 'Поп', 'Хип-хоп'].map((p) => (
                        <option key={p} value={p} className="bg-black text-white">{p}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </SettingSection>

            <SettingSection title="Премиум-возможности">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <p className="font-medium mb-1">Plus и Fan</p>
                <p className="text-sm text-white/40 mb-3">Отключите рекламу, откройте полную статистику и получите доступ к fan-привилегиям без офлайн-режима и скачивания.</p>
                <Link to="/premium" className="inline-flex px-3 py-2 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-sm transition">
                  Посмотреть тарифы
                </Link>
              </div>
            </SettingSection>
          </div>
        )

      case 'privacy':
        return (
          <div>
            <SettingSection title="Профиль">
              <SettingRow
                title={
                  <span className="flex items-center">
                    Публичный профиль
                    <TooltipIcon 
                      title="Публичный профиль" 
                      description="Когда включено, любой пользователь может найти вас в поиске и увидеть ваш профиль. Пример: выкл - только по ссылке." 
                    />
                  </span>
                }
                description="Виден всем пользователям"
                action={<Toggle checked={settings.publicProfile} onChange={() => updateSetting('publicProfile', !settings.publicProfile)} />}
              />
              <SettingRow
                title={
                  <span className="flex items-center">
                    Показывать историю
                    <TooltipIcon 
                      title="Показывать историю" 
                      description="Другие пользователи смогут видеть, что вы слушали. Можно скрыть в разделе 'Недавно прослушано'." 
                    />
                  </span>
                }
                description="История прослушивания"
        action={<Toggle checked={settings.showHistory} onChange={() => updateSetting('showHistory', !settings.showHistory)} disabled={!settings.publicProfile} />}
              />
              <SettingRow
                title={
                  <span className="flex items-center">
                    Показывать достижения
                    <TooltipIcon 
                      title="Показывать достижения" 
                      description="Показывает ваши достижения в профиле. Пример: выкл - скрыто от глаз." 
                    />
                  </span>
                }
                description="Достижения и значки"
                action={<Toggle checked={settings.showAchievements} onChange={() => updateSetting('showAchievements', !settings.showAchievements)} disabled={!settings.publicProfile} />}
              />
              <SettingRow
                title={
                  <span className="flex items-center">
                    Показывать любимых артистов
                    <TooltipIcon 
                      title="Показывать любимых артистов" 
                      description="Показывает список артистов, на которых вы подписаны. При выкл - скрыто от глаз." 
                    />
                  </span>
                }
                description="Ваши подписки на артистов"
                action={<Toggle checked={settings.showFavoriteArtists} onChange={() => updateSetting('showFavoriteArtists', !settings.showFavoriteArtists)} disabled={!settings.publicProfile} />}
              />
              <SettingRow
                title={
                  <span className="flex items-center">
                    Показывать любимые альбомы
                    <TooltipIcon 
                      title="Показывать любимые альбомы" 
                      description="Показывает альбомы, которые вы лайкнули. При выкл - скрыто от глаз." 
                    />
                  </span>
                }
                description="Ваша коллекция альбомов"
                action={<Toggle checked={settings.showFavoriteAlbums} onChange={() => updateSetting('showFavoriteAlbums', !settings.showFavoriteAlbums)} disabled={!settings.publicProfile} />}
              />
              <SettingRow
                title={
                  <span className="flex items-center">
                    Показывать плейлисты
                    <TooltipIcon 
                      title="Показывать плейлисты" 
                      description="Показывает ваши плейлисты в публичном профиле. При выкл - скрыто от глаз." 
                    />
                  </span>
                }
                description="Ваши плейлисты"
                action={<Toggle checked={settings.showPlaylists} onChange={() => updateSetting('showPlaylists', !settings.showPlaylists)} disabled={!settings.publicProfile} />}
              />
              <SettingRow
                title={
                  <span className="flex items-center">
                    Показывать любимые треки
                    <TooltipIcon 
                      title="Показывать любимые треки" 
                      description="Показывает раздел 'Избранное' с вашими лайкнутыми треками. При выкл - раздел скрыт." 
                    />
                  </span>
                }
                description="Раздел 'Избранное'"
                action={<Toggle checked={settings.showFavoriteTracks} onChange={() => updateSetting('showFavoriteTracks', !settings.showFavoriteTracks)} disabled={!settings.publicProfile} />}
              />
            </SettingSection>

            <SettingSection title="Онлайн статус">
              <SettingRow
                title={
                  <span className="flex items-center">
                    Показывать, что слушаю
                    <TooltipIcon
                      title="Показывать, что слушаю"
                      description="Другие пользователи смогут видеть трек, который вы слушаете прямо сейчас."
                    />
                  </span>
                }
                description="Видимость текущего прослушивания"
                action={<Toggle checked={settings.showListeningStatus} onChange={() => updateSetting('showListeningStatus', !settings.showListeningStatus)} disabled={!settings.publicProfile} />}
              />
              <SettingRow
                title={
                  <span className="flex items-center">
                    Показывать онлайн
                    <TooltipIcon 
                      title="Показывать онлайн" 
                      description="Другие пользователи видят, что вы в сети. При выкл - статус скрыт." 
                    />
                  </span>
                }
                description="Видимость статуса онлайн"
                action={<Toggle checked={settings.showOnlineStatus} onChange={() => updateSetting('showOnlineStatus', !settings.showOnlineStatus)} disabled={!settings.publicProfile} />}
              />
            </SettingSection>
          </div>
        )

      case 'notifications':
        return (
          <div>
            <SettingSection title="Типы уведомлений">
              <SettingRow
                icon={Heart}
                title="Лайки"
                description="Когда кто-то лайкает ваши треки"
                action={<Toggle checked={settings.notifyLikes} onChange={() => updateSetting('notifyLikes', !settings.notifyLikes)} />}
              />
              <SettingRow
                icon={User}
                title="Подписки"
                description="Новые подписчики"
                action={<Toggle checked={settings.notifyFollows} onChange={() => updateSetting('notifyFollows', !settings.notifyFollows)} />}
              />
              <SettingRow
                icon={User}
                title="Запросы в друзья"
                description="Новые запросы в друзья"
                action={<Toggle checked={settings.notifyFriendRequests} onChange={() => updateSetting('notifyFriendRequests', !settings.notifyFriendRequests)} />}
              />
              <SettingRow
                icon={Mic}
                title="Концерты"
                description="Когда любимые артисты объявляют концерты"
                action={<Toggle checked={settings.concertNotifications} onChange={() => updateSetting('concertNotifications', !settings.concertNotifications)} />}
              />
            </SettingSection>
          </div>
        )

      case 'artist':
        return (
          <div>
            <SettingSection title="Стать артистом">
              {user?.role === 'artist' ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-300 text-sm">
                    Ваша страница артиста активна.
                  </div>
                  <button
                    onClick={() => setShowArtistDeleteModal(true)}
                    className="px-4 py-3 rounded-xl text-sm font-medium bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/20 transition"
                  >
                    Удалить страницу артиста
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <h3 className="font-medium mb-2">Заявка на страницу исполнителя</h3>
                    <p className="text-sm text-white/40 mb-4">Расскажите о себе и оставьте ссылки на соцсети, портфолио или музыку. После этого администратор сможет одобрить заявку.</p>

                    <div className="space-y-3">
                      <textarea
                        value={artistApplicationMessage}
                        onChange={(e) => setArtistApplicationMessage(e.target.value)}
                        rows={4}
                        placeholder="Кратко расскажите о себе как об артисте"
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] focus:border-white/15 outline-none transition resize-none"
                      />
                      <input
                        value={artistApplicationLinks}
                        onChange={(e) => setArtistApplicationLinks(e.target.value)}
                        placeholder="Ссылки на соцсети, стриминги или портфолио"
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] focus:border-white/15 outline-none transition"
                      />
                      <button
                        onClick={() => submitArtistApplication('create')}
                        disabled={artistApplicationLoading || artistApplication?.status === 'pending'}
                        className={`px-4 py-3 rounded-xl text-sm font-medium transition ${
                          artistApplicationLoading || artistApplication?.status === 'pending'
                            ? 'bg-white/10 text-white/40 cursor-not-allowed'
                            : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30'
                        }`}
                      >
                        {artistApplication?.status === 'pending'
                          ? 'Заявка отправлена'
                          : artistApplicationLoading
                            ? 'Отправка...'
                            : 'Отправить заявку'}
                      </button>
                    </div>
                  </div>

                  {artistApplication && (
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] text-sm">
                      <p className="text-white/40 mb-2">Текущий статус</p>
                      <p className={`font-medium ${
                        artistApplication.status === 'approved'
                          ? 'text-green-400'
                          : artistApplication.status === 'rejected'
                            ? 'text-red-400'
                            : 'text-yellow-400'
                      }`}>
                        {artistApplication.status === 'approved'
                          ? 'Одобрено'
                          : artistApplication.status === 'rejected'
                            ? 'Отклонено'
                            : 'На рассмотрении'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </SettingSection>

            {showArtistDeleteModal && (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-2xl bg-[#0a0a0a] border border-white/10 p-6 space-y-4">
                  <h2 className="text-xl font-bold">Удалить страницу артиста</h2>
                  <p className="text-sm text-white/50">Для отправки заявки на удаление подтвердите действие паролем и укажите причину.</p>
                  <textarea
                    value={artistDeleteReason}
                    onChange={(e) => setArtistDeleteReason(e.target.value)}
                    rows={4}
                    placeholder="Причина удаления страницы артиста"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] focus:border-white/15 outline-none transition resize-none"
                  />
                  <input
                    type="password"
                    value={artistDeletePassword}
                    onChange={(e) => setArtistDeletePassword(e.target.value)}
                    placeholder="Пароль от аккаунта"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] focus:border-white/15 outline-none transition"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowArtistDeleteModal(false)} className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">Отмена</button>
                    <button
                      onClick={() => submitArtistApplication('delete')}
                      disabled={artistApplicationLoading || !artistDeleteReason.trim() || !artistDeletePassword}
                      className="px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-300 disabled:opacity-50"
                    >
                      {artistApplicationLoading ? 'Отправка...' : 'Отправить заявку'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
          
      case 'about':
        return (
          <div>
            <SettingSection title="Miyu">
              <div className="p-6 rounded-xl glass border border-white/10 text-center">
                <h2 className="text-3xl font-bold mb-2">Miyu</h2>
                <p className="text-white/50">Версия 1.0.0</p>
              </div>
            </SettingSection>

            <SettingSection title="Информация">
              <SettingRow
                title="Поддержка"
                description="Сообщить о проблеме и отправить скриншоты"
                onClick={() => setShowSupportModal(true)}
                action={<ChevronRight className="w-5 h-5 text-white/30" />}
              />
            </SettingSection>
          </div>
        )
    }
  }
          
  return (
    <div className="flex w-full gap-12 max-[414px]:gap-3">
      <div className="w-56 flex-shrink-0 max-[414px]:w-14">
        <h2 className="mb-6 text-xl font-bold max-[414px]:hidden">Настройки</h2>
        <nav className="space-y-1">
          <div className="space-y-1">
            {sections.slice(0, 2).map((s) => {
              const Icon = s.icon
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={`w-full rounded-xl px-4 py-3 text-left transition-all duration-300 max-[414px]:flex max-[414px]:h-11 max-[414px]:items-center max-[414px]:justify-center max-[414px]:px-0 max-[414px]:py-0 ${
                    section === s.id 
                      ? 'glass-accent text-white' 
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 max-[414px]:gap-0">
                    <Icon className="w-5 h-5" />
                    <span className="font-medium max-[414px]:hidden">{s.label}</span>
                  </div>
                </button>
              )
            })}
          </div>
          
          <div className="mt-4 space-y-1 border-t border-white/5 pt-4">
            {sections.slice(2, 5).map((s) => {
              const Icon = s.icon
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={`w-full rounded-xl px-4 py-3 text-left transition-all duration-300 max-[414px]:flex max-[414px]:h-11 max-[414px]:items-center max-[414px]:justify-center max-[414px]:px-0 max-[414px]:py-0 ${
                    section === s.id 
                      ? 'glass-accent text-white' 
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 max-[414px]:gap-0">
                    <Icon className="w-5 h-5" />
                    <span className="font-medium max-[414px]:hidden">{s.label}</span>
                  </div>
                </button>
              )
            })}
          </div>
          
          <div className="mt-4 space-y-1 border-t border-white/5 pt-4">
            {sections.slice(5).map((s) => {
              const Icon = s.icon
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={`w-full rounded-xl px-4 py-3 text-left transition-all duration-300 max-[414px]:flex max-[414px]:h-11 max-[414px]:items-center max-[414px]:justify-center max-[414px]:px-0 max-[414px]:py-0 ${
                    section === s.id 
                      ? 'glass-accent text-white' 
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 max-[414px]:gap-0">
                    <Icon className="w-5 h-5" />
                    <span className="font-medium max-[414px]:hidden">{s.label}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </nav>
      </div>

      <div className="min-w-0 flex-1">
        {renderSection()}
      </div>

      {showSupportModal && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowSupportModal(false)}
        >
          <div
            className="w-full max-w-2xl my-auto rounded-2xl bg-[#0a0a0a] border border-white/10 p-6 space-y-5 max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Обращение в поддержку</h2>
                <p className="text-sm text-white/40">Выберите область проблемы, опишите ситуацию и при необходимости приложите скриншоты.</p>
              </div>
              <button onClick={() => setShowSupportModal(false)} className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">Закрыть</button>
            </div>

            <div>
              <p className="text-sm font-medium mb-3">Область проблемы</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {supportAreas.map((area) => {
                  const isChecked = supportIssueAreas.includes(area)
                  const isDisabled = area !== 'Другое' && supportIssueAreas.includes('Другое')

                  return (
                  <label key={area} className={`p-3 rounded-xl border cursor-pointer transition ${isChecked ? 'bg-purple-500/10 border-purple-500/30 text-purple-200' : 'bg-white/[0.02] border-white/[0.05] text-white/70 hover:border-white/10'} ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={isChecked} disabled={isDisabled} onChange={() => toggleSupportArea(area)} className="accent-gray-400 checked:accent-purple-500" />
                      <span className="text-sm">{area}</span>
                    </div>
                  </label>
                )})}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-3">Описание проблемы</p>
              <textarea
                value={supportDescription}
                onChange={(e) => setSupportDescription(e.target.value)}
                rows={6}
                placeholder="Опишите, что произошло, как это воспроизводится и что вы ожидали увидеть"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] focus:border-white/15 outline-none transition resize-none"
              />
            </div>

            <div>
              <p className="text-sm font-medium mb-3">Скриншоты</p>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setSupportFiles(Array.from(e.target.files || []).slice(0, 5))}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
              />
              {supportFiles.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {supportFilePreviews.map(({ file, url }) => (
                    <div key={`${file.name}-${file.size}`} className="rounded-xl overflow-hidden border border-white/[0.05] bg-white/[0.02]">
                      <img src={url} alt={file.name} className="w-full h-28 object-cover" />
                      <div className="p-2 text-xs text-white/50 truncate">{file.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSupportModal(false)} className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">Отмена</button>
              <button
                onClick={submitSupportTicket}
                disabled={supportSubmitting || supportIssueAreas.length === 0 || !supportDescription.trim()}
                className="px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 disabled:opacity-50"
              >
                {supportSubmitting ? 'Отправка...' : 'Отправить заявку'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
