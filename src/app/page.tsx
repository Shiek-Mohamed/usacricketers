"use client"

import { useAppStore } from "@/lib/store"
import { Header } from "@/components/site/header"
import { Footer } from "@/components/site/footer"
import { HomeView } from "@/components/site/views/home-view"
import { MatchesView } from "@/components/site/views/matches-view"
import { MatchDetailView } from "@/components/site/views/match-detail-view"
import { LiveBlogView } from "@/components/site/views/live-blog-view"
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
import { RankingsView } from "@/components/site/views/rankings-view"
import { BracketPageView } from "@/components/site/views/bracket-view-page"
import { PricingView } from "@/components/site/views/pricing-view"
import { DLSCalculator } from "@/components/cricket/dls-calculator"
import { ScheduleView } from "@/components/site/views/schedule-view"
import { PhotosView } from "@/components/site/views/photos-view"
import { GalleryDetailView } from "@/components/site/views/gallery-detail-view"
import { VideosView } from "@/components/site/views/videos-view"
import { VideoDetailView } from "@/components/site/views/video-detail-view"
import { SearchView } from "@/components/site/views/search-view"
import { FeedbackView } from "@/components/site/views/feedback-view"
import { DashboardView } from "@/components/admin/views/dashboard-view"
import { AdminArticlesView } from "@/components/admin/views/articles-view"
import { AdminMatchesView } from "@/components/admin/views/matches-view"
import { AdminPlayersView } from "@/components/admin/views/players-view"
import { AdminTeamsView } from "@/components/admin/views/teams-view"
import { AdminSeriesView } from "@/components/admin/views/series-view"
import { AdminSidebarView } from "@/components/admin/views/admin-sidebar-view"
import { AdminImportView } from "@/components/admin/views/admin-import-view"
import { AdminImportLeagueView } from "@/components/admin/views/admin-import-league-view"
import { AdminGalleriesView } from "@/components/admin/views/admin-galleries-view"
import { AdminVideosView } from "@/components/admin/views/admin-videos-view"
import { AdminBannersView } from "@/components/admin/views/admin-banners-view"
import { AdminScorerView } from "@/components/admin/views/admin-scorers-view"
import { AdminLeagueAdminsView } from "@/components/admin/views/admin-league-admins-view"
import { AdminFeedbackView } from "@/components/admin/views/admin-feedback-view"
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
import { LeagueAdminTeamsView } from "@/components/site/views/league-admin-teams-view"
import { LeagueAdminPlayersView } from "@/components/site/views/league-admin-players-view"
import { LeagueAdminStandingsView } from "@/components/site/views/league-admin-standings-view"
import { useLeagueAdminSession } from "@/lib/league-admin-session"
import { ViewErrorBoundary } from "@/components/site/view-error-boundary"
import { useEffect } from "react"

export default function Home() {
  const view = useAppStore((s) => s.view)
  const id = useAppStore((s) => s.id)
  const mode = useAppStore((s) => s.mode)
  const session = useScorerSession((s) => s.session)
  const leagueAdminSession = useLeagueAdminSession((s) => s.session)

  // On mount: sync the store with the URL (deep links / refreshes) and
  // seed the browser history so the back button works from the first
  // navigation. Runs once after hydration to avoid SSR mismatch.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlView = params.get("view")
    const urlId = params.get("id")
    if (urlView) {
      // Deep link — set the view without pushing a new history entry.
      useAppStore.getState().setView(urlView as typeof view, urlId)
      window.history.replaceState(
        { view: urlView, id: urlId },
        "",
        window.location.href,
      )
    } else {
      // No view in URL — seed the history state with the current view so
      // popstate has something to restore when the user presses back.
      window.history.replaceState(
        { view, id },
        "",
        window.location.href,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const renderView = () => {
    switch (view) {
      // Public
      case "home":
        return <HomeView />
      case "matches":
        return <MatchesView />
      case "match-detail":
        return <MatchDetailView />
      case "live-blog":
        return <LiveBlogView />
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
      case "rankings":
        return <RankingsView />
      case "bracket":
        return <BracketPageView />
      case "pricing":
        return <PricingView />
      case "dls":
        return <DLSCalculator />
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
      case "feedback":
        return <FeedbackView />
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
      case "admin-import-league":
        return <AdminImportLeagueView />
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
      case "admin-feedback":
        return <AdminFeedbackView />
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
      case "league-admin-teams":
        if (!leagueAdminSession) return <LeagueAdminLoginView />
        return <LeagueAdminTeamsView />
      case "league-admin-players":
        if (!leagueAdminSession) return <LeagueAdminLoginView />
        return <LeagueAdminPlayersView />
      case "league-admin-standings":
        if (!leagueAdminSession) return <LeagueAdminLoginView />
        return <LeagueAdminStandingsView />
      default:
        return <HomeView />
    }
  }

  // Scorer mode: minimal shell, no regular header/footer. The login view is
  // full-screen; everything else (home + live-scorer) renders bare.
  if (mode === "scorer") {
    return (
      <ViewErrorBoundary key={view} label={`scorer:${view}`}>
        {renderView()}
      </ViewErrorBoundary>
    )
  }

  // League admin mode: minimal shell, no regular header/footer. Views wrap
  // themselves in LeagueAdminShell internally (except the login view).
  if (mode === "leagueAdmin") {
    return (
      <ViewErrorBoundary key={view} label={`league-admin:${view}`}>
        {renderView()}
      </ViewErrorBoundary>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
          {/* Per-view error boundary: if a single view crashes during render,
              only this area shows the error card — the header, footer, and
              navigation stay fully usable so the user can click away. */}
          <ViewErrorBoundary key={view} label={view}>
            {renderView()}
          </ViewErrorBoundary>
        </div>
      </main>
      {mode === "public" && <Footer />}
    </div>
  )
}
