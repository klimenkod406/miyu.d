
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, Clock, Ticket, Search, Mic, X, Loader } from 'lucide-react';
import { concertsApi } from '../api/concerts';
import ConcertCover from '../components/ConcertCover';
import Button from '../components/Button'
import FilterPills from '../components/FilterPills'

interface Concert {
  id: number;
  title: string;
  artists: { id: number; name: string }[];
  date: string;
  time: string;
  venue: string;
  city: string;
  genre: string;
  priceFrom: number;
  status: 'available' | 'soon' | 'soldout';
  image?: string;
  cover_url?: string | null;
  tickets?: { id: number; name: string; price: number; available: number }[];
}

const genres = ['Все', 'Рок', 'Поп', 'Электроника', 'Хип-хоп', 'Джаз', 'Классика'];
const cities = ['Москва', 'Санкт-Петербург', 'Екатеринбург', 'Казань', 'Сочи'];
const priceRanges = [
  { label: 'Все', min: 0, max: Infinity },
  { label: 'Бесплатно', min: 0, max: 0 },
  { label: 'До 1000 ₽', min: 1, max: 1000 },
  { label: 'До 5000 ₽', min: 1001, max: 5000 },
];
const genreFilterOptions = [
  { id: 'Рок', label: 'Рок' },
  { id: 'Поп', label: 'Поп' },
  { id: 'Электроника', label: 'Электроника' },
  { id: 'Хип-хоп', label: 'Хип-хоп' },
  { id: 'Джаз', label: 'Джаз' },
];
const priceFilterOptions = [
  { id: '0', label: 'Все' },
  { id: '1', label: 'Бесплатно' },
  { id: '2', label: 'до 1000₽' },
  { id: '3', label: 'до 5000₽' },
];
const dateFilterOptions = [
  { id: 'all', label: 'Все' },
  { id: 'today', label: 'Сегодня' },
  { id: 'tomorrow', label: 'Завтра' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
];

function formatConcertTime(time: string | undefined | null): string {
  if (!time) return '';
  // Handle "HH:MM:SS" or "HH:MM" format — strip seconds
  const match = time.match(/^(\d{1,2}:\d{2})/);
  return match ? match[1] : time;
}

function formatConcertDate(date: string | undefined | null): string {
  if (!date) return '';
  // Remove trailing " г." from Russian locale date formatting
  return date.replace(/\s*г\.\s*$/, '');
}

function BannerSlider({ banners, isLoading }: { banners: Concert[], isLoading: boolean }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (banners.length === 0) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length]);

  if (isLoading) {
    return <div className="relative mb-10 rounded-2xl overflow-hidden aspect-[16/7] min-h-[320px] bg-white/[0.02] animate-pulse"></div>;
  }
  
  if (banners.length === 0) return null;

  const currentBanner = banners[current];
  const hasTickets = currentBanner.tickets && currentBanner.tickets.length > 0;

  return (
    <div className="relative mb-10 rounded-2xl overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.4 }}
          className="relative aspect-[16/7] min-h-[320px]"
        >
          <ConcertCover src={currentBanner.cover_url} alt={currentBanner.title} iconSize={96} />
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/80 via-primary-900/60 to-pink-900/80 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="relative h-full flex items-center">
            <div className="px-8 md:px-12 py-8 max-w-xl">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <span className="inline-block px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium rounded-full mb-4">HOT</span>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 text-white">{currentBanner.title}</h1>
                {(currentBanner.date || currentBanner.time) && (
                  <div className="flex flex-wrap items-center gap-3 text-white/70 mb-2">
                    {currentBanner.date && (
                      <span className="flex items-center gap-1.5"><Calendar size={16} />{currentBanner.date}</span>
                    )}
                    {currentBanner.time && (
                      <span className="flex items-center gap-1.5"><Clock size={16} />{currentBanner.time}</span>
                    )}
                  </div>
                )}
                {(currentBanner.venue || currentBanner.city) && (
                  <div className="flex items-center gap-1.5 text-white/70 mb-4">
                    <MapPin size={16} />{currentBanner.venue}{currentBanner.venue && currentBanner.city && ', '}{currentBanner.city}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mb-6">
                  {currentBanner.artists?.map((artist) => (
                    <Link key={artist.id} to={`/artist/${artist.id}`} className="px-3 py-1 bg-white/10 rounded-full text-sm text-white/80 hover:bg-white/20 transition">
                      {artist.name}
                    </Link>
                  ))}
                </div>
                <div className="flex items-center gap-4">
                <Button as="link" to={`/concert/${currentBanner.id}`} variant="primary">
                    {!hasTickets
                      ? '\u041a\u0443\u043f\u0438\u0442\u044c \u0431\u0438\u043b\u0435\u0442\u044b'
                      : currentBanner.priceFrom === 0
                        ? '\u0411\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u043e'
                        : `\u041a\u0443\u043f\u0438\u0442\u044c \u043e\u0442 ${currentBanner.priceFrom.toLocaleString('ru-RU')} \u20bd`}
                  </Button>
                  {currentBanner.status === 'soldout' && <span className="px-4 py-2 bg-red-500/20 text-red-400 rounded-full text-sm">Распродано</span>}
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {banners.map((_, i) => (
          <button key={i} onClick={() => setCurrent(i)} className={`h-2 rounded-full transition-all ${i === current ? 'w-8 bg-white' : 'w-2 bg-white/40'}`} />
        ))}
      </div>
    </div>
  );
}

function ConcertCard({ concert }: { concert: Concert }) {
  return (
    <Link
      to={`/concert/${concert.id}`}
      className="group block"
    >
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition duration-200">
        <ConcertCover
          src={concert.cover_url}
          alt={concert.title}
          imgClassName="group-hover:scale-105 transition duration-300"
          iconSize={64}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition flex items-end justify-end p-3">
          <button className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <Ticket className="w-5 h-5" />
          </button>
        </div>
        {concert.status === 'soldout' && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-red-500/80 text-white text-xs rounded">
            Распродано
          </div>
        )}
        {concert.status === 'soon' && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-yellow-500/80 text-white text-xs rounded">
            Скоро
          </div>
        )}
      </div>
      <h3 className="font-medium text-sm truncate group-hover:text-purple-400 transition">
        {concert.title}
      </h3>
      <div className="flex items-center gap-1.5 text-xs text-white/40 mb-1">
        <Calendar size={12} />
        {formatConcertDate(concert.date)}
        {concert.time && <span className="ml-1">• {formatConcertTime(concert.time)}</span>}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-white/40 mb-1">
        <MapPin size={12} />
        {concert.venue}, {concert.city}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">
          {concert.priceFrom === 0 ? (
            <span className="text-green-400">Бесплатно</span>
          ) : (
            <span>от {concert.priceFrom.toLocaleString('ru-RU')} ₽</span>
          )}
        </span>
        {concert.status === 'available' && (
          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
            Купить
          </span>
        )}
      </div>
    </Link>
  )
}

