import { usePlayer } from '../hooks/PlayerContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Square, Heart, Music, Waves } from 'lucide-react'
import { memo } from 'react'
import { useAuth } from '../hooks/AuthContext'
import { ExplicitBadge } from '../components/ExplicitBadge'

const MemoizedMiniPlayerContent = memo(function MiniPlayerContent() {
  const { currentTrack, isPlaying, togglePlay, stop, toggleExpanded, progress, duration, isLiked, toggleLike, isWaveActive } = usePlayer()
  const { isAuthenticated } = useAuth()
  const isGuestRadio = !isAuthenticated

  const coverPath = currentTrack?.cover_url || currentTrack?.album?.cover_url
  const coverUrl = coverPath ? coverPath : undefined

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0
  const clampedProgressPercent = Math.min(100, Math.max(0, progressPercent))

  return (
    <motion.div
      onClick={isAuthenticated ? toggleExpanded : undefined}
      className={`fixed bottom-4 right-4 z-50 w-72 overflow-hidden rounded-2xl p-3 shadow-lg glass max-[414px]:bottom-[4.75rem] max-[414px]:left-3 max-[414px]:right-3 max-[414px]:w-auto max-[414px]:p-2.5 max-[375px]:left-2.5 max-[375px]:right-2.5 ${isAuthenticated ? 'cursor-pointer' : 'cursor-default'}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <AnimatePresence>
        {coverUrl && (
          <motion.img
            key={coverUrl}
            src={coverUrl}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 w-full h-full object-cover filter blur-xl scale-110"
            style={{
              clipPath: `inset(0 ${100 - clampedProgressPercent}% 0 0)`
            }}
          />
        )}
      </AnimatePresence>

      {!coverUrl && clampedProgressPercent > 0 && (
        <motion.div
          className="absolute inset-y-0 left-0 bg-white/20"
          initial={false}
          animate={{ width: `${clampedProgressPercent}%` }}
          transition={{ duration: 0.25, ease: 'linear' }}
        />
      )}

      <div className="relative flex items-center gap-3 max-[414px]:gap-2.5">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10 text-xl shadow-inner max-[414px]:h-10 max-[414px]:w-10">
          {coverUrl ? (
            <img loading="lazy" src={coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Music className="w-6 h-6 text-white/60" />
          )}
        </div>

        <div className="min-w-0 flex-1 pr-1 max-[414px]:pr-0">
          <p className="truncate text-sm font-medium text-white max-[414px]:text-[13px]">
            <span className="inline-flex items-center gap-1">{currentTrack?.title || 'Трек не выбран'}<ExplicitBadge is_explicit={currentTrack?.is_explicit} size="xs" /></span>
          </p>
          <div className="flex items-center gap-2 min-w-0">
            <p className="truncate text-xs text-gray-400 max-[414px]:text-[11px]">
              {currentTrack?.artist?.username || 'Артист'}
            </p>
            {isWaveActive && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
                <Waves className="h-3 w-3" />
                Волна Miyu
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1 max-[414px]:gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (isGuestRadio && isPlaying) {
                stop()
                return
              }
              togglePlay()
            }}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/90 text-gray-900 transition hover:scale-105 max-[414px]:h-8 max-[414px]:w-8"
          >
            {isPlaying ? (
              isGuestRadio ? <Square className="w-4 h-4 fill-current" /> : <Square className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </button>

          {isAuthenticated && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleLike()
              }}
              className="w-8 h-8 flex items-center justify-center transition flex-shrink-0"
            >
              <Heart className={`w-5 h-5 max-[414px]:h-4 max-[414px]:w-4 ${isLiked ? 'fill-white text-white' : 'text-gray-500 hover:text-white'}`} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
})

export default function MiniPlayer() {
  const { currentTrack } = usePlayer()
  if (!currentTrack) return null
  return <MemoizedMiniPlayerContent />
}
