import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import type { Track, Playlist } from '../types'
import { getStoredTokens } from '../api/auth'
import { recsysApi } from '../api/recsys'
import { selectNextTrackIndex, type RepeatMode } from './playerNavigation'
type PlaybackMode = 'playlist' | 'album' | 'wave'

interface PlaybackCollection {
  id: number
  title: string
  mode?: PlaybackMode
  is_system?: boolean
}

function isRegularPlaylistCollection(collection: PlaybackCollection | null | undefined): boolean {
  if (!collection) return false
  if (collection.mode !== 'playlist') return false
  if (collection.is_system) return false
  return Number.isFinite(collection.id) && collection.id > 0
}

function shouldFallIntoWave(collection: PlaybackCollection | null | undefined): boolean {
  if (!collection) return false
  if (collection.mode === 'wave') return false
  if (collection.mode === 'playlist' || collection.mode === 'album') return true
  return Number.isFinite(collection.id) && collection.id > 0
}

function shouldStartWaveAfterQueueEnd(
  collection: PlaybackCollection | null | undefined,
  queueLength: number,
  hasCurrentTrack: boolean,
): boolean {
  if (collection?.mode === 'wave') return false
  if (shouldFallIntoWave(collection)) return true
  if (queueLength > 0) return true
  return hasCurrentTrack
}

interface PlayerState {
  currentTrack: Track | null
  currentPlaylist: PlaybackCollection | null
  queue: Track[]
  volume: number
  progress: number
  duration: number
  repeatMode: RepeatMode
  isShuffled: boolean
  isExpanded: boolean
  isLiked: boolean
  showEQ: boolean
  showVolume: boolean
  eqPreset: string
  eqBands: number[]
}

interface PlayerContextType extends PlayerState {
  isPlaying: boolean
  playlists: Playlist[]
  isWaveActive: boolean

  play: () => void
  pause: () => void
  stop: () => void
  togglePlay: () => void
  setTrack: (track: Track, playNow?: boolean, playlist?: PlaybackCollection | null) => void
  setQueue: (tracks: Track[], playNow?: boolean, playlist?: PlaybackCollection | null) => void
  addToQueue: (track: Track) => void
  nextTrack: () => void
  prevTrack: () => void
  playNext: () => void
  playPrevious: () => void
  setVolume: (volume: number) => void
  cycleRepeatMode: () => void
  toggleShuffle: () => void
  toggleLike: () => void
  toggleExpanded: () => void
  toggleEQ: () => void
  toggleVolumeSlider: () => void
  setProgress: (progress: number) => void
  setDuration: (duration: number) => void
  seekTo: (time: number) => void
  addToPlaylist: (playlistId: number) => void
  addOrRemoveFromPlaylist: (playlistId: number) => void
  isTrackInPlaylist: (playlistId: number) => boolean
  setEqPreset: (preset: string) => void
  setEqBand: (index: number, value: number) => void
  refreshLikeStatus: () => void
  startWave: () => Promise<void>
}

const EQ_PRESETS: Record<string, number[]> = {
  'По умолчанию': [0, 0, 0, 0, 0],
  'Басы': [6, 4, 0, 0, 0],
  'Вокал': [-2, 0, 2, 4, 2],
  'Электроника': [5, 3, 0, -2, -3],
  'Рок': [4, 2, -1, 2, 5],
  'Классика': [0, 0, 0, -2, -4],
  'Поп': [2, 4, 3, 1, 0],
  'Хип-хоп': [7, 3, -1, 0, 2],
  'Пользовательский': [0, 0, 0, 0, 0],
}

const defaultTrack: Track = {
  id: 1,
  artist_id: 1,
  title: 'Midnight City',
  artist: { id: 1, email: '', username: 'M83', role: 'artist', is_verified: false, is_premium: false, created_at: '' },
  album: { id: 1, artist_id: 1, title: "Hurry Up, We're Dreaming", cover_url: '', type: 'album', status: '', created_at: '' },
  duration: 243,
  file_path: '',
  cover_url: '',
  is_explicit: false,
  is_premium: false,
  status: 'approved',
  created_at: '',
}

