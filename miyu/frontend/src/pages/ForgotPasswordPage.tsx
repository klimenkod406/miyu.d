import { Link } from 'react-router-dom'

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-bold">Miyu</Link>
          <h1 className="text-2xl font-bold mt-6">Забыли пароль?</h1>
          <p className="text-white/40 mt-2">Введите email для сброса пароля</p>
        </div>

        <form className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-3.5 bg-white/[0.02] border border-white/[0.05] rounded-xl focus:outline-none focus:border-white/20 text-white placeholder-white/30 transition"
          />
          <button className="w-full py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full font-medium transition">
            Отправить инструкции
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link to="/login" className="text-white/40 hover:text-purple-400 transition">
            Вернуться ко входу
          </Link>
        </div>
      </div>
    </div>
  )
}