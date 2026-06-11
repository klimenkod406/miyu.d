import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { User, Mail, Lock, UserPlus, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'
import ServiceLogo from '../components/ServiceLogo'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !username || !password || !confirmPassword) {
      setError('Заполните все поля')
      return
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }
    setIsLoading(true)
    setError('')

    try {
      await register(email, username, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="mb-12 flex justify-center scale-[1.56] md:scale-[1.88]">
            <ServiceLogo animationIntervalMs={15000} />
          </div>
          <h1 className="text-3xl font-bold text-white">Создать аккаунт</h1>
          <p className="text-white/40 mt-2">Присоединяйтесь к Miyu</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative group">
            <User className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-purple-400 transition" size={22} />
            <input
              type="text"
              placeholder="Имя пользователя"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-14 pr-5 py-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.04] text-white placeholder-white/30 transition-all"
            />
          </div>
          
          <div className="relative group">
            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-purple-400 transition" size={22} />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-14 pr-5 py-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.04] text-white placeholder-white/30 transition-all"
            />
          </div>
          
          <div className="relative group">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-purple-400 transition" size={22} />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-14 pr-14 py-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.04] text-white placeholder-white/30 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          
          <div className="relative group">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-purple-400 transition" size={22} />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Повторите пароль"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full pl-14 pr-5 py-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.04] text-white placeholder-white/30 transition-all"
            />
          </div>
          
          <button
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 hover:from-purple-500 hover:via-pink-400 hover:to-purple-500 rounded-2xl font-semibold flex items-center justify-center gap-3 transition-all duration-300"
          >
            <UserPlus size={22} />
            Зарегистрироваться
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-white/40">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="text-purple-400 hover:text-pink-400 font-semibold transition">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
