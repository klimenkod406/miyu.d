import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft } from 'lucide-react'
import { authApi } from '../api/auth'
import ServiceLogo from '../components/ServiceLogo'
import Button from '../components/Button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    setErrorMsg('')
    try {
      await authApi.forgotPassword(email.trim())
      setStatus('success')
    } catch (err: any) {
      setStatus('error')
      setErrorMsg(err.message || 'Ошибка. Попробуйте позже.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="mb-12 flex justify-center scale-[1.56] md:scale-[1.88]">
            <ServiceLogo animationIntervalMs={15000} />
          </div>
          <h1 className="text-3xl font-bold text-white">Забыли пароль?</h1>
          <p className="text-white/40 mt-2">Введите email, и мы отправим ссылку для сброса</p>
        </div>

        {status === 'error' && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {errorMsg}
          </div>
        )}

        {status === 'success' ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Письмо отправлено!</h2>
            <p className="text-white/40 text-sm mb-8">Проверьте почту и перейдите по ссылке в письме.</p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-purple-400 hover:text-pink-400 font-semibold transition"
            >
              <ArrowLeft size={18} />
              Вернуться ко входу
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative group">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-purple-400 transition" size={22} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Email"
                className="w-full pl-14 pr-5 py-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.04] text-white placeholder-white/30 transition-all"
              />
            </div>

            <Button variant="primary" type="submit" disabled={status === 'loading'} className="w-full">
              {status === 'loading' ? 'Отправка...' : 'Отправить ссылку'}
            </Button>
          </form>
        )}

        <div className="mt-8 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-white/40 hover:text-purple-400 transition"
          >
            <ArrowLeft size={16} />
            Вернуться ко входу
          </Link>
        </div>
      </div>
    </div>
  )
}
