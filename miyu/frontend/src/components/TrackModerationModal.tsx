import { useState, useEffect, useRef } from 'react'
import { X, Check, Loader2, Play, Pause, Volume2, VolumeX, AlertTriangle, FileText, History, Sparkles, RefreshCw, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { adminApi } from '../api/admin'
import { aiApi } from '../api/ai'
import { getStoredTokens } from '../api/auth'

const RED_FLAGS = new Set(['hate', 'hate_slur', 'nsfw_cover', 'invalid_audio', 'possible_duplicate'])

const FLAG_LABELS: Record<string, string> = {
  hate: 'Hate-речь',
  hate_slur: 'Оскорбления',
  toxic: 'Токсичность',
  explicit_lyrics: 'Нецензурный текст',
  explicit_heavy: 'Много мата',
  drug_reference: 'Упоминание наркотиков',
  nsfw_cover: 'NSFW-обложка',
  suggestive_cover: 'Сомнительная обложка',
  invalid_audio: 'Битый аудиофайл',
  possible_duplicate: 'Возможный дубликат',
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return 'text-white/40 bg-white/5'
  if (score < 0.2) return 'text-green-400 bg-green-500/15 border-green-500/30'
  if (score < 0.7) return 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30'
  return 'text-red-400 bg-red-500/15 border-red-500/30'
}

function fmt(v: number | null | undefined, suffix = ''): string {
  return v == null ? '—' : `${v.toFixed(2)}${suffix}`
}

function fmtDate(d?: string | null): string {
  if (!d) return ''
  try { return new Date(d).toLocaleString('ru-RU') } catch { return d }
}

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60); const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

interface Props {
  track: any
  onClose: () => void
  onResolved: () => void  // вызывается после approve/reject
}

