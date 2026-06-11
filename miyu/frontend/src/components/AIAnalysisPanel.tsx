import { useState, useEffect } from 'react'
import { Sparkles, AlertTriangle, ChevronDown, ChevronUp, Loader2, RefreshCw, FileText } from 'lucide-react'
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

interface Track {
  id: number
  ai_score?: number | null
  ai_flags?: string[] | null
  mood_tags?: string[] | null
  genre_tags?: Array<{ tag: string; prob: number }> | null
  ai_bpm?: number | null
  ai_key?: string | null
  danceability?: number | null
  energy?: number | null
  valence?: number | null
  acousticness?: number | null
  instrumentalness?: number | null
  speechiness?: number | null
  loudness?: number | null
  lyrics_text?: string | null
  lyrics_language?: string | null
  analysis_summary?: string | null
  analysis_version?: string | null
  fingerprint?: string | null
  moderation_priority?: string | null
  moderation_status?: string | null
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return 'text-white/40 bg-white/5'
  if (score < 0.2) return 'text-green-400 bg-green-500/10'
  if (score < 0.7) return 'text-yellow-400 bg-yellow-500/10'
  return 'text-red-400 bg-red-500/10'
}

function scoreLabel(score: number | null | undefined): string {
  if (score == null) return 'нет данных'
  if (score < 0.2) return 'чисто'
  if (score < 0.7) return 'спорно'
  return 'риск'
}

function fmt(v: number | null | undefined): string {
  return v == null ? '—' : v.toFixed(2)
}

interface LyricsData {
  lyrics_text: string
  lyrics_language: string | null
  explicit_words: Array<{ start: number; end: number; word: string }>
  segments: Array<{ start: number; end: number; text: string }>
}

