export function selectNextTrackIndex({ queueLength, currentIndex, repeatMode, isShuffled, random = Math.random }) {
  if (queueLength <= 0 || currentIndex < 0) return null
  if (repeatMode === 'one') return currentIndex
  if (isShuffled) {
    if (queueLength === 1) return 0
    const candidates = Array.from({ length: queueLength }, (_, index) => index).filter(index => index !== currentIndex)
    return candidates[Math.floor(random() * candidates.length)]
  }
  if (currentIndex < queueLength - 1) return currentIndex + 1
  if (repeatMode === 'all') return 0
  return null
}
