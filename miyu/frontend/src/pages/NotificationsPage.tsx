import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, UserPlus, MessageCircle, Share, Award, Calendar, UserCheck, BellOff, Check, BarChart3, Loader2, LifeBuoy } from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'
import type { Notification, User } from '../types'

function getStoredTokens() {
  const token = localStorage.getItem('accessToken')
  return token ? { accessToken: token } : null
}

function formatTimeAgo(dateString: string): string {
  try {
    const normalized = typeof dateString === 'string' && !dateString.includes('T')
      ? dateString.replace(' ', 'T')
      : dateString
    const date = new Date(normalized)
    if (Number.isNaN(date.getTime())) return dateString
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diff < 60) return 'только что'
    if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
    return `${Math.floor(diff / 86400)} дн назад`
  } catch {
    return dateString
  }
}

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case 'like': return <Heart className="w-4 h-4 text-white" />
    case 'follow': return <UserPlus className="w-4 h-4 text-blue-400" />
    case 'comment': return <MessageCircle className="w-4 h-4 text-green-400" />
    case 'share': return <Share className="w-4 h-4 text-purple-400" />
    case 'achievement': return <Award className="w-4 h-4 text-yellow-400" />
    case 'concert': return <Calendar className="w-4 h-4 text-red-400" />
    case 'friend_request': return <UserCheck className="w-4 h-4 text-green-400" />
    case 'share_stats': return <BarChart3 className="w-4 h-4 text-cyan-400" />
    case 'support_resolved': return <LifeBuoy className="w-4 h-4 text-white" />
    default: return <BellOff className="w-4 h-4 text-white/40" />
  }
}

function renderNotificationMessage(notification: any) {
  if (notification.type !== 'support_resolved') {
    return <span className="text-white/60">{notification.message}</span>
  }

  const marker = 'Принятые меры:'
  const markerIndex = String(notification.message || '').indexOf(marker)

  if (markerIndex === -1) {
    return <span className="text-white/60">{notification.message}</span>
  }

  const prefix = notification.message.slice(0, markerIndex).trim()
  const resolution = notification.message.slice(markerIndex + marker.length).trim()

  return (
    <span className="block mt-1 space-y-2">
      <span className="block text-white/60">{prefix}</span>
      <span className="block rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 py-2 text-white">
        <span className="font-medium">Принятые меры:</span> {resolution}
      </span>
    </span>
  )
}

function getNotificationLink(notification: Notification): string {
  switch (notification.type) {
    case 'like':
      return notification.target_type === 'track' ? `/track/${notification.target_id}` : `/album/${notification.target_id}`
    case 'follow':
    case 'friend_request':
      return `/user/${notification.from_user_id}`
    case 'achievement':
      return '/achievements'
    case 'concert':
      return `/concert/${notification.target_id}`
    case 'share_stats':
      return `/stats/shared/${notification.from_user_id}`
    default:
      return '#'
  }
}

function parseNotificationNotification(n: any): Notification {
  return {
    id: n.id,
    type: n.type as any,
    from_user_id: n.from_user_id,
    from_user: n.from_user || null,
    target_type: n.target_type as any,
    target_id: n.target_id,
    message: n.message,
    read: !!n.read,
    created_at: n.created_at
  }
}

export default function NotificationsPage() {
  const { isAuthenticated } = useAuth()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications()
    } else {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (isAuthenticated) {
        loadNotifications()
      }
    }, 10000)
    return () => clearInterval(intervalId)
  }, [isAuthenticated])

  const loadNotifications = async () => {
    const tokens = getStoredTokens()
    if (!tokens) {
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.map(parseNotificationNotification))
        window.dispatchEvent(new CustomEvent('refresh-notification-unread'))
      }
    } catch (err) {
      console.error('Failed to load notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = async (id: number) => {
    const tokens = getStoredTokens()
    if (!tokens) return

    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}` 
        },
        body: JSON.stringify({ ids: [id] })
      })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      window.dispatchEvent(new CustomEvent('refresh-notification-unread'))
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  const markAllAsRead = async () => {
    setSaving(true)
    const tokens = getStoredTokens()
    if (!tokens) {
      setSaving(false)
      return
    }

    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      window.dispatchEvent(new CustomEvent('refresh-notification-unread'))
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-20 text-white/40">
        <BellOff className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <p>Войдите, чтобы видеть уведомления</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Уведомления</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/60 transition disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            Прочитать все
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'all', label: 'Все' },
          { id: 'unread', label: `Непрочитанные${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap transition ${
              filter === f.id 
                ? 'glass-accent text-white' 
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredNotifications.map((notification, index) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`p-4 rounded-xl border transition cursor-pointer ${
              notification.read 
                ? 'bg-white/[0.02] border-white/[0.05]' 
                : 'bg-purple-500/5 border-purple-500/20'
            }`}
            onClick={() => markAsRead(notification.id)}
          >
            <Link 
              to={getNotificationLink(notification)}
              className="flex items-start gap-3"
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium">
                  {(notification.from_user?.username || (notification.type === 'support_resolved' ? 'MiYu' : 'система'))[0]?.toUpperCase() || '?'}
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black flex items-center justify-center">
                  <NotificationIcon type={notification.type} />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">@{notification.from_user?.username || (notification.type === 'support_resolved' ? 'MiYu' : 'система')}</span>
                  {' '}
                  {renderNotificationMessage(notification)}
                </p>
                <p className="text-xs text-white/30 mt-1">
                  {formatTimeAgo(notification.created_at)}
                </p>
              </div>

              {!notification.read && (
                <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0 mt-2" />
              )}
            </Link>
          </motion.div>
        ))}
      </div>

      {filteredNotifications.length === 0 && (
        <div className="text-center py-12 text-white/40">
          <BellOff className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Нет уведомлений</p>
        </div>
      )}
    </div>
  )
}
