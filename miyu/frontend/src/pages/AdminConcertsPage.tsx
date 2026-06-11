
import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search, Edit, Trash, Star } from 'lucide-react';
import { concertsApi } from '../api/concerts';
import { useAuth } from '../hooks/AuthContext';

// Simplified concert type for the admin list
interface AdminConcert {
  id: number;
  title: string;
  artist: { name: string };
  event_date: string;
  status: string;
  is_in_banner: number;
}

export default function AdminConcertsPage() {
  const [concerts, setConcerts] = useState<AdminConcert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) {
        setError("Требуется авторизация");
        setLoading(false);
        return;
    }
    const fetchConcerts = async () => {
      try {
        setLoading(true);
        const data = await concertsApi.getAll(); // Using the public endpoint for now
        setConcerts(data);
      } catch (err: any) {
        setError(err.message || 'Не удалось загрузить концерты.');
      } finally {
        setLoading(false);
      }
    };
    fetchConcerts();
  }, [accessToken]);

  const handleDelete = async (id: number) => {
    if (!accessToken || !window.confirm('Вы уверены, что хотите удалить этот концерт?')) return;
    try {
        await concertsApi.delete(accessToken, id);
        setConcerts(concerts.filter(c => c.id !== id));
    } catch (err: any) {
        alert(`Ошибка удаления: ${err.message}`);
    }
  };

  const handleToggleBanner = async (concert: AdminConcert) => {
    if (!accessToken) return;
    try {
        if (concert.is_in_banner) {
            await concertsApi.removeFromBanner(accessToken, concert.id);
        } else {
            await concertsApi.addToBanner(accessToken, concert.id);
        }
        // Refresh local state
        setConcerts(concerts.map(c => c.id === concert.id ? { ...c, is_in_banner: c.is_in_banner ? 0 : 1 } : c));
    } catch (err: any) {
        alert(`Ошибка обновления баннера: ${err.message}`);
    }
  };


  if (loading) return <div className="flex justify-center items-center py-40"><Loader2 className="w-12 h-12 text-white animate-spin" /></div>;
  if (error) return <div className="text-center py-20 text-red-400">Ошибка: {error}</div>;

  return (
    <div>
        <h1 className="text-2xl font-bold mb-6">Управление концертами</h1>
        <div className="rounded-xl overflow-hidden bg-white/[0.02] border border-white/[0.05]">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-white/30 border-b border-white/[0.05]">
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Артист</th>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {concerts.map((concert) => (
                <tr key={concert.id} className="border-b border-white/[0.05]/50 hover:bg-white/[0.02] transition">
                  <td className="px-4 py-3 font-medium">{concert.title}</td>
                  <td className="px-4 py-3 text-white/60">{concert.artist.name}</td>
                  <td className="px-4 py-3 text-white/60">{new Date(concert.event_date).toLocaleDateString('ru-RU')}</td>
                  <td className="px-4 py-3"><span className="px-2 py-1 text-xs rounded bg-white/10">{concert.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                        <button onClick={() => handleToggleBanner(concert)} title="В баннер">
                            <Star size={18} className={concert.is_in_banner ? 'text-yellow-400 fill-current' : 'text-white/40'}/>
                        </button>
                        <Link to={`/admin/concerts/edit/${concert.id}`} className="p-2 hover:bg-white/10 rounded-lg"><Edit size={18} /></Link>
                        <button onClick={() => handleDelete(concert.id)} className="p-2 hover:bg-red-500/20 rounded-lg text-red-400"><Trash size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </div>
  );
}
