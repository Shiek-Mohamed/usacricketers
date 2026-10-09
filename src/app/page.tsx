"use client"

import { useAppStore } from "@/lib/store"
import { Header } from "@/components/site/header"
import { Footer } from "@/components/site/footer"
import { HomeView } from "@/components/site/views/home-view"
import { MatchesView } from "@/components/site/views/matches-view"
import { MatchDetailView } from "@/components/site/views/match-detail-view"
import { NewsView } from "@/components/site/views/news-view"
import { ArticleDetailView } from "@/components/site/views/article-detail-view"
import { SeriesView } from "@/components/site/views/series-view"
import { SeriesDetailView } from "@/components/site/views/series-detail-view"
import { TeamsView } from "@/components/site/views/teams-view"
import { TeamDetailView } from "@/components/site/views/team-detail-view"
import { PlayersView } from "@/components/site/views/players-view"
import { PlayerDetailView } from "@/components/site/views/player-detail-view"
import { StatsView } from "@/components/site/views/stats-view"
import { ScheduleView } from "@/components/site/views/schedule-view"
import { DashboardView } from "@/components/admin/views/dashboard-view"
import { AdminArticlesView } from "@/components/admin/views/articles-view"
import { AdminMatchesView } from "@/components/admin/views/matches-view"
import { AdminPlayersView } from "@/components/admin/views/players-view"
import { AdminTeamsView } from "@/components/admin/views/teams-view"
import { AdminSeriesView } from "@/components/admin/views/series-view"
import { LiveScorerView } from "@/components/admin/views/live-scorer-view"

export default function Home() {
  const view = useAppStore((s) => s.view)
  const mode = useAppStore((s) => s.mode)

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
      case "stats":
        return <StatsView />
      case "schedule":
        return <ScheduleView />
      // Admin
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
      case "live-scorer":
        return <LiveScorerView />
      default:
        return <HomeView />
    }
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
