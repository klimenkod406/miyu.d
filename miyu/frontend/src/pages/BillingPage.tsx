import { useEffect, useState } from 'react'
import { getStoredTokens } from '../api/auth'

interface Transaction {
  id: number
  type: string
  amount: number
  currency: string
  status: string
  created_at: string
  description: string
}

export default function BillingPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTransactions()
  }, [])

  const fetchTransactions = async () => {
    try {
      const token = getStoredTokens()?.accessToken
      const response = await fetch('/api/transactions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch transactions')
      }

      const data = await response.json()
      setTransactions(data)
    } catch (err) {
      setError('Не удалось загрузить историю платежей')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Оплачено'
      case 'pending':
        return 'В обработке'
      case 'failed':
        return 'Ошибка'
      case 'refunded':
        return 'Возврат'
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400'
      case 'pending':
        return 'text-yellow-400'
      case 'failed':
        return 'text-red-400'
      case 'refunded':
        return 'text-blue-400'
      default:
        return 'text-white/40'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/40">Загрузка...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-red-400">{error}</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">История платежей</h1>

      {transactions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/40">У вас пока нет платежей</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition duration-200">
              <div>
                <p className="font-medium">{t.description}</p>
                <p className="text-sm text-white/40">{formatDate(t.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{t.amount} {t.currency}</p>
                <p className={`text-sm ${getStatusColor(t.status)}`}>{getStatusText(t.status)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
