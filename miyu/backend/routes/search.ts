import { Router, Response } from 'express';
import { getAll } from '../db';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

function normalizeMediaPath(value: string | null, prefix: '/uploads/tracks/' | '/uploads/albums/' | '/uploads/avatars/' | '/uploads/concerts/' | '/uploads/playlists/'): string | null {
  if (!value) return null;
  if (value.startsWith('http') || value.startsWith('/uploads/') || value.startsWith('data:image/')) return value;
  return `${prefix}${value}`;
}

function ciIncludes(text: string | null | undefined, query: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(query.toLowerCase());
}

function mapTrackRow(track: any) {
  const coverUrl = normalizeMediaPath(track.cover_url, '/uploads/tracks/');
  const albumCoverUrl = normalizeMediaPath(track.album_cover, '/uploads/albums/');
  return {
    id: track.id,
    title: track.title,
    duration: track.duration,
    file_path: track.file_path,
    cover_url: coverUrl,
    genre: track.genre,
    is_explicit: track.is_explicit,
    is_premium: track.is_premium,
    artist: {
      id: track.artist_id,
      username: track.artist_name,
      is_verified: track.artist_verified,
      is_premium: track.artist_premium
    },
    album: track.album_id ? {
      id: track.album_id,
      title: track.album_title,
      cover_url: albumCoverUrl
    } : null
  };
}

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const rawQuery = String(req.query.q || '').trim();
    const query = rawQuery.toLowerCase();
    const genre = String(req.query.genre || '').trim();
    const type = req.query.type as string | undefined;

    if (genre) {
      const results: any = { tracks: [], artists: [], albums: [], playlists: [], concerts: [] };

      if (!type || type === 'tracks' || type === 'all') {
        const tracks = await getAll<any>(
          `SELECT
            t.id, t.title, t.duration, t.file_path, t.cover_url, t.genre, t.is_explicit, t.is_premium,
            u.id as artist_id, u.username as artist_name, u.is_verified as artist_verified, u.is_premium as artist_premium,
            a.id as album_id, a.title as album_title, a.cover_url as album_cover
           FROM tracks t
           JOIN users u ON t.artist_id = u.id
           LEFT JOIN albums a ON t.album_id = a.id
           WHERE t.status = 'approved' AND LOWER(TRIM(t.genre)) = LOWER(TRIM(?))
           ORDER BY t.created_at DESC
           LIMIT 50`,
          [genre]
        );
        results.tracks = tracks.map(mapTrackRow);
      }

      if (!type || type === 'artists' || type === 'all') {
        const artists = await getAll<any>(
          `SELECT u.id, u.username as name, u.avatar_url, u.bio, u.is_verified, u.is_premium,
            COUNT(t.id) as track_count
           FROM users u
           JOIN tracks t ON t.artist_id = u.id
           WHERE u.role = 'artist'
             AND t.status = 'approved'
              AND LOWER(TRIM(t.genre)) = LOWER(TRIM(?))
           GROUP BY u.id, u.username, u.avatar_url, u.bio, u.is_verified, u.is_premium
           ORDER BY track_count DESC, u.username
           LIMIT 20`,
          [genre]
        );

        results.artists = artists.map((artist: any) => ({
          ...artist,
          avatar_url: artist.avatar_url && !artist.avatar_url.startsWith('http') && !artist.avatar_url.startsWith('/uploads/')
            ? `/uploads/avatars/${artist.avatar_url}`
            : artist.avatar_url
        }));
      }

      return res.json(results);
    }

    if (query.length === 0) {
      const results: any = {
        tracks: [],
        artists: [],
        albums: [],
        playlists: [],
        concerts: []
      };

      const tracks = await getAll<any>(
        `SELECT
          t.id, t.title, t.duration, t.file_path, t.cover_url, t.genre, t.is_explicit, t.is_premium,
          u.id as artist_id, u.username as artist_name, u.is_verified as artist_verified, u.is_premium as artist_premium,
          a.id as album_id, a.title as album_title, a.cover_url as album_cover,
          COALESCE((SELECT COUNT(*) FROM track_plays WHERE track_id = t.id), 0) as play_count
         FROM tracks t
         JOIN users u ON t.artist_id = u.id
         LEFT JOIN albums a ON t.album_id = a.id
         WHERE t.status = 'approved'
         ORDER BY play_count DESC, t.created_at DESC
         LIMIT 5`
      );

      results.tracks = tracks.map(mapTrackRow);

      const artists = await getAll<any>(
        `SELECT u.id, u.username as name, u.avatar_url, u.bio, u.is_verified, u.is_premium,
          (SELECT COUNT(*) FROM tracks WHERE artist_id = u.id AND status = 'approved') as track_count
         FROM users u
         WHERE u.role = 'artist'
         ORDER BY track_count DESC, u.created_at DESC
         LIMIT 6`
      );

      results.artists = artists.map((artist: any) => ({
        ...artist,
        avatar_url: artist.avatar_url && !artist.avatar_url.startsWith('http') && !artist.avatar_url.startsWith('/uploads/')
          ? `/uploads/avatars/${artist.avatar_url}`
          : artist.avatar_url
      }));

      const albums = await getAll<any>(
        `SELECT a.id, a.title, a.cover_url, a.release_year,
          u.id as artist_id, u.username as artist_name, u.is_verified as artist_verified,
          (SELECT COUNT(*) FROM tracks WHERE album_id = a.id) as track_count
         FROM albums a
         JOIN users u ON a.artist_id = u.id
         WHERE a.status = 'approved'
         ORDER BY a.created_at DESC
         LIMIT 6`
      );

      results.albums = albums.map((album: any) => {
        let coverUrl = album.cover_url;
        if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/')) {
          coverUrl = `/uploads/albums/${coverUrl}`;
        }
        return {
          id: album.id,
          title: album.title,
          cover_url: coverUrl,
          release_year: album.release_year,
          track_count: album.track_count,
          artist: {
            id: album.artist_id,
            username: album.artist_name,
            is_verified: album.artist_verified
          }
        };
      });

      const playlists = await getAll<any>(
        `SELECT p.id, p.title, p.cover_url, p.is_public,
          u.id as author_id, u.username as author_name,
          (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count
         FROM playlists p
         JOIN users u ON p.user_id = u.id
         WHERE p.is_public = 1
         ORDER BY p.created_at DESC
         LIMIT 6`
      );

      results.playlists = playlists.map((playlist: any) => {
        let coverUrl = playlist.cover_url;
        if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/')) {
          coverUrl = `/uploads/playlists/${coverUrl}`;
        }
        return {
          id: playlist.id,
          title: playlist.title,
          cover_url: coverUrl,
          is_public: playlist.is_public,
          track_count: playlist.track_count,
          author: {
            id: playlist.author_id,
            username: playlist.author_name
          }
        };
      });

      const concerts = await getAll<any>(
        `SELECT c.id, c.title, c.event_date, c.event_time, c.venue, c.city, c.cover_url, c.status,
          u.id as artist_id, u.username as artist_name,
          (SELECT MIN(price) FROM ticket_types WHERE concert_id = c.id) as min_price
         FROM concerts c
         JOIN users u ON c.artist_id = u.id
         WHERE c.status = 'available' AND c.event_date >= date('now')
         ORDER BY c.event_date ASC
         LIMIT 5`
      );

      results.concerts = concerts.map((concert: any) => {
        let coverUrl = concert.cover_url;
        if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/')) {
          coverUrl = `/uploads/concerts/${coverUrl}`;
        }
        return {
          id: concert.id,
          title: concert.title,
          event_date: concert.event_date,
          event_time: concert.event_time,
          venue: concert.venue,
          city: concert.city,
          cover_url: coverUrl,
          status: concert.status,
          price: concert.min_price || 0,
          artist: {
            id: concert.artist_id,
            username: concert.artist_name
          }
        };
      });

      return res.json(results);
    }

    if (query.length < 2) {
      return res.json({
        tracks: [],
        artists: [],
        albums: [],
        playlists: [],
        concerts: []
      });
    }

    const results: any = {
      tracks: [],
      artists: [],
      albums: [],
      playlists: [],
      concerts: []
    };

    if (!type || type === 'tracks' || type === 'all') {
      const tracks = await getAll<any>(
        `SELECT
          t.id, t.title, t.duration, t.file_path, t.cover_url, t.genre, t.is_explicit, t.is_premium,
          u.id as artist_id, u.username as artist_name, u.is_verified as artist_verified, u.is_premium as artist_premium,
          a.id as album_id, a.title as album_title, a.cover_url as album_cover
         FROM tracks t
         JOIN users u ON t.artist_id = u.id
         LEFT JOIN albums a ON t.album_id = a.id
         WHERE t.status = 'approved'
         ORDER BY t.title
         LIMIT 200`
      );
      results.tracks = tracks
        .filter((t: any) => ciIncludes(t.title, rawQuery) || ciIncludes(t.artist_name, rawQuery) || ciIncludes(t.genre, rawQuery))
        .sort((a: any, b: any) => {
          const aTitle = ciIncludes(a.title, rawQuery) ? 0 : 1;
          const bTitle = ciIncludes(b.title, rawQuery) ? 0 : 1;
          if (aTitle !== bTitle) return aTitle - bTitle;
          const aGenre = ciIncludes(a.genre, rawQuery) ? 0 : 1;
          const bGenre = ciIncludes(b.genre, rawQuery) ? 0 : 1;
          return aGenre - bGenre;
        })
        .slice(0, 20)
        .map(mapTrackRow);
    }

    if (!type || type === 'artists' || type === 'all') {
      const artists = await getAll<any>(
        `SELECT u.id, u.username as name, u.avatar_url, u.bio, u.is_verified, u.is_premium,
          COUNT(DISTINCT t.id) as track_count
         FROM users u
         LEFT JOIN tracks t ON t.artist_id = u.id AND t.status = 'approved'
         WHERE u.role = 'artist'
         GROUP BY u.id, u.username, u.avatar_url, u.bio, u.is_verified, u.is_premium
         LIMIT 200`
      );

      results.artists = artists
        .filter((a: any) => ciIncludes(a.name, rawQuery))
        .sort((a: any, b: any) => b.track_count - a.track_count)
        .slice(0, 20)
        .map((artist: any) => ({
          ...artist,
          avatar_url: artist.avatar_url && !artist.avatar_url.startsWith('http') && !artist.avatar_url.startsWith('/uploads/')
            ? `/uploads/avatars/${artist.avatar_url}`
            : artist.avatar_url
        }));
    }

    if (!type || type === 'albums' || type === 'all') {
      const albums = await getAll<any>(
        `SELECT a.id, a.title, a.cover_url, a.release_year,
          u.id as artist_id, u.username as artist_name, u.is_verified as artist_verified,
          (SELECT COUNT(*) FROM tracks WHERE album_id = a.id) as track_count
         FROM albums a
         JOIN users u ON a.artist_id = u.id
         WHERE a.status = 'approved'
         ORDER BY a.title
         LIMIT 200`
      );

      results.albums = albums
        .filter((a: any) => ciIncludes(a.title, rawQuery) || ciIncludes(a.artist_name, rawQuery))
        .sort((a: any, b: any) => {
          const aTitle = ciIncludes(a.title, rawQuery) ? 0 : 1;
          const bTitle = ciIncludes(b.title, rawQuery) ? 0 : 1;
          return aTitle - bTitle;
        })
        .slice(0, 20)
        .map((album: any) => {
          let coverUrl = album.cover_url;
          if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/')) {
            coverUrl = `/uploads/albums/${coverUrl}`;
          }
          return {
            id: album.id,
            title: album.title,
            cover_url: coverUrl,
            release_year: album.release_year,
            track_count: album.track_count,
            artist: {
              id: album.artist_id,
              username: album.artist_name,
              is_verified: album.artist_verified
            }
          };
        });
    }

    if (!type || type === 'playlists' || type === 'all') {
      const playlists = await getAll<any>(
        `SELECT p.id, p.title, p.cover_url, p.is_public,
          u.id as author_id, u.username as author_name,
          (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count
         FROM playlists p
         JOIN users u ON p.user_id = u.id
         WHERE p.is_public = 1
         ORDER BY p.title
         LIMIT 200`
      );

      results.playlists = playlists
        .filter((p: any) => ciIncludes(p.title, rawQuery))
        .sort((a: any, b: any) => a.title.localeCompare(b.title))
        .slice(0, 20)
        .map((playlist: any) => {
          let coverUrl = playlist.cover_url;
          if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/')) {
            coverUrl = `/uploads/playlists/${coverUrl}`;
          }
          return {
            id: playlist.id,
            title: playlist.title,
            cover_url: coverUrl,
            is_public: playlist.is_public,
            track_count: playlist.track_count,
            author: {
              id: playlist.author_id,
              username: playlist.author_name
            }
          };
        });
    }

    if (!type || type === 'concerts' || type === 'all') {
      const concerts = await getAll<any>(
        `SELECT c.id, c.title, c.event_date, c.event_time, c.venue, c.city, c.cover_url, c.status,
          u.id as artist_id, u.username as artist_name,
          (SELECT MIN(price) FROM ticket_types WHERE concert_id = c.id) as min_price
         FROM concerts c
         JOIN users u ON c.artist_id = u.id
         WHERE c.status = 'available'
         ORDER BY c.event_date
         LIMIT 200`
      );

      results.concerts = concerts
        .filter((c: any) => ciIncludes(c.title, rawQuery) || ciIncludes(c.venue, rawQuery) || ciIncludes(c.city, rawQuery) || ciIncludes(c.artist_name, rawQuery))
        .sort((a: any, b: any) => {
          const aTitle = ciIncludes(a.title, rawQuery) ? 0 : 1;
          const bTitle = ciIncludes(b.title, rawQuery) ? 0 : 1;
          return aTitle - bTitle;
        })
        .slice(0, 20)
        .map((concert: any) => {
          let coverUrl = concert.cover_url;
          if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/')) {
            coverUrl = `/uploads/concerts/${coverUrl}`;
          }
          return {
            id: concert.id,
            title: concert.title,
            event_date: concert.event_date,
            event_time: concert.event_time,
            venue: concert.venue,
            city: concert.city,
            cover_url: coverUrl,
            status: concert.status,
            price: concert.min_price || 0,
            artist: {
              id: concert.artist_id,
              username: concert.artist_name
            }
          };
        });
    }

    res.json(results);
  } catch (error: any) {
    console.error('Search error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

export default router;
