import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

export function useOnlineStatus(userIds: number[]) {
  const { isAuthenticated, accessToken } = useAuth()
  const [onlineStatus, setOnlineStatus] = useState<{ [key: number]: boolean }>({})

  useEffect(() => {
    if (!isAuthenticated || !accessToken || userIds.length === 0) {
      return
    }

    const fetchOnlineStatus = async () => {
      try {
        const response = await fetch('/api/user/online-status', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userIds })
        })

        if (response.ok) {
          const data = await response.json()
          setOnlineStatus(data)
        }
      } catch (error) {
        console.error('Failed to fetch online status:', error)
      }
    }

    // Fetch immediately
    fetchOnlineStatus()

    // Refresh every 30 seconds
    const intervalId = setInterval(fetchOnlineStatus, 30000)

    return () => clearInterval(intervalId)
  }, [isAuthenticated, accessToken, JSON.stringify(userIds)])

  return onlineStatus
}
