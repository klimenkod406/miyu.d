import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, LogIn, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'
import { openOAuthPopup } from '../components/OAuthPopup'
import ServiceLogo from '../components/ServiceLogo'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Заполните все поля')
      return
    }
    setIsLoading(true)
    setError('')

    try {
      console.log('LoginPage: calling login...')
      await login(email, password)
      console.log('LoginPage: login complete, checking localStorage:', localStorage.getItem('accessToken')?.substring(0, 20))
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuth = async (provider: 'github') => {
    try {
      setError(null);
      setIsLoading(true);
      await openOAuthPopup(provider);
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа через GitHub');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="mb-12 flex justify-center scale-[1.56] md:scale-[1.88]">
            <ServiceLogo animationIntervalMs={15000} />
          </div>
          <h1 className="text-3xl font-bold text-white">С возвращением</h1>
          <p className="text-white/40 mt-2">Войдите в свой аккаунт</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
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
          
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-sm text-white/40 hover:text-purple-400 transition">
              Забыли пароль?
            </Link>
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 hover:from-purple-500 hover:via-pink-400 hover:to-purple-500 rounded-2xl font-semibold flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn size={22} />
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        {/* OAuth */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-white/[0.08]" />
          <span className="text-white/30 text-sm">или</span>
          <div className="flex-1 h-px bg-white/[0.08]" />
        </div>

        <button
          type="button"
          onClick={() => handleOAuth('github')}
          disabled={isLoading}
          className="w-full py-4 bg-gradient-to-r from-[#333] to-[#555] hover:from-[#444] hover:to-[#666] rounded-2xl font-semibold text-white flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          Войти через GitHub
        </button>

        <div className="mt-8 text-center">
          <p className="text-white/40">
            Нет аккаунта?{' '}
            <Link to="/register" className="text-purple-400 hover:text-pink-400 font-semibold transition">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