function ConcertList({ concerts, title }: { concerts: Concert[]; title?: string }) {
  return (
    <section className="mb-10">
      {title && <h2 className="text-xl font-bold mb-6">{title}</h2>}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {concerts.map((concert) => (
          <ConcertCard key={concert.id} concert={concert} />
        ))}
      </div>
    </section>
  )
}

export default function ConcertsPage() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [bannerConcerts, setBannerConcerts] = useState<Concert[]>([]);
  const [allConcerts, setAllConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedGenre, setSelectedGenre] = useState('Все');
  const [selectedCity, setSelectedCity] = useState('Все');
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [selectedDate, setSelectedDate] = useState('all');
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  useEffect(() => {
    const fetchConcerts = async () => {
      try {
        setLoading(true);
        const [banners, all] = await Promise.all([
          concertsApi.getBanner(),
          concertsApi.getAll()
        ]);
        
        const processConcertData = (c: any): Concert => ({
            ...c,
            tickets: c.tickets || [],
            priceFrom: Array.isArray(c.tickets) && c.tickets.length > 0 ? Math.min(...c.tickets.map((t:any) => t.price)) : 0
        });

        setBannerConcerts(banners.map(processConcertData));
        setAllConcerts(all.map(processConcertData));

      } catch (err: any) {
        setError(err.message || 'Не удалось загрузить концерты.');
      } finally {
        setLoading(false);
      }
    };
    fetchConcerts();
  }, []);

  const filteredConcerts = allConcerts.filter((concert) => {
    if (searchQuery && !concert.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !concert.venue.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    if (selectedGenre !== 'Все' && concert.genre !== selectedGenre) {
      return false
    }
    if (selectedCity !== 'Все' && concert.city !== selectedCity) {
      return false
    }
    if (selectedPrice > 0) {
      const range = priceRanges[selectedPrice]
      if (concert.priceFrom < range.min || concert.priceFrom > range.max) {
        return false
      }
    }
    return true
  });

  const freeConcerts = allConcerts.filter((c) => c.priceFrom === 0);
  const popularConcerts = allConcerts.slice(0, 5);

  if (error) {
    return <div className="text-center py-20 text-red-400">Ошибка: {error}</div>;
  }

  return (
    <div>
      <BannerSlider banners={bannerConcerts} isLoading={loading} />
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20} />
            <input
              type="text"
              placeholder="Поиск концертов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-xl focus:outline-none focus:border-white/20 text-white placeholder-white/30 transition"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowCityDropdown(!showCityDropdown)}
              className="flex items-center gap-2 px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-xl hover:border-white/10 transition min-w-[180px]"
            >
              <MapPin size={18} className="text-white/40" />
              {selectedCity}
            </button>
            {showCityDropdown && (
              <div className="absolute top-full mt-2 left-0 w-48 bg-dark-800 border border-white/10 rounded-xl overflow-hidden z-20">
                {cities.map((city) => (
                  <button
                    key={city}
                    onClick={() => {
                      setSelectedCity(city)
                      setShowCityDropdown(false)
                    }}
                    className={`w-full px-4 py-2 text-left hover:bg-white/5 transition ${
                      selectedCity === city ? 'text-purple-400' : 'text-white/70'
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterPills
            name="date"
            options={dateFilterOptions}
            selected={selectedDate}
            onChange={(id) => setSelectedDate(id)}
          />

          <FilterPills
            name="genre"
            options={genreFilterOptions}
            selected={selectedGenre}
            onChange={(id) => setSelectedGenre(id)}
          />

          <FilterPills
            name="price"
            options={priceFilterOptions}
            selected={selectedPrice.toString()}
            onChange={(id) => setSelectedPrice(parseInt(id))}
          />

          {(searchQuery || selectedGenre !== 'Все' || selectedCity !== 'Все' || selectedPrice > 0) && (
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedGenre('Все')
                setSelectedCity('Все')
                setSelectedPrice(0)
                setSelectedDate('all')
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-white/40 hover:text-white transition"
            >
              <X size={16} />
              Сбросить
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center items-center py-20">
            <Loader className="w-12 h-12 text-white animate-spin" />
        </div>
      ) : (
        <>
          {filteredConcerts.length > 0 ? (
            <ConcertList concerts={filteredConcerts} title="Концерты" />
          ) : (
            <div className="text-center py-16">
              <Ticket className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">Концерты не найдены</h3>
              <p className="text-white/40">Попробуйте изменить параметры поиска</p>
            </div>
          )}
          {searchQuery === '' && selectedGenre === 'Все' && selectedCity === 'Все' && selectedPrice === 0 && (
            <>
              <ConcertList concerts={freeConcerts} title="Бесплатные концерты" />
              <ConcertList concerts={popularConcerts} title="Популярные концерты" />
            </>
          )}
        </>
      )}
    </div>
  );
}
