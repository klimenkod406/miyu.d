
import { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Loader2, User } from 'lucide-react';
import { concertsApi } from '../api/concerts';
import { authApi } from '../api/auth';
import { useAuth } from '../hooks/AuthContext';

// Basic interfaces, should be in a types file
interface Artist { id: number; username: string; }
interface TicketTier { id: number; name: string; price: number; quantity: number; }

export default function AdminConcertEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const { accessToken } = useAuth();

  const [artists, setArtists] = useState<Artist[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    artist_id: '' as string | number,
    description: '',
    venue: '',
    city: '',
    datetime: '',
    time: '',
    // ... other fields as needed
  });
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!accessToken) {
        setError("Требуется авторизация");
        setLoading(false);
        return;
    };

    const fetchData = async () => {
      try {
        setLoading(true);
        const artistsData = await authApi.getArtists(accessToken);
        setArtists(artistsData);

        if (isEditing) {
          const concertData = await concertsApi.getById(id!);
          setFormData({
              title: concertData.title,
              artist_id: concertData.artist.id,
              description: concertData.description,
              venue: concertData.venue,
              city: concertData.city,
              datetime: new Date(concertData.datetime).toISOString().split('T')[0],
              time: concertData.time,
          });
          setTicketTiers(concertData.tickets.map((t: any) => ({...t, quantity: t.available}))); // Adapt based on API response
        } else {
            // Set default empty state for creation
            setFormData({
                title: '', artist_id: '', description: '', venue: '',
                city: '', datetime: '', time: '',
            });
            setTicketTiers([{id: Date.now(), name: 'Standard', price: 1000, quantity: 100}]);
        }
      } catch (err: any) {
        setError(err.message || 'Не удалось загрузить данные');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, isEditing, accessToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;

    setIsSaving(true);
    const concertPayload = {
      ...formData,
      ticket_types: ticketTiers,
      artist_id: Number(formData.artist_id),
      datetime: new Date(`${formData.datetime}T${formData.time}`).toISOString(),
    };

    try {
      if (isEditing) {
        await concertsApi.update(accessToken, parseInt(id!), concertPayload);
      } else {
        await concertsApi.create(accessToken, concertPayload);
      }
      navigate('/admin/concerts');
    } catch (err: any) {
      alert(`Ошибка сохранения: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center py-40"><Loader2 className="w-12 h-12 text-white animate-spin" /></div>;
  if (error) return <div className="text-center py-20 text-red-400">Ошибка: {error}</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{isEditing ? 'Редактирование концерта' : 'Создание концерта'}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Simplified Form */}
        <div>
            <label>Артист</label>
            <select
                value={formData.artist_id}
                onChange={(e) => setFormData({...formData, artist_id: e.target.value})}
                required
                className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08]"
            >
                <option value="" disabled>Выберите артиста</option>
                {artists.map(artist => (
                    <option key={artist.id} value={artist.id}>{artist.username}</option>
                ))}
            </select>
        </div>
        <div>
            <label>Название</label>
            <input 
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                required
                className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08]"
            />
        </div>
        {/* Add other form fields for venue, city, date, time etc. */}
        
        <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.05]">
          <button type="button" onClick={() => navigate(-1)} className="px-6 py-3 rounded-xl bg-white/[0.05]">Отмена</button>
          <button type="submit" disabled={isSaving} className="px-6 py-3 rounded-xl bg-purple-600 disabled:opacity-50">
            {isSaving ? <Loader2 className="animate-spin" /> : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
}
