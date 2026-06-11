import Header from './Header'
import Sidebar from './Sidebar'
import SocialSidebar from './SocialSidebar'
import Player from './Player'
import StarField from './StarField'
import { PlayerProvider } from '../hooks/PlayerContext'
import { ThemeProvider } from '../hooks/ThemeContext'
import PageContent from './PageContent'
import { useAuth } from '../hooks/AuthContext'
import { useHeartbeat } from '../hooks/useHeartbeat'

function PresenceSync() {
  useHeartbeat()
  return null
}

export default function Layout() {
  const { isAuthenticated } = useAuth()

  return (
    <PlayerProvider>
      <PresenceSync />
      <ThemeProvider>
        <div className="min-h-screen bg-[#050505] text-white">
          <StarField />
          <div className="relative z-10">
            <Header />
            {isAuthenticated && <SocialSidebar />}
            <main className={`px-4 py-5 max-[414px]:px-3 max-[414px]:py-4 max-[375px]:px-2.5 md:px-6 lg:px-8 pb-32 ${isAuthenticated ? 'lg:pl-20' : ''}`}>
              <div className="mx-auto max-w-7xl">
                <PageContent />
              </div>
            </main>
          </div>
          <Sidebar />
          <Player />
        </div>
      </ThemeProvider>
    </PlayerProvider>
  )
}
