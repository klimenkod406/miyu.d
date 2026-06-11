import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle, FileAudio, Loader2, RefreshCw, Upload, X } from 'lucide-react'
import { adminApi, type AdminBatchUploadResult, type AdminBatchUploadResponse } from '../api/admin'
import { authApi, getStoredTokens } from '../api/auth'
import { formatDuration, getAudioDuration, normalizeArtistName, parseMp3TrackFilename } from '../lib/batchUpload'

interface ArtistOption {
  id: number
  username: string
}

type UploadItemStatus = 'invalid' | 'unknown_artist' | 'ready' | 'uploading' | 'imported' | 'duplicate' | 'failed'

interface UploadItem {
  id: string
  file: File
  filename: string
  artistName: string
  title: string
  duration: number | null
  artistId: number | null
  status: UploadItemStatus
  error?: string
  result?: AdminBatchUploadResult
}

function showToast(message: string, type: 'success' | 'info' | 'error' = 'info') {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }))
}

function statusLabel(item: UploadItem) {
  switch (item.status) {
    case 'ready': return 'Готов'
    case 'unknown_artist': return 'Нужен артист'
    case 'invalid': return 'Ошибка'
    case 'uploading': return 'Загрузка'
    case 'imported': return 'Загружен'
    case 'duplicate': return 'Дубль'
    case 'failed': return 'Не загружен'
    default: return item.status
  }
}

const DURATION_SCAN_CONCURRENCY = 4
const UPLOAD_CHUNK_SIZE = 10

function mergeBatchResponses(responses: AdminBatchUploadResponse[]): AdminBatchUploadResponse {
  return responses.reduce<AdminBatchUploadResponse>((acc, response) => ({
    summary: {
      received: acc.summary.received + response.summary.received,
      imported: acc.summary.imported + response.summary.imported,
      duplicates: acc.summary.duplicates + response.summary.duplicates,
      failed: acc.summary.failed + response.summary.failed,
      aiQueued: acc.summary.aiQueued + response.summary.aiQueued,
    },
    results: [...acc.results, ...response.results],
  }), {
    summary: { received: 0, imported: 0, duplicates: 0, failed: 0, aiQueued: 0 },
    results: [],
  })
}

function buildBatchFormData(batchItems: UploadItem[]): FormData {
  const formData = new FormData()
  batchItems.forEach(item => formData.append('tracks', item.file, item.filename))
  formData.append('manifest', JSON.stringify({
    items: batchItems.map(item => ({
      fileName: item.filename,
      artistName: item.artistName,
      title: item.title,
      duration: item.duration || 0,
      artistId: item.artistId,
    })),
  }))
  return formData
}