const PLAYER_STATE_KEY = 'miyu-player-state';
const MIYU_WAVE_COLLECTION: PlaybackCollection = { id: -9999, title: 'Волна Miyu', mode: 'wave' }
const WAVE_FETCH_LIMIT = 50
const WAVE_PREFETCH_THRESHOLD = 5
const WAVE_RETRY_COOLDOWN_MS = 15000
const WAVE_MIN_QUEUE_FOR_PREFETCH = 3

const defaultState: PlayerState = {
  currentTrack: defaultTrack,
  currentPlaylist: null,
  queue: [],
  volume: 80,
  progress: 0,
  duration: 243,
  repeatMode: 'off',
  isShuffled: false,
  isExpanded: false,
  isLiked: false,
  showEQ: false,
  showVolume: false,
  eqPreset: 'По умолчанию',
  eqBands: EQ_PRESETS['По умолчанию'],
}

const PlayerContext = createContext<PlayerContextType | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerState>(() => {
    try {
      const storedState = localStorage.getItem(PLAYER_STATE_KEY);
      if (storedState) {
        const parsed = JSON.parse(storedState)
        parsed.progress = parsed.currentTrack ? parsed.progress : 0
        return parsed;
      }
    } catch (e) {
      console.error("Failed to load player state from localStorage", e);
    }
    return defaultState;
  });
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [wavePrefetchInFlight, setWavePrefetchInFlight] = useState(false)
  const waveRetryBlockedUntilRef = useRef(0)
  const lastWavePrefetchKeyRef = useRef<string | null>(null)

  const mapFeedTrackToTrack = useCallback((track: any): Track => ({
    ...track,
    cover_url: track.cover_url || track.album?.cover_url || '',
    file_path: track.file_path || '',
    is_explicit: !!track.is_explicit,
    is_premium: !!track.is_premium,
    status: track.status || 'approved',
    created_at: track.created_at || '',
  }), [])

  const hasPlayableFile = useCallback((track: Track) => Boolean(track.file_path && String(track.file_path).trim().length > 0), [])

  const dedupeTracks = useCallback((tracks: Track[]): Track[] => {
    const seen = new Set<number>()
    const out: Track[] = []
    for (const track of tracks) {
      if (!track?.id || seen.has(track.id)) continue
      seen.add(track.id)
      out.push(track)
    }
    return out
  }, [])

  const fetchFallbackWaveTracks = useCallback(async (): Promise<Track[]> => {
    try {
      const popularRes = await fetch('/api/tracks/popular')
      const popularData = popularRes.ok ? await popularRes.json() : []

      return dedupeTracks(
        Array.isArray(popularData) ? popularData.map(mapFeedTrackToTrack) : []
      ).filter(hasPlayableFile)
    } catch (error) {
      console.error('Failed to load fallback wave tracks:', error)
      return []
    }
  }, [dedupeTracks, hasPlayableFile, mapFeedTrackToTrack])

  const fetchWaveTracks = useCallback(async (limit = WAVE_FETCH_LIMIT): Promise<Track[]> => {
    if (Date.now() < waveRetryBlockedUntilRef.current) {
      return []
    }

    const tokens = getStoredTokens()
    if (!tokens?.accessToken) {
      return fetchFallbackWaveTracks()
    }

    try {
      const response = await recsysApi.getFeed(tokens.accessToken, limit)
      const personalized = Array.isArray(response.tracks)
        ? response.tracks.map(mapFeedTrackToTrack).filter(hasPlayableFile)
        : []

      if (personalized.length > 0) {
        return dedupeTracks(personalized)
      }

      return fetchFallbackWaveTracks()
    } catch (error) {
      console.error('Failed to load Miyu wave:', error)
      waveRetryBlockedUntilRef.current = Date.now() + WAVE_RETRY_COOLDOWN_MS
      return fetchFallbackWaveTracks()
    }
  }, [dedupeTracks, fetchFallbackWaveTracks, hasPlayableFile, mapFeedTrackToTrack])

  useEffect(() => {
    const tokens = getStoredTokens()
    if (tokens) {
      fetch('/api/playlists', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      })
        .then(res => res.json())
        .then(data => {
          setPlaylists(Array.isArray(data) ? data.filter((playlist: any) => !playlist.is_system) : [])
        })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save player state to localStorage", e);
    }
  }, [state]);

  // Очищаем плеер при изменении авторизации (логин/логаут)
  // чтобы гостевой и авторизованный плеер не пересекались
  useEffect(() => {
    const handleAuthChanged = () => {
      setIsPlaying(false)
      setState(s => ({
        ...s,
        queue: [],
        progress: 0,
      }))
    }
    window.addEventListener('miyu-auth-changed', handleAuthChanged)
    return () => window.removeEventListener('miyu-auth-changed', handleAuthChanged)
  }, [])

  // Record play history when track ends or user leaves
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (state.currentTrack && state.progress > 30) { // Минимум 30 секунд
        const completed = state.progress >= state.duration * 0.8
        const tokens = getStoredTokens()
        if (tokens) {
          // Use fetch with keepalive instead of sendBeacon for proper auth headers
          fetch('/api/history', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokens.accessToken}`
            },
            body: JSON.stringify({
              trackId: state.currentTrack.id,
              playDuration: Math.floor(state.progress),
              completed,
              playlistId: isRegularPlaylistCollection(state.currentPlaylist) ? state.currentPlaylist!.id : null
            }),
            keepalive: true // Ensures request completes even if page is closing
          }).catch(() => {}) // Ignore errors on page unload
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [state.currentTrack, state.progress, state.duration, state.currentPlaylist])

  const play = useCallback(() => setIsPlaying(true), [])
  const pause = useCallback(() => setIsPlaying(false), [])
  const stop = useCallback(() => {
    setIsPlaying(false)
    setState(s => ({ ...s, progress: 0 }))
  }, [])
  const togglePlay = useCallback(() => setIsPlaying(p => !p), [])

  const recordPlay = useCallback((trackId: number, playDuration: number, completed: boolean) => {
    const tokens = getStoredTokens()
    if (!tokens || !trackId) return

    fetch('/api/history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.accessToken}`
      },
      body: JSON.stringify({
        trackId,
        playDuration,
        completed,
        playlistId: isRegularPlaylistCollection(state.currentPlaylist) ? state.currentPlaylist!.id : null
      })
    }).catch(err => console.error('Failed to record play:', err))
  }, [state.currentPlaylist])

  const setTrack = useCallback((track: Track, playNow = true, playlist?: PlaybackCollection | null) => {
    // Record previous track play if it was playing
    if (state.currentTrack && state.progress > 0) {
      const completed = state.progress >= state.duration * 0.8 // 80% считается прослушанным
      recordPlay(state.currentTrack.id, Math.floor(state.progress), completed)
    }

    setState(s => ({
      ...s,
      currentTrack: track,
      currentPlaylist: typeof playlist !== 'undefined' ? playlist : s.currentPlaylist,
      progress: 0,
      duration: track.duration || 0,
      isLiked: false
    }))
    if (playNow) {
      setIsPlaying(true)
    }

    const tokens = getStoredTokens()
    if (tokens && track.id) {
      fetch(`/api/likes/check/${track.id}`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      })
        .then(res => res.json())
        .then(data => {
          setState(s => ({ ...s, isLiked: data.liked || false }))
        })
        .catch(() => {})
    }
  }, [state.currentTrack, state.progress, state.duration, recordPlay])
  
  const setQueue = useCallback((tracks: Track[], playNow = false, playlist?: PlaybackCollection | null) => {
    setState(s => ({
      ...s,
      queue: tracks,
      currentPlaylist: typeof playlist !== 'undefined' ? playlist : null,
    }))
    if (playNow && tracks.length > 0) {
      setTrack(tracks[0], true, playlist)
    }
  }, [setTrack])
  
  const addToQueue = useCallback((track: Track) => {
    setState(s => ({ ...s, queue: [...s.queue, track] }))
  }, [])

  const prefetchWaveIfNeeded = useCallback(async () => {
    if (wavePrefetchInFlight) return

    const currentPlaylist = state.currentPlaylist
    const currentTrack = state.currentTrack
    const queue = state.queue

    if (currentPlaylist?.mode !== 'wave' || !currentTrack || queue.length < WAVE_MIN_QUEUE_FOR_PREFETCH) return

    const currentIndex = queue.findIndex(track => track.id === currentTrack.id)
    if (currentIndex === -1) return

    const remaining = queue.length - currentIndex - 1
    if (remaining > WAVE_PREFETCH_THRESHOLD) return

    const prefetchKey = `${currentTrack.id}:${queue.length}:${queue[queue.length - 1]?.id || 'none'}`
    if (lastWavePrefetchKeyRef.current === prefetchKey) return
    lastWavePrefetchKeyRef.current = prefetchKey

    setWavePrefetchInFlight(true)
    try {
      const existingIds = new Set(queue.map(track => track.id))
      const waveTracks = await fetchWaveTracks(WAVE_FETCH_LIMIT)
      const freshTracks = waveTracks.filter(track => !existingIds.has(track.id))
      if (freshTracks.length === 0) return

      setState(prev => {
        const prevIds = new Set(prev.queue.map(track => track.id))
        const dedupedFresh = freshTracks.filter(track => !prevIds.has(track.id))
        if (dedupedFresh.length === 0) return prev
        return { ...prev, queue: [...prev.queue, ...dedupedFresh] }
      })
    } catch (error) {
      console.error('Failed to prefetch Miyu wave:', error)
      waveRetryBlockedUntilRef.current = Date.now() + WAVE_RETRY_COOLDOWN_MS
    } finally {
      setWavePrefetchInFlight(false)
    }
  }, [fetchWaveTracks, state.currentPlaylist, state.currentTrack, state.queue, wavePrefetchInFlight])
  
  const startWave = useCallback(async () => {
    if (Date.now() < waveRetryBlockedUntilRef.current) return

    const tracks = await fetchWaveTracks(WAVE_FETCH_LIMIT)
    if (tracks.length === 0) return
    lastWavePrefetchKeyRef.current = null
    
    // Перемешиваем треки для случайного порядка воспроизведения
    const shuffled = [...tracks]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    
    setQueue(shuffled, false, MIYU_WAVE_COLLECTION)
    setTrack(shuffled[0], true, MIYU_WAVE_COLLECTION)
  }, [fetchWaveTracks, setQueue, setTrack])

  const nextTrack = useCallback(async () => {
    if (state.queue.length === 0 && !state.currentTrack) return
    const queue = state.queue.length > 0 ? state.queue : [state.currentTrack!]
    const currentIndex = queue.findIndex(t => t.id === state.currentTrack?.id)
    const nextIndex = selectNextTrackIndex({
      queueLength: queue.length,
      currentIndex,
      repeatMode: state.repeatMode,
      isShuffled: state.isShuffled,
    })

    if (nextIndex === null && state.currentPlaylist?.mode === 'wave') {
      const existingIds = new Set(queue.map(track => track.id))
      const waveTracks = await fetchWaveTracks(WAVE_FETCH_LIMIT)
      const freshTracks = waveTracks.filter(track => !existingIds.has(track.id))

      if (freshTracks.length === 0) {
        if (queue.length > 0) {
          const fallbackNext = queue[0]
          if (fallbackNext) {
            setTrack(fallbackNext, true, state.currentPlaylist)
          }
        } else {
          setIsPlaying(false)
        }
        waveRetryBlockedUntilRef.current = Date.now() + WAVE_RETRY_COOLDOWN_MS
        return
      }

      const extendedQueue = [...queue, ...freshTracks]
      const next = freshTracks[0]
      setState(s => ({ ...s, queue: extendedQueue }))
      setTrack(next, true, state.currentPlaylist)
      return
    }

    if (nextIndex === null) {
      if (shouldStartWaveAfterQueueEnd(state.currentPlaylist, state.queue.length, !!state.currentTrack)) {
        await startWave()
        return
      }
      setIsPlaying(false)
      return
    }

    const next = queue[nextIndex]
    if (next) setTrack(next, true, state.currentPlaylist)
  }, [state.queue, state.currentTrack, state.isShuffled, state.repeatMode, state.currentPlaylist, setTrack, fetchWaveTracks, startWave])

  useEffect(() => {
    if (state.currentPlaylist?.mode === 'wave' && isPlaying) {
      prefetchWaveIfNeeded().catch((error) => console.error('Wave prefetch effect failed:', error))
    }
  }, [state.currentPlaylist, state.currentTrack?.id, state.queue.length, isPlaying, prefetchWaveIfNeeded])
  
  const prevTrack = useCallback(() => {
    if (state.queue.length === 0 && !state.currentTrack) return
    const queue = state.queue.length > 0 ? state.queue : [state.currentTrack!]
    const currentIndex = queue.findIndex(t => t.id === state.currentTrack?.id)
    
    if (state.progress > 3) {
      setState(s => ({ ...s, progress: 0 }))
      // This will cause the player to seek to 0, which is what we want.
      // The audio element's `onTimeUpdate` will call setProgress, but we can force it here.
      return; 
    }
    
    let prevIndex: number
    if (currentIndex > 0) {
      prevIndex = currentIndex - 1
    } else if (state.repeatMode === 'all') {
      prevIndex = queue.length - 1
    } else {
      setState(s => ({ ...s, progress: 0 }))
      return
    }

    const prev = queue[prevIndex]
    if (prev) setTrack(prev, true, state.currentPlaylist)
  }, [state.queue, state.currentTrack, state.progress, state.repeatMode, state.currentPlaylist, setTrack])
  
  const setVolume = useCallback((v: number) => setState(s => ({...s, volume: Math.max(0, Math.min(100, v)) })), [])
  
  const cycleRepeatMode = useCallback(() => {
    setState(s => {
      let newMode: RepeatMode = 'off'
      if (s.repeatMode === 'off') newMode = 'one'
      if (s.repeatMode === 'one') newMode = 'all'
      return { ...s, repeatMode: newMode }
    })
  }, [])

  const setEqPreset = useCallback((preset: string) => {
    setState(s => ({
      ...s,
      eqPreset: preset,
      eqBands: EQ_PRESETS[preset] ? [...EQ_PRESETS[preset]] : s.eqBands
    }))
  }, [])

  const setEqBand = useCallback((index: number, value: number) => {
    setState(s => {
      const newBands = [...s.eqBands]
      newBands[index] = value
      return { ...s, eqBands: newBands, eqPreset: 'Пользовательский' }
    })
  }, [])

  const refreshLikeStatus = useCallback(() => {
    const trackId = state.currentTrack?.id
    if (!trackId) return
    
    const tokens = getStoredTokens()
    if (!tokens) return
    
    fetch(`/api/likes/check/${trackId}`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` }
    })
      .then(res => res.json())
      .then(data => {
        setState(s => ({ ...s, isLiked: data.liked || false }))
      })
      .catch(() => {})
  }, [state.currentTrack?.id])
  
  const toggleShuffle = useCallback(() => setState(s => ({...s, isShuffled: !s.isShuffled})), [])
  const toggleLike = useCallback(() => {
    const trackId = state.currentTrack?.id
    if (!trackId) return

    const tokens = getStoredTokens()
    if (!tokens) return

    fetch(`/api/likes/${trackId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.accessToken}` }
    })
      .then(res => res.json())
      .then(data => {
        setState(s => ({ ...s, isLiked: data.liked }))
        if (data.unlockedAchievements && data.unlockedAchievements.length > 0) {
          window.dispatchEvent(new CustomEvent('show-achievement', {
            detail: { achievements: data.unlockedAchievements }
          }))
        }
      })
      .catch(err => console.error('Failed to toggle like:', err))
  }, [state.currentTrack?.id, state.isLiked])
  const toggleExpanded = useCallback(() => {
    const tokens = getStoredTokens()
    if (!tokens) return
    setState(s => ({...s, isExpanded: !s.isExpanded}))
  }, [])
  const toggleEQ = useCallback(() => setState(s => ({...s, showEQ: !s.showEQ, showVolume: false })), [])
  const toggleVolumeSlider = useCallback(() => setState(s => ({...s, showVolume: !s.showVolume, showEQ: false })), [])
  const setProgress = useCallback((p: number) => setState(s => ({...s, progress: p})), [])
  const setDuration = useCallback((d: number) => setState(s => ({...s, duration: d})), [])
  const seekTo = useCallback((time: number) => setProgress(time), [setProgress]);
  
  const addToPlaylist = useCallback((playlistId: number) => {
    const trackId = state.currentTrack?.id
    if (!trackId) return
    
    const tokens = getStoredTokens()
    if (!tokens) return
    
    fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.accessToken}` }
    })
      .then(res => {
        if (res.ok) {
          setAddedToPlaylists(prev => [...prev, playlistId])
          window.dispatchEvent(new Event('playlist-updated'))
        }
      })
      .catch(err => console.error('Add to playlist error:', err))
  }, [state.currentTrack?.id])

  const [addedToPlaylists, setAddedToPlaylists] = useState<number[]>([])

  const fetchTrackPlaylists = useCallback(() => {
    const trackId = state.currentTrack?.id
    if (!trackId) return
    
    const tokens = getStoredTokens()
    if (!tokens) return
    
    fetch('/api/playlists', {
      headers: { Authorization: `Bearer ${tokens.accessToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const userPlaylists = data.filter((p: any) => !p.is_system)
          Promise.all(userPlaylists.map((p: any) => 
            fetch(`/api/playlists/${p.id}/has-track/${trackId}`, {
              headers: { Authorization: `Bearer ${tokens.accessToken}` }
            })
              .then(res => res.json())
              .then(result => result.exists ? p.id : -1)
              .catch(() => -1)
          )).then(results => {
            setAddedToPlaylists(results.filter((id: number) => id > 0))
          })
        }
      })
      .catch(() => {})
  }, [state.currentTrack?.id])

  useEffect(() => {
    if (state.currentTrack?.id) {
      fetchTrackPlaylists()
    }
  }, [state.currentTrack?.id, fetchTrackPlaylists])

  const addOrRemoveFromPlaylist = useCallback((playlistId: number) => {
    const trackId = state.currentTrack?.id
    if (!trackId) return
    
    const tokens = getStoredTokens()
    if (!tokens) return
    
    const isInPlaylist = addedToPlaylists.includes(playlistId)
    
    if (isInPlaylist) {
      fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      })
        .then(res => {
          if (res.ok) {
            setAddedToPlaylists(prev => prev.filter(id => id !== playlistId))
            window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Трек удалён из плейлиста', type: 'info' } }))
            window.dispatchEvent(new Event('playlist-updated'))
          }
        })
        .catch(err => console.error('Remove from playlist error:', err))
    } else {
      fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      })
        .then(res => {
          if (res.ok) {
            setAddedToPlaylists(prev => [...prev, playlistId])
            window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Трек добавлен в плейлист', type: 'success' } }))
            window.dispatchEvent(new Event('playlist-updated'))
          }
        })
        .catch(err => console.error('Add to playlist error:', err))
    }
  }, [state.currentTrack?.id, addedToPlaylists])

  const isTrackInPlaylist = useCallback((playlistId: number): boolean => {
    return addedToPlaylists.includes(playlistId)
  }, [addedToPlaylists])

  return (
    <PlayerContext.Provider value={{
      ...state,
      isPlaying,
      playlists,
      isWaveActive: state.currentPlaylist?.mode === 'wave',
      play,
      pause,
      stop,
      togglePlay,
      setTrack,
      setQueue,
      addToQueue,
      nextTrack,
      prevTrack,
      playNext: nextTrack,
      playPrevious: prevTrack,
      setVolume,
      cycleRepeatMode,
      toggleShuffle,
      toggleLike,
      toggleExpanded,
      toggleEQ,
      toggleVolumeSlider,
      setProgress,
      setDuration,
      seekTo,
      addToPlaylist,
      addOrRemoveFromPlaylist,
      setEqPreset,
      setEqBand,
      refreshLikeStatus,
      isTrackInPlaylist,
      startWave,
    }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (!context) throw new Error('usePlayer must be used within PlayerProvider')
  return context
}
