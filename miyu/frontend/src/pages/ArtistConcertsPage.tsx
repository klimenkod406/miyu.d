
import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Clock, Plus, Settings, ChartBar, Mic, Loader2 } from 'lucide-react';
import { concertsApi } from '../api/concerts';
import { useAuth } from '../hooks/AuthContext';

interface Concert {
  id: number;
  title: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  cover_url?: string | null;
  status: 'upcoming' | 'completed' | 'cancelled' | 'pending' | 'rejected' | 'available' | 'soldout';
  ticketsSold: number;
  revenue: number;
}

interface ConcertStats {
    totalConcerts: number;
    totalUpcoming: number;
    totalTicketsSold: number;
    totalRevenue: number;
    avgTickets: number;
    bestConcertTickets: number;
}

type ViewType = 'upcoming' | 'past';

export default function ArtistConcertsPage() {
  const [view, setView] = useState<ViewType>('upcoming');
  const [upcomingConcerts, setUpcomingConcerts] = useState<Concert[]>([]);
  const [pastConcerts, setPastConcerts] = useState<Concert[]>([]);
  const [stats, setStats] = useState<ConcertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) {
        setError("Требуется авторизация");
        setLoading(false);
        return;
    };

    const fetchArtistConcerts = async () => {
      try {
        setLoading(true);
        const data = await concertsApi.getArtistConcerts(accessToken);
        setUpcomingConcerts(data.upcomingConcerts || []);
        setPastConcerts(data.pastConcerts || []);
        setStats(data.stats || null);
      } catch (err: any) {
        setError(err.message || 'Не удалось загрузить данные о концертах.');
      } finally {
        setLoading(false);
      }
    };
    fetchArtistConcerts();
  }, [accessToken]);
  
  const displayedConcerts = view === 'upcoming' ? upcomingConcerts : pastConcerts;

  if (loading) {
    return <div className="flex justify-center items-center py-40"><Loader2 className="w-12 h-12 text-white animate-spin" /></div>;
  }

  if (error) {
    return <div className="text-center py-20 text-red-400">Ошибка: {error}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Концерты</h1>
          <p className="text-white/40">
            {upcomingConcerts.length} предстоящих • {pastConcerts.length} прошедших
          </p>
        </div>
        <Link to="/artist/concerts/new" className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full font-medium text-sm flex items-center gap-2">
          <Plus size={18} />
          Добавить концерт
        </Link>
      </div>

    {stats && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="glass rounded-xl p-5">
          <p className="text-sm text-white/40 mb-1">Всего концертов</p>
          <p className="text-3xl font-bold">{stats.totalConcerts}</p>
        </div>
        <div className="glass rounded-xl p-5">
          <p className="text-sm text-white/40 mb-1">Предстоящих</p>
          <p className="text-3xl font-bold text-purple-400">{stats.totalUpcoming}</p>
        </div>
        <div className="glass rounded-xl p-5">
          <p className="text-sm text-white/40 mb-1">Всего зрителей</p>
          <p className="text-3xl font-bold">{(stats.totalTicketsSold || 0).toLocaleString()}</p>
        </div>
        <div className="glass rounded-xl p-5">
          <p className="text-sm text-white/40 mb-1">Общий доход</p>
          <p className="text-3xl font-bold">
            {((stats.totalRevenue || 0) / 1000000).toFixed(1)}M ₽
          </p>
        </div>
      </div>
    )}

      <div className="flex gap-2 mb-6">
        <button onClick={() => setView('upcoming')} className={`px-4 py-2 rounded-lg text-sm transition ${view === 'upcoming' ? 'glass-accent' : 'bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/10'}`}>
          Предстоящие ({upcomingConcerts.length})
        </button>
        <button onClick={() => setView('past')} className={`px-4 py-2 rounded-lg text-sm transition ${view === 'past' ? 'glass-accent' : 'bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/10'}`}>
          Прошедшие ({pastConcerts.length})
        </button>
      </div>

      {displayedConcerts.length === 0 ? (
        <div className="text-center py-16">
            <Mic className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">
                {view === 'upcoming' ? 'Нет предстоящих концертов' : 'Нет прошедших концертов'}
            </h3>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedConcerts.map((concert) => (
            <div key={concert.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] hover:border-white/10 transition group">
              <div className="w-16 h-16 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0 overflow-hidden">
                {concert.cover_url ? (
                  <img src={concert.cover_url} alt={concert.title} className="w-full h-full object-cover" />
                ) : (
                  <Calendar className="w-6 h-6 text-white/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate group-hover:text-purple-400 transition">{concert.title}</h3>
                <div className="flex flex-wrap gap-3 text-sm text-white/40">
                  <span className="flex items-center gap-1"><Calendar size={14} />{concert.date}</span>
                  <span className="flex items-center gap-1"><Clock size={14} />{concert.time}</span>
                  <span className="flex items-center gap-1"><MapPin size={14} />{concert.venue}, {concert.city}</span>
                </div>
              </div>
              {concert.status === 'pending' ? (
                <span className="px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg text-sm">
                  На модерации
                </span>
              ) : concert.status === 'rejected' ? (
                <span className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm">
                  Отклонён
                </span>
              ) : concert.status === 'cancelled' ? (
                <span className="px-3 py-1.5 bg-white/10 text-white/40 rounded-lg text-sm">
                  Отменён
                </span>
              ) : concert.status === 'upcoming' || concert.status === 'available' ? (
                <div className="flex gap-2">
                  <span className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-sm">
                    Продано: {concert.ticketsSold}
                  </span>
                  <button className="p-2 rounded-lg hover:bg-white/10"><Settings size={18} /></button>
                </div>
              ) : (
                <div className="flex gap-4 text-right">
                  <div>
                    <p className="text-sm text-white/40">Зрителей</p>
                    <p className="font-medium">{concert.ticketsSold.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-white/40">Доход</p>
                    <p className="font-medium text-green-400">{(concert.revenue / 1000).toFixed(0)}K ₽</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
