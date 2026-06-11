import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden">
      <div className="text-center">
        <h1 className="text-[10rem] font-bold text-white">404</h1>
        <p className="text-2xl font-medium mb-2 mt-[-1.5rem]">Страница не найдена</p>
        <p className="text-white/40 mb-8">Извините, такой страницы не существует</p>
        <Link to="/" className="px-6 py-3 rounded-full font-medium bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transition inline-flex items-center gap-2">
          <Home size={20} />
          На главную
        </Link>
      </div>
    </div>
  )
}