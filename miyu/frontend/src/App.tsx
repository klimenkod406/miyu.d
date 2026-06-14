import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import React, { Suspense } from 'react'
import Layout from './components/Layout'
import AuthLayout from './components/AuthLayout'
import { useAuth } from './hooks/AuthContext'

// Pages - P0
const HomePage = React.lazy(() => import('./pages/HomePage'))
const SearchPage = React.lazy(() => import('./pages/SearchPage'))
const TrackPage = React.lazy(() => import('./pages/TrackPage'))
const AlbumPage = React.lazy(() => import('./pages/AlbumPage'))
const ArtistPage = React.lazy(() => import('./pages/ArtistPage'))
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'))
const EditProfilePage = React.lazy(() => import('./pages/EditProfilePage'))
const LikedPage = React.lazy(() => import('./pages/LikedPage'))
const LikedPlaylistsPage = React.lazy(() => import('./pages/LikedPlaylistsPage'))
const PlaylistsPage = React.lazy(() => import('./pages/PlaylistsPage'))
const PlaylistPage = React.lazy(() => import('./pages/PlaylistPage'))
const HistoryPage = React.lazy(() => import('./pages/HistoryPage'))
const FavoriteArtistsPage = React.lazy(() => import('./pages/FavoriteArtistsPage'))
const FavoriteAlbumsPage = React.lazy(() => import('./pages/FavoriteAlbumsPage'))
const NewReleasesPage = React.lazy(() => import('./pages/NewReleasesPage'))
const ChartsPage = React.lazy(() => import('./pages/ChartsPage'))
const PopularArtistsPage = React.lazy(() => import('./pages/PopularArtistsPage'))
const GenresPage = React.lazy(() => import('./pages/GenresPage'))
const ArtistDashboardPage = React.lazy(() => import('./pages/ArtistDashboardPage'))
const ArtistUploadPage = React.lazy(() => import('./pages/ArtistUploadPage'))
const ArtistTracksPage = React.lazy(() => import('./pages/ArtistTracksPage'))
const ArtistAlbumsPage = React.lazy(() => import('./pages/ArtistAlbumsPage'))
const ArtistCreateAlbumPage = React.lazy(() => import('./pages/ArtistCreateAlbumPage'))
const ArtistCreateConcertPage = React.lazy(() => import('./pages/ArtistCreateConcertPage'))
const ArtistUploadVideoPage = React.lazy(() => import('./pages/ArtistUploadVideoPage'))
const ArtistVideosPage = React.lazy(() => import('./pages/ArtistVideosPage'))
const ArtistConcertsPage = React.lazy(() => import('./pages/ArtistConcertsPage'))
const PremiumPage = React.lazy(() => import('./pages/PremiumPage'))
const CheckoutPage = React.lazy(() => import('./pages/CheckoutPage'))
const GiftPage = React.lazy(() => import('./pages/GiftPage'))
const VideoPage = React.lazy(() => import('./pages/VideoPage'))
const ClipsPage = React.lazy(() => import('./pages/ClipsPage'))
const ModerationPage = React.lazy(() => import('./pages/ModerationPage'))
const AdminUsersPage = React.lazy(() => import('./pages/AdminUsersPage'))
const AdminPage = React.lazy(() => import('./pages/AdminPage'))
const AdminArtistsPage = React.lazy(() => import('./pages/AdminArtistsPage'))
const AdminArtistAvatarsPage = React.lazy(() => import('./pages/AdminArtistAvatarsPage'))
const ArtistStatsPage = React.lazy(() => import('./pages/ArtistStatsPage'))
const UserStatsPage = React.lazy(() => import('./pages/UserStatsPage'))
const AchievementsPage = React.lazy(() => import('./pages/AchievementsPage'))
const AdminAchievementsPage = React.lazy(() => import('./pages/AdminAchievementsPage'))
const AdminContentPage = React.lazy(() => import('./pages/AdminContentPage'))
const AdminBatchUploadPage = React.lazy(() => import('./pages/AdminBatchUploadPage'))
const AdminConcertsPage = React.lazy(() => import('./pages/AdminConcertsPage'))
const AdminConcertEditPage = React.lazy(() => import('./pages/AdminConcertEditPage'))
const SupportAdminPage = React.lazy(() => import('./pages/SupportAdminPage'))
const LoginPage = React.lazy(() => import('./pages/LoginPage'))
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'))
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'))
import Toast from './components/Toast'
import AchievementToast from './components/AchievementToast'


