import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Film, Play, Pause, VolumeX, Volume1, Volume2, Music, Maximize, Minimize, X } from 'lucide-react'

interface VideoPlayerProps {
  title: string
  artist: string
  thumbnail?: string
  trackId?: number
  onClose?: () => void
}

export default function VideoPlayer({
  title,
  artist,
  thumbnail,
  trackId,
  onClose,
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [volume, setVolume] = useState(80)
  const [progress, setProgress] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const controlsTimeout = useRef<ReturnType<typeof setTimeout>>()

  const handleMouseMove = () => {
    setShowControls(true)
    clearTimeout(controlsTimeout.current)
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) setShowControls(false)
    }, 3000)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 bg-black flex items-center justify-center ${
        isFullscreen ? '' : 'bg-black/90'
      }`}
      onMouseMove={handleMouseMove}
      onClick={() => isPlaying && setShowControls(!showControls)}
    >
      {/* Video element (placeholder) */}
      <div
        className={`relative ${isFullscreen ? 'w-full h-full' : 'w-full max-w-4xl aspect-video bg-dark-900'}`}
        onClick={() => setIsPlaying(!isPlaying)}
      >
        {thumbnail || !isPlaying ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-64 h-36 bg-dark-800 rounded-lg mb-4 flex items-center justify-center">
                <Film size={60} className="text-dark-600" />
              </div>
              <p className="text-xl font-medium">{title}</p>
              <p className="text-dark-400">{artist}</p>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 bg-dark-800 flex items-center justify-center">
            <button className="w-20 h-20 bg-primary-500 rounded-full flex items-center justify-center hover:scale-105 transition">
              <Play size={40} className="text-white ml-1" />
            </button>
          </div>
        )}

        {/* Controls */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Progress bar */}
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full h-1 accent-primary-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black"
              >
                {isPlaying ? <Pause /> : <Play />}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setVolume(volume > 0 ? 0 : 80)}
                  className="text-white"
                >
                  {volume === 0 ? <VolumeX /> : volume < 50 ? <Volume1 /> : <Volume2 />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-20 h-1 accent-white"
                />
              </div>

              <span className="text-white text-sm">0:00 / 4:20</span>
            </div>

            <div className="flex items-center gap-4">
              {trackId && (
                <Link
                  to={`/track/${trackId}`}
                  className="text-white text-sm hover:text-primary-400 flex items-center gap-1"
                >
                  <Music size={16} /> К треку
                </Link>
              )}
              <button
                onClick={toggleFullscreen}
                className="text-white hover:text-primary-400"
              >
                {isFullscreen ? <Minimize /> : <Maximize />}
              </button>
              <button
                onClick={onClose}
                className="text-white hover:text-primary-400"
              >
                <X />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}