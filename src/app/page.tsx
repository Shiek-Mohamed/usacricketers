"use client"

import { useAppStore } from "@/lib/store"
import { Header } from "@/components/site/header"
import { Footer } from "@/components/site/footer"
import { HomeView } from "@/components/site/views/home-view"
import { MatchesView } from "@/components/site/views/matches-view"
import { MatchDetailView } from "@/components/site/views/match-detail-view"
import { NewsView } from "@/components/site/views/news-view"
import { InterviewsView } from "@/components/site/views/interviews-view"
import { ArticleDetailView } from "@/components/site/views/article-detail-view"
import { SeriesView } from "@/components/site/views/series-view"
import { SeriesDetailView } from "@/components/site/views/series-detail-view"
import { TeamsView } from "@/components/site/views/teams-view"
import { TeamDetailView } from "@/components/site/views/team-detail-view"
import { PlayersView } from "@/components/site/views/players-view"
import { PlayerDetailView } from "@/components/site/views/player-detail-view"
import { PlayerTimelineView } from "@/components/site/views/player-timeline-view"
import { PlayerComparisonView } from "@/components/site/views/player-comparison-view"
import { StatsView } from "@/components/site/views/stats-view"
import { ScheduleView } from "@/components/site/views/schedule-view"
import { PhotosView } from "@/components/site/views/photos-view"
import { GalleryDetailView } from "@/components/site/views/gallery-detail-view"
import { VideosView } from "@/components/site/views/videos-view"
import { VideoDetailView } from "@/components/site/views/video-detail-view"
import { SearchView } from "@/components/site/views/search-view"
import { DashboardView } from "@/components/admin/views/dashboard-view"
import { AdminArticlesView } from "@/components/admin/views/articles-view"
import { AdminMatchesView } from "@/components/admin/views/matches-view"
import { AdminPlayersView } from "@/components/admin/views/players-view"
import { AdminTeamsView } from "@/components/admin/views/teams-view"
import { AdminSeriesView } from "@/components/admin/views/series-view"
import { AdminSidebarView } from "@/components/admin/views/admin-sidebar-view"
import { AdminImportView } from "@/components/admin/views/admin-import-view"
import { AdminGalleriesView } from "@/components/admin/views/admin-galleries-view"
import { AdminVideosView } from "@/components/admin/views/admin-videos-view"
import { AdminBannersView } from "@/components/admin/views/admin-banners-view"
import { AdminScorerView } from "@/components/admin/views/admin-scorers-view"
import { AdminLeagueAdminsView } from "@/components/admin/views/admin-league-admins-view"
import { AdminLoginView } from "@/components/site/views/admin-login-view"
import { AdminResetPasswordView } from "@/components/site/views/admin-reset-password-view"
import { LiveScorerView } from "@/components/admin/views/live-scorer-view"
import { ScorerLoginView } from "@/components/site/views/scorer-login-view"
import { ScorerLandingView } from "@/components/site/views/scorer-landing-view"
import { ScorerHomeView } from "@/components/site/views/scorer-home-view"
import { ScorerShell } from "@/components/admin/scorer-shell"
import { useScorerSession } from "@/lib/scorer-session"
import { LeagueAdminLoginView } from "@/components/site/views/league-admin-login-view"
import { LeagueAdminSignupView } from "@/components/site/views/league-admin-signup-view"
import { LeagueAdminHomeView } from "@/components/site/views/league-admin-home-view"
import { LeagueAdminSeriesEditView } from "@/components/site/views/league-admin-series-edit-view"
import { LeagueAdminMatchesView } from "@/components/site/views/league-admin-matches-view"
import { LeagueAdminScorersView } from "@/components/site/views/league-admin-scorers-view"
import { useLeagueAdminSession } from "@/lib/league-admin-session"