// Pages - P1
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage'))
const BillingPage = React.lazy(() => import('./pages/BillingPage'))
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'))
const ConcertsPage = React.lazy(() => import('./pages/ConcertsPage'))
const ConcertPage = React.lazy(() => import('./pages/ConcertPage'))
const MyTicketsPage = React.lazy(() => import('./pages/MyTicketsPage'))
const TicketDetailPage = React.lazy(() => import('./pages/TicketDetailPage'))
const ConcertTicketsPage = React.lazy(() => import('./pages/ConcertTicketsPage'))

// Pages - Social
const FeedPage = React.lazy(() => import('./pages/FeedPage'))
const NotificationsPage = React.lazy(() => import('./pages/NotificationsPage'))
const FriendsPage = React.lazy(() => import('./pages/FriendsPage'))
const FollowersPage = React.lazy(() => import('./pages/FollowersPage'))
const FollowingPage = React.lazy(() => import('./pages/FollowingPage'))
const PublicProfilePage = React.lazy(() => import('./pages/PublicProfilePage'))

function ScrollToTop() {
  const { pathname } = useLocation()

  React.useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

function GuestHomeOnlyGate() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  const publicGuestPaths = ['/']

  if (isLoading) {
    return null
  }

  if (!isAuthenticated && !publicGuestPaths.includes(location.pathname)) {
    return <Navigate to="/" replace />
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Layout />
    </Suspense>
  )
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#050505]">
      <div className="animate-pulse text-gray-400">Загрузка...</div>
    </div>
  )
}