export default function AdminBatchUploadPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [artists, setArtists] = useState<ArtistOption[]>([])
  const [items, setItems] = useState<UploadItem[]>([])
  const [loadingArtists, setLoadingArtists] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [response, setResponse] = useState<AdminBatchUploadResponse | null>(null)

  useEffect(() => {
    const loadArtists = async () => {
      const tokens = getStoredTokens()
      if (!tokens) {
        setError('Вы не авторизованы')
        setLoadingArtists(false)
        return
      }

      try {
        const data = await authApi.getArtists(tokens.accessToken)
        setArtists(data.map((artist: any) => ({ id: artist.id, username: artist.username })))
      } catch (err: any) {
        setError(err.message || 'Не удалось загрузить артистов')
      } finally {
        setLoadingArtists(false)
      }
    }

    loadArtists()
  }, [])

  const artistMap = useMemo(() => {
    const map = new Map<string, ArtistOption>()
    artists.forEach(artist => map.set(normalizeArtistName(artist.username), artist))
    return map
  }, [artists])

  const addFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    setResponse(null)

    const nextItems: UploadItem[] = files.map((file, idx) => {
      const parsed = parseMp3TrackFilename(file.name)
      if (!parsed.ok) {
        return {
          id: `${Date.now()}-${idx}`,
          file,
          filename: file.name,
          artistName: '',
          title: '',
          duration: null,
          artistId: null,
          status: 'invalid',
          error: parsed.errorMessage,
        }
      }

      const matchedArtist = artistMap.get(normalizeArtistName(parsed.artistName))
      return {
        id: `${Date.now()}-${idx}`,
        file,
        filename: file.name,
        artistName: matchedArtist?.username || parsed.artistName,
        title: parsed.title,
        duration: null,
        artistId: matchedArtist?.id || null,
        status: matchedArtist ? 'ready' : 'unknown_artist',
        error: matchedArtist ? undefined : 'Артист не найден. Выберите вручную или создайте артиста заранее.',
      }
    })

    setItems(prev => [...prev, ...nextItems])

    for (let index = 0; index < nextItems.length; index += DURATION_SCAN_CONCURRENCY) {
      const batch = nextItems.slice(index, index + DURATION_SCAN_CONCURRENCY)
      await Promise.all(batch.map(async item => {
        const duration = await getAudioDuration(item.file)
        setItems(prev => prev.map(current => current.id === item.id ? { ...current, duration } : current))
      }))
    }
  }

  const updateArtist = (itemId: string, artistId: number) => {
    const artist = artists.find(entry => entry.id === artistId)
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      if (item.status === 'invalid') return item
      return {
        ...item,
        artistId: artist?.id || null,
        artistName: artist?.username || item.artistName,
        status: artist ? 'ready' : 'unknown_artist',
        error: artist ? undefined : 'Выберите артиста',
      }
    }))
  }

  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId))
  }

  const readyToUpload = items.length > 0 && items.every(item => item.status === 'ready' && item.artistId)

  const handleUpload = async () => {
    const tokens = getStoredTokens()
    if (!tokens) {
      setError('Вы не авторизованы')
      return
    }

    if (!readyToUpload) {
      setError('Исправьте ошибки в списке перед загрузкой')
      return
    }

    setUploading(true)
    setError('')
    setResponse(null)
    setItems(prev => prev.map(item => ({ ...item, status: 'uploading' })))

    try {
      const responses: AdminBatchUploadResponse[] = []

      for (let index = 0; index < items.length; index += UPLOAD_CHUNK_SIZE) {
        const batchItems = items.slice(index, index + UPLOAD_CHUNK_SIZE)
        const result = await adminApi.uploadTrackBatch(tokens.accessToken, buildBatchFormData(batchItems))
        responses.push(result)

        setItems(prev => prev.map(item => {
          const batchIndex = batchItems.findIndex(batchItem => batchItem.id === item.id)
          if (batchIndex === -1) return item

          const backendResult = result.results[batchIndex]
          if (!backendResult) return { ...item, status: 'failed', error: 'Backend не вернул результат для файла' }
          const nextStatus: UploadItemStatus = backendResult.status === 'imported'
            ? 'imported'
            : backendResult.status === 'duplicate'
              ? 'duplicate'
              : 'failed'
          return {
            ...item,
            status: nextStatus,
            result: backendResult,
            error: backendResult.error,
          }
        }))
      }

      const result = mergeBatchResponses(responses)
      setResponse(result)
      showToast(`Импортировано: ${result.summary.imported}, ошибок: ${result.summary.failed}`, result.summary.failed ? 'info' : 'success')
    } catch (err: any) {
      setError(err.message || 'Ошибка массовой загрузки')
      setItems(prev => prev.map(item => ({ ...item, status: item.artistId ? 'ready' : 'unknown_artist' })))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-2">Массовая загрузка MP3</h1>
          <p className="text-white/40">Файлы должны называться строго: Artist - Track.mp3</p>
        </div>
        <Link to="/admin/content" className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-sm transition">
          Перейти в модерацию
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          if (!uploading) addFiles(event.dataTransfer.files)
        }}
        className="rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] p-8 text-center"
      >
        <FileAudio className="w-12 h-12 mx-auto mb-4 text-purple-300" />
        <h2 className="text-lg font-semibold mb-2">Выберите или перетащите MP3-файлы</h2>
        <p className="text-white/40 text-sm mb-5">Артист должен уже существовать в системе и совпадать с левой частью имени файла.</p>
        <input
          ref={inputRef}
          type="file"
          accept="audio/mpeg,.mp3"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files)
            event.currentTarget.value = ''
          }}
        />
        <button
          type="button"
          disabled={uploading || loadingArtists}
          onClick={() => inputRef.current?.click()}
          className="px-5 py-2.5 rounded-full bg-purple-500 hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition"
        >
          {loadingArtists ? 'Загрузка артистов...' : 'Выбрать файлы'}
        </button>
      </div>

      {items.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Предпросмотр импорта</h2>
              <p className="text-sm text-white/40">Файлов: {items.length}</p>
            </div>
            <button
              type="button"
              disabled={!readyToUpload || uploading}
              onClick={handleUpload}
              className="px-4 py-2 rounded-xl bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition flex items-center gap-2"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Загрузить и отправить на AI
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-white/40 bg-black/20">
                <tr>
                  <th className="text-left p-3">Файл</th>
                  <th className="text-left p-3">Исполнитель</th>
                  <th className="text-left p-3">Трек</th>
                  <th className="text-left p-3">Длительность</th>
                  <th className="text-left p-3">Статус</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-t border-white/[0.06]">
                    <td className="p-3 min-w-[220px]">
                      <p className="font-medium">{item.filename}</p>
                      {item.result?.trackId && <p className="text-xs text-white/40">track #{item.result.trackId}</p>}
                    </td>
                    <td className="p-3 min-w-[220px]">
                      {item.status === 'invalid' ? (
                        <span className="text-white/30">—</span>
                      ) : (
                        <select
                          value={item.artistId || ''}
                          onChange={(event) => updateArtist(item.id, Number(event.target.value))}
                          disabled={uploading || item.status === 'imported'}
                          className="w-full px-3 py-2 rounded-lg bg-[#111] border border-white/10 text-white outline-none focus:border-purple-500"
                        >
                          <option value="">Выбрать артиста</option>
                          {artists.map(artist => (
                            <option key={artist.id} value={artist.id}>{artist.username}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="p-3 min-w-[180px]">{item.title || <span className="text-white/30">—</span>}</td>
                    <td className="p-3">{formatDuration(item.duration)}</td>
                    <td className="p-3 min-w-[180px]">
                      <div className="flex items-center gap-2">
                        {item.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-purple-300" />}
                        {item.status === 'imported' && <CheckCircle className="w-4 h-4 text-green-400" />}
                        {item.status === 'failed' || item.status === 'invalid' || item.status === 'unknown_artist' ? <AlertCircle className="w-4 h-4 text-red-400" /> : null}
                        <span>{statusLabel(item)}</span>
                      </div>
                      {item.error && <p className="text-xs text-red-300 mt-1">{item.error}</p>}
                      {item.result?.aiQueued && <p className="text-xs text-purple-300 mt-1">AI-анализ поставлен в очередь</p>}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => removeItem(item.id)}
                        className="w-8 h-8 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-300 disabled:opacity-30 transition"
                      >
                        <X className="w-4 h-4 mx-auto" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {response && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center gap-3 mb-4">
            <RefreshCw className="w-5 h-5 text-purple-300" />
            <h2 className="font-semibold">Итог загрузки</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div className="p-3 rounded-xl bg-white/[0.03]"><p className="text-white/40">Получено</p><p className="text-xl font-bold">{response.summary.received}</p></div>
            <div className="p-3 rounded-xl bg-white/[0.03]"><p className="text-white/40">Создано</p><p className="text-xl font-bold text-green-300">{response.summary.imported}</p></div>
            <div className="p-3 rounded-xl bg-white/[0.03]"><p className="text-white/40">Дубли</p><p className="text-xl font-bold text-yellow-300">{response.summary.duplicates}</p></div>
            <div className="p-3 rounded-xl bg-white/[0.03]"><p className="text-white/40">Ошибки</p><p className="text-xl font-bold text-red-300">{response.summary.failed}</p></div>
            <div className="p-3 rounded-xl bg-white/[0.03]"><p className="text-white/40">AI queue</p><p className="text-xl font-bold text-purple-300">{response.summary.aiQueued}</p></div>
          </div>
        </div>
      )}
    </div>
  )
}
