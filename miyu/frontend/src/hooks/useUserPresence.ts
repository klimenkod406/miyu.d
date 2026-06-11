import { useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

export interface UserPresenceTrack {
  id: number
  title: string
  cover_url?: string | null
  artist_id?: number
  artist?: { id: number; username: string }
  album?: { id: number; title: string; cover_url?: string | null }
}

export interface UserPresenceInfo {
  isOnline: boolean
  listeningTo: null | {
    type: 'track' | 'album' | 'playlist'
    track: UserPresenceTrack
    context: null | {
      type: string
      id: number | null
      title: string | null
    }
  }
}

export function useUserPresence(userIds: number[]) {
  const { isAuthenticated, accessToken } = useAuth()
  const [presence, setPresence] = useState<Record<number, UserPresenceInfo>>({})
  const [refreshTick, setRefreshTick] = useState(0)
  const refreshPresence = () => setRefreshTick((tick) => tick + 1)

  useEffect(() => {
    if (!isAuthenticated || !accessToken || userIds.length === 0) {
      setPresence({})
      return
    }

    const fetchPresence = async () => {
      try {
        const response = await fetch('/api/user/presence-status', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userIds }),
        })

        if (response.ok) {
          const data = await response.json()
          setPresence(data)
        }
      } catch (error) {
        console.error('Failed to fetch user presence:', error)
      }
    }

    fetchPresence()
    const intervalId = window.setInterval(fetchPresence, 10000)
    return () => window.clearInterval(intervalId)
  }, [isAuthenticated, accessToken, JSON.stringify(userIds), refreshTick])

  return { presence, refreshPresence }
}
