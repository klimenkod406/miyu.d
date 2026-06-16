import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: ['С рекламой', '96 kbps', 'Ограниченные пропуски', 'Только смена имени в профиле'],
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 299,
    popular: true,
    features: ['Без рекламы', '320 kbps', 'Неограниченные пропуски', 'Полная статистика', 'Кастомизация профиля'],
  },
  {
    id: 'fan',
    name: 'Fan',
    price: 499,
    features: ['Всё из Plus', 'Ранний доступ к билетам', 'Закрытый контент артистов', 'Fan-статус'],
  },
]

export default function PremiumPage() {
  const navigate = useNavigate()

  const handleSelectPlan = (planId: string) => {
    navigate('/checkout', { state: { planId } })
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">Подписки Miyu</h1>
        <p className="text-white/40 text-lg">Выберите формат доступа: комфортное прослушивание или fan-привилегии</p>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-12">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`p-6 rounded-2xl border transition-all ${
              plan.popular
                ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                : 'border-white/[0.05] bg-white/[0.02]'
            } hover:border-white/20`}
          >
            {plan.popular && (
              <span className="inline-block px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs rounded-full mb-4">
                Популярный
              </span>
            )}
            <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
            <p className="text-4xl font-bold mb-4">
              {plan.price === 0 ? 'Бесплатно' : `${plan.price} ₽`}
              {plan.price > 0 && <span className="text-lg text-white/40 font-normal">/мес</span>}
            </p>
            <ul className="space-y-3 mb-6">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-purple-400">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            {plan.price > 0 && (
              plan.popular ? (
                <Button variant="primary" size="lg" onClick={() => handleSelectPlan(plan.id)}>
                  Выбрать
                </Button>
              ) : (
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  className="w-full py-3 rounded-full font-medium transition bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/10"
                >
                  Выбрать
                </button>
              )
            )}
          </div>
        ))}
      </div>

      <div className="mt-16">
        <div className="glass rounded-3xl p-8 max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Подарите подписку близкому</h2>
            <p className="text-white/40 mb-6 text-lg">
              Подарите подписку Plus или Fan другу или близкому человеку.
              Выберите тариф, и мы отправим красивый цифровой подарок.
            </p>
            <Button as="link" to="/gift" variant="primary" size="lg">
              Подарить подписку
            </Button>
        </div>
      </div>

      <div className="mt-16">
        <h2 className="text-2xl font-bold text-center mb-8">Сравнение тарифов</h2>
        <div className="overflow-x-auto">
          <table className="w-full max-w-4xl mx-auto">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="text-left py-4 px-4 text-white/40">Функции</th>
                <th className="text-center py-4 px-4 text-white/40">Free</th>
                 <th className="text-center py-4 px-4 text-white/40">Plus</th>
                 <th className="text-center py-4 px-4 text-white/40">Fan</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/[0.05]/50">
                <td className="py-4 px-4">Реклама</td>
                <td className="text-center py-4 px-4">✓</td>
                <td className="text-center py-4 px-4 text-green-400">—</td>
                <td className="text-center py-4 px-4 text-green-400">—</td>
              </tr>
              <tr className="border-b border-white/[0.05]/50">
                <td className="py-4 px-4">Качество аудио</td>
                <td className="text-center py-4 px-4">96 kbps</td>
                <td className="text-center py-4 px-4">320 kbps</td>
                <td className="text-center py-4 px-4">320 kbps</td>
              </tr>
              <tr className="border-b border-white/[0.05]/50">
                 <td className="py-4 px-4">Пропуски треков</td>
                 <td className="text-center py-4 px-4">Ограниченные</td>
                 <td className="text-center py-4 px-4 text-green-400">Неограниченные</td>
                 <td className="text-center py-4 px-4 text-green-400">Неограниченные</td>
               </tr>
               <tr className="border-b border-white/[0.05]/50">
                 <td className="py-4 px-4">Кастомизация профиля</td>
                 <td className="text-center py-4 px-4">Только имя</td>
                 <td className="text-center py-4 px-4 text-green-400">Аватар, био, палитра</td>
                 <td className="text-center py-4 px-4 text-green-400">Аватар, био, палитра, fan-оформление</td>
               </tr>
               <tr className="border-b border-white/[0.05]/50">
                 <td className="py-4 px-4">Расширенная статистика</td>
                 <td className="text-center py-4 px-4 text-red-400">—</td>
                 <td className="text-center py-4 px-4 text-green-400">✓</td>
                 <td className="text-center py-4 px-4 text-green-400">✓</td>
               </tr>
               <tr className="border-b border-white/[0.05]/50">
                 <td className="py-4 px-4">Ранний доступ к билетам</td>
                 <td className="text-center py-4 px-4 text-red-400">—</td>
                 <td className="text-center py-4 px-4 text-red-400">—</td>
                 <td className="text-center py-4 px-4 text-green-400">✓</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
