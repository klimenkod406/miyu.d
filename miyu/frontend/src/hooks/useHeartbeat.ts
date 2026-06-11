import { useEffect } from 'react'
import { useAuth } from './AuthContext'
import { usePlayer } from './PlayerContext'

const HEARTBEAT_INTERVAL = 60000 // 60 seconds

export function useHeartbeat() {
  const { isAuthenticated, accessToken } = useAuth()
  const { currentTrack, currentPlaylist, isPlaying } = usePlayer()

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return
    }

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/user/heartbeat', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            currentTrackId: isPlaying ? currentTrack?.id ?? null : null,
            currentContextType: isPlaying ? currentPlaylist?.mode ?? (currentPlaylist ? 'playlist' : 'track') : null,
            currentContextId: isPlaying ? currentPlaylist?.id ?? null : null,
            currentContextTitle: isPlaying ? currentPlaylist?.title ?? currentTrack?.album?.title ?? null : null,
          })
        })
      } catch (error) {
        console.error('Heartbeat failed:', error)
      }
    }

    // Send initial heartbeat
    sendHeartbeat()

    // Set up interval
    const intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

    return () => clearInterval(intervalId)
  }, [isAuthenticated, accessToken, currentTrack?.id, currentTrack?.album?.title, currentPlaylist?.id, currentPlaylist?.mode, currentPlaylist?.title, isPlaying])
}