export default function TrackModerationModal({ track, onClose, onResolved }: Props) {
  const [comment, setComment] = useState('')
  const [processing, setProcessing] = useState<'approve' | 'reject' | null>(null)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [showRejectConfirm, setShowRejectConfirm] = useState(false)
  const [lyricsData, setLyricsData] = useState<{ lyrics_text: string; explicit_words: Array<{ start: number; end: number; word: string }> } | null>(null)

  // audio player
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)

  const score = track.ai_score
  const flags = (track.ai_flags || []) as string[]
  const redFlags = flags.filter(f => RED_FLAGS.has(f))
  const isResolved = track.status === 'approved' || track.status === 'rejected'
  const approvedByLabel = track.approved_by_type === 'moderator'
    ? `Модератор${track.approved_by_username ? `: ${track.approved_by_username}` : ''}`
    : track.status === 'approved'
      ? 'AI'
      : null

  useEffect(() => {
    const tokens = getStoredTokens()
    if (!tokens) return
    adminApi.getTrackHistory(tokens.accessToken, track.id)
      .then(d => setHistory(d.events || []))
      .catch(e => console.error('history failed', e))
    aiApi.getTrackLyrics(tokens.accessToken, track.id)
      .then(d => setLyricsData({ lyrics_text: d.lyrics_text, explicit_words: d.explicit_words || [] }))
      .catch(e => console.error('lyrics failed', e))
  }, [track.id])

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleApprove = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return
    setProcessing('approve')
    try {
      await adminApi.approveTrack(tokens.accessToken, track.id, comment)
      onResolved()
      onClose()
    } catch (e) {
      console.error(e)
      setProcessing(null)
    }
  }

  const handleReject = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return
    if (!comment.trim()) {
      setShowRejectConfirm(true)
      return
    }
    setProcessing('reject')
    try {
      await adminApi.rejectTrack(tokens.accessToken, track.id, comment)
      onResolved()
      onClose()
    } catch (e) {
      console.error(e)
      setProcessing(null)
    }
  }

  const handleReanalyze = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return
    setReanalyzing(true)
    try {
      await aiApi.enqueueAnalyze(tokens.accessToken, track.id)
      setTimeout(() => {
        adminApi.getTrackHistory(tokens.accessToken, track.id)
          .then(d => setHistory(d.events || []))
        onResolved()
      }, 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setReanalyzing(false)
    }
  }

  const togglePlay = () => {
    const a = audioRef.current; if (!a) return
    if (playing) a.pause()
    else a.play().catch(() => {/* */})
  }

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current; if (!a || !a.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    a.currentTime = pct * a.duration
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[calc(100vh-2rem)] bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-white/[0.05] shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-wrap">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-bold">Модерация трека #{track.id}</h2>
              {track.status === 'approved' ? (
                <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">Одобрен</span>
              ) : track.status === 'rejected' ? (
                <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">Отклонён</span>
              ) : track.moderation_status === 'ai_flagged' ? (
                <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">AI flagged</span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-400">На проверке</span>
              )}
              {approvedByLabel && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${track.approved_by_type === 'moderator' ? 'bg-blue-500/15 text-blue-300' : 'bg-purple-500/15 text-purple-300'}`}>
                  Одобрил: {approvedByLabel}
                </span>
              )}
            </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.06] transition shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-5 flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* Top: cover + meta + player */}
          <div className="flex gap-4">
            <div className="w-32 h-32 rounded-xl bg-white/[0.05] flex-shrink-0 overflow-hidden">
              {track.cover_url ? (
                <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20">no cover</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold truncate">{track.title}</h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-white/50">
                <Link to={`/artist/${track.artist_id}`} className="hover:text-white/80 transition flex items-center gap-1">
                  {track.artist_name}
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <span>·</span>
                <span>{fmtDuration(track.duration || 0)}</span>
                {track.genre && <><span>·</span><span>{track.genre}</span></>}
              </div>
              <div className="text-xs text-white/30 mt-1">
                загружено {fmtDate(track.created_at)}
                {track.album_id && track.album_title && (
                  <> · альбом <Link to={`/album/${track.album_id}`} className="hover:text-white/60 underline">{track.album_title}</Link></>
                )}
              </div>

              {/* Audio player */}
              {track.file_path && (
                <div className="mt-3 flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <audio
                    ref={audioRef}
                    src={track.file_path}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                    onTimeUpdate={() => {
                      const a = audioRef.current; if (!a || !a.duration) return
                      setProgress((a.currentTime / a.duration) * 100)
                    }}
                    onLoadedMetadata={() => {
                      const a = audioRef.current; if (a) setDuration(a.duration)
                    }}
                    muted={muted}
                  />
                  <button
                    onClick={togglePlay}
                    className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition"
                  >
                    {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                  <div
                    className="flex-1 h-1.5 bg-white/10 rounded-full cursor-pointer relative"
                    onClick={onSeek}
                  >
                    <div
                      className="h-full bg-purple-400 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/40 font-mono w-16 text-right">
                    {duration ? fmtDuration(duration * progress / 100) : '0:00'} / {duration ? fmtDuration(duration) : '0:00'}
                  </span>
                  <button
                    onClick={() => setMuted(m => !m)}
                    className="p-1.5 rounded hover:bg-white/[0.06] text-white/60 transition"
                  >
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* AI verdict */}
          <div className="rounded-xl border border-white/[0.05] p-4 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/40">
                <Sparkles className="w-3.5 h-3.5" /> AI-вердикт
              </div>
              <button
                onClick={handleReanalyze}
                disabled={reanalyzing}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white transition disabled:opacity-50"
              >
                {reanalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Перезапустить анализ
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className={`px-3 py-1 rounded-full text-sm font-mono border ${scoreColor(score)}`}>
                ai_score: {score != null ? score.toFixed(3) : '—'}
              </span>
              {track.moderation_priority && (
                <span className={`px-3 py-1 rounded-full text-xs ${
                  track.moderation_priority === 'high' ? 'bg-red-500/15 text-red-400' :
                  track.moderation_priority === 'normal' ? 'bg-yellow-500/15 text-yellow-400' :
                  'bg-white/5 text-white/40'
                }`}>
                  priority: {track.moderation_priority}
                </span>
              )}
              {redFlags.length > 0 && (
                <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-red-500/15 text-red-400">
                  <AlertTriangle className="w-3 h-3" />
                  {redFlags.length} red-flag{redFlags.length > 1 ? 's' : ''}
                </span>
              )}
              {track.approved_at && (
                <span className="px-3 py-1 rounded-full text-xs bg-white/[0.04] text-white/50">
                  approved_at: {fmtDate(track.approved_at)}
                </span>
              )}
            </div>

            {flags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {flags.map(f => (
                  <span
                    key={f}
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      RED_FLAGS.has(f)
                        ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                        : 'bg-white/5 text-white/60'
                    }`}
                  >
                    {FLAG_LABELS[f] || f}
                  </span>
                ))}
              </div>
            )}

            {track.analysis_summary && (
              <div className="text-xs text-white/50 italic mb-3">{track.analysis_summary}</div>
            )}

            {/* Audio features */}
            {(track.ai_bpm != null || track.energy != null) && (
              <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs font-mono text-white/60 pt-3 border-t border-white/[0.04]">
                <div>BPM <span className="text-white/40">{fmt(track.ai_bpm)}</span></div>
                <div>Key <span className="text-white/40">{track.ai_key ?? '—'}</span></div>
                <div>Loud <span className="text-white/40">{fmt(track.loudness)} dB</span></div>
                <div>Energy <span className="text-white/40">{fmt(track.energy)}</span></div>
                <div>Valence <span className="text-white/40">{fmt(track.valence)}</span></div>
                <div>Dance <span className="text-white/40">{fmt(track.danceability)}</span></div>
                <div>Acoust <span className="text-white/40">{fmt(track.acousticness)}</span></div>
                <div>Instr <span className="text-white/40">{fmt(track.instrumentalness)}</span></div>
                <div>Speech <span className="text-white/40">{fmt(track.speechiness)}</span></div>
              </div>
            )}

            {/* Mood/Genre */}
            {((track.mood_tags?.length ?? 0) > 0 || (track.genre_tags?.length ?? 0) > 0) && (
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.04] mt-3 text-xs">
                {track.mood_tags?.length > 0 && (
                  <div>
                    <div className="uppercase tracking-wide text-[10px] text-white/40 mb-1">Mood</div>
                    <div className="flex flex-wrap gap-1.5">
                      {track.mood_tags.map((m: string) => (
                        <span key={m} className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300">{m}</span>
                      ))}
                    </div>
                  </div>
                )}
                {track.genre_tags?.length > 0 && (
                  <div>
                    <div className="uppercase tracking-wide text-[10px] text-white/40 mb-1">Genres</div>
                    <div className="flex flex-wrap gap-1.5">
                      {track.genre_tags.slice(0, 6).map((g: any) => (
                        <span key={g.tag} className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300">
                          {g.tag} <span className="text-blue-300/50">{(g.prob * 100).toFixed(0)}%</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lyrics */}
          {(lyricsData?.lyrics_text || track.lyrics_text) && (
            <div className="rounded-xl border border-white/[0.05] p-4 bg-white/[0.02]">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/40 mb-2">
                <FileText className="w-3.5 h-3.5" />
                Распознанный текст {track.lyrics_language && `· ${track.lyrics_language}`}
              </div>
              <div className="max-h-[min(18rem,40vh)] overflow-y-auto p-3 rounded bg-black/30 text-sm text-white/70">
                <LyricsDisplay
                  text={lyricsData?.lyrics_text || track.lyrics_text}
                  explicitWords={lyricsData?.explicit_words || []}
                />
                {lyricsData && lyricsData.explicit_words.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-white/10 text-[10px] text-white/50 text-center">
                    Найдено explicit-слов: <span className="text-yellow-500 font-medium">{lyricsData.explicit_words.length}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="rounded-xl border border-white/[0.05] p-4 bg-white/[0.02]">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/40 mb-3">
                <History className="w-3.5 h-3.5" /> История модерации
              </div>
              <div className="space-y-2 text-xs">
                {history.map((ev, i) => (
                  <div key={i} className="flex items-start gap-3 py-1">
                    <span className="text-white/30 font-mono whitespace-nowrap">{fmtDate(ev.at)}</span>
                    <span className="flex-1">
                      {ev.kind === 'uploaded' && <span className="text-white/60">📤 Загружен артистом</span>}
                      {ev.kind === 'ai_job' && (
                        <span className={ev.status === 'failed' ? 'text-red-400' : 'text-purple-400'}>
                          ✦ AI-анализ: {ev.status}{ev.error ? ` (${ev.error.slice(0, 80)})` : ''}
                        </span>
                      )}
                      {ev.kind === 'ai_decision' && (
                        <span className="text-white/70">
                          🤖 AI-вердикт:{' '}
                          <span className={
                            ev.status === 'ai_flagged' ? 'text-red-400' :
                            ev.status === 'approved' ? 'text-green-400' : 'text-yellow-400'
                          }>{ev.status}</span>
                          {ev.ai_score != null && <span className="font-mono ml-1">score={ev.ai_score.toFixed(2)}</span>}
                          {ev.ai_flags?.length > 0 && <span className="ml-1">[{ev.ai_flags.join(', ')}]</span>}
                        </span>
                      )}
                      {ev.kind === 'moderator_decision' && (
                        <span className={ev.status === 'approved' ? 'text-green-400' : 'text-red-400'}>
                          {ev.status === 'approved' ? '✓' : '✗'} @{ev.reviewer_name || `user#${ev.reviewer_id}`}: {ev.status}
                          {ev.comment && <span className="text-white/50"> «{ev.comment}»</span>}
                        </span>
                      )}
                      {ev.kind === 'current_state' && (
                        <span className="text-white/40">Текущее состояние: {ev.status}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer: comment + actions */}
        <div className="border-t border-white/[0.05] p-4 sm:p-5 space-y-3 bg-black/30 shrink-0">
          <div>
            <label className="text-xs text-white/50 mb-1 block">
              Комментарий модератора {showRejectConfirm && <span className="text-red-400">(обязателен для отклонения)</span>}
            </label>
            <textarea
              value={comment}
              onChange={e => { setComment(e.target.value); if (showRejectConfirm) setShowRejectConfirm(false) }}
              placeholder="Например: «Текст содержит оскорбления группы лиц по национальному признаку»"
              rows={2}
              className={`w-full px-3 py-2 rounded-lg bg-white/[0.03] border text-sm placeholder-white/20 focus:outline-none transition ${
                showRejectConfirm ? 'border-red-500/40 focus:border-red-500/60' : 'border-white/[0.08] focus:border-white/15'
              }`}
            />
            <p className="text-[10px] text-white/30 mt-1">
              При отклонении комментарий уйдёт артисту в уведомлении.
            </p>
          </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm bg-white/[0.04] hover:bg-white/[0.08] text-white/60 transition"
              >
                Закрыть
              </button>
              {!isResolved && (
                <>
                  <button
                    onClick={handleReject}
                    disabled={!!processing}
                    className="px-4 py-2 rounded-lg text-sm bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {processing === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    Отклонить
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={!!processing}
                    className="px-4 py-2 rounded-lg text-sm bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {processing === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Одобрить
                  </button>
                </>
              )}
            </div>
          </div>
      </div>
    </div>
  )
}

/** Отображает lyrics с разбивкой по предложениям и подсветкой explicit-слов */
function LyricsDisplay({ 
  text, 
  explicitWords 
}: { 
  text: string; 
  explicitWords: Array<{ start: number; end: number; word: string }>;
}) {
  if (!text) return null

  // Разбиваем: сначала по \n, иначе по предложениям
  let lines: string[]
  if (text.includes('\n')) {
    lines = text.split('\n').filter(s => s.trim().length > 0)
  } else {
    const m = text.match(/[^.!?]+[.!?]+/g)
    lines = m && m.length > 1 ? m : [text]
    lines = lines.map(s => s.trim()).filter(s => s.length > 0)
  }

  // Вычисляем offset каждой строки
  let currentOffset = 0
  const lineInfo = lines.map((line) => {
    const idx = text.indexOf(line, currentOffset)
    const start = idx >= 0 ? idx : currentOffset
    const info = { text: line, start, end: start + line.length }
    currentOffset = info.end + 1
    return info
  })

  return (
    <div className="space-y-3">
      {lineInfo.map((line, idx) => (
        <p key={idx} className="block text-center leading-relaxed m-0">
          <LyricsLine 
            text={line.text} 
            lineStartOffset={line.start} 
            explicitWords={explicitWords} 
          />
        </p>
      ))}
    </div>
  )
}

function LyricsLine({ 
  text, 
  lineStartOffset, 
  explicitWords 
}: { 
  text: string; 
  lineStartOffset: number; 
  explicitWords: Array<{ start: number; end: number; word: string }>;
}) {
  const lineEnd = lineStartOffset + text.length
  const marks = explicitWords.filter(w => w.start >= lineStartOffset && w.end <= lineEnd)
  if (!marks.length) return <>{text}</>

  const sorted = [...marks].sort((a, b) => a.start - b.start)
  type Part = { text: string; category?: string }
  const parts: Part[] = []
  let lastEnd = 0
  for (const mark of sorted) {
    const localStart = mark.start - lineStartOffset
    const localEnd = mark.end - lineStartOffset
    if (localStart > lastEnd) parts.push({ text: text.slice(lastEnd, localStart) })
    parts.push({ text: text.slice(localStart, localEnd), category: (mark as any).category || 'severe' })
    lastEnd = localEnd
  }
  if (lastEnd < text.length) parts.push({ text: text.slice(lastEnd) })

  return (
    <>
      {parts.map((part, idx) => (
        <span 
          key={idx} 
          className={part.category ? categoryClass(part.category) : ''}
          title={part.category ? `Категория: ${part.category}` : undefined}
        >
          {part.text}
        </span>
      ))}
    </>
  )
}

function categoryClass(category: string): string {
  switch (category) {
    case 'slur':
      return 'underline decoration-red-500 decoration-2 text-red-400 font-bold'
    case 'severe':
      return 'underline decoration-yellow-400 decoration-2 text-yellow-300 font-medium'
    case 'moderate':
      return 'underline decoration-orange-400 decoration-2 text-orange-300'
    case 'mild':
      return 'underline decoration-blue-400/60 decoration-1 text-blue-300/80'
    case 'drug':
      return 'underline decoration-green-500 decoration-2 text-green-400 font-medium'
    default:
      return 'underline decoration-yellow-400 decoration-2 text-yellow-300'
  }
}
