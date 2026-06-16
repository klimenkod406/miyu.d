import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { getStoredTokens } from '../api/auth'
import { concertsApi } from '../api/concerts'
import Button from '../components/Button'

const PLAN_DETAILS: Record<string, { name: string; price: number }> = {
  plus: { name: 'Plus', price: 299 },
  fan: { name: 'Fan', price: 499 },
}

type CheckoutType = 'subscription' | 'concertTickets'

interface TicketCheckoutItem {
  ticketTypeId: number
  quantity: number
  name: string
  price: number
  zoneId?: string
  zoneName?: string
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [cardholder, setCardholder] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const checkoutType = (location.state?.checkoutType || 'subscription') as CheckoutType
  const planId = location.state?.planId || 'plus'
  const isGift = location.state?.isGift || false
  const recipient = location.state?.recipient
  const concertId = location.state?.concertId as number | undefined
  const concertTitle = location.state?.concertTitle as string | undefined
  const items = (location.state?.items || []) as TicketCheckoutItem[]
  const explicitTotal = Number(location.state?.total || 0)
  const plan = PLAN_DETAILS[planId] || PLAN_DETAILS.plus
  const total = checkoutType === 'concertTickets' ? explicitTotal : plan.price

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16)
    return digits.replace(/(.{4})/g, '$1 ').trim()
  }

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    if (digits.length <= 2) return digits
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }

  const formatCvv = (value: string) => value.replace(/\D/g, '').slice(0, 3)
  const formatCardholder = (value: string) => value.toUpperCase().replace(/[^A-ZА-ЯЁ\s-]/g, '')

  const isCardValid = cardNumber.replace(/\s/g, '').length === 16
  const isExpiryValid = /^\d{2}\/\d{2}$/.test(expiry)
  const isCvvValid = cvv.length === 3
  const isCardholderValid = cardholder.trim().length >= 4
  const isFormValid = isCardValid && isExpiryValid && isCvvValid && isCardholderValid && acceptedTerms

  const handlePay = async () => {
    if (!isFormValid) return

    const tokens = getStoredTokens()
    if (!tokens) {
      setError('Требуется авторизация для оплаты')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      if (checkoutType === 'concertTickets') {
        if (!concertId || items.length === 0) {
          throw new Error('Не удалось сформировать заказ на билеты')
        }

        for (const item of items) {
          await concertsApi.buyTicket(tokens.accessToken, concertId, item.ticketTypeId, item.quantity)
        }

        navigate(`/tickets/concert/${concertId}`)
        return
      }

      const response = await fetch('/api/transactions/subscription/mock-pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({ plan: planId, payment_method: 'mock_card' }),
      })

      const text = await response.text()
      if (!response.ok) {
        throw new Error(text || 'Не удалось провести оплату')
      }

      navigate('/', { state: { paymentSuccess: true, isGift } })
    } catch (err: any) {
      setError(err.message || 'Ошибка оплаты')
    } finally {
      setProcessing(false)
    }
  }

  const renderOrderBlock = () => {
    if (checkoutType === 'concertTickets') {
      return (
        <>
          <h2 className="text-lg font-medium mb-4">Заказ</h2>
          <div className="mb-4">
            <p className="font-medium">{concertTitle || 'Билеты на концерт'}</p>
            <p className="text-sm text-white/40">Имитация оплаты билетов</p>
          </div>
          <div className="space-y-2 mb-4">
            {items.map((item) => (
              <div key={item.ticketTypeId} className="flex justify-between gap-4 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{item.name} x{item.quantity}</span>
                  {item.zoneName && <span className="block text-xs text-white/40">Зона: {item.zoneName}</span>}
                </span>
                <span className="shrink-0">{(item.price * item.quantity).toLocaleString('ru-RU')} ₽</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between pt-2 border-t border-white/10">
            <span className="font-medium">Итого</span>
            <span className="font-medium">{total.toLocaleString('ru-RU')} ₽</span>
          </div>
        </>
      )
    }

    return (
      <>
        <h2 className="text-lg font-medium mb-4">Заказ</h2>
        <div className="flex justify-between mb-2">
          <span>Тариф {plan.name}</span>
          <span>{plan.price} ₽/мес</span>
        </div>
        {isGift && recipient && <p className="text-sm text-white/40 mb-3">Подарок для {recipient}</p>}
        <div className="flex justify-between pt-2 border-t border-white/10">
          <span className="font-medium">Итого</span>
          <span className="font-medium">{plan.price} ₽</span>
        </div>
      </>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Оплата</h1>

      <div className="glass rounded-xl p-6 mb-6">
        {renderOrderBlock()}
      </div>

      {error && (
        <div className="glass rounded-xl p-4 mb-6 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="glass rounded-xl p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Способ оплаты</h2>
        <div className="space-y-3">
          <label className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 cursor-pointer transition duration-200">
            <input type="radio" name="method" defaultChecked className="accent-purple-500" />
            <div>
              <p className="font-medium">Банковская карта</p>
              <p className="text-sm text-white/40">Visa, Mastercard, МИР</p>
            </div>
          </label>
        </div>
      </div>

      <div className="glass rounded-xl p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Реквизиты</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/40 mb-2">Номер карты</label>
              <input
                type="text"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] focus:border-purple-500/50 focus:outline-none transition duration-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
              <label className="block text-sm text-white/40 mb-2">Срок действия</label>
                <input
                  type="text"
                  placeholder="MM/YY"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] focus:border-purple-500/50 focus:outline-none transition duration-200"
                />
              </div>
              <div>
                <label className="block text-sm text-white/40 mb-2">CVV</label>
                <input
                  type="text"
                  placeholder="123"
                  value={cvv}
                  onChange={(e) => setCvv(formatCvv(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] focus:border-purple-500/50 focus:outline-none transition duration-200"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-white/40 mb-2">Имя владельца</label>
              <input
                type="text"
                placeholder="IVAN IVANOV"
                value={cardholder}
                onChange={(e) => setCardholder(formatCardholder(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] focus:border-purple-500/50 focus:outline-none transition duration-200"
              />
            </div>
            <label className="flex items-start gap-3 text-sm text-white/55 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 accent-purple-500"
              />
              <span>Я соглашаюсь с условиями обработки платежа и подтверждаю корректность введённых реквизитов</span>
            </label>
          </div>
        </div>

      <Button
        variant="primary"
        size="lg"
        disabled={processing || !isFormValid}
        onClick={handlePay}
        className="w-full"
      >
        <Lock className="w-4 h-4" />
        {processing ? 'Обработка...' : `Оплатить ${total.toLocaleString('ru-RU')} ₽`}
      </Button>
    </div>
  )
}
