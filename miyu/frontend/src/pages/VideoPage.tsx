import { Link, useParams } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { Music, Share2, Play, Pause, Volume2, VolumeX, Maximize, Settings, Loader2 } from 'lucide-react'

interface VideoData {
  id: number
  title: string
  description: string | null
  duration: number
  file_path: string
  thumbnail_url: string | null
  artist_id: number
  artist_name: string
  track_id: number | null
  track_title: string | null
  album_id: number | null
  album_title: string | null
  views_count: number
  status: string
  created_at: string
}

export default function VideoPage() {
  const { id } = useParams()
  const [video, setVideo] = useState<VideoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(80)
  const [showControls, setShowControls] = useState(true)
  const [quality, setQuality] = useState('1080p')
  const [showQualityMenu, setShowQualityMenu] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const videoRef = useRef<HTMLDivElement>(null)
  const videoElementRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        const res = await fetch(`/api/videos/${id}`)
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Видео не найдено')
        }
        const data = await res.json()
        setVideo(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchVideo()
  }, [id])

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    if (isPlaying && showControls) {
      timeout = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
    return () => clearTimeout(timeout)
  }, [isPlaying, showControls])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatViews = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toString()
  }

  const currentTime = video ? (progress / 100) * video.duration : 0

  const handleFullscreen = () => {
    if (!videoRef.current) return
    if (!document.fullscreenElement) {
      videoRef.current.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  const togglePlay = () => {
    if (videoElementRef.current) {
      if (isPlaying) {
        videoElementRef.current.pause()
      } else {
        videoElementRef.current.play()
      }
    }
    setIsPlaying(!isPlaying)
  }

  const handleTimeUpdate = () => {
    const el = videoElementRef.current
    if (el && el.duration) {
      setProgress((el.currentTime / el.duration) * 100)
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = videoElementRef.current
    if (!el || !el.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = ((e.clientX - rect.left) / rect.width) * 100
    el.currentTime = (percent / 100) * el.duration
    setProgress(percent)
  }

  const toggleMute = () => setIsMuted(!isMuted)
  const qualities = ['2160p', '1080p', '720p', '480p', '360p']

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  if (error || !video) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400">{error || 'Видео не найдено'}</p>
        <Link to="/" className="text-purple-400 hover:text-purple-300 mt-4 inline-block">
          На главную
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div 
        ref={videoRef}
        className="relative aspect-video rounded-2xl overflow-hidden bg-black group"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        <video
          ref={videoElementRef}
          src={video.file_path}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
        />

        {!isPlaying && !videoElementRef.current?.currentTime && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/30 via-dark-900 to-pink-900/30">
            {video.thumbnail_url ? (
              <img src={video.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
            ) : null}
            <button
              onClick={togglePlay}
              className="w-24 h-24 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-4xl hover:scale-110 transition shadow-2xl z-10"
            >
              <Play size={40} className="text-white ml-2" />
            </button>
          </div>
        )}

        <div 
          className={`absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/60 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setShowControls(!showControls)}
        >
          <div className="absolute top-0 left-0 right-0 p-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{video.title}</h1>
              <Link
                to={`/artist/${video.artist_id}`}
                className="text-sm text-white/60 hover:text-purple-400 transition"
              >
                {video.artist_name}
              </Link>
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button
              onClick={(e) => {
                e.stopPropagation()
                togglePlay()
              }}
              className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-white/20 transition transform hover:scale-110 pointer-events-auto"
            >
              {isPlaying ? (
                <Pause size={40} className="text-white" />
              ) : (
                <Play size={40} className="text-white ml-2" />
              )}
            </button>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6 space-y-4">
            <div 
              className="flex items-center gap-4 cursor-pointer"
              onClick={handleSeek}
            >
              <span className="text-xs text-white/70 w-12 font-medium">{formatTime(currentTime)}</span>
              <div className="flex-1 h-1.5 bg-white/20 rounded-full">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full relative"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-white/70 w-12 text-right font-medium">{formatTime(video.duration)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePlay()
                  }}
                  className="p-2 rounded-full hover:bg-white/10 transition"
                >
                  {isPlaying ? (
                    <Pause size={24} className="text-white" />
                  ) : (
                    <Play size={24} className="text-white ml-1" />
                  )}
                </button>

                <div className="flex items-center gap-3 group/volume">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleMute()
                    }}
                    className="p-2 rounded-full hover:bg-white/10 transition"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX size={20} className="text-white" />
                    ) : (
                      <Volume2 size={20} className="text-white" />
                    )}
                  </button>
                </div>

                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowQualityMenu(!showQualityMenu)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition text-sm text-white border border-white/10"
                  >
                    <Settings size={14} />
                    <span className="font-medium">{quality}</span>
                  </button>
                  {showQualityMenu && (
                    <div className="absolute bottom-full mb-2 right-0 p-1.5 bg-black/95 backdrop-blur-xl rounded-lg shadow-2xl border border-white/10 min-w-[110px]">
                      {qualities.map((q) => (
                        <button
                          key={q}
                          onClick={(e) => {
                            e.stopPropagation()
                            setQuality(q)
                            setShowQualityMenu(false)
                          }}
                          className={`block w-full text-left px-3 py-1.5 text-xs rounded-md transition ${
                            quality === q 
                              ? 'text-white bg-purple-500/30 border border-purple-500/30' 
                              : 'text-white/60 hover:bg-white/10'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleFullscreen()
                  }}
                  className="p-2 rounded-full hover:bg-white/10 transition"
                >
                  <Maximize size={20} className="text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start justify-between mt-8">
        <div>
          <div className="flex items-center gap-4 text-sm text-white/40 mb-3">
            <span>{formatViews(video.views_count)} просмотров</span>
            <span>•</span>
            <span>{new Date(video.created_at).toLocaleDateString('ru-RU')}</span>
          </div>
          {video.description && (
            <p className="text-white/60">{video.description}</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsLiked(!isLiked)}
            className={`px-5 py-2.5 rounded-full font-medium transition flex items-center gap-2 ${
              isLiked
                ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                : 'bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/10'
            }`}
          >
            ♥
          </button>
          <button className="px-5 py-2.5 rounded-full font-medium bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/10 transition flex items-center gap-2">
            <Share2 size={18} />
            Поделиться
          </button>
        </div>
      </div>

      {video.track_id && video.track_title && (
        <div className="mt-8 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition">
          <p className="text-sm text-white/40 mb-3">К треку:</p>
          <Link
            to={`/track/${video.track_id}`}
            className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.05] transition group"
          >
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-white/[0.05] flex items-center justify-center flex-shrink-0 overflow-hidden">
              {video.thumbnail_url ? (
                <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Music className="w-6 h-6 text-purple-400" />
              )}
            </div>
            <div>
              <p className="font-medium group-hover:text-purple-400 transition">{video.track_title}</p>
              <p className="text-sm text-white/40">{video.artist_name}</p>
            </div>
          </Link>
        </div>
      )}
    </div>
  )
}
