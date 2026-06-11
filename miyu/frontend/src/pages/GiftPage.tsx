import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift, Mail, User } from 'lucide-react'

const plans = [
  {
    id: 'plus',
    name: 'Plus',
    pricePerMonth: 299,
    features: ['Без рекламы', '320 kbps', 'Неограниченные пропуски', 'Полная статистика'],
  },
  {
    id: 'fan',
    name: 'Fan',
    pricePerMonth: 499,
    features: ['Всё из Plus', 'Ранний доступ к билетам', 'Закрытый контент артистов'],
  },
]

const durations = [
  { months: 1, label: '1 месяц', discount: 0 },
  { months: 3, label: '3 месяца', discount: 10, popular: true },
  { months: 6, label: '6 месяцев', discount: 15 },
  { months: 12, label: '12 месяцев', discount: 20 },
]

export default function GiftPage() {
  const navigate = useNavigate()
  const [selectedPlan, setSelectedPlan] = useState('plus')
  const [selectedDuration, setSelectedDuration] = useState(3)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [message, setMessage] = useState('')
  const [sendDate, setSendDate] = useState('now')
  const [customDate, setCustomDate] = useState('')

  const calculatePrice = () => {
    const plan = plans.find(p => p.id === selectedPlan)
    if (!plan) return 0

    const duration = durations.find(d => d.months === selectedDuration)
    if (!duration) return 0

    const basePrice = plan.pricePerMonth * selectedDuration
    const discount = basePrice * (duration.discount / 100)
    return Math.round(basePrice - discount)
  }

  const handleGift = () => {
    if (!recipientEmail || !recipientName) {
      alert('Заполните email и имя получателя')
      return
    }

    navigate('/checkout', {
      state: {
        planId: selectedPlan,
        duration: selectedDuration,
        isGift: true,
        recipient: {
          email: recipientEmail,
          name: recipientName,
          message,
          sendDate: sendDate === 'now' ? new Date().toISOString() : customDate
        }
      }
    })
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 mb-4">
          <Gift className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-bold mb-3">Подарите подписку</h1>
        <p className="text-white/40 text-lg">Порадуйте близкого человека подпиской на музыку и fan-привилегии</p>
      </div>

      <div className="grid gap-8">
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Выберите тариф</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedPlan === plan.id
                    ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500'
                    : 'border-white/[0.05] bg-white/[0.02] hover:border-white/20'
                }`}
              >
                <h3 className="font-bold text-lg mb-1">{plan.name}</h3>
                <p className="text-2xl font-bold mb-3">{plan.pricePerMonth} ₽<span className="text-sm text-white/40 font-normal">/мес</span></p>
                <ul className="space-y-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="text-xs text-white/60 flex items-center gap-1">
                      <span className="text-purple-400">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-bold mb-3">Выберите срок подписки</h3>
          <div className="grid grid-cols-4 gap-3">
            {durations.map((duration) => (
              <div
                key={duration.months}
                onClick={() => setSelectedDuration(duration.months)}
                className={`p-4 rounded-xl border cursor-pointer transition-all text-center ${
                  selectedDuration === duration.months
                    ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500'
                    : 'border-white/[0.05] bg-white/[0.02] hover:border-white/20'
                }`}
              >
                {duration.popular && (
                  <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs rounded-full mb-2">
                    Популярный
                  </span>
                )}
                <p className="font-bold mb-1">{duration.label}</p>
                {duration.discount > 0 && (
                  <p className="text-xs text-green-400">-{duration.discount}%</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Получатель</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Имя получателя
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Иван Иванов"
                className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-xl text-white placeholder-white/30 focus:border-purple-500 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                Email получателя
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="example@mail.com"
                className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-xl text-white placeholder-white/30 focus:border-purple-500 focus:outline-none transition"
              />
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Персональное сообщение</h2>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Напишите поздравление или пожелание..."
            rows={4}
            className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-xl text-white placeholder-white/30 focus:border-purple-500 focus:outline-none transition resize-none"
          />
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Когда отправить?</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 cursor-pointer transition">
              <input
                type="radio"
                name="sendDate"
                value="now"
                checked={sendDate === 'now'}
                onChange={(e) => setSendDate(e.target.value)}
                className="accent-purple-500"
              />
              <div>
                <p className="font-medium">Сразу после оплаты</p>
                <p className="text-sm text-white/40">Получатель получит подарок мгновенно</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 cursor-pointer transition">
              <input
                type="radio"
                name="sendDate"
                value="custom"
                checked={sendDate === 'custom'}
                onChange={(e) => setSendDate(e.target.value)}
                className="accent-purple-500"
              />
              <div className="flex-1">
                <p className="font-medium mb-2">Выбрать дату</p>
                {sendDate === 'custom' && (
                  <input
                    type="datetime-local"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.05] rounded-lg text-white focus:border-purple-500 focus:outline-none transition"
                  />
                )}
              </div>
            </label>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/60">Подписка {plans.find(p => p.id === selectedPlan)?.name}</span>
            <span className="font-medium">{plans.find(p => p.id === selectedPlan)?.pricePerMonth} ₽/мес</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/60">Срок</span>
            <span className="font-medium">{durations.find(d => d.months === selectedDuration)?.label}</span>
          </div>
          {durations.find(d => d.months === selectedDuration)?.discount! > 0 && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/60">Скидка</span>
              <span className="font-medium text-green-400">-{durations.find(d => d.months === selectedDuration)?.discount}%</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-4 border-t border-white/10 mb-6">
            <span className="text-lg font-bold">Итого</span>
            <span className="text-2xl font-bold">{calculatePrice()} ₽</span>
          </div>
          <button
            onClick={handleGift}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full font-bold text-lg transition shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            Перейти к оплате
          </button>
        </div>
      </div>
    </div>
  )
}
