import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Music, Mic, Disc, ListMusic, Play, Ticket, Calendar, MapPin, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'
import { searchApi, SearchResults } from '../api/search'

type TabType = 'all' | 'tracks' | 'artists' | 'albums' | 'playlists' | 'concerts'

const tabs: { key: TabType; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'tracks', label: 'Треки' },
  { key: 'artists', label: 'Артисты' },
  { key: 'albums', label: 'Альбомы' },
  { key: 'concerts', label: 'Концерты' },
  { key: 'playlists', label: 'Плейлисты' },
]

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const query = searchParams.get('q') || ''
  const genre = searchParams.get('genre') || ''
  const { accessToken } = useAuth()

  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [[page, direction], setPage] = useState([0, 0])
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tabIndex = tabs.findIndex((t) => t.key === activeTab)

  // Calculate which tabs have results
  const availableTabs = results ? tabs.filter(tab => {
    if (tab.key === 'all') return true
    const count = results[tab.key as keyof Omit<SearchResults, 'all'>]?.length || 0
    return count > 0
  }) : tabs

  // If current tab is not available, switch to 'all'
  useEffect(() => {
    if (query && results && !availableTabs.find(t => t.key === activeTab)) {
      setActiveTab('all')
    }
  }, [availableTabs, activeTab, query, results])

  useEffect(() => {
    const fetchResults = async () => {
      if (!accessToken) {
        return
      }

      setLoading(true)
      setError(null)

      try {
        const data = await searchApi.search(accessToken, query, activeTab, genre)
        setResults(data)
      } catch (err) {
        console.error('Search error:', err)
        setError('Ошибка при поиске')
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [query, genre, activeTab, accessToken])

  const paginate = (newTab: TabType) => {
    const newTabIndex = tabs.findIndex((t) => t.key === newTab)
    const oldTabIndex = tabs.findIndex((t) => t.key === activeTab)
    setPage([newTabIndex, newTabIndex > oldTabIndex ? 1 : -1])
    setActiveTab(newTab)
  }

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 50 : -50,
      opacity: 0,
    }),
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const hasAnyResults = results && (
    results.tracks.length > 0 ||
    results.artists.length > 0 ||
    results.albums.length > 0 ||
    results.playlists.length > 0 ||
    results.concerts.length > 0
  )

  return (
    <div>
      <div className="mb-6 max-[414px]:mb-4">
        <h1 className="text-2xl font-bold max-[414px]:text-xl">
          {genre ? `Жанр: ${genre}` : query ? `Результаты поиска: "${query}"` : 'Поиск'}
        </h1>
        {genre && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm text-white/70">
            Треки с жанром
            <span className="font-semibold text-white">{genre}</span>
          </div>
        )}
      </div>

      {/* Show tabs only if there's a query and results */}
      {(query || genre) && hasAnyResults && (
        <div className="mb-6 flex flex-wrap gap-2 max-[414px]:mb-4 max-[414px]:gap-1.5">
          {availableTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => paginate(tab.key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition duration-200 max-[414px]:px-3 max-[414px]:py-1.5 max-[414px]:text-xs ${
                  activeTab === tab.key
                    ? 'glass-accent text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && results && (
        <div className="mt-6 relative overflow-hidden">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={page}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: 'spring', stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
              }}
              className="w-full"
            >
              {(() => {
                const Tracks = results.tracks.length > 0 ? (
                  <motion.section key="tracks" className="mb-8">
                    <h2 className="text-lg font-medium mb-4">{query ? 'Треки' : 'Популярные треки'}</h2>
                    <div className="space-y-2">
                      {results.tracks.map((track, i) => (
                        <Link key={track.id} to={`/track/${track.id}`} className="group flex items-center gap-4 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 transition duration-200 hover:border-white/10 hover:bg-white/[0.06] max-[414px]:gap-2.5 max-[414px]:p-2.5">
                          <span className="w-8 text-center text-white/30 max-[414px]:hidden">{i + 1}</span>
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.05] max-[414px]:h-11 max-[414px]:w-11">
                            {track.cover_url ? (
                              <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover" />
                            ) : (
                              <Music className="w-5 h-5 text-white/40" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate group-hover:text-purple-400 transition">{track.title}</p>
                            <p className="text-sm text-white/40 truncate">
                              {track.artist.username}{track.genre ? ` • ${track.genre}` : ''}
                            </p>
                          </div>
                          <span className="text-sm text-white/30 max-[414px]:hidden">{track.album?.title || ''}</span>
                          <span className="text-sm text-white/30 max-[414px]:text-xs">{formatDuration(track.duration)}</span>
                        </Link>
                      ))}
                    </div>
                  </motion.section>
                ) : null

                const Artists = results.artists.length > 0 ? (
                  <motion.section key="artists" className="mb-8">
                    <h2 className="text-lg font-medium mb-4">{query ? 'Артисты' : 'Популярные артисты'}</h2>
                    <div className="grid grid-cols-2 gap-4 max-[414px]:gap-3 md:grid-cols-4 lg:grid-cols-6">
                      {results.artists.map((artist) => (
                        <Link key={artist.id} to={`/artist/${artist.id}`} className="group text-center">
                          <div className="w-full aspect-square rounded-full bg-white/[0.02] border border-white/[0.05] hover:border-white/10 mb-3 flex items-center justify-center overflow-hidden transition duration-200">
                            {artist.avatar_url ? (
                              <img src={artist.avatar_url} alt={artist.name} className="w-full h-full object-cover" />
                            ) : (
                              <Mic size={30} className="text-white/30" />
                            )}
                          </div>
                          <p className="font-medium group-hover:text-purple-400 transition truncate">{artist.name}</p>
                          <p className="text-sm text-white/40">{artist.track_count} треков</p>
                        </Link>
                      ))}
                    </div>
                  </motion.section>
                ) : null

                const Albums = results.albums.length > 0 ? (
                  <motion.section key="albums" className="mb-8">
                    <h2 className="text-lg font-medium mb-4">{query ? 'Альбомы' : 'Новые альбомы'}</h2>
                    <div className="grid grid-cols-2 gap-4 max-[414px]:gap-3 md:grid-cols-4 lg:grid-cols-6">
                      {results.albums.map((album) => (
                        <Link key={album.id} to={`/album/${album.id}`} className="group">
                          <div className="aspect-square rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 mb-3 flex items-center justify-center overflow-hidden transition duration-200 relative">
                            {album.cover_url ? (
                              <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover" />
                            ) : (
                              <Disc size={36} className="text-white/30" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition flex items-end justify-end p-2">
                              <button className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                                <Play className="w-4 h-4 ml-0.5" />
                              </button>
                            </div>
                          </div>
                          <p className="font-medium truncate group-hover:text-purple-400 transition">{album.title}</p>
                          <p className="text-sm text-white/40 truncate">{album.artist.username} • {album.release_year}</p>
                        </Link>
                      ))}
                    </div>
                  </motion.section>
                ) : null

                const Concerts = results.concerts.length > 0 ? (
                  <motion.section key="concerts" className="mb-8">
                    <h2 className="text-lg font-medium mb-4">{query ? 'Концерты' : 'Предстоящие концерты'}</h2>
                    <div className="space-y-3">
                      {results.concerts.map((concert) => (
                        <Link key={concert.id} to={`/concert/${concert.id}`} className="group flex items-center gap-4 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 transition duration-200 hover:border-white/10 hover:bg-white/[0.06] max-[414px]:items-start max-[414px]:gap-3 max-[414px]:p-3">
                          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 max-[414px]:h-12 max-[414px]:w-12">
                            {concert.cover_url ? (
                              <img src={concert.cover_url} alt={concert.title} className="w-full h-full object-cover" />
                            ) : (
                              <Ticket className="w-6 h-6 text-purple-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate group-hover:text-purple-400 transition">{concert.title}</p>
                            <div className="flex items-center gap-3 text-sm text-white/40 max-[414px]:flex-col max-[414px]:items-start max-[414px]:gap-1 max-[414px]:text-xs">
                              <span className="flex items-center gap-1">
                                <Calendar size={14} />
                                {formatDate(concert.event_date)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin size={14} />
                                {concert.venue}, {concert.city}
                              </span>
                            </div>
                          </div>
                          <div className="text-right max-[414px]:ml-auto max-[414px]:pt-0.5">
                            <p className="font-medium">
                              {concert.price === 0 ? 'Бесплатно' : `от ${concert.price} ₽`}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </motion.section>
                ) : null

                const Playlists = results.playlists.length > 0 ? (
                  <motion.section key="playlists">
                    <h2 className="text-lg font-medium mb-4">{query ? 'Плейлисты' : 'Публичные плейлисты'}</h2>
                    <div className="grid grid-cols-2 gap-4 max-[414px]:gap-3 md:grid-cols-4 lg:grid-cols-6">
                      {results.playlists.map((playlist) => (
                        <Link key={playlist.id} to={`/playlist/${playlist.id}`} className="group">
                          <div className="aspect-square rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 mb-3 flex items-center justify-center overflow-hidden relative transition duration-200">
                            {playlist.cover_url ? (
                              <img src={playlist.cover_url} alt={playlist.title} className="w-full h-full object-cover" />
                            ) : (
                              <ListMusic size={36} className="text-white/30" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition flex items-end justify-end p-2">
                              <button className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                                <Play className="w-4 h-4 ml-0.5" />
                              </button>
                            </div>
                          </div>
                          <p className="font-medium truncate group-hover:text-purple-400 transition">{playlist.title}</p>
                          <p className="text-sm text-white/40">{playlist.track_count} треков</p>
                        </Link>
                      ))}
                    </div>
                  </motion.section>
                ) : null

                // For specific tab views
                if (activeTab !== 'all') {
                  switch (activeTab) {
                    case 'tracks':
                      return Tracks || <div className="text-center py-12 text-white/40">Треки не найдены</div>
                    case 'artists':
                      return Artists || <div className="text-center py-12 text-white/40">Артисты не найдены</div>
                    case 'albums':
                      return Albums || <div className="text-center py-12 text-white/40">Альбомы не найдены</div>
                    case 'concerts':
                      return Concerts || <div className="text-center py-12 text-white/40">Концерты не найдены</div>
                    case 'playlists':
                      return Playlists || <div className="text-center py-12 text-white/40">Плейлисты не найдены</div>
                  }
                }

                // For 'all' tab
                return (
                  <>
                    {Tracks}
                    {Artists}
                    {Albums}
                    {Concerts}
                    {Playlists}
                    {!hasAnyResults && (query || genre) && (
                      <div className="text-center py-12 text-white/40">
                        {genre ? `В жанре ${genre} пока нет треков` : 'Ничего не найдено'}
                      </div>
                    )}
                    {!hasAnyResults && !query && !genre && (
                      <div className="text-center py-12 text-white/40">
                        Начните вводить запрос для поиска
                      </div>
                    )}
                  </>
                )
              })()}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
