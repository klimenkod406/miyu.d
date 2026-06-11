export type ParsedMp3TrackFilename =
  | {
      ok: true
      artistName: string
      title: string
      extension: '.mp3'
    }
  | {
      ok: false
      errorCode: 'UNSUPPORTED_TYPE' | 'INVALID_FILENAME'
      errorMessage: string
    }

export function parseMp3TrackFilename(fileName: string): ParsedMp3TrackFilename {
  const trimmed = fileName.trim()
  if (!trimmed.toLowerCase().endsWith('.mp3')) {
    return {
      ok: false,
      errorCode: 'UNSUPPORTED_TYPE',
      errorMessage: 'Поддерживаются только MP3-файлы',
    }
  }

  const baseName = trimmed.slice(0, -4).trim()
  const separator = baseName.indexOf(' - ')
  if (separator === -1) {
    return {
      ok: false,
      errorCode: 'INVALID_FILENAME',
      errorMessage: 'Имя файла должно быть в формате Artist - Track.mp3',
    }
  }

  const artistName = baseName.slice(0, separator).trim()
  const title = baseName.slice(separator + 3).trim()

  if (!artistName || !title) {
    return {
      ok: false,
      errorCode: 'INVALID_FILENAME',
      errorMessage: 'Исполнитель и название трека не должны быть пустыми',
    }
  }

  return { ok: true, artistName, title, extension: '.mp3' }
}

export function normalizeArtistName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function getAudioDuration(file: File, timeoutMs = 5000): Promise<number | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const audio = new Audio(objectUrl)
    let settled = false

    const finish = (duration: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      audio.removeAttribute('src')
      audio.load()
      URL.revokeObjectURL(objectUrl)
      resolve(duration)
    }

    const timeout = window.setTimeout(() => finish(null), timeoutMs)

    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? Math.round(audio.duration) : null
      finish(duration)
    }

    audio.onerror = () => finish(null)
    audio.src = objectUrl
  })
}

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