function App() {
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null)
  const [achievementQueue, setAchievementQueue] = React.useState<any[]>([])
  const [currentAchievement, setCurrentAchievement] = React.useState<any | null>(null)

  React.useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent
      setToast({ message: customEvent.detail.message, type: customEvent.detail.type || 'info' })
    }
    window.addEventListener('show-toast', handler)
    return () => window.removeEventListener('show-toast', handler)
  }, [])

  React.useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent
      const achievements = customEvent.detail.achievements
      if (achievements && achievements.length > 0) {
        setAchievementQueue(prev => [...prev, ...achievements])
      }
    }
    window.addEventListener('show-achievement', handler)
    return () => window.removeEventListener('show-achievement', handler)
  }, [])

  React.useEffect(() => {
    if (!currentAchievement && achievementQueue.length > 0) {
      setCurrentAchievement(achievementQueue[0])
      setAchievementQueue(prev => prev.slice(1))
    }
  }, [currentAchievement, achievementQueue])

  return (
    <>
      <Routes>
      <Route path="/login" element={<Suspense fallback={<LoadingFallback />}><AuthLayout><LoginPage /></AuthLayout></Suspense>} />
      <Route path="/register" element={<Suspense fallback={<LoadingFallback />}><AuthLayout><RegisterPage /></AuthLayout></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={<LoadingFallback />}><AuthLayout><ForgotPasswordPage /></AuthLayout></Suspense>} />

      {/* Main routes */}
      <Route path="/" element={
        <>
          <ScrollToTop />
          <GuestHomeOnlyGate />
        </>
      }>
        <Route index element={<HomePage />} />
        <Route path="new-releases" element={<NewReleasesPage />} />
        <Route path="charts" element={<ChartsPage />} />
        <Route path="popular-artists" element={<PopularArtistsPage />} />
        <Route path="genres" element={<GenresPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="clips" element={<ClipsPage />} />
        <Route path="track/:id" element={<TrackPage />} />
        <Route path="album/:id" element={<AlbumPage />} />
        <Route path="artist/:id" element={<ArtistPage />} />
        <Route path="video/:id" element={<VideoPage />} />

        {/* User */}
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/edit" element={<EditProfilePage />} />
        <Route path="profile/library/liked" element={<LikedPage />} />
        <Route path="profile/library/playlists" element={<PlaylistsPage />} />
        <Route path="profile/library/liked-playlists" element={<LikedPlaylistsPage />} />
        <Route path="playlist/:id" element={<PlaylistPage />} />
        <Route path="profile/playlist/:id" element={<PlaylistPage />} />
        <Route path="profile/library/history" element={<HistoryPage />} />
        <Route path="profile/library/artists" element={<FavoriteArtistsPage />} />
        <Route path="profile/library/albums" element={<FavoriteAlbumsPage />} />

        {/* Artist */}
        <Route path="artist/dashboard" element={<ArtistDashboardPage />} />
        <Route path="artist/upload" element={<ArtistUploadPage />} />
        <Route path="artist/upload-video" element={<ArtistUploadPage />} />
        <Route path="artist/videos" element={<ArtistVideosPage />} />
        <Route path="artist/videos/new" element={<ArtistUploadVideoPage />} />
        <Route path="artist/videos/upload" element={<ArtistUploadVideoPage />} />
        <Route path="artist/tracks" element={<ArtistTracksPage />} />
        <Route path="artist/albums" element={<ArtistAlbumsPage />} />
        <Route path="artist/albums/new" element={<ArtistCreateAlbumPage />} />
        <Route path="artist/concerts" element={<ArtistConcertsPage />} />
        <Route path="artist/concerts/new" element={<ArtistCreateConcertPage />} />
        <Route path="artist/stats" element={<ArtistStatsPage />} />
        <Route path="artist/:id/stats" element={<ArtistStatsPage />} />
        <Route path="artist/earnings" element={<div className="p-8">Доходы</div>} />

        {/* Payments */}
        <Route path="premium" element={<PremiumPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="gift" element={<GiftPage />} />

        {/* Settings */}
        <Route path="settings" element={<SettingsPage />} />
        <Route path="stats" element={<UserStatsPage />} />
        <Route path="stats/shared/:fromUserId" element={<UserStatsPage />} />
        <Route path="achievements" element={<AchievementsPage />} />
        <Route path="admin/achievements" element={<AdminAchievementsPage />} />

        {/* Concerts */}
        <Route path="concerts" element={<ConcertsPage />} />
        <Route path="concert/:id" element={<ConcertPage />} />
        <Route path="tickets" element={<MyTicketsPage />} />
        <Route path="tickets/concert/:id" element={<ConcertTicketsPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />

        {/* Social */}
        <Route path="feed" element={<FeedPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="friends" element={<FriendsPage />} />
        <Route path="user/:id" element={<PublicProfilePage />} />
        <Route path="user/:id/followers" element={<FollowersPage />} />
        <Route path="user/:id/following" element={<FollowingPage />} />

        {/* Admin */}
        <Route path="admin" element={<AdminPage />} />
        <Route path="admin/moderation" element={<ModerationPage />} />
        <Route path="admin/users" element={<AdminUsersPage />} />
        <Route path="admin/artists" element={<AdminArtistsPage />} />
        <Route path="admin/artist-avatars" element={<AdminArtistAvatarsPage />} />
        <Route path="admin/support" element={<SupportAdminPage />} />
        <Route path="admin/artists/:id/stats" element={<ArtistStatsPage />} />
        <Route path="admin/content" element={<AdminContentPage />} />
        <Route path="admin/upload" element={<AdminBatchUploadPage />} />
        <Route path="admin/concerts" element={<AdminConcertsPage />} />
        <Route path="admin/concerts/new" element={<AdminConcertEditPage />} />
        <Route path="admin/concerts/edit/:id" element={<AdminConcertEditPage />} />

        {/* Errors */}
        <Route path="404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    {currentAchievement && (
      <AchievementToast
        achievement={currentAchievement}
        onClose={() => setCurrentAchievement(null)}
      />
    )}
    </>
  )
}

export default App
