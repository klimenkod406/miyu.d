import { Home } from 'lucide-react'
import Button from '../components/Button'

export default function NotFoundPage() {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden">
      <div className="text-center">
        <h1 className="text-[10rem] font-bold text-white">404</h1>
        <p className="text-2xl font-medium mb-2 mt-[-1.5rem]">Страница не найдена</p>
        <p className="text-white/40 mb-8">Извините, такой страницы не существует</p>
        <Button variant="primary" as="link" to="/">
          <Home size={20} />
          На главную
        </Button>
      </div>
    </div>
  )
}