import { parseBattingStats, parseBowlingStats, parseScorecard } from "./types"
import type { Article, Match, Player, Series, Team } from "./types"
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

export function serializeSeries(s: Prisma.SeriesGetPayload<Record<string, never>>): Series {
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
    category: a.category,
    author: a.author,
    tags: a.tags,
    featured: a.featured,
    published: a.published,
    publishedAt: a.publishedAt.toISOString(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }
}
