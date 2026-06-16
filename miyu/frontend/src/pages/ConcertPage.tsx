
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, MapPin, Mic, ChevronLeft, Loader2, Plus, Minus, CheckCircle2, Ticket as TicketIcon, X } from 'lucide-react';
import { concertsApi } from '../api/concerts';
import { useAuth } from '../hooks/AuthContext';
import { venuePlans, VenuePlanPreview, type VenuePlan } from '../components/VenuePlans';
import ConcertCover from '../components/ConcertCover';

interface TicketSector { id: number; name: string; price: number; available: number; zone_id?: string; }
interface Artist { id: number; name: string; avatar_url?: string | null; }
interface Concert {
  id: number; title: string; artists: Artist[]; date: string; time: string; datetime: string;
  venue: string; address: string; city: string; genre: string; description: string;
  image?: string; cover_url?: string | null; status: 'available' | 'soon' | 'soldout'; tickets: TicketSector[];
  venue_plan_id?: string;
}

export default function ConcertPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const [concert, setConcert] = useState<Concert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [venuePlan, setVenuePlan] = useState<VenuePlan | null>(null);

  const [isBuying, setIsBuying] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState<Record<number, number>>({});
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{ count: number; total: number } | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("ID концерта не найдено");
      setLoading(false);
      return;
    }
    const fetchConcert = async () => {
      try {
        setLoading(true);
        const data = await concertsApi.getById(id);
        setConcert(data);

        // Load venue plan if available
        if (data.venue_plan_id) {
          const plan = venuePlans.find(p => p.id === data.venue_plan_id);
          setVenuePlan(plan || null);
        }
      } catch (err: any) {
        setError(err.message || 'Не удалось загрузить информацию о концерте.');
      } finally {
        setLoading(false);
      }
    };
    fetchConcert();
  }, [id]);

  const handleBuyTickets = async () => {
    if (!accessToken) {
      navigate('/login');
      return;
    }
    if (!concert) return;

    const items = concert.tickets
      .filter((ticket) => (selectedTickets[ticket.id] || 0) > 0)
      .map((ticket) => {
        const zone = venuePlan?.zones.find((item) => item.id === ticket.zone_id);

        return {
          ticketTypeId: ticket.id,
          quantity: selectedTickets[ticket.id],
          name: ticket.name,
          price: ticket.price,
          zoneId: ticket.zone_id,
          zoneName: zone?.name,
        };
      });

    if (items.length === 0 || totalPrice <= 0) {
      setPurchaseError('Выберите доступную зону и количество билетов');
      return;
    }

    navigate('/checkout', {
      state: {
        checkoutType: 'concertTickets',
        concertId: concert.id,
        concertTitle: concert.title,
        items,
        total: totalPrice,
      },
    })
  };
  
  const updateTicketQty = (sectorId: number, amount: number) => {
    const sector = concert?.tickets.find((s) => s.id === sectorId);
    if (!sector) return;

    setSelectedTickets((prev) => {
      const currentQty = prev[sectorId] || 0;
      const newQty = Math.max(0, Math.min(currentQty + amount, sector.available));
      if (newQty === 0) {
        const { [sectorId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [sectorId]: newQty };
    });
  };

  const totalPrice = Object.entries(selectedTickets).reduce((sum, [sectorId, qty]) => {
    const sector = concert?.tickets.find((s) => s.id === Number(sectorId));
    return sum + (sector?.price || 0) * qty;
  }, 0);

  const totalTickets = Object.values(selectedTickets).reduce((sum, qty) => sum + qty, 0);

  const handleZoneClick = (zoneId: string) => {
    if (!concert || !zoneId) return;

    setSelectedZoneId(zoneId);
    setPurchaseError(null);

    const ticket = concert.tickets.find((ticket) => ticket.zone_id === zoneId);
    const zone = venuePlan?.zones.find((item) => item.id === zoneId);
    const zoneLabel = zone?.name || 'Эта зона';

    if (!ticket) {
      setPurchaseError(`${zoneLabel}: билеты для этой зоны пока недоступны`);
      return;
    }

    if (ticket.available <= 0) {
      setPurchaseError(`${zoneLabel}: билеты распроданы`);
      return;
    }

    if (!selectedTickets[ticket.id]) {
      updateTicketQty(ticket.id, 1);
    }
  };

  if (loading) return <div className="flex justify-center items-center py-40"><Loader2 className="w-12 h-12 text-white animate-spin" /></div>;
  if (error) return <div className="text-center py-20 text-red-400">Ошибка: {error}</div>;
  if (!concert) return <div className="text-center py-20">Концерт не найден.</div>;

  const selectedZones = concert.tickets
    .filter(t => selectedTickets[t.id] > 0)
    .map(t => t.zone_id)
    .filter(Boolean) as string[];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-20">
      <Link to="/concerts" className="inline-flex items-center gap-2 text-white/40 hover:text-white mb-6 transition">
        <ChevronLeft size={20} /> К концертам
      </Link>

      {/* Full width banner */}
      <div className="relative aspect-video rounded-2xl overflow-hidden mb-8 bg-white/[0.02]">
        <ConcertCover src={concert.cover_url} alt={concert.title} iconSize={96} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      <div className="max-w-4xl">
        <div>
          {/* Main Content */}
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{concert.title}</h1>
          <div className="flex flex-wrap gap-4 text-white/60 mb-4">
              <div className="flex items-center gap-2"><Calendar size={20} />{concert.date}</div>
              <div className="flex items-center gap-2"><Clock size={20} />{concert.time}</div>
          </div>
          <div className="flex items-center gap-2 text-white/60 mb-6"><MapPin size={20} />{concert.venue}, {concert.address}, {concert.city}</div>
          <div className="space-y-4 text-white/60 leading-relaxed mb-8"><p>{concert.description}</p></div>

          {/* Artists slider */}
          {concert.artists && concert.artists.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Mic className="w-5 h-5" />
                Артисты
              </h2>
              <div className="flex gap-8 overflow-x-auto pb-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                {concert.artists.map((artist) => (
                  <Link
                    key={artist.id}
                    to={`/artist/${artist.id}`}
                    className="flex-shrink-0 flex flex-col items-center gap-3 group"
                  >
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      {(artist as any).avatar_url ? (
                        <img loading="lazy"
                          src={(artist as any).avatar_url}
                          alt={artist.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Mic className="w-10 h-10 text-white" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-center group-hover:text-purple-400 transition max-w-[100px]">{artist.name}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Venue Plan at the bottom */}
      {venuePlan && (
        <div className="mt-12 max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Выберите зону на плане площадки</h2>
            <p className="text-white/60">Кликните на зону, чтобы выбрать билеты</p>
          </div>
          <div className="glass rounded-2xl p-6 mb-8">
            <VenuePlanPreview
              plan={venuePlan}
              selectedZones={selectedZones}
              onZoneClick={handleZoneClick}
            />
          </div>

          {/* Ticket selection below the plan - only show if at least one zone is selected */}
          {totalTickets > 0 && (
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4">Количество билетов</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {concert.tickets.map((sector) => {
                  const qty = selectedTickets[sector.id] || 0;
                  const zone = venuePlan?.zones.find(z => z.id === sector.zone_id);
                  const isSelected = selectedZoneId === sector.zone_id;
                  const isAvailable = sector.available > 0;

                  return (
                    <motion.div
                      key={sector.id}
                      className={`p-4 rounded-xl border-2 transition ${
                        isSelected
                          ? 'bg-purple-500/20 border-purple-500'
                          : 'bg-white/[0.03] border-transparent hover:border-white/10'
                      } ${isAvailable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                      onClick={() => handleZoneClick(sector.zone_id || '')}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {zone && (
                            <div
                              className="w-4 h-4 rounded flex-shrink-0"
                              style={{ backgroundColor: zone.color }}
                            />
                          )}
                          <div>
                            <p className="font-medium">{sector.name}</p>
                            <p className="text-sm text-white/40">{sector.price.toLocaleString()} ₽</p>
                          </div>
                        </div>
                        <div className="text-xs text-white/30">
                          {sector.available > 0 ? `${sector.available} мест` : 'Распродано'}
                        </div>
                      </div>

                      {sector.available > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white/60">Количество:</span>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateTicketQty(sector.id, -1);
                              }}
                              disabled={qty === 0}
                              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center transition"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-bold">{qty}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateTicketQty(sector.id, 1);
                              }}
                              disabled={qty >= sector.available}
                              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center transition"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Order summary + buy button at the very bottom */}
          {totalPrice > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-6 mt-6"
            >
              <h2 className="text-xl font-bold mb-4">Ваш заказ</h2>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-white/60">
                  <span>Билетов:</span>
                  <span>{totalTickets}</span>
                </div>
                <div className="flex justify-between text-2xl font-bold">
                  <span>Итого:</span>
                  <span>{totalPrice.toLocaleString()} ₽</span>
                </div>
              </div>
              <button
                onClick={handleBuyTickets}
                disabled={isBuying || totalTickets === 0 || totalPrice <= 0}
                className="w-full py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full font-medium text-base transition disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isBuying ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  <>
                    <TicketIcon className="w-5 h-5" />
                    Купить билеты
                  </>
                )}
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* Error toast */}
      <AnimatePresence>
        {purchaseError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/40 backdrop-blur text-sm text-red-100 flex items-center gap-3 max-w-md"
          >
            <span className="flex-1">{purchaseError}</span>
            <button onClick={() => setPurchaseError(null)} className="opacity-70 hover:opacity-100">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success modal */}
      <AnimatePresence>
        {purchaseSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setPurchaseSuccess(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.4 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-[#1a1530] to-[#0e0b1f] border border-white/10 p-8 text-center"
            >
              <button
                onClick={() => setPurchaseSuccess(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition"
              >
                <X size={16} />
              </button>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring' }}
                className="w-20 h-20 mx-auto mb-5 rounded-full bg-green-500/15 flex items-center justify-center"
              >
                <CheckCircle2 className="w-12 h-12 text-green-400" />
              </motion.div>

              <h2 className="text-2xl font-bold mb-2">Билеты куплены!</h2>
              <p className="text-white/60 mb-6">
                Вы приобрели <strong className="text-white">{purchaseSuccess.count}</strong>{' '}
                {purchaseSuccess.count === 1 ? 'билет' : purchaseSuccess.count < 5 ? 'билета' : 'билетов'}
                {' '}на сумму{' '}
                <strong className="text-white">{purchaseSuccess.total.toLocaleString()} ₽</strong>
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setPurchaseSuccess(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition text-sm"
                >
                  Остаться здесь
                </button>
                <button
                  onClick={() => navigate(`/tickets/concert/${concert.id}`)}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transition text-sm font-medium flex items-center justify-center gap-2"
                >
                  <TicketIcon size={16} /> К билетам
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
