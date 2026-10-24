import { parseBattingStats, parseBowlingStats, parseCategories, parseScorecard } from "./types"
import type { Article, Banner, Gallery, LeagueAdmin, Match, PhotoItem, Player, Scorer, Series, SidebarBlock, SiteAdmin, Team, Video } from "./types"
import type { Prisma } from "@prisma/client"

export function serializeTeam(t: Prisma.TeamGetPayload<Record<string, never>>): Team {
  return {
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    country: t.country,
    primaryColor: t.primaryColor,
    accentColor: t.accentColor,
    description: t.description,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

export function serializePlayer(
  p: Prisma.PlayerGetPayload<{ include: { team: true } }>
): Player {
  return {
    id: p.id,
    name: p.name,
    teamId: p.teamId,
    role: p.role,
    isCaptain: p.isCaptain,
    isKeeper: p.isKeeper,
    battingStyle: p.battingStyle,
    bowlingStyle: p.bowlingStyle,
    battingStats: parseBattingStats(p.battingStats),
    bowlingStats: parseBowlingStats(p.bowlingStats),
    bio: p.bio,
    imageUrl: p.imageUrl,
    team: p.team ? serializeTeam(p.team) : undefined,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

export function serializeSeries(
  s: Prisma.SeriesGetPayload<{ include?: { tournamentTeams?: { include: { team: true } } } }>
): Series {
  return {
    id: s.id,
    name: s.name,
    shortName: s.shortName,
    format: s.format,
    season: s.season,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate.toISOString(),
    status: s.status,
    description: s.description,
    teams: (s as any).tournamentTeams?.map((tt: any) => serializeTeam(tt.team)) ?? [],
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

export function serializeMatch(
  m: Prisma.MatchGetPayload<{ include: { team1: true; team2: true; series: true } }>
): Match {
  return {
    id: m.id,
    seriesId: m.seriesId,
    team1Id: m.team1Id,
    team2Id: m.team2Id,
    format: m.format,
    matchNo: m.matchNo,
    status: m.status,
    venue: m.venue,
    city: m.city,
    startDate: m.startDate.toISOString(),
    result: m.result,
    manOfMatch: m.manOfMatch,
    scorecard: parseScorecard(m.scorecard),
    team1: m.team1 ? serializeTeam(m.team1) : undefined,
    team2: m.team2 ? serializeTeam(m.team2) : undefined,
    series: m.series ? serializeSeries(m.series) : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }
}

export function serializeArticle(a: Prisma.ArticleGetPayload<Record<string, never>>): Article {
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    content: a.content,
    imageUrl: a.imageUrl,
    imageCaption: a.imageCaption,
    categories: parseCategories(a.category),
    author: a.author,
    tags: a.tags,
    featured: a.featured,
    published: a.published,
    publishedAt: a.publishedAt.toISOString(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }
}

export function serializeSidebarBlock(
  b: Prisma.SidebarBlockGetPayload<Record<string, never>>
): SidebarBlock {
  return {
    id: b.id,
    title: b.title,
    content: b.content,
    placement: b.placement,
    order: b.order,
    published: b.published,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }
}

export function serializeGallery(
  g: Prisma.GalleryGetPayload<Record<string, never>>
): Gallery {
  let photos: PhotoItem[] = []
  try {
    photos = JSON.parse(g.photos || "[]")
  } catch {
    photos = []
  }
  return {
    id: g.id,
    title: g.title,
    slug: g.slug,
    description: g.description,
    coverImage: g.coverImage,
    photos,
    published: g.published,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  }
}

export function serializeScorer(
  s: Prisma.ScorerGetPayload<{ include: { assignments: true } }>
): Scorer {
  return {
    id: s.id,
    username: s.username,
    email: s.email,
    name: s.name,
    active: s.active,
    tournamentIds: s.assignments.map((a) => a.seriesId),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

export function serializeVideo(
  v: Prisma.VideoGetPayload<Record<string, never>>
): Video {
  return {
    id: v.id,
    title: v.title,
    slug: v.slug,
    description: v.description,
    source: (v.source as "youtube" | "upload") || "youtube",
    videoUrl: v.videoUrl,
    youtubeId: v.youtubeId,
    thumbnailUrl: v.thumbnailUrl,
    duration: v.duration,
    category: v.category,
    author: v.author,
    tags: v.tags,
    featured: v.featured,
    published: v.published,
    publishedAt: v.publishedAt.toISOString(),
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  }
}

export function serializeLeagueAdmin(
  a: Prisma.LeagueAdminGetPayload<{ include: { assignments: true } }>
): LeagueAdmin {
  return {
    id: a.id,
    username: a.username,
    email: a.email,
    name: a.name,
    active: a.active,
    managedSeriesIds: a.assignments.map((x) => x.seriesId),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }
}

export function serializeSiteAdmin(
  a: Prisma.SiteAdminGetPayload<Record<string, never>>
): SiteAdmin {
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    active: a.active,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }
}


export function serializeBanner(
  b: Prisma.BannerGetPayload<Record<string, never>>
): Banner {
  return {
    id: b.id,
    type: (b.type as Banner["type"]) ?? "image",
    title: b.title,
    placement: b.placement,
    order: b.order,
    published: b.published,
    startDate: b.startDate ? b.startDate.toISOString() : null,
    endDate: b.endDate ? b.endDate.toISOString() : null,
    impressions: b.impressions,
    clicks: b.clicks,
    weight: b.weight,
    imageUrl: b.imageUrl,
    linkUrl: b.linkUrl,
    altText: b.altText,
    adsenseClient: b.adsenseClient,
    adsenseSlot: b.adsenseSlot,
    adsenseFormat: b.adsenseFormat,
    responsive: b.responsive,
    htmlContent: b.htmlContent,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }
}
