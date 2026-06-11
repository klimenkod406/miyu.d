export interface User {
  id: number
  email?: string
  username: string
  role: 'user' | 'artist' | 'moderator' | 'admin'
  avatar_url?: string
  bio?: string
  is_verified: boolean
  is_premium: boolean
  premium_expires_at?: string
  created_at: string
  is_profile_public?: boolean
  show_history?: boolean
  show_likes?: boolean
  show_achievements?: boolean
  show_favorite_artists?: boolean
  show_favorite_albums?: boolean
  palette_mode?: string
  palette_primary?: string
  palette_secondary?: string
  palette_tertiary?: string
  palette_accent?: string
  last_seen?: string
  show_online_status?: boolean
  show_listening_status?: boolean
  is_online?: boolean
  is_pinned_in_sidebar?: boolean
  is_hidden_in_sidebar?: boolean
}

export interface ArtistProfile {
  id: number
  user_id: number
  stage_name: string
  real_name?: string
  genre?: string
  country?: string
  website?: string
  instagram?: string
  twitter?: string
  total_plays: number
  total_earnings: number
  verified_at?: string
}

export interface Track {
  id: number
  artist_id: number
  artist?: User
  album_id?: number
  album?: Album
  title: string
  duration: number
  track_number?: number
  file_path: string
  cover_url?: string
  genre?: string
  bpm?: number
  lyrics?: string
  is_explicit: boolean
  is_premium: boolean
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface Video {
  id: number
  artist_id: number
  artist?: User
  album_id?: number
  track_id?: number
  track?: Track
  album?: Album
  title: string
  description?: string
  duration: number
  file_path: string
  thumbnail_url?: string
  status: 'pending' | 'approved' | 'rejected'
  views_count: number
  created_at: string
}

export interface Album {
  id: number
  artist_id: number
  artist?: User
  title: string
  release_year?: number
  cover_url?: string
  description?: string
  genre?: string
  type: 'album' | 'single' | 'ep'
  status: string
  tracks?: Track[]
  videos?: Video[]
  created_at: string
}

export interface Playlist {
  id: number
  user_id: number
  user?: User
  title: string
  description?: string
  cover_url?: string
  is_public: boolean
  is_system: boolean
  is_pinned?: boolean
  track_count?: number
  tracks?: Track[]
  created_at: string
}

export interface Concert {
  id: number
  artist_id: number
  artist?: User
  title: string
  description?: string
  venue?: string
  city?: string
  country?: string
  address?: string
  event_date: string
  event_time?: string
  cover_url?: string
  total_seats?: number
  available_seats?: number
  status: string
}

export interface Ticket {
  id: number
  ticket_type_id: number
  user_id: number
  seat_row?: string
  seat_number?: string
  qr_code?: string
  status: 'valid' | 'used' | 'cancelled'
}

export interface Subscription {
  id: number
  user_id: number
  plan: 'free' | 'plus' | 'fan'
  status: 'active' | 'cancelled' | 'expired'
  started_at: string
  expires_at: string
  auto_renew: boolean
}

export interface Transaction {
  id: number
  user_id: number
  type: 'subscription' | 'ticket' | 'donation' | 'promotion' | 'refund'
  amount: number
  currency: string
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  payment_method?: string
  created_at: string
}

export interface Achievement {
  id: number
  code: string
  title: string
  description?: string
  icon?: string
}

export interface ArtistStats {
  total_plays: number
  unique_listeners: number
  total_earnings: number
  tracks_count: number
  albums_count: number
  concerts_count: number
}

// History types
export interface TrackPlay {
  id: number
  track_id: number
  track: Track
  user_id: number
  playlist_id?: number
  playlist?: Playlist
  play_duration: number
  completed: boolean
  created_at: string
}

export interface VideoView {
  id: number
  video_id: number
  video: Video
  user_id: number
  playlist_id?: number
  playlist?: Playlist
  view_duration: number
  completed: boolean
  created_at: string
}

// Player state
export interface PlayerState {
  currentTrack: Track | null
  currentVideo: Video | null
  isPlaying: boolean
  volume: number
  progress: number
  duration: number
  queue: Track[]
  sourcePlaylist?: Playlist
}

// Social types
export interface Follow {
  follower_id: number
  following_id: number
  created_at: string
}

export interface Notification {
  id: number
  type: 'like' | 'follow' | 'comment' | 'share' | 'achievement' | 'concert' | 'friend_request' | 'share_stats' | 'support_resolved' | 'artist_page_deleted' | 'track_moderated'
  from_user_id: number
  from_user?: User
  target_type: 'track' | 'album' | 'user' | 'playlist' | 'concert' | 'video' | 'stats' | 'support_ticket' | 'artist_page' | 'artist_application'
  target_id: number
  message: string
  read: boolean
  created_at: string
}

export interface Activity {
  id: number
  user_id: number
  user?: User
  type: 'listen' | 'like' | 'follow' | 'playlist_add' | 'comment'
  target_type: 'track' | 'album' | 'artist' | 'playlist' | 'user'
  target_id: number
  target?: Track | Album | Playlist | User
  created_at: string
}

export interface FriendRequest {
  id: number
  from_user_id: number
  from_user?: User
  to_user_id: number
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}
