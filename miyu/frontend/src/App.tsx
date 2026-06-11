import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import React from 'react'
import Layout from './components/Layout'
import AuthLayout from './components/AuthLayout'
import { useAuth } from './hooks/AuthContext'

// Pages - P0
import HomePage from './pages/HomePage'
import SearchPage from './pages/SearchPage'
import TrackPage from './pages/TrackPage'
import AlbumPage from './pages/AlbumPage'
import ArtistPage from './pages/ArtistPage'
import ProfilePage from './pages/ProfilePage'
import EditProfilePage from './pages/EditProfilePage'
import LikedPage from './pages/LikedPage'
import LikedPlaylistsPage from './pages/LikedPlaylistsPage'
import PlaylistsPage from './pages/PlaylistsPage'
import PlaylistPage from './pages/PlaylistPage'
import HistoryPage from './pages/HistoryPage'
import FavoriteArtistsPage from './pages/FavoriteArtistsPage'
import FavoriteAlbumsPage from './pages/FavoriteAlbumsPage'
import NewReleasesPage from './pages/NewReleasesPage'
import ChartsPage from './pages/ChartsPage'
import PopularArtistsPage from './pages/PopularArtistsPage'
import GenresPage from './pages/GenresPage'
import ArtistDashboardPage from './pages/ArtistDashboardPage'
import ArtistUploadPage from './pages/ArtistUploadPage'
import ArtistTracksPage from './pages/ArtistTracksPage'
import ArtistAlbumsPage from './pages/ArtistAlbumsPage'
import ArtistCreateAlbumPage from './pages/ArtistCreateAlbumPage'
import ArtistCreateConcertPage from './pages/ArtistCreateConcertPage'
import ArtistUploadVideoPage from './pages/ArtistUploadVideoPage'
import ArtistVideosPage from './pages/ArtistVideosPage'
import ArtistConcertsPage from './pages/ArtistConcertsPage'
import PremiumPage from './pages/PremiumPage'
import CheckoutPage from './pages/CheckoutPage'
import GiftPage from './pages/GiftPage'
import VideoPage from './pages/VideoPage'
import ClipsPage from './pages/ClipsPage'
import ModerationPage from './pages/ModerationPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminPage from './pages/AdminPage'
import AdminArtistsPage from './pages/AdminArtistsPage'
import AdminArtistAvatarsPage from './pages/AdminArtistAvatarsPage'
import ArtistStatsPage from './pages/ArtistStatsPage'
import UserStatsPage from './pages/UserStatsPage'
import AchievementsPage from './pages/AchievementsPage'
import AdminAchievementsPage from './pages/AdminAchievementsPage'
import AdminContentPage from './pages/AdminContentPage'
import AdminBatchUploadPage from './pages/AdminBatchUploadPage'
import AdminConcertsPage from './pages/AdminConcertsPage'
import AdminConcertEditPage from './pages/AdminConcertEditPage'
import SupportAdminPage from './pages/SupportAdminPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import NotFoundPage from './pages/NotFoundPage'
import Toast from './components/Toast'
import AchievementToast from './components/AchievementToast'

// Pages - P1
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import BillingPage from './pages/BillingPage'
import SettingsPage from './pages/SettingsPage'
import ConcertsPage from './pages/ConcertsPage'
import ConcertPage from './pages/ConcertPage'
import MyTicketsPage from './pages/MyTicketsPage'
import TicketDetailPage from './pages/TicketDetailPage'
import ConcertTicketsPage from './pages/ConcertTicketsPage'

// Pages - Social
import FeedPage from './pages/FeedPage'
import NotificationsPage from './pages/NotificationsPage'
import FriendsPage from './pages/FriendsPage'
import FollowersPage from './pages/FollowersPage'
import FollowingPage from './pages/FollowingPage'
import PublicProfilePage from './pages/PublicProfilePage'

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

  return <Layout />
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
      <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
      <Route path="/register" element={<AuthLayout><RegisterPage /></AuthLayout>} />
      <Route path="/forgot-password" element={<AuthLayout><ForgotPasswordPage /></AuthLayout>} />

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
