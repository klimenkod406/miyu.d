export function getPresenceTitle(presence) {
  if (!presence?.isOnline) return 'Не в сети'
  if (!presence.listeningTo) return 'Сейчас ничего не слушает'
  return presence.listeningTo.track?.title || 'Неизвестный трек'
}

export function getPresenceSubtitle(presence) {
  if (!presence?.isOnline) return 'Был недавно'
  if (!presence.listeningTo) return 'Онлайн'

  const artist = presence.listeningTo.track?.artist?.username || 'Неизвестный артист'
  const context = presence.listeningTo.context
  if (!context?.title) return artist
  if (context.type === 'album') return `${artist} • Из альбома: ${context.title}`
  if (context.type === 'playlist') return `${artist} • Из плейлиста: ${context.title}`
  return `${artist} • ${context.title}`
}
