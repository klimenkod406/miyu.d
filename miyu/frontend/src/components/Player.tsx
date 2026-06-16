import { useRef, useEffect } from 'react'
import { usePlayer } from '../hooks/PlayerContext'
import MiniPlayer from './MiniPlayer'
import ExpandedPlayer from './ExpandedPlayer'
import { getStoredTokens } from '../api/auth'
import { setAnalyser } from '../lib/audioAnalyser'
import { useAuth } from '../hooks/AuthContext'

export default function Player() {
  const { isAuthenticated } = useAuth()
  const {
    currentTrack,
    isExpanded,
    isPlaying,
    volume,
    progress,
    duration,
    eqBands,
    setDuration,
    setProgress,
    nextTrack,
  } = usePlayer()

  const audioRef = useRef<HTMLAudioElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const filtersRef = useRef<BiquadFilterNode[]>([])
  const analyserRef = useRef<AnalyserNode | null>(null)
  const playRecordedRef = useRef(false)

  // Record play when track is played for at least 30 seconds or completed
  useEffect(() => {
    if (!currentTrack) return

    console.log('[Player] Track changed:', currentTrack.id)
    playRecordedRef.current = false
  }, [currentTrack?.id])

  // Check if we should record play based on progress
  useEffect(() => {
    if (!currentTrack || playRecordedRef.current || !isPlaying || progress < 30) return

    console.log('[Player] 30 seconds reached, recording play')
    recordPlay(Math.floor(progress), progress >= duration * 0.8)
  }, [progress, currentTrack, isPlaying, duration])

  const recordPlay = async (playDuration: number, completed: boolean) => {
    if (!currentTrack || playRecordedRef.current) return

    playRecordedRef.current = true // Set flag immediately to prevent duplicate calls

    console.log('[Player] Recording play:', { trackId: currentTrack.id, playDuration, completed })

    try {
      const tokens = getStoredTokens()
      if (!tokens?.accessToken) {
        console.log('[Player] No access token, skipping play record')
        return
      }

      const response = await fetch(`/api/track/${currentTrack.id}/play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens.accessToken}`
        },
        body: JSON.stringify({
          duration: playDuration,
          playlistId: null,
          completed
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('[Player] Play recorded successfully')

        // Show achievement notifications
        if (data.unlockedAchievements && data.unlockedAchievements.length > 0) {
          console.log('[Player] Unlocked achievements:', data.unlockedAchievements)
          window.dispatchEvent(new CustomEvent('show-achievement', {
            detail: { achievements: data.unlockedAchievements }
          }))
        }
      } else {
        console.error('[Player] Failed to record play:', response.status)
      }
    } catch (error) {
      console.error('[Player] Failed to record play:', error)
    }
  }

  // Setup Web Audio API context and filters
  useEffect(() => {
    if (!audioContextRef.current) {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = context;

      const freqs = [60, 230, 910, 4000, 14000]; // 5 bands
      const newFilters = freqs.map(freq => {
        const filter = context.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1.41;
        filter.gain.value = 0;
        return filter;
      });
      filtersRef.current = newFilters;

      // Analyser for visualizers; sits between source and EQ filter chain
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.82;
      analyserRef.current = analyser;

      // Chain the filters and connect to destination
      let currentNode: AudioNode = context.destination;
      for (let i = newFilters.length - 1; i >= 0; i--) {
        newFilters[i].connect(currentNode);
        currentNode = newFilters[i];
      }
      analyser.connect(newFilters[0]);
    }
    // ALWAYS re-register analyser on mount (survives HMR module resets)
    if (analyserRef.current) {
      setAnalyser(analyserRef.current);
    }
  }, []);

  // Connect audio element to the audio graph
  useEffect(() => {
    if (audioRef.current && audioContextRef.current && !sourceRef.current && analyserRef.current) {
      sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
      sourceRef.current.connect(analyserRef.current);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (audioRef.current && currentTrack) {
      const filePath = currentTrack.file_path || ''
      const newSrc = filePath.startsWith('http')
        ? filePath
        : filePath.startsWith('/')
          ? filePath
          : `${import.meta.env.VITE_API_URL || ''}/${filePath}`
      if (audioRef.current.src !== newSrc) {
        audioRef.current.src = newSrc
      }
    }
  }, [currentTrack])

  useEffect(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioContextRef.current?.resume();
      audioRef.current.play().catch(e => console.error("Audio play failed", e))
    } else {
      audioRef.current.pause()
    }
  }, [isPlaying, currentTrack])

  useEffect(() => {
    if (audioRef.current && Math.abs(audioRef.current.currentTime - progress) > 1.5) {
      audioRef.current.currentTime = progress;
    }
  }, [progress]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100
    }
  }, [volume])

  useEffect(() => {
    if (filtersRef.current.length > 0) {
      eqBands.forEach((bandValue, index) => {
        if (filtersRef.current[index]) {
          filtersRef.current[index].gain.value = bandValue;
        }
      });
    }
  }, [eqBands]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
      if(isPlaying) {
        audioRef.current.play().catch(e => console.error("Audio play failed", e));
      }
    }
  }

  const handleEnded = () => {
    if (currentTrack && !playRecordedRef.current) {
      recordPlay(Math.floor(duration), true)
    }
    nextTrack()
  }

  if (!currentTrack) return null

  return (
    <>
      <audio
        ref={audioRef}
        crossOrigin="anonymous" preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={(e) => console.error('Audio Error:', e)}
      />
      {isAuthenticated && (isExpanded ? <ExpandedPlayer /> : <MiniPlayer />)}
    </>
  )
}