export default function Home() {
  const view = useAppStore((s) => s.view)
  const mode = useAppStore((s) => s.mode)
  const session = useScorerSession((s) => s.session)
  const leagueAdminSession = useLeagueAdminSession((s) => s.session)

  const renderView = () => {
    switch (view) {
      // Public
      case "home":
        return <HomeView />
      case "matches":
        return <MatchesView />
      case "match-detail":
        return <MatchDetailView />
      case "news":
        return <NewsView />
      case "interviews":
        return <InterviewsView />
      case "article-detail":
        return <ArticleDetailView />
      case "series":
        return <SeriesView />
      case "series-detail":
        return <SeriesDetailView />
      case "teams":
        return <TeamsView />
      case "team-detail":
        return <TeamDetailView />
      case "players":
        return <PlayersView />
      case "player-detail":
        return <PlayerDetailView />
      case "player-timeline":
        return <PlayerTimelineView />
      case "player-comparison":
        return <PlayerComparisonView />
      case "stats":
        return <StatsView />
      case "schedule":
        return <ScheduleView />
      case "photos":
        return <PhotosView />
      case "gallery-detail":
        return <GalleryDetailView />
      case "videos":
        return <VideosView />
      case "video-detail":
        return <VideoDetailView />
      case "search":
        return <SearchView />
      // Admin
      case "admin-login":
        return <AdminLoginView />
      case "admin-reset-password":
        return <AdminResetPasswordView />
      case "admin-dashboard":
        return <DashboardView />
      case "admin-articles":
        return <AdminArticlesView />
      case "admin-matches":
        return <AdminMatchesView />
      case "admin-players":
        return <AdminPlayersView />
      case "admin-teams":
        return <AdminTeamsView />
      case "admin-series":
        return <AdminSeriesView />
      case "admin-sidebar":
        return <AdminSidebarView />
      case "admin-import":
        return <AdminImportView />
      case "admin-galleries":
        return <AdminGalleriesView />
      case "admin-videos":
        return <AdminVideosView />
      case "admin-banners":
        return <AdminBannersView />
      case "admin-scorers":
        return <AdminScorerView />
      case "admin-league-admins":
        return <AdminLeagueAdminsView />
      // Scorer add-on
      case "live-scorer":
        return <LiveScorerView />
      case "scorer-login":
        return <ScorerLoginView />
      case "scorer-landing":
        return <ScorerLandingView />
      case "scorer-home":
        // Gate on session: if none, show the login screen instead.
        if (!session) return <ScorerLoginView />
        return (
          <ScorerShell title="Select a Match to Score">
            <ScorerHomeView />
          </ScorerShell>
        )
      // League admin add-on (Tier 3)
      case "league-admin-login":
        return <LeagueAdminLoginView />
      case "league-admin-signup":
        return <LeagueAdminSignupView />
      case "league-admin-home":
        if (!leagueAdminSession) return <LeagueAdminLoginView />
        return <LeagueAdminHomeView />
      case "league-admin-series-edit":
        if (!leagueAdminSession) return <LeagueAdminLoginView />
        return <LeagueAdminSeriesEditView />
      case "league-admin-matches":
        if (!leagueAdminSession) return <LeagueAdminLoginView />
        return <LeagueAdminMatchesView />
      case "league-admin-scorers":
        if (!leagueAdminSession) return <LeagueAdminLoginView />
        return <LeagueAdminScorersView />
      default:
        return <HomeView />
    }
  }

  // Scorer mode: minimal shell, no regular header/footer. The login view is
  // full-screen; everything else (home + live-scorer) renders bare.
  if (mode === "scorer") {
    return <>{renderView()}</>
  }

  // League admin mode: minimal shell, no regular header/footer. Views wrap
  // themselves in LeagueAdminShell internally (except the login view).
  if (mode === "leagueAdmin") {
    return <>{renderView()}</>
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
          {renderView()}
        </div>
      </main>
      {mode === "public" && <Footer />}
    </div>
  )
}
