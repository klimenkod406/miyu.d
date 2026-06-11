import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Camera, User, AlignLeft, Save, X } from 'lucide-react'
import type { User as UserType } from '../types'
import { getStoredTokens } from '../api/auth'
import { useAuth } from '../hooks/AuthContext'

export default function EditProfilePage() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const canCustomizeProfile = Boolean(currentUser?.is_premium)

  const [user, setUser] = useState<Pick<UserType, 'username' | 'bio'>>({
    username: '',
    bio: '',
  })

  const [avatar, setAvatar] = useState<string>('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const tokens = getStoredTokens()
        if (!tokens) return

        const response = await fetch('/api/user/me', {
          headers: { Authorization: `Bearer ${tokens.accessToken}` }
        })
        if (response.ok) {
          const data = await response.json()
          setUser({
            username: data.username,
            bio: data.bio || '',
          })
          if (data.avatar_url) {
            setAvatar(`${data.avatar_url}`)
          }
        }
      } catch (err) {
        console.error('Failed to fetch user:', err)
      }
    }
    fetchUser()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    setIsSaving(true)

    try {
      const tokens = getStoredTokens()
      if (!tokens) {
        setError('Необходима авторизация')
        return
      }

      // Free can only update the display name.
      let avatarUrl = undefined
      if (canCustomizeProfile && avatarFile) {
        const formData = new FormData()
        formData.append('avatar', avatarFile)

        const avatarResponse = await fetch('/api/user/me/avatar', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
          body: formData
        })

        if (!avatarResponse.ok) {
          throw new Error('Не удалось загрузить аватар')
        }

        const avatarData = await avatarResponse.json()
        avatarUrl = avatarData.avatar_url
      }

      // Update profile
      const updateData: any = {}

      if (user.username) {
        updateData.username = user.username
      }
      if (canCustomizeProfile && user.bio !== undefined) {
        updateData.bio = user.bio
      }

      if (avatarUrl) {
        updateData.avatar_url = avatarUrl
      }

      const response = await fetch('/api/user/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка сохранения')
      }

      setSuccess('Профиль успешно сохранён')
      setTimeout(() => navigate('/profile'), 1500)
    } catch (err: any) {
      setError(err.message || 'Ошибка сервера')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatar(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCancel = () => {
    navigate('/profile')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 text-center">
        <Link 
          to="/profile" 
          className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white mb-4 transition"
        >
          <X size={16} />
          Назад к профилю
        </Link>
        <h1 className="text-3xl font-bold">
          Редактировать профиль
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="glass p-4 rounded-xl text-red-400 text-sm border border-red-500/20">
            {error}
          </div>
        )}
        
        {success && (
          <div className="glass p-4 rounded-xl text-green-400 text-sm border border-green-500/20">
            {success}
          </div>
        )}

        {canCustomizeProfile ? (
          <div className="glass rounded-2xl p-8">
            <h2 className="text-lg font-medium mb-6 text-center">Аватар</h2>
            <div className="flex flex-col items-center">
              <div className="relative mb-4">
                <img
                  src={avatar || '/default-avatar.svg'}
                  alt="Avatar"
                  className="w-32 h-32 rounded-xl object-cover border-2 border-white/10"
                />
                <label className="absolute bottom-1 right-1 w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center cursor-pointer hover:scale-105 transition">
                  <Camera size={18} />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-sm text-white/50 text-center">
                Нажмите на иконку, чтобы загрузить изображение
              </p>
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-medium mb-2">Кастомизация профиля доступна в Plus и Fan</h2>
            <p className="text-sm text-white/50">
              На бесплатном тарифе можно менять только имя пользователя. Аватар и описание откроются после перехода на платный план.
            </p>
          </div>
        )}

        <div className="glass rounded-2xl p-8">
          <h2 className="text-lg font-medium mb-6 text-center">Основная информация</h2>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2 ml-1">
                Имя пользователя
              </label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-purple-400 transition" size={20} />
                <input
                  type="text"
                  value={user.username}
                  onChange={(e) => setUser({ ...user, username: e.target.value })}
                  placeholder="Введите имя пользователя"
                  className="w-full pl-12 pr-4 py-3.5 bg-white/[0.02] border border-white/[0.05] rounded-xl focus:outline-none focus:border-white/20 text-white placeholder-white/30 transition"
                />
              </div>
            </div>

            {canCustomizeProfile && (
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2 ml-1">
                  О себе
                </label>
                <div className="relative group">
                  <AlignLeft className="absolute left-4 top-4 text-white/30 group-focus-within:text-purple-400 transition" size={20} />
                  <textarea
                    value={user.bio}
                    onChange={(e) => setUser({ ...user, bio: e.target.value })}
                    placeholder="Расскажите о себе..."
                    rows={4}
                    maxLength={500}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/[0.02] border border-white/[0.05] rounded-xl focus:outline-none focus:border-white/20 text-white placeholder-white/30 resize-none transition"
                  />
                </div>
                <p className="text-xs text-white/30 mt-2 text-right">
                  {user.bio?.length || 0}/500
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-6 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={20} />
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
          
          <button
            type="button"
            onClick={handleCancel}
            className="glass px-6 py-4 rounded-xl font-medium flex items-center gap-2 transition hover:bg-white/10"
          >
            <X size={20} />
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}