export default function AIAnalysisPanel({ track, onReanalyzed }: { track: Track; onReanalyzed?: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [showLyrics, setShowLyrics] = useState(false)
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null)
  const [lyricsLoading, setLyricsLoading] = useState(false)

  const score = track.ai_score
  const flags = (track.ai_flags || []) as string[]
  const hasAnalysis = score != null || flags.length > 0 || track.analysis_version != null
  const redFlags = flags.filter(f => RED_FLAGS.has(f))

  const handleReanalyze = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return
    setReanalyzing(true)
    try {
      await aiApi.enqueueAnalyze(tokens.accessToken, track.id)
      // Перезагрузка списка через колбэк (обычно через 5-30 секунд анализ закончится).
      onReanalyzed?.()
    } catch (e) {
      console.error('Reanalyze failed', e)
    } finally {
      setReanalyzing(false)
    }
  }

  // Загружаем lyrics с explicit marks при открытии
  useEffect(() => {
    if (showLyrics && !lyricsData) {
      const loadLyrics = async () => {
        const tokens = getStoredTokens()
        if (!tokens) return
        setLyricsLoading(true)
        try {
          const data = await aiApi.getTrackLyrics(tokens.accessToken, track.id)
          setLyricsData({
            lyrics_text: data.lyrics_text,
            lyrics_language: data.lyrics_language,
            explicit_words: data.explicit_words || [],
            segments: data.segments || []
          })
        } catch (e) {
          console.error('Failed to load lyrics', e)
          // Fallback на простой текст из track
          setLyricsData({
            lyrics_text: track.lyrics_text || '',
            lyrics_language: track.lyrics_language || null,
            explicit_words: [],
            segments: []
          })
        } finally {
          setLyricsLoading(false)
        }
      }
      loadLyrics()
    }
  }, [showLyrics, track.id, track.lyrics_text])

  return (
    <div className="mt-3 rounded-lg border border-white/[0.05] bg-white/[0.02]">
      {/* Заголовок-сводка */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full p-3 flex items-center gap-2 hover:bg-white/[0.02] transition rounded-lg"
      >
        <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
        <span className="text-xs font-medium text-white/70">AI-анализ</span>

        {hasAnalysis ? (
          <>
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${scoreColor(score)}`}>
              {score != null ? score.toFixed(2) : '—'} · {scoreLabel(score)}
            </span>

            {redFlags.length > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400">
                <AlertTriangle className="w-3 h-3" />
                {redFlags.length} red-flag{redFlags.length > 1 ? 's' : ''}
              </span>
            )}

            {flags.filter(f => !RED_FLAGS.has(f)).slice(0, 3).map(f => (
              <span key={f} className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/50">
                {FLAG_LABELS[f] || f}
              </span>
            ))}
          </>
        ) : (
          <span className="text-xs text-white/40 italic">не проанализирован</span>
        )}

        <span className="ml-auto flex items-center gap-1 text-white/40">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-3 text-xs">
          {/* Сводка */}
          {track.analysis_summary && (
            <div className="text-white/60 italic">{track.analysis_summary}</div>
          )}

          {/* Все флаги */}
          {flags.length > 0 && (
            <div>
              <div className="text-white/40 uppercase tracking-wide mb-1.5 text-[10px]">Флаги</div>
              <div className="flex flex-wrap gap-1.5">
                {flags.map(f => (
                  <span
                    key={f}
                    className={`px-2 py-0.5 rounded-full ${
                      RED_FLAGS.has(f)
                        ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                        : 'bg-white/5 text-white/60'
                    }`}
                  >
                    {FLAG_LABELS[f] || f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Mood / genre tags */}
          {(track.mood_tags?.length || track.genre_tags?.length) && (
            <div className="grid grid-cols-2 gap-3">
              {track.mood_tags && track.mood_tags.length > 0 && (
                <div>
                  <div className="text-white/40 uppercase tracking-wide mb-1.5 text-[10px]">Mood</div>
                  <div className="flex flex-wrap gap-1.5">
                    {track.mood_tags.map(m => (
                      <span key={m} className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {track.genre_tags && track.genre_tags.length > 0 && (
                <div>
                  <div className="text-white/40 uppercase tracking-wide mb-1.5 text-[10px]">Genres</div>
                  <div className="flex flex-wrap gap-1.5">
                    {track.genre_tags.slice(0, 6).map(g => (
                      <span key={g.tag} className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300">
                        {g.tag}
                        <span className="text-blue-300/50 ml-1">{(g.prob * 100).toFixed(0)}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Audio features */}
          {hasAnalysis && (
            <div>
              <div className="text-white/40 uppercase tracking-wide mb-1.5 text-[10px]">Аудио-признаки</div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-1 font-mono text-white/70">
                <div>BPM <span className="text-white/40">{fmt(track.ai_bpm as any) }</span></div>
                <div>Key <span className="text-white/40">{track.ai_key ?? '—'}</span></div>
                <div>Loud <span className="text-white/40">{fmt(track.loudness)} dB</span></div>
                <div>Energy <span className="text-white/40">{fmt(track.energy)}</span></div>
                <div>Valence <span className="text-white/40">{fmt(track.valence)}</span></div>
                <div>Dance <span className="text-white/40">{fmt(track.danceability)}</span></div>
                <div>Acoust <span className="text-white/40">{fmt(track.acousticness)}</span></div>
                <div>Instr <span className="text-white/40">{fmt(track.instrumentalness)}</span></div>
                <div>Speech <span className="text-white/40">{fmt(track.speechiness)}</span></div>
              </div>
            </div>
          )}

          {/* Lyrics */}
          {(track.lyrics_text || hasAnalysis) && (
            <div>
              <button
                onClick={() => setShowLyrics(v => !v)}
                className="flex items-center gap-1.5 text-white/60 hover:text-white/80 transition"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="uppercase tracking-wide text-[10px]">
                  Распознанный текст
                  {track.lyrics_language && ` · ${track.lyrics_language}`}
                  {lyricsData && lyricsData.explicit_words.length > 0 && (
                    <span className="ml-1 text-yellow-500">⚠ {lyricsData.explicit_words.length} explicit</span>
                  )}
                </span>
                {showLyrics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showLyrics && (
                <div className="mt-2 max-h-[60vh] overflow-y-auto p-3 rounded bg-black/30 text-sm text-white/80">
                  {lyricsLoading ? (
                    <div className="flex items-center gap-2 text-white/50">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Загрузка...</span>
                    </div>
                  ) : lyricsData ? (
                    <LyricsView data={lyricsData} />
                  ) : track.lyrics_text ? (
                    <SimpleLyricsView text={track.lyrics_text} />
                  ) : (
                    <div className="text-white/50">Нет текста</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer: meta + reanalyze */}
          <div className="flex items-center justify-between pt-1 border-t border-white/[0.05] text-[10px] text-white/30">
            <div>
              {track.analysis_version && <span>v{track.analysis_version}</span>}
              {track.fingerprint && (
                <span className="ml-2">fp:{track.fingerprint.slice(0, 12)}…</span>
              )}
              {track.moderation_priority && (
                <span className={`ml-2 ${
                  track.moderation_priority === 'high' ? 'text-red-400' :
                  track.moderation_priority === 'normal' ? 'text-yellow-400' : 'text-white/40'
                }`}>
                  prio:{track.moderation_priority}
                </span>
              )}
            </div>
            <button
              onClick={handleReanalyze}
              disabled={reanalyzing}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/[0.05] text-white/50 hover:text-white/80 transition disabled:opacity-50"
            >
              {reanalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Перезапустить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Компонент для отображения lyrics с подчеркнутыми explicit-словами */
function LyricsView({ data }: { data: LyricsData }) {
  const { lyrics_text, explicit_words, segments } = data

  // Если есть сегменты от Whisper — показываем по куплетам с таймкодами
  if (segments && segments.length > 0) {
    return (
      <div className="space-y-4">
        {segments.map((seg, idx) => (
          <div key={idx}>
            <div className="text-[10px] text-white/40 mb-1">
              {formatTime(seg.start)} – {formatTime(seg.end)}
            </div>
            <HighlightedLines 
              text={seg.text} 
              explicitWords={explicit_words}
              baseOffset={getSegmentOffset(lyrics_text, seg.text, idx, segments)}
            />
          </div>
        ))}
        {explicit_words.length > 0 && (
          <div className="pt-2 border-t border-white/10 text-[10px] text-white/50">
            Найдено explicit-слов: <span className="text-yellow-500 font-medium">{explicit_words.length}</span>
          </div>
        )}
      </div>
    )
  }

  // Fallback: разбиваем по предложениям, каждое на новой строке
  return (
    <div>
      <HighlightedLines text={lyrics_text} explicitWords={explicit_words} baseOffset={0} />
      {explicit_words.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-white/50">
          Найдено explicit-слов: <span className="text-yellow-500 font-medium">{explicit_words.length}</span>
        </div>
      )}
    </div>
  )
}

/** Разбивает текст на строки по \n или предложениям и подчеркивает explicit-слова */
function HighlightedLines({ 
  text, 
  explicitWords, 
  baseOffset 
}: { 
  text: string; 
  explicitWords: Array<{ start: number; end: number; word: string }>;
  baseOffset: number;
}) {
  if (!text) return null

  // Разбиваем: сначала по \n, иначе по предложениям
  let lines: string[]
  if (text.includes('\n')) {
    lines = text.split('\n')
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
      {lineInfo.map((line, lineIdx) => (
        <p key={lineIdx} className="block text-center leading-relaxed m-0">
          <InlineHighlight 
            text={line.text} 
            lineStartOffset={baseOffset + line.start}
            explicitWords={explicitWords}
          />
        </p>
      ))}
    </div>
  )
}

/** Inline подсветка explicit-слов в одной строке */
function InlineHighlight({ 
  text, 
  lineStartOffset, 
  explicitWords 
}: { 
  text: string; 
  lineStartOffset: number;
  explicitWords: Array<{ start: number; end: number; word: string }>;
}) {
  const lineEndOffset = lineStartOffset + text.length
  const marksOnLine = explicitWords.filter(
    w => w.start >= lineStartOffset && w.end <= lineEndOffset
  )

  if (!marksOnLine.length) {
    return <>{text}</>
  }

  const sorted = [...marksOnLine].sort((a, b) => a.start - b.start)
  const parts: Array<{ text: string; isExplicit: boolean }> = []
  let lastEnd = 0

  for (const mark of sorted) {
    const localStart = mark.start - lineStartOffset
    const localEnd = mark.end - lineStartOffset

    if (localStart > lastEnd) {
      parts.push({ text: text.slice(lastEnd, localStart), isExplicit: false })
    }
    parts.push({ text: text.slice(localStart, localEnd), isExplicit: true })
    lastEnd = localEnd
  }

  if (lastEnd < text.length) {
    parts.push({ text: text.slice(lastEnd), isExplicit: false })
  }

  return (
    <>
      {parts.map((part, idx) => (
        <span 
          key={idx} 
          className={part.isExplicit ? 'underline decoration-yellow-400 decoration-2 text-yellow-300 font-medium' : ''}
        >
          {part.text}
        </span>
      ))}
    </>
  )
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/** Простое отображение lyrics с разбивкой по предложениям (без explicit-подсветки) */
function SimpleLyricsView({ text }: { text: string }) {
  // Разбиваем: сначала по \n, иначе по предложениям
  let lines: string[]
  if (text.includes('\n')) {
    lines = text.split('\n')
  } else {
    const m = text.match(/[^.!?]+[.!?]+/g)
    lines = m && m.length > 1 ? m : [text]
    lines = lines.map(s => s.trim()).filter(s => s.length > 0)
  }

  return (
    <div className="space-y-3">
      {lines.map((line, idx) => (
        <p key={idx} className="block text-center leading-relaxed m-0">
          {line}
        </p>
      ))}
    </div>
  )
}

/** Вычисляет смещение сегмента в полном тексте (приблизительно) */
function getSegmentOffset(
  fullText: string, 
  segmentText: string, 
  segmentIndex: number, 
  segments: Array<{ text: string }>
): number {
  let offset = 0
  for (let i = 0; i < segmentIndex; i++) {
    offset += segments[i].text.length + 1
  }
  return offset
}
