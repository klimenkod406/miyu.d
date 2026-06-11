import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePlayer } from '../hooks/PlayerContext';
import type { Track, Album } from '../types';
import { Play, Pause, Clock, Music, Loader2, Heart, Share2, MoreHorizontal, Verified } from 'lucide-react';
import { getStoredTokens } from '../api/auth';

interface AlbumFull extends Album {
  artist_id: number;
  artist_name: string;
  artist_verified?: boolean;
  tracks: Track[];
}

export default function AlbumPage() {
  const { id } = useParams<{ id: string }>();
  const [album, setAlbum] = useState<AlbumFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const player = usePlayer();

  useEffect(() => {
    async function fetchAlbum() {
      try {
        setLoading(true);
        const res = await fetch(`/api/album/${id}`);
        if (!res.ok) {
          throw new Error('Альбом не найден');
        }
        const data = await res.json();
        setAlbum(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAlbum();
  }, [id]);

  useEffect(() => {
    async function fetchLikeStatus() {
      const tokens = getStoredTokens();
      if (!tokens || !id) {
        setLiked(false);
        return;
      }

      try {
        const res = await fetch(`/api/likes/albums/check/${id}`, {
          headers: { Authorization: `Bearer ${tokens.accessToken}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        setLiked(!!data.liked);
      } catch (err) {
        console.error('Failed to load album like status:', err);
      }
    }

    fetchLikeStatus();
  }, [id]);

  const isAlbumPlaying = album && player.currentTrack && 
    album.tracks.some(track => track.id === player.currentTrack?.id);
  const isPlaying = player.isPlaying && isAlbumPlaying;

  const handlePlayAlbum = () => {
    if (album && album.tracks.length > 0) {
      if (isAlbumPlaying && isPlaying) {
        player.pause();
      } else {
        player.setQueue(
          album.tracks,
          false,
          { id: album.id, title: album.title, mode: 'album' }
        );
        player.setTrack(
          album.tracks[0],
          true,
          { id: album.id, title: album.title, mode: 'album' }
        );
      }
    }
  };

  const handlePlayTrack = (track: Track, index: number) => {
    if (album) {
      player.setQueue(
        album.tracks,
        false,
        { id: album.id, title: album.title, mode: 'album' }
      );
      player.setTrack(
        track,
        true,
        { id: album.id, title: album.title, mode: 'album' }
      );
      void index;
    }
  };

  const handleToggleAlbumLike = async () => {
    const tokens = getStoredTokens();
    if (!tokens || !id || likeLoading) return;

    setLikeLoading(true);
    try {
      const res = await fetch(`/api/likes/albums/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      });

      if (!res.ok) return;

      const data = await res.json();
      setLiked(!!data.liked);

      if (data.unlockedAchievements && data.unlockedAchievements.length > 0) {
        window.dispatchEvent(new CustomEvent('show-achievement', {
          detail: { achievements: data.unlockedAchievements }
        }));
      }
    } catch (err) {
      console.error('Failed to toggle album like:', err);
    } finally {
      setLikeLoading(false);
    }
  };

  const isCurrentTrack = (trackId: number) => player.currentTrack?.id === trackId;
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTypeLabel = (type?: string) => {
    switch (type) {
      case 'single': return 'Сингл';
      case 'ep': return 'EP';
      case 'compilation': return 'Сборник';
      default: return 'Альбом';
    }
  };
  
  if (loading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>;
  }

  if (error) {
    return <div className="text-center py-20 text-red-400">{error}</div>;
  }

  if (!album) {
    return <div className="text-center py-20">Альбом не найден.</div>;
  }

  const totalDuration = album.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
  const coverUrl = album.cover_url ? album.cover_url : undefined;

  return (
    <div className="text-white">
      <div className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 z-0">
          {coverUrl ? (
            <>
              <img src={coverUrl} alt="" className="w-full h-full object-cover blur-3xl scale-125 opacity-40" />
              <div className="absolute inset-0 bg-dark-900/60" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-900/50 to-pink-900/50" />
          )}
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-8 p-8">
          <div className="w-48 h-48 flex-shrink-0 shadow-2xl">
            {coverUrl ? (
              <img src={coverUrl} alt={album.title} className="w-full h-full object-cover rounded-xl" />
            ) : (
              <div className="w-full h-full bg-white/5 rounded-xl flex items-center justify-center">
                <Music className="w-16 h-16 text-white/20" />
              </div>
            )}
          </div>
          <div className="flex flex-col justify-end">
            <p className="text-sm font-bold uppercase tracking-wider text-white/60">{getTypeLabel(album.type)}</p>
            <h1 className="text-5xl font-black tracking-tight my-3">{album.title}</h1>
            <div className="flex items-center gap-2 text-sm text-white/70 flex-wrap">
              <Link to={`/artist/${album.artist_id}`} className="font-bold hover:text-white transition flex items-center gap-1">
                {album.artist_name}
                {album.artist_verified && <Verified className="w-4 h-4 text-blue-400" />}
              </Link>
              <span>•</span>
              <span>{album.release_year}</span>
              <span>•</span>
              <span>{album.tracks.length} треков</span>
              <span>•</span>
              <span className="text-white/50">{formatDuration(totalDuration)}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-8 pt-4">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={handlePlayAlbum}
            className="w-14 h-14 bg-white hover:bg-gray-200 rounded-full flex items-center justify-center shadow-lg transition transform hover:scale-105"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 text-black ml-0.5" />
            ) : (
              <Play className="w-7 h-7 text-black ml-1" />
            )}
          </button>
          <button
            onClick={handleToggleAlbumLike}
            disabled={likeLoading}
            className={`w-10 h-10 transition disabled:opacity-50 ${liked ? 'text-white' : 'text-white/60 hover:text-white'}`}
          >
            <Heart className={`w-6 h-6 ${liked ? 'fill-current' : ''}`} />
          </button>
          <button className="w-10 h-10 text-white/60 hover:text-white transition">
            <Share2 className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 text-white/60 hover:text-white transition">
            <MoreHorizontal className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-1">
          <div className="grid grid-cols-[3rem_1fr_auto] gap-4 px-4 text-sm text-white/40 border-b border-white/10 pb-3 mb-2">
            <span className="text-center">#</span>
            <span>Название</span>
            <Clock className="w-4 h-4" />
          </div>
          {album.tracks.map((track, index) => {
            const isCurrent = isCurrentTrack(track.id);
            return (
              <div
                key={track.id}
                onClick={() => handlePlayTrack(track, index)}
                className={`grid grid-cols-[3rem_1fr_auto] gap-4 px-4 py-3 rounded-lg cursor-pointer group transition ${
                  isCurrent ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-center">
                  {isCurrent && player.isPlaying ? (
                    <div className="w-4 h-4 flex items-center justify-center">
                      <div className="w-1 h-4 bg-white rounded-full animate-music-bar-1"></div>
                      <div className="w-1 h-3 bg-white rounded-full mx-0.5 animate-music-bar-2"></div>
                      <div className="w-1 h-4 bg-white rounded-full animate-music-bar-3"></div>
                    </div>
                  ) : (
                    <span className="group-hover:hidden text-white/40">{index + 1}</span>
                  )}
                  {!isCurrent && <Play className="w-4 h-4 hidden group-hover:block text-white/60" />}
                </div>
                <div>
                  <p className="font-medium text-white">{track.title}</p>
                  <p className="text-sm text-white/40">{album.artist_name}</p>
                </div>
                <div className="text-sm text-white/60 flex items-center">
                  {formatDuration(track.duration)}
                </div>
              </div>
            );
          })}
        </div>

        {album.description && (
          <div className="mt-8 p-4 bg-white/5 rounded-xl">
            <h3 className="text-sm font-medium text-white/60 mb-2">Описание</h3>
            <p className="text-white/80">{album.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
